const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const conflictResolution = require('../middleware/conflictResolution');
const { sql } = require('kysely');
const db = require('../config/database');
const { parsePagination, wrapPaginatedResponse } = require('../utils/paginate');
const { checkLowStockAndNotify } = require('../services/notificationService');

const router = express.Router();

router.use(authenticate);
router.use(conflictResolution);

// ============================================================================
// INVENTORY ITEMS ROUTES
// ============================================================================

// Get all inventory items
router.get('/items', async (req, res, next) => {
  try {
    const pag = parsePagination(req);
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

    if (pag.paginate) {
      query = query.select([sql`COUNT(*) OVER()`.as('count')]);
    }

    const items = await query
      .orderBy('inventory_items.created_at', 'desc')
      .limit(pag.paginate ? pag.limit : null)
      .offset(pag.paginate ? pag.offset : null)
      .execute();

    const itemIds = items.map(item => item.id);
    if (pag.paginate) {
      const count = items.length > 0 ? Number(items[0].count) : 0;
      res.json(wrapPaginatedResponse(itemIds, count, pag.limit, pag.offset));
    } else {
      res.json(itemIds);
    }
  } catch (error) {
    next(error);
  }
});

// Get inventory items by IDs (batch)
router.get('/items/batch', async (req, res, next) => {
  try {
    const { ids } = req.query;
    if (!ids) {
      return res.status(400).json({ error: 'ids query parameter is required' });
    }

    const idArray = ids.split(',').map(id => id.trim()).filter(id => id.length > 0);
    if (idArray.length === 0) {
      return res.json([]);
    }

    const items = await db
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
      .where('inventory_items.id', 'in', idArray)
      .where('inventory_items.tenant_id', '=', req.tenantId)
      .execute();

    res.json(items);
  } catch (error) {
    next(error);
  }
});

// Get inventory item by ID
router.get('/items/:id', async (req, res, next) => {
  try {
    let item = await db
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
      item = (await db
        .selectFrom('audit_logs')
        .select('old_values')
        .where('entity_type', '=', 'inventory_items')
        .where('action', '=', 'DELETE')
        .where('entity_id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst())?.old_values;

      if (!item) {
        return res.status(404).json({ error: 'inventory.error.item_not_found' });
      }
    }

    res.json(item);
  } catch (error) {
    next(error);
  }
});

// Search inventory items
router.get('/items/search', async (req, res, next) => {
  try {
    const { search: query } = req.query;
    if (!query || query.trim().length === 0) {
      return res.json([]);
    }

    const sanitized = query.replace(/[^a-zA-Z0-9\s\-]/g, '');
    const results = await db
      .selectFrom('inventory_items')
      .select('inventory_items.id')
      .where('inventory_items.tenant_id', '=', req.tenantId)
      .where((eb) =>
        eb.or([
          eb('inventory_items.name', 'ilike', `%${sanitized}%`),
          eb('inventory_items.item_code', 'ilike', `%${sanitized}%`),
        ])
      )
      .limit(20)
      .execute();

    res.json(results.map(r => r.id));
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
  body('category_id').optional().isUUID(),
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

      const result = await db
        .insertInto('inventory_items')
        .values({
          tenant_id: req.tenantId,
          name,
          description: description || null,
          category_id: category_id || null,
          unit_of_measure,
          current_stock: 0,
          min_stock_level,
          max_stock_level: max_stock_level || null,
          reorder_point: reorder_point || null,
          unit_cost_dzd,
          selling_price_dzd: selling_price_dzd || null,
          expiry_tracking,
          notes: notes || null,
          created_by: req.user.id
        })
        .returning('id')
        .executeTakeFirst();

      // Create initial stock movement if current_stock > 0
      // (trigger adds the quantity to current_stock, so we start at 0)
      if (current_stock > 0) {
        await db
          .insertInto('stock_movements')
          .values({
            tenant_id: req.tenantId,
            inventory_item_id: result.id,
            movement_type: 'stock.movement.adjustment',
            quantity: current_stock,
            unit_cost_dzd,
            reference_type: 'initial_stock',
            notes: 'Initial stock entry',
            created_by: req.user.id
          })
          .execute();
      }

      // Re-fetch to get the real stock level (after trigger has run)
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
        .where('inventory_items.id', '=', result.id)
        .where('inventory_items.tenant_id', '=', req.tenantId)
        .executeTakeFirst();

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

      checkLowStockAndNotify(req.tenantId, item.id).catch(() => {});

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

      if (res.conflictCheck(currentItem)) return;

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

      checkLowStockAndNotify(req.tenantId, item.id).catch(() => {});

      res.json(item);
    } catch (error) {
      next(error);
    }
  }
);

// Delete inventory item
router.delete('/items/:id',
  param('id').isUUID(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'validation.error', details: errors.array() });
      }

      const item = await db
        .selectFrom('inventory_items')
        .selectAll()
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!item) {
        return res.status(404).json({ error: 'inventory.error.item_not_found' });
      }

      await db
        .deleteFrom('inventory_items')
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .execute();

      item.status_key = 'inventory_item.status.deleted';

      if (req.audit) {
        await req.audit.log({
          action: 'DELETE',
          entityType: 'inventory_items',
          entityId: req.params.id,
          tenantId: req.tenantId,
          oldValues: item
        });
      }

      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }
);

