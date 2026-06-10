const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { sql } = require('kysely');
const db = require('../config/database');
const { parsePagination, wrapPaginatedResponse } = require('../utils/paginate');
const cloudinary = require('../config/cloudinary');
const multer = require('multer');
const { validateFile, uploadToCloudinary, MAX_FILE_SIZE } = require('../utils/upload');

const router = express.Router();

router.use(authenticate);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE || 20971520 }
});

async function attachMediaToXray(xray) {
  if (!xray) return null;
  const media = await db
    .selectFrom('media')
    .select(['cloudinary_url', 'cloudinary_public_id', 'original_filename', 'mime_type', 'file_size'])
    .where('id', '=', xray.media_id)
    .executeTakeFirst();
  if (media) {
    xray.cloudinary_url = media.cloudinary_url;
    xray.cloudinary_public_id = media.cloudinary_public_id;
    xray.original_filename = media.original_filename;
    xray.mime_type = media.mime_type;
    xray.file_size = media.file_size;
  }
  return xray;
}

const VALID_TOOTH_NUMBERS = [
  '11', '12', '13', '14', '15', '16', '17', '18',
  '21', '22', '23', '24', '25', '26', '27', '28',
  '31', '32', '33', '34', '35', '36', '37', '38',
  '41', '42', '43', '44', '45', '46', '47', '48'
];

router.get('/',
  query('patient_id').optional().isUUID(),
  query('treatment_record_id').optional().isUUID(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'validation.error', details: errors.array() });
      }

      const pag = parsePagination(req);

      let query = db
        .selectFrom('xrays')
        .innerJoin('media', 'xrays.media_id', 'media.id')
        .innerJoin('patients', 'xrays.patient_id', 'patients.id')
        .select(['xrays.id'])
        .where('xrays.tenant_id', '=', req.tenantId);

      if (req.query.patient_id) {
        query = query.where('xrays.patient_id', '=', req.query.patient_id);
      }
      if (req.query.treatment_record_id) {
        query = query.where('xrays.treatment_record_id', '=', req.query.treatment_record_id);
      }

      if (pag.paginate) {
        query = query.select([sql`COUNT(*) OVER()`.as('count')]);
      }

      const xrays = await query
        .orderBy('xrays.captured_date', 'desc')
        .orderBy('xrays.created_at', 'desc')
        .limit(pag.paginate ? pag.limit : null)
        .offset(pag.paginate ? pag.offset : null)
        .execute();

      const ids = xrays.map(x => x.id);
      if (pag.paginate) {
        const count = xrays.length > 0 ? Number(xrays[0].count) : 0;
        res.json(wrapPaginatedResponse(ids, count, pag.limit, pag.offset));
      } else {
        res.json(ids);
      }
    } catch (error) {
      next(error);
    }
  }
);

router.get('/:id',
  param('id').isUUID(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'validation.error', details: errors.array() });
      }

      let xray = await db
        .selectFrom('xrays')
        .innerJoin('media', 'xrays.media_id', 'media.id')
        .innerJoin('patients', 'xrays.patient_id', 'patients.id')
        .select([
          'xrays.id',
          'xrays.media_id',
          'xrays.patient_id',
          'patients.full_name as patient_name',
          'xrays.treatment_record_id',
          'xrays.tooth_number',
          'xrays.description',
          'xrays.captured_date',
          'xrays.created_at',
          'xrays.updated_at',
          'media.cloudinary_url',
          'media.cloudinary_public_id',
          'media.original_filename',
          'media.mime_type',
          'media.file_size'
        ])
        .where('xrays.id', '=', req.params.id)
        .where('xrays.tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!xray) {
        xray = (await db
          .selectFrom('audit_logs')
          .select('old_values')
          .where('entity_type', '=', 'xrays')
          .where('action', '=', 'DELETE')
          .where('entity_id', '=', req.params.id)
          .where('tenant_id', '=', req.tenantId)
          .executeTakeFirst())?.old_values;

        if (!xray) {
          return res.status(404).json({ error: 'xray.error.not_found' });
        }
      }

      res.json(xray);
    } catch (error) {
      next(error);
    }
  }
);

