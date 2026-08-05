const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const db = require('../config/database');
const cloudinary = require('../config/cloudinary');
const multer = require('multer');
const { sql } = require('kysely');
const { parsePagination, wrapPaginatedResponse } = require('../utils/paginate');
const { validateFile, uploadToCloudinary, MAX_FILE_SIZE } = require('../utils/upload');

const router = express.Router();

router.use(authenticate);

// Search media
router.get('/search', async (req, res, next) => {
  try {
    const { search: query } = req.query;
    if (!query || query.trim().length === 0) {
      return res.json([]);
    }

    const sanitized = query.replace(/[^a-zA-Z0-9\s-]/g, '');
    const results = await db
      .selectFrom('media')
      .select('media.id')
      .where('media.tenant_id', '=', req.tenantId)
      .where((eb) =>
        eb.or([
          eb('media.original_filename', 'ilike', `%${sanitized}%`),
        ])
      )
      .limit(20)
      .execute();

    res.json(results.map(r => r.id));
  } catch (error) {
    next(error);
  }
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE || 20971520 }
});

router.get('/', async (req, res, next) => {
  try {
    const pag = parsePagination(req);
    const { start_date, end_date } = req.query;

    let query = db
      .selectFrom('media')
      .select(['media.id'])
      .where('media.tenant_id', '=', req.tenantId);

    if (start_date) {
      query = query.where('media.created_at', '>=', start_date);
    }
    if (end_date) {
      query = query.where('media.created_at', '<=', end_date + ' 23:59:59');
    }

    if (pag.paginate) {
      query = query.select([sql`COUNT(*) OVER()`.as('count')]);
    }

    const media = await query
      .orderBy('media.created_at', 'desc')
      .limit(pag.paginate ? pag.limit : null)
      .offset(pag.paginate ? pag.offset : null)
      .execute();

    const mediaIds = media.map(m => m.id);
    if (pag.paginate) {
      const count = media.length > 0 ? Number(media[0].count) : 0;
      res.json(wrapPaginatedResponse(mediaIds, count, pag.limit, pag.offset));
    } else {
      res.json(mediaIds);
    }
  } catch (error) {
    next(error);
  }
});

// Get media by IDs (batch)
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

    const media = await db
      .selectFrom('media')
      .selectAll()
      .where('media.id', 'in', idArray)
      .where('media.tenant_id', '=', req.tenantId)
      .execute();

    res.json(media);
  } catch (error) {
    next(error);
  }
});

router.get('/:id',
  param('id').isUUID(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'validation.error', details: errors.array() });
      }

      let media = await db
        .selectFrom('media')
        .selectAll()
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!media) {
        media = (await db
          .selectFrom('audit_logs')
          .select('old_values')
          .where('entity_type', '=', 'media')
          .where('action', '=', 'DELETE')
          .where('entity_id', '=', req.params.id)
          .where('tenant_id', '=', req.tenantId)
          .executeTakeFirst())?.old_values;

        if (!media) {
          return res.status(404).json({ error: 'media.error.not_found' });
        }
      }

      res.json(media);
    } catch (error) {
      next(error);
    }
  }
);

router.post('/upload',
  upload.single('file'),
  async (req, res, next) => {
    try {
      const fileCheck = validateFile(req.file);
      if (!fileCheck.valid) {
        return res.status(400).json({ error: fileCheck.error });
      }

      const cloudinaryResult = await uploadToCloudinary(
        req.file.buffer,
        req.file.originalname,
        `${req.tenantId}/media`
      );

      const media = await db
        .insertInto('media')
        .values({
          tenant_id: req.tenantId,
          cloudinary_public_id: cloudinaryResult.public_id,
          cloudinary_url: cloudinaryResult.secure_url,
          original_filename: req.file.originalname,
          mime_type: req.file.mimetype,
          file_size: req.file.size,
          uploaded_by: req.user.id
        })
        .returningAll()
        .executeTakeFirst();

      if (req.audit) {
        await req.audit.log({
          action: 'CREATE',
          entityType: 'media',
          entityId: media.id,
          tenantId: req.tenantId,
          newValues: media
        });
      }

      res.status(201).json(media);
    } catch (error) {
      next(error);
    }
  }
);

// Update media metadata
router.patch('/:id',
  param('id').isUUID(),
  body('description').optional().isString(),
  body('category').optional().isString(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const current = await db
        .selectFrom('media')
        .selectAll()
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!current) {
        return res.status(404).json({ error: 'media.error.not_found' });
      }

      const { description, category } = req.body;
      const updateData = { updated_at: new Date() };
      if (description !== undefined) updateData.description = description;
      if (category !== undefined) updateData.category = category;

      const updated = await db
        .updateTable('media')
        .set(updateData)
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .returningAll()
        .executeTakeFirst();

      if (req.audit) {
        await req.audit.log({
          action: 'UPDATE',
          entityType: 'media',
          entityId: updated.id,
          tenantId: req.tenantId,
          oldValues: { description: current.description, category: current.category },
          newValues: { description: updated.description, category: updated.category }
        });
      }

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

router.delete('/:id',
  param('id').isUUID(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'validation.error', details: errors.array() });
      }

      const media = await db
        .selectFrom('media')
        .selectAll()
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!media) {
        return res.status(404).json({ error: 'media.error.not_found' });
      }

      try {
        await cloudinary.uploader.destroy(media.cloudinary_public_id);
      } catch (cloudinaryError) {
        console.error('Cloudinary deletion failed:', cloudinaryError);
      }

      await db
        .deleteFrom('media')
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .execute();

      media.status_key = 'media.status.deleted';

      if (req.audit) {
        await req.audit.log({
          action: 'DELETE',
          entityType: 'media',
          entityId: req.params.id,
          tenantId: req.tenantId,
          oldValues: media
        });
      }

      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
