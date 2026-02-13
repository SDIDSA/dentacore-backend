const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { sql } = require('kysely');
const db = require('../config/database');

const router = express.Router();

router.use(authenticate);

// ============================================================================
// INVENTORY ITEMS ROUTES
// ============================================================================

// Get all inventory items
router.get('/items', async (req, res, next) => {
  try {
    const { search, category_id, status, low_stock } = req.query;

    let query = db
      .selectFrom('inventory_items')
      .leftJoin('inventory_categories', 'inventory_items.category_id', 'inventory_categories.id')
      .select(['inventory_items.id'])
      .where('inventory_items.tenant_id', '=', req.tenantId);

    if (search) {
      query = query.where((eb) =>
        eb.or([
          eb('inventory_items.name', 'ilike', `%${search}%`),
          eb('inventory_items.item_code', 'ilike', `%${search}%`),
          eb('inventory_items.description', 'ilike', `%${search}%`)
        ])
      );
    }

    if (category_id) {
      query = query.where('inventory_items.category_id', '=', category_id);
    }

    if (status) {
      query = query.where('inventory_items.status_key', '=', status);
    }

    if (low_stock === 'true') {
      query = query.where('inventory_items.current_stock', '<=', sql`inventory_items.min_stock_level`);
    }

    const items = await query
      .orderBy('inventory_items.created_at', 'desc')
      .execute();

    const itemIds = items.map(item => item.id);
    res.json(itemIds);
  } catch (error) {
    next(error);
  }
});

// Get inventory item by ID
router.get('/items/:id', async (req, res, next) => {
  try {
    const item = await db
      .selectFrom('inventory_items')
      .leftJoin('inventory_categories', 'inventory_items.category_id', 'inventory_categories.id')
      .leftJoin('users as created_user', 'inventory_items.created_by', 'created_user.id')
      .select([
        'inventory_items.id',
        'inventory_items.item_code',
        'inventory_items.name',
        'inventory_items.description',
        'inventory_items.category_id',
        'inventory_items.unit_of_measure',
        'inventory_items.current_stock',
        'inventory_items.min_stock_level',
        'inventory_items.max_stock_level',
        'inventory_items.reorder_point',
        'inventory_items.unit_cost_dzd',
        'inventory_items.selling_price_dzd',
        'inventory_items.expiry_tracking',
        'inventory_items.status_key',
        'inventory_items.notes',
        'inventory_items.created_at',
        'inventory_items.updated_at',
        'inventory_categories.category_key',
        'created_user.full_name as created_by_name',
        sql`(inventory_items.current_stock * inventory_items.unit_cost_dzd)`.as('total_value_dzd')
      ])
      .where('inventory_items.id', '=', req.params.id)
      .where('inventory_items.tenant_id', '=', req.tenantId)
      .executeTakeFirst();

    if (!item) {
      return res.status(404).json({ error: 'inventory.error.item_not_found' });
    }

    res.json(item);
  } catch (error) {
    next(error);
  }
});

// Create inventory item
router.post('/items',
  body('name').trim().notEmpty(),
  body('unit_of_measure').trim().notEmpty(),
  body('unit_cost_dzd').isFloat({ min: 0 }),
  body('min_stock_level').isFloat({ min: 0 }),
  body('current_stock').optional().isFloat({ min: 0 }),
  body('selling_price_dzd').optional().isFloat({ min: 0 }),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const {
        name, description, category_id, unit_of_measure,
        current_stock = 0, min_stock_level, max_stock_level,
        reorder_point, unit_cost_dzd, selling_price_dzd,
        expiry_tracking = false, notes
      } = req.body;

      const item = await db
        .insertInto('inventory_items')
        .values({
          tenant_id: req.tenantId,
          name,
          description: description || null,
          category_id: category_id || null,
          unit_of_measure,
          current_stock,
          min_stock_level,
          max_stock_level: max_stock_level || null,
          reorder_point: reorder_point || null,
          unit_cost_dzd,
          selling_price_dzd: selling_price_dzd || null,
          expiry_tracking,
          notes: notes || null,
          created_by: req.user.id
        })
        .returningAll()
        .executeTakeFirst();

      // Create initial stock movement if current_stock > 0
      if (current_stock > 0) {
        await db
          .insertInto('stock_movements')
          .values({
            tenant_id: req.tenantId,
            inventory_item_id: item.id,
            movement_type: 'stock.movement.adjustment',
            quantity: current_stock,
            unit_cost_dzd,
            reference_type: 'initial_stock',
            notes: 'Initial stock entry',
            created_by: req.user.id
          })
          .execute();
      }

      // Log the creation
      if (req.audit) {
        await req.audit.log({
          action: 'CREATE',
          entityType: 'inventory_items',
          entityId: item.id,
          tenantId: req.tenantId,
          newValues: item
        });
      }

      res.status(201).json(item);
    } catch (error) {
      next(error);
    }
  }
);