// Adjust stock levels
router.post('/items/:id/adjust-stock',
  body('quantity').isFloat({ min: -999999 }),
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

      checkLowStockAndNotify(req.tenantId, item.id).catch(() => {});

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
    const pag = parsePagination(req);

    let query = db
      .selectFrom('inventory_categories')
      .select(['inventory_categories.id'])
      .where((eb) => eb.or([
        eb('inventory_categories.tenant_id', 'is', null),
        eb('inventory_categories.tenant_id', '=', req.tenantId)
      ]))
      .where('inventory_categories.is_active', '=', true);

    if (pag.paginate) {
      query = query.select([sql`COUNT(*) OVER()`.as('count')]);
    }

    const cats = await query
      .orderBy('inventory_categories.category_key')
      .limit(pag.paginate ? pag.limit : null)
      .offset(pag.paginate ? pag.offset : null)
      .execute();

    const categoryIds = cats.map(c => c.id);
    if (pag.paginate) {
      const count = cats.length > 0 ? Number(cats[0].count) : 0;
      res.json(wrapPaginatedResponse(categoryIds, count, pag.limit, pag.offset));
    } else {
      res.json(categoryIds);
    }
  } catch (error) {
    next(error);
  }
});

// Get inventory categories by IDs (batch)
router.get('/categories/batch', async (req, res, next) => {
  try {
    const { ids } = req.query;
    if (!ids) {
      return res.status(400).json({ error: 'ids query parameter is required' });
    }

    const idArray = ids.split(',').map(id => id.trim()).filter(id => id.length > 0);
    if (idArray.length === 0) {
      return res.json([]);
    }

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
      .where('inventory_categories.id', 'in', idArray)
      .where((eb) => eb.or([
        eb('inventory_categories.tenant_id', 'is', null),
        eb('inventory_categories.tenant_id', '=', req.tenantId)
      ]))
      .execute();

    res.json(categories);
  } catch (error) {
    next(error);
  }
});

// Get inventory category by ID
router.get('/categories/:id', async (req, res, next) => {
  try {
    let category = await db
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
      .where('inventory_categories.id', '=', req.params.id)
      .where((eb) => eb.or([
        eb('inventory_categories.tenant_id', 'is', null),
        eb('inventory_categories.tenant_id', '=', req.tenantId)
      ]))
      .executeTakeFirst();

    if (!category) {
      category = (await db
        .selectFrom('audit_logs')
        .select('old_values')
        .where('entity_type', '=', 'inventory_categories')
        .where('action', '=', 'DELETE')
        .where('entity_id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst())?.old_values;

      if (!category) {
        return res.status(404).json({ error: 'not_found' });
      }
    }

    res.json(category);
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

// Update inventory category (tenant-specific)
router.patch('/categories/:id',
  body('category_key').optional().trim().notEmpty(),
  body('description').optional().trim(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const { category_key, parent_id, description, is_active } = req.body;

      const currentCategory = await db
        .selectFrom('inventory_categories')
        .selectAll()
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!currentCategory) {
        return res.status(404).json({ error: 'inventory.error.category_not_found' });
      }

      if (res.conflictCheck(currentCategory)) return;

      const updateData = {};
      if (category_key !== undefined) updateData.category_key = category_key;
      // Allow parent_id to be set to null if explicitly provided
      if (parent_id !== undefined) updateData.parent_id = parent_id;
      if (description !== undefined) updateData.description = description;
      if (is_active !== undefined) updateData.is_active = is_active;
      updateData.updated_at = new Date();

      const category = await db
        .updateTable('inventory_categories')
        .set(updateData)
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .returningAll()
        .executeTakeFirst();

      if (req.audit) {
        await req.audit.log({
          action: 'UPDATE',
          entityType: 'inventory_categories',
          entityId: category.id,
          tenantId: req.tenantId,
          oldValues: currentCategory,
          newValues: category
        });
      }

      res.json(category);
    } catch (error) {
      next(error);
    }
  }
);

// Delete inventory category (tenant-specific only)
router.delete('/categories/:id',
  param('id').isUUID(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'validation.error', details: errors.array() });
      }

      const category = await db
        .selectFrom('inventory_categories')
        .selectAll()
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId) // Only allow deleting tenant-specific categories
        .executeTakeFirst();

      if (!category) {
        return res.status(404).json({ error: 'inventory.error.category_not_found' });
      }

      // Check if category is being used by any items
      const hasItems = await db
        .selectFrom('inventory_items')
        .select('id')
        .where('category_id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (hasItems) {
        return res.status(400).json({ error: 'inventory.error.category_has_items' });
      }

      // Check if category has sub-categories
      const hasSubCategories = await db
        .selectFrom('inventory_categories')
        .select('id')
        .where('parent_id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (hasSubCategories) {
        return res.status(400).json({ error: 'inventory.error.category_has_subcategories' });
      }

      await db
        .deleteFrom('inventory_categories')
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .execute();

      category.status_key = 'inventory_category.status.deleted';

      // Log the deletion
      if (req.audit) {
        await req.audit.log({
          action: 'DELETE',
          entityType: 'inventory_categories',
          entityId: req.params.id,
          tenantId: req.tenantId,
          oldValues: category
        });
      }

      res.status(204).end();
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
    const pag = parsePagination(req);
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

    if (pag.paginate) {
      query = query.select([sql`COUNT(*) OVER()`.as('count')]);
    }

    const suppliers = await query
      .orderBy('suppliers.created_at', 'desc')
      .limit(pag.paginate ? pag.limit : null)
      .offset(pag.paginate ? pag.offset : null)
      .execute();

    const supplierIds = suppliers.map(supplier => supplier.id);
    if (pag.paginate) {
      const count = suppliers.length > 0 ? Number(suppliers[0].count) : 0;
      res.json(wrapPaginatedResponse(supplierIds, count, pag.limit, pag.offset));
    } else {
      res.json(supplierIds);
    }
  } catch (error) {
    next(error);
  }
});

