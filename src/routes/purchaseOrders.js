const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const conflictResolution = require('../middleware/conflictResolution');
const { sql } = require('kysely');
const db = require('../config/database');
const { parsePagination, wrapPaginatedResponse } = require('../utils/paginate');

const router = express.Router();

router.use(authenticate);
router.use(conflictResolution);

const VALID_STATUSES = [
  'po.status.draft', 'po.status.pending_approval', 'po.status.approved',
  'po.status.sent', 'po.status.partially_received', 'po.status.received',
  'po.status.cancelled'
];

const TRANSITIONAL_STATUSES = [
  'po.status.pending_approval', 'po.status.approved',
  'po.status.sent', 'po.status.cancelled'
];

// List purchase order IDs with filters
router.get('/', async (req, res, next) => {
  try {
    const pag = parsePagination(req);
    const { supplier_id, status_key, start_date, end_date } = req.query;

    let query = db
      .selectFrom('purchase_orders')
      .select(['purchase_orders.id'])
      .where('purchase_orders.tenant_id', '=', req.tenantId);

    if (supplier_id) {
      query = query.where('purchase_orders.supplier_id', '=', supplier_id);
    }
    if (status_key) {
      query = query.where('purchase_orders.status_key', '=', status_key);
    }
    if (start_date) {
      query = query.where('purchase_orders.order_date', '>=', start_date);
    }
    if (end_date) {
      query = query.where('purchase_orders.order_date', '<=', end_date + ' 23:59:59');
    }

    if (pag.paginate) {
      query = query.select([sql`COUNT(*) OVER()`.as('count')]);
    }

    const orders = await query
      .orderBy('purchase_orders.order_date', 'desc')
      .limit(pag.paginate ? pag.limit : null)
      .offset(pag.paginate ? pag.offset : null)
      .execute();

    const orderIds = orders.map(o => o.id);
    if (pag.paginate) {
      const count = orders.length > 0 ? Number(orders[0].count) : 0;
      res.json(wrapPaginatedResponse(orderIds, count, pag.limit, pag.offset));
    } else {
      res.json(orderIds);
    }
  } catch (error) {
    next(error);
  }
});

// Get purchase orders by IDs (batch)
router.get('/batch', async (req, res, next) => {
  try {
    const { ids } = req.query;
    if (!ids) {
      return res.status(400).json({ error: 'ids query parameter is required' });
    }

    const idArray = ids.split(',').map(id => id.trim()).filter(id => id.length > 0);
    if (idArray.length === 0) {
      return res.json([]);
    }

    const orders = await db
      .selectFrom('purchase_orders')
      .leftJoin('suppliers', 'purchase_orders.supplier_id', 'suppliers.id')
      .leftJoin('users as creator', 'purchase_orders.created_by', 'creator.id')
      .leftJoin('users as approver', 'purchase_orders.approved_by', 'approver.id')
      .select([
        'purchase_orders.id',
        'purchase_orders.po_number',
        'purchase_orders.supplier_id',
        'suppliers.name as supplier_name',
        'purchase_orders.order_date',
        'purchase_orders.expected_delivery_date',
        'purchase_orders.actual_delivery_date',
        'purchase_orders.subtotal_dzd',
        'purchase_orders.tax_dzd',
        'purchase_orders.shipping_dzd',
        'purchase_orders.total_dzd',
        'purchase_orders.status_key',
        'purchase_orders.notes',
        'purchase_orders.created_by',
        'creator.full_name as created_by_name',
        'purchase_orders.approved_by',
        'approver.full_name as approved_by_name',
        'purchase_orders.approved_at',
        'purchase_orders.created_at',
        'purchase_orders.updated_at'
      ])
      .where('purchase_orders.id', 'in', idArray)
      .where('purchase_orders.tenant_id', '=', req.tenantId)
      .execute();

    res.json(orders);
  } catch (error) {
    next(error);
  }
});

