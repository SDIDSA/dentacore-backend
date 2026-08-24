const cloudinary = require('../config/cloudinary');

const MAX_FILE_SIZE = Number.parseInt(process.env.MAX_FILE_SIZE);
if (!MAX_FILE_SIZE || MAX_FILE_SIZE < 1) {
  console.warn('WARN: MAX_FILE_SIZE env var is missing or invalid, defaulting to 20MB');
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];

// magic-byte signatures — the multipart mimetype is client-controlled, so
// "images only" is enforced against file content, not the declared header
function sniffMagicBytes(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (buf.slice(0, 3).toString('ascii') === 'GIF') return 'image/gif';
  if (buf[0] === 0x42 && buf[1] === 0x4d) return 'image/bmp';
  return null;
}

function validateFile(file) {
  if (!file) {
    return { valid: false, error: 'media.error.no_file' };
  }
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return { valid: false, error: 'media.error.invalid_mime_type' };
  }
  const sniffed = sniffMagicBytes(file.buffer);
  if (!sniffed || !ALLOWED_MIME_TYPES.includes(sniffed)) {
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
