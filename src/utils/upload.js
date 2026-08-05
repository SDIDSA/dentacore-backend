const cloudinary = require('../config/cloudinary');

const MAX_FILE_SIZE = Number.parseInt(process.env.MAX_FILE_SIZE);
if (!MAX_FILE_SIZE || MAX_FILE_SIZE < 1) {
  console.warn('WARN: MAX_FILE_SIZE env var is missing or invalid, defaulting to 20MB');
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];

function validateFile(file) {
  if (!file) {
    return { valid: false, error: 'media.error.no_file' };
  }
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return { valid: false, error: 'media.error.invalid_mime_type' };
  }
  return { valid: true };
}

async function uploadToCloudinary(fileBuffer, originalFilename, folder) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `tenants/${folder}`,
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

module.exports = { validateFile, uploadToCloudinary, MAX_FILE_SIZE, ALLOWED_MIME_TYPES };