// Get purchase order by ID (with items)
router.get('/:id',
  param('id').isUUID(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'validation.error', details: errors.array() });
      }

      let order = await db
        .selectFrom('purchase_orders')
        .leftJoin('suppliers', 'purchase_orders.supplier_id', 'suppliers.id')
        .leftJoin('users as creator', 'purchase_orders.created_by', 'creator.id')
        .leftJoin('users as approver', 'purchase_orders.approved_by', 'approver.id')
        .select([
          'purchase_orders.id',
          'purchase_orders.po_number',
          'purchase_orders.supplier_id',
          'suppliers.name as supplier_name',
          'purchase_orders.order_date',
          'purchase_orders.expected_delivery_date',
          'purchase_orders.actual_delivery_date',
          'purchase_orders.subtotal_dzd',
          'purchase_orders.tax_dzd',
          'purchase_orders.shipping_dzd',
          'purchase_orders.total_dzd',
          'purchase_orders.status_key',
          'purchase_orders.notes',
          'purchase_orders.created_by',
          'creator.full_name as created_by_name',
          'purchase_orders.approved_by',
          'approver.full_name as approved_by_name',
          'purchase_orders.approved_at',
          'purchase_orders.created_at',
          'purchase_orders.updated_at'
        ])
        .where('purchase_orders.id', '=', req.params.id)
        .where('purchase_orders.tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!order) {
        order = (await db
          .selectFrom('audit_logs')
          .select('old_values')
          .where('entity_type', '=', 'purchase_orders')
          .where('action', '=', 'DELETE')
          .where('entity_id', '=', req.params.id)
          .where('tenant_id', '=', req.tenantId)
          .executeTakeFirst())?.old_values;

        if (!order) {
          return res.status(404).json({ error: 'po.error.not_found' });
        }
      }

      const items = await db
        .selectFrom('purchase_order_items')
        .leftJoin('inventory_items', 'purchase_order_items.inventory_item_id', 'inventory_items.id')
        .select([
          'purchase_order_items.id',
          'purchase_order_items.inventory_item_id',
          'inventory_items.item_code',
          'inventory_items.name as item_name',
          'purchase_order_items.quantity_ordered',
          'purchase_order_items.quantity_received',
          'purchase_order_items.unit_cost_dzd',
          'purchase_order_items.total_cost_dzd',
          'purchase_order_items.expiry_date',
          'purchase_order_items.batch_number',
          'purchase_order_items.notes'
        ])
        .where('purchase_order_items.purchase_order_id', '=', order.id)
        .where('purchase_order_items.tenant_id', '=', req.tenantId)
        .execute();

      res.json({ ...order, items });
    } catch (error) {
      next(error);
    }
  }
);

// Create purchase order with items
router.post('/',
  body('supplier_id').isUUID(),
  body('expected_delivery_date').optional({ values: 'null' }).isISO8601(),
  body('tax_dzd').optional().isFloat({ min: 0 }),
  body('shipping_dzd').optional().isFloat({ min: 0 }),
  body('notes').optional().isString(),
  body('items').isArray({ min: 1 }),
  body('items.*.inventory_item_id').isUUID(),
  body('items.*.quantity_ordered').isFloat({ min: 0.001 }),
  body('items.*.unit_cost_dzd').isFloat({ min: 0 }),
  body('items.*.expiry_date').optional({ values: 'null' }).isISO8601(),
  body('items.*.batch_number').optional().isString(),
  body('items.*.notes').optional().isString(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const {
        supplier_id, expected_delivery_date,
        tax_dzd, shipping_dzd, notes, items
      } = req.body;

      const subtotal = items.reduce(
        (sum, item) => sum + item.quantity_ordered * item.unit_cost_dzd, 0);
      const tax = tax_dzd || 0;
      const shipping = shipping_dzd || 0;
      const total = subtotal + tax + shipping;

      const order = await db
        .insertInto('purchase_orders')
        .values({
          supplier_id,
          expected_delivery_date: expected_delivery_date || null,
          subtotal_dzd: subtotal,
          tax_dzd: tax,
          shipping_dzd: shipping,
          total_dzd: total,
          notes: notes || null,
          created_by: req.user.id,
          tenant_id: req.tenantId
        })
        .returningAll()
        .executeTakeFirst();

      const orderItems = [];
      for (const item of items) {
        const totalCost = item.quantity_ordered * item.unit_cost_dzd;
        const inserted = await db
          .insertInto('purchase_order_items')
          .values({
            purchase_order_id: order.id,
            inventory_item_id: item.inventory_item_id,
            quantity_ordered: item.quantity_ordered,
            unit_cost_dzd: item.unit_cost_dzd,
            total_cost_dzd: totalCost,
            expiry_date: item.expiry_date || null,
            batch_number: item.batch_number || null,
            notes: item.notes || null,
            tenant_id: req.tenantId
          })
          .returningAll()
          .executeTakeFirst();
        orderItems.push(inserted);
      }

      if (req.audit) {
        await req.audit.log({
          action: 'CREATE',
          entityType: 'purchase_orders',
          entityId: order.id,
          tenantId: req.tenantId,
          newValues: { ...order, items: orderItems }
        }, db);
      }

      res.status(201).json({ ...order, items: orderItems });
    } catch (error) {
      next(error);
    }
  }
);