// Update inventory item
router.patch('/items/:id',
  body('name').optional().trim().notEmpty(),
  body('unit_cost_dzd').optional().isFloat({ min: 0 }),
  body('min_stock_level').optional().isFloat({ min: 0 }),
  body('selling_price_dzd').optional().isFloat({ min: 0 }),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const {
        name, description, category_id, unit_of_measure,
        min_stock_level, max_stock_level, reorder_point,
        unit_cost_dzd, selling_price_dzd, expiry_tracking,
        status_key, notes
      } = req.body;

      // Get current state for audit logging
      const currentItem = await db
        .selectFrom('inventory_items')
        .selectAll()
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!currentItem) {
        return res.status(404).json({ error: 'inventory.error.item_not_found' });
      }

      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (category_id !== undefined) updateData.category_id = category_id;
      if (unit_of_measure !== undefined) updateData.unit_of_measure = unit_of_measure;
      if (min_stock_level !== undefined) updateData.min_stock_level = min_stock_level;
      if (max_stock_level !== undefined) updateData.max_stock_level = max_stock_level;
      if (reorder_point !== undefined) updateData.reorder_point = reorder_point;
      if (unit_cost_dzd !== undefined) updateData.unit_cost_dzd = unit_cost_dzd;
      if (selling_price_dzd !== undefined) updateData.selling_price_dzd = selling_price_dzd;
      if (expiry_tracking !== undefined) updateData.expiry_tracking = expiry_tracking;
      if (status_key !== undefined) updateData.status_key = status_key;
      if (notes !== undefined) updateData.notes = notes;
      updateData.updated_at = new Date();

      const item = await db
        .updateTable('inventory_items')
        .set(updateData)
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .returningAll()
        .executeTakeFirst();

      // Log the update
      if (req.audit) {
        await req.audit.log({
          action: 'UPDATE',
          entityType: 'inventory_items',
          entityId: item.id,
          tenantId: req.tenantId,
          oldValues: currentItem,
          newValues: item
        });
      }

      res.json(item);
    } catch (error) {
      next(error);
    }
  }
);

// Adjust stock levels
router.post('/items/:id/adjust-stock',
  body('quantity').isFloat(),
  body('reason').trim().notEmpty(),
  body('unit_cost_dzd').optional().isFloat({ min: 0 }),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const { quantity, reason, unit_cost_dzd, batch_number, expiry_date } = req.body;

      const item = await db
        .selectFrom('inventory_items')
        .selectAll()
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!item) {
        return res.status(404).json({ error: 'inventory.error.item_not_found' });
      }

      // Create stock movement
      await db
        .insertInto('stock_movements')
        .values({
          tenant_id: req.tenantId,
          inventory_item_id: item.id,
          movement_type: 'stock.movement.adjustment',
          quantity,
          unit_cost_dzd: unit_cost_dzd || item.unit_cost_dzd,
          reference_type: 'manual_adjustment',
          batch_number: batch_number || null,
          expiry_date: expiry_date || null,
          notes: reason,
          created_by: req.user.id
        })
        .execute();

      // Get updated item
      const updatedItem = await db
        .selectFrom('inventory_items')
        .selectAll()
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      // Log the adjustment
      if (req.audit) {
        await req.audit.log({
          action: 'STOCK_ADJUSTMENT',
          entityType: 'inventory_items',
          entityId: item.id,
          tenantId: req.tenantId,
          oldValues: { current_stock: item.current_stock },
          newValues: { current_stock: updatedItem.current_stock, adjustment: quantity, reason }
        });
      }

      res.json(updatedItem);
    } catch (error) {
      next(error);
    }
  }
);

