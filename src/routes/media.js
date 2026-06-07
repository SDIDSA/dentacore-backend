const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const db = require('../config/database');
const cloudinary = require('../config/cloudinary');
const multer = require('multer');

const router = express.Router();

router.use(authenticate);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 20971520 }
});

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE);
if (!MAX_FILE_SIZE || MAX_FILE_SIZE < 1) {
  if (process.env.NODE_ENV !== 'test') {
    console.error('FATAL: MAX_FILE_SIZE env var must be a positive number');
    process.exit(1);
  }
}

async function uploadToCloudinary(fileBuffer, originalFilename, tenantId) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `tenants/${tenantId}/media`,
        resource_type: 'auto',
        public_id: `${Date.now()}_${originalFilename.replace(/\.[^.]+$/, '')}`,
        use_filename: true,
        unique_filename: false
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    uploadStream.on('error', reject);
    uploadStream.end(fileBuffer);
  });
}

router.get('/', async (req, res, next) => {
  try {
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

    const media = await query
      .orderBy('media.created_at', 'desc')
      .execute();

    res.json(media.map(m => m.id));
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

      const media = await db
        .selectFrom('media')
        .selectAll()
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!media) {
        return res.status(404).json({ error: 'media.error.not_found' });
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
      if (!req.file) {
        return res.status(400).json({ error: 'media.error.no_file' });
      }

      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedMimeTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ error: 'media.error.invalid_mime_type' });
      }

      const cloudinaryResult = await uploadToCloudinary(
        req.file.buffer,
        req.file.originalname,
        req.tenantId
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