// Update purchase order status
router.patch('/:id/status',
  param('id').isUUID(),
  body('status_key').isIn(TRANSITIONAL_STATUSES),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const current = await db
        .selectFrom('purchase_orders')
        .selectAll()
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!current) {
        return res.status(404).json({ error: 'po.error.not_found' });
      }

      if (res.conflictCheck(current)) return;

      const { status_key } = req.body;
      const updateData = { status_key, updated_at: new Date() };

      if (status_key === 'po.status.approved') {
        updateData.approved_by = req.user.id;
        updateData.approved_at = new Date();
      }

      const updated = await db
        .updateTable('purchase_orders')
        .set(updateData)
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .returningAll()
        .executeTakeFirst();

      if (req.audit) {
        await req.audit.log({
          action: 'UPDATE_STATUS',
          entityType: 'purchase_orders',
          entityId: updated.id,
          tenantId: req.tenantId,
          oldValues: { status_key: current.status_key },
          newValues: { status_key }
        }, db);
      }

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

// Receive items (partial or full)
router.patch('/:id/receive',
  param('id').isUUID(),
  body('items').isArray({ min: 1 }),
  body('items.*.item_id').isUUID(),
  body('items.*.quantity_received').isFloat({ min: 0 }),
  body('actual_delivery_date').optional({ values: 'null' }).isISO8601(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const order = await db
        .selectFrom('purchase_orders')
        .selectAll()
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!order) {
        return res.status(404).json({ error: 'po.error.not_found' });
      }

      if (res.conflictCheck(order)) return;

      if (order.status_key === 'po.status.cancelled' || order.status_key === 'po.status.draft') {
        return res.status(400).json({ error: 'po.error.invalid_status' });
      }

      const { items, actual_delivery_date } = req.body;

      for (const incoming of items) {
        const existing = await db
          .selectFrom('purchase_order_items')
          .selectAll()
          .where('id', '=', incoming.item_id)
          .where('purchase_order_id', '=', order.id)
          .where('tenant_id', '=', req.tenantId)
          .executeTakeFirst();

        if (!existing) {
          return res.status(404).json({
            error: 'po.error.item_not_found',
            details: `Item ${incoming.item_id} not found on this order`
          });
        }

        if (incoming.quantity_received > existing.quantity_ordered - existing.quantity_received) {
          return res.status(400).json({
            error: 'po.error.quantity_exceeds',
            details: `Cannot receive more than ordered for item ${incoming.item_id}`
          });
        }

        const newReceived = existing.quantity_received + incoming.quantity_received;
        await db
          .updateTable('purchase_order_items')
          .set({
            quantity_received: newReceived,
            total_cost_dzd: newReceived * existing.unit_cost_dzd
          })
          .where('id', '=', existing.id)
          .where('tenant_id', '=', req.tenantId)
          .execute();

        // Create stock movement for received items
        await db
          .insertInto('stock_movements')
          .values({
            inventory_item_id: existing.inventory_item_id,
            movement_type: 'stock.movement.purchase',
            quantity: incoming.quantity_received,
            unit_cost_dzd: existing.unit_cost_dzd,
            reference_type: 'purchase_order',
            reference_id: order.id,
            batch_number: existing.batch_number,
            expiry_date: existing.expiry_date,
            notes: `Received from PO ${order.po_number}`,
            created_by: req.user.id,
            tenant_id: req.tenantId
          })
          .execute();
      }

      // Check if all items are fully received to update PO status
      const remainingItems = await db
        .selectFrom('purchase_order_items')
        .select([
          'purchase_order_items.id',
          'purchase_order_items.quantity_ordered',
          'purchase_order_items.quantity_received'
        ])
        .where('purchase_order_items.purchase_order_id', '=', order.id)
        .where('purchase_order_items.tenant_id', '=', req.tenantId)
        .execute();

      const allReceived = remainingItems.every(
        item => item.quantity_received >= item.quantity_ordered
      );
      const anyReceived = remainingItems.some(
        item => item.quantity_received > 0
      );

      const updateData = { updated_at: new Date() };
      if (actual_delivery_date) {
        updateData.actual_delivery_date = actual_delivery_date;
      }

      if (allReceived) {
        updateData.status_key = 'po.status.received';
      } else if (anyReceived) {
        updateData.status_key = 'po.status.partially_received';
      }

      await db
        .updateTable('purchase_orders')
        .set(updateData)
        .where('id', '=', order.id)
        .where('tenant_id', '=', req.tenantId)
        .execute();

      const updated = await db
        .selectFrom('purchase_orders')
        .selectAll()
        .where('id', '=', order.id)
        .executeTakeFirst();

      if (req.audit) {
        await req.audit.log({
          action: 'RECEIVE_ITEMS',
          entityType: 'purchase_orders',
          entityId: updated.id,
          tenantId: req.tenantId,
          oldValues: { status_key: order.status_key },
          newValues: { status_key: updated.status_key, items_received: items }
        }, db);
      }

      // Fetch full response with items
      const orderItems = await db
        .selectFrom('purchase_order_items')
        .leftJoin('inventory_items', 'purchase_order_items.inventory_item_id', 'inventory_items.id')
        .select([
          'purchase_order_items.id',
          'purchase_order_items.inventory_item_id',
          'inventory_items.item_code',
          'inventory_items.name as item_name',
          'purchase_order_items.quantity_ordered',
          'purchase_order_items.quantity_received',
          'purchase_order_items.unit_cost_dzd',
          'purchase_order_items.total_cost_dzd',
          'purchase_order_items.expiry_date',
          'purchase_order_items.batch_number',
          'purchase_order_items.notes'
        ])
        .where('purchase_order_items.purchase_order_id', '=', order.id)
        .where('purchase_order_items.tenant_id', '=', req.tenantId)
        .execute();

      res.json({ ...updated, items: orderItems });
    } catch (error) {
      next(error);
    }
  }
);

// Delete purchase order (only if draft)
router.delete('/:id',
  param('id').isUUID(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'validation.error', details: errors.array() });
      }

      const order = await db
        .selectFrom('purchase_orders')
        .selectAll()
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!order) {
        return res.status(404).json({ error: 'po.error.not_found' });
      }

      if (order.status_key !== 'po.status.draft') {
        return res.status(400).json({ error: 'po.error.cannot_delete' });
      }

      await db
        .deleteFrom('purchase_order_items')
        .where('purchase_order_id', '=', order.id)
        .where('tenant_id', '=', req.tenantId)
        .execute();

      await db
        .deleteFrom('purchase_orders')
        .where('id', '=', order.id)
        .where('tenant_id', '=', req.tenantId)
        .execute();

      if (req.audit) {
        await req.audit.log({
          action: 'DELETE',
          entityType: 'purchase_orders',
          entityId: req.params.id,
          tenantId: req.tenantId,
          oldValues: order
        }, db);
      }

      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