// Get stock movements for an item
router.get('/items/:id/movements', async (req, res, next) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const movements = await db
      .selectFrom('stock_movements')
      .leftJoin('users', 'stock_movements.created_by', 'users.id')
      .select(['stock_movements.id'])
      .where('stock_movements.inventory_item_id', '=', req.params.id)
      .where('stock_movements.tenant_id', '=', req.tenantId)
      .orderBy('stock_movements.created_at', 'desc')
      .limit(parseInt(limit))
      .offset(parseInt(offset))
      .execute();

    const movementIds = movements.map(movement => movement.id);
    res.json(movementIds);
  } catch (error) {
    next(error);
  }
});

// Get stock movement by ID
router.get('/movements/:id', async (req, res, next) => {
  try {
    const movement = await db
      .selectFrom('stock_movements')
      .leftJoin('users', 'stock_movements.created_by', 'users.id')
      .leftJoin('inventory_items', 'stock_movements.inventory_item_id', 'inventory_items.id')
      .select([
        'stock_movements.id',
        'stock_movements.inventory_item_id',
        'stock_movements.movement_type',
        'stock_movements.quantity',
        'stock_movements.unit_cost_dzd',
        'stock_movements.reference_type',
        'stock_movements.reference_id',
        'stock_movements.batch_number',
        'stock_movements.expiry_date',
        'stock_movements.notes',
        'stock_movements.created_at',
        'users.full_name as created_by_name',
        'inventory_items.name as item_name',
        'inventory_items.item_code'
      ])
      .where('stock_movements.id', '=', req.params.id)
      .where('stock_movements.tenant_id', '=', req.tenantId)
      .executeTakeFirst();

    if (!movement) {
      return res.status(404).json({ error: 'inventory.error.movement_not_found' });
    }

    res.json(movement);
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// INVENTORY CATEGORIES ROUTES
// ============================================================================

// Get all inventory categories
router.get('/categories', async (req, res, next) => {
  try {
    const categories = await db
      .selectFrom('inventory_categories')
      .leftJoin('inventory_categories as parent', 'inventory_categories.parent_id', 'parent.id')
      .select([
        'inventory_categories.id',
        'inventory_categories.category_key',
        'inventory_categories.parent_id',
        'inventory_categories.description',
        'inventory_categories.is_active',
        'inventory_categories.created_at',
        'parent.category_key as parent_category_key',
        sql`CASE WHEN inventory_categories.tenant_id IS NULL THEN true ELSE false END`.as('is_global')
      ])
      .where((eb) => eb.or([
        eb('inventory_categories.tenant_id', 'is', null), // Global categories
        eb('inventory_categories.tenant_id', '=', req.tenantId) // Tenant-specific categories
      ]))
      .where('inventory_categories.is_active', '=', true)
      .orderBy('inventory_categories.category_key')
      .execute();

    res.json(categories);
  } catch (error) {
    next(error);
  }
});

// Create inventory category (tenant-specific)
router.post('/categories',
  body('category_key').trim().notEmpty(),
  body('description').optional().trim(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const { category_key, parent_id, description } = req.body;

      const category = await db
        .insertInto('inventory_categories')
        .values({
          tenant_id: req.tenantId, // Tenant-specific category
          category_key,
          parent_id: parent_id || null,
          description: description || null
        })
        .returningAll()
        .executeTakeFirst();

      // Log the creation
      if (req.audit) {
        await req.audit.log({
          action: 'CREATE',
          entityType: 'inventory_categories',
          entityId: category.id,
          tenantId: req.tenantId,
          newValues: category
        });
      }

      res.status(201).json(category);
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// SUPPLIERS ROUTES
// ============================================================================

// Get all suppliers
router.get('/suppliers', async (req, res, next) => {
  try {
    const { search, status } = req.query;

    let query = db
      .selectFrom('suppliers')
      .leftJoin('wilayas', 'suppliers.wilaya_id', 'wilayas.id')
      .select(['suppliers.id'])
      .where('suppliers.tenant_id', '=', req.tenantId);

    if (search) {
      query = query.where((eb) =>
        eb.or([
          eb('suppliers.name', 'ilike', `%${search}%`),
          eb('suppliers.supplier_code', 'ilike', `%${search}%`),
          eb('suppliers.contact_person', 'ilike', `%${search}%`)
        ])
      );
    }

    if (status) {
      query = query.where('suppliers.status_key', '=', status);
    }

    const suppliers = await query
      .orderBy('suppliers.created_at', 'desc')
      .execute();

    const supplierIds = suppliers.map(supplier => supplier.id);
    res.json(supplierIds);
  } catch (error) {
    next(error);
  }
});

// Get supplier by ID
router.get('/suppliers/:id', async (req, res, next) => {
  try {
    const supplier = await db
      .selectFrom('suppliers')
      .leftJoin('wilayas', 'suppliers.wilaya_id', 'wilayas.id')
      .leftJoin('users as created_user', 'suppliers.created_by', 'created_user.id')
      .select([
        'suppliers.id',
        'suppliers.supplier_code',
        'suppliers.name',
        'suppliers.contact_person',
        'suppliers.email',
        'suppliers.phone',
        'suppliers.wilaya_id',
        'suppliers.address',
        'suppliers.tax_id',
        'suppliers.payment_terms_days',
        'suppliers.status_key',
        'suppliers.notes',
        'suppliers.created_at',
        'suppliers.updated_at',
        'wilayas.name_key as wilaya_name_key',
        'created_user.full_name as created_by_name'
      ])
      .where('suppliers.id', '=', req.params.id)
      .where('suppliers.tenant_id', '=', req.tenantId)
      .executeTakeFirst();

    if (!supplier) {
      return res.status(404).json({ error: 'inventory.error.supplier_not_found' });
    }

    res.json(supplier);
  } catch (error) {
    next(error);
  }
});

// Create supplier
router.post('/suppliers',
  body('name').trim().notEmpty(),
  body('phone').optional().matches(/^\+213[0-9]{9}$/),
  body('email').optional().isEmail(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const {
        name, contact_person, email, phone, wilaya_id,
        address, tax_id, payment_terms_days = 30, notes
      } = req.body;

      const supplier = await db
        .insertInto('suppliers')
        .values({
          tenant_id: req.tenantId,
          name,
          contact_person: contact_person || null,
          email: email || null,
          phone: phone || null,
          wilaya_id: wilaya_id || null,
          address: address || null,
          tax_id: tax_id || null,
          payment_terms_days,
          notes: notes || null,
          created_by: req.user.id
        })
        .returningAll()
        .executeTakeFirst();

      // Log the creation
      if (req.audit) {
        await req.audit.log({
          action: 'CREATE',
          entityType: 'suppliers',
          entityId: supplier.id,
          tenantId: req.tenantId,
          newValues: supplier
        });
      }

      res.status(201).json(supplier);
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// DASHBOARD/REPORTS ROUTES
// ============================================================================

// Get low stock items
router.get('/reports/low-stock', async (req, res, next) => {
  try {
    const lowStockItems = await db
      .selectFrom('v_low_stock_items')
      .selectAll()
      .where('tenant_id', '=', req.tenantId)
      .execute();

    res.json(lowStockItems);
  } catch (error) {
    next(error);
  }
});

// Get inventory valuation
router.get('/reports/valuation', async (req, res, next) => {
  try {
    const valuation = await db
      .selectFrom('v_inventory_valuation')
      .selectAll()
      .where('tenant_id', '=', req.tenantId)
      .execute();

    const totalValue = valuation.reduce((sum, item) => sum + parseFloat(item.total_value_dzd || 0), 0);

    res.json({
      items: valuation,
      summary: {
        total_items: valuation.length,
        total_value_dzd: totalValue
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get inventory summary stats
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await db
      .selectFrom('inventory_items')
      .select([
        sql`COUNT(*)`.as('total_items'),
        sql`COUNT(*) FILTER (WHERE status_key = 'item.status.active')`.as('active_items'),
        sql`COUNT(*) FILTER (WHERE current_stock <= min_stock_level)`.as('low_stock_items'),
        sql`SUM(current_stock * unit_cost_dzd)`.as('total_inventory_value_dzd'),
        sql`AVG(current_stock * unit_cost_dzd)`.as('avg_item_value_dzd')
      ])
      .where('tenant_id', '=', req.tenantId)
      .executeTakeFirst();

    res.json(stats);
  } catch (error) {
    next(error);
  }
});

module.exports = router;