router.post('/upload',
  upload.single('file'),
  body('patient_id').isUUID(),
  body('tooth_number').if(body('tooth_number').notEmpty()).isIn(VALID_TOOTH_NUMBERS),
  body('description').isString(),
  body('treatment_record_id').if(body('treatment_record_id').notEmpty()).isUUID(),
  body('captured_date').optional({ values: 'null' }).isISO8601(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const fileCheck = validateFile(req.file);
      if (!fileCheck.valid) {
        return res.status(400).json({ error: fileCheck.error });
      }

      const cloudinaryResult = await uploadToCloudinary(
        req.file.buffer,
        req.file.originalname,
        `${req.tenantId}/xrays`
      );

      const result = await db.transaction().execute(async (trx) => {
        const media = await trx
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

        const xray = await trx
          .insertInto('xrays')
          .values({
            media_id: media.id,
            tenant_id: req.tenantId,
            patient_id: req.body.patient_id,
            treatment_record_id: req.body.treatment_record_id || null,
            tooth_number: req.body.tooth_number || null,
            description: req.body.description || null,
            captured_date: req.body.captured_date || new Date()
          })
          .returningAll()
          .executeTakeFirst();

        await trx
          .insertInto('audit_logs')
          .values({
            tenant_id: req.tenantId,
            user_id: req.user.id,
            action: 'CREATE',
            entity_type: 'xrays',
            entity_id: xray.id,
            new_values: JSON.stringify(xray),
            ip_address: req.ip,
            user_agent: req.get('User-Agent')
          })
          .execute();

        return { media, xray };
      });

      res.status(201).json(await attachMediaToXray(result.xray));
    } catch (error) {
      next(error);
    }
  }
);

router.patch('/:id',
  param('id').isUUID(),
  body('tooth_number').optional().isIn(VALID_TOOTH_NUMBERS),
  body('description').optional().isString(),
  body('captured_date').optional().isISO8601(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const current = await db
        .selectFrom('xrays')
        .selectAll()
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!current) {
        return res.status(404).json({ error: 'xray.error.not_found' });
      }

      const { tooth_number, description, captured_date } = req.body;
      const updateData = {};
      if (tooth_number !== undefined) updateData.tooth_number = tooth_number;
      if (description !== undefined) updateData.description = description;
      if (captured_date !== undefined) updateData.captured_date = captured_date;
      updateData.updated_at = new Date();

      const updated = await db
        .updateTable('xrays')
        .set(updateData)
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .returningAll()
        .executeTakeFirst();

      if (req.audit) {
        await req.audit.log({
          action: 'UPDATE',
          entityType: 'xrays',
          entityId: updated.id,
          tenantId: req.tenantId,
          oldValues: current,
          newValues: updated
        });
      }

      res.json(await attachMediaToXray(updated));
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

      const xray = await db
        .selectFrom('xrays')
        .innerJoin('media', 'xrays.media_id', 'media.id')
        .select([
          'xrays.id',
          'xrays.media_id',
          'xrays.tenant_id',
          'media.cloudinary_public_id'
        ])
        .where('xrays.id', '=', req.params.id)
        .where('xrays.tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!xray) {
        return res.status(404).json({ error: 'xray.error.not_found' });
      }

      await db.transaction().execute(async (trx) => {
        await trx
          .deleteFrom('xrays')
          .where('id', '=', req.params.id)
          .where('tenant_id', '=', req.tenantId)
          .execute();

        await trx
          .deleteFrom('media')
          .where('id', '=', xray.media_id)
          .execute();

        await trx
          .insertInto('audit_logs')
          .values({
            tenant_id: req.tenantId,
            user_id: req.user.id,
            action: 'DELETE',
            entity_type: 'xrays',
            entity_id: req.params.id,
            old_values: JSON.stringify(xray),
            ip_address: req.ip,
            user_agent: req.get('User-Agent')
          })
          .execute();
      });

      try {
        await cloudinary.uploader.destroy(xray.cloudinary_public_id);
      } catch (cloudinaryError) {
        console.error('Cloudinary deletion failed:', cloudinaryError);
      }

      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