// Get suppliers by IDs (batch)
router.get('/suppliers/batch', async (req, res, next) => {
  try {
    const { ids } = req.query;
    if (!ids) {
      return res.status(400).json({ error: 'ids query parameter is required' });
    }

    const idArray = ids.split(',').map(id => id.trim()).filter(id => id.length > 0);
    if (idArray.length === 0) {
      return res.json([]);
    }

    const suppliers = await db
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
        'suppliers.payment_terms_days',
        'suppliers.status_key',
        'suppliers.notes',
        'suppliers.created_at',
        'suppliers.updated_at',
        'wilayas.name_key as wilaya_name_key',
        'created_user.full_name as created_by_name'
      ])
      .where('suppliers.id', 'in', idArray)
      .where('suppliers.tenant_id', '=', req.tenantId)
      .execute();

    res.json(suppliers);
  } catch (error) {
    next(error);
  }
});

// Get supplier by ID
router.get('/suppliers/:id', async (req, res, next) => {
  try {
    let supplier = await db
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
      supplier = (await db
        .selectFrom('audit_logs')
        .select('old_values')
        .where('entity_type', '=', 'suppliers')
        .where('action', '=', 'DELETE')
        .where('entity_id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst())?.old_values;

      if (!supplier) {
        return res.status(404).json({ error: 'inventory.error.supplier_not_found' });
      }
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
        address, payment_terms_days = 30, notes
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
          payment_terms_days,
          notes: notes || null,
          created_by: req.user.id
        })
        .returningAll()
        .executeTakeFirst();

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

// Update supplier
router.patch('/suppliers/:id',
  body('name').optional().trim().notEmpty(),
  body('phone').optional().matches(/^\+213[0-9]{9}$/),
  body('email').optional().isEmail(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const { name, contact_person, email, phone, address, payment_terms_days, notes, status_key } = req.body;

      const currentSupplier = await db
        .selectFrom('suppliers')
        .selectAll()
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!currentSupplier) {
        return res.status(404).json({ error: 'inventory.error.supplier_not_found' });
      }

      if (res.conflictCheck(currentSupplier)) return;

      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (contact_person !== undefined) updateData.contact_person = contact_person;
      if (email !== undefined) updateData.email = email;
      if (phone !== undefined) updateData.phone = phone;
      if (address !== undefined) updateData.address = address;
      if (payment_terms_days !== undefined) updateData.payment_terms_days = payment_terms_days;
      if (notes !== undefined) updateData.notes = notes;
      if (status_key !== undefined) updateData.status_key = status_key;
      updateData.updated_at = new Date();

      const supplier = await db
        .updateTable('suppliers')
        .set(updateData)
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .returningAll()
        .executeTakeFirst();

      if (req.audit) {
        await req.audit.log({
          action: 'UPDATE',
          entityType: 'suppliers',
          entityId: supplier.id,
          tenantId: req.tenantId,
          oldValues: currentSupplier,
          newValues: supplier
        });
      }

      res.json(supplier);
    } catch (error) {
      next(error);
    }
  }
);

// Delete inventory supplier
router.delete('/suppliers/:id',
  param('id').isUUID(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'validation.error', details: errors.array() });
      }

      const supplier = await db
        .selectFrom('suppliers')
        .selectAll()
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!supplier) {
        return res.status(404).json({ error: 'inventory.error.supplier_not_found' });
      }

      await db
        .deleteFrom('suppliers')
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .execute();

      supplier.status_key = 'supplier.status.deleted';

      if (req.audit) {
        await req.audit.log({
          action: 'DELETE',
          entityType: 'suppliers',
          entityId: req.params.id,
          tenantId: req.tenantId,
          oldValues: supplier
        });
      }

      res.status(204).end();
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