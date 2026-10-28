const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Storage configuration with sanitized unique filenames
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `item-${uniqueSuffix}${ext}`);
  },
});

// File filter for allowed image extensions and mimetypes
const fileFilter = (req, file, cb) => {
  const allowedExtensions = /jpeg|jpg|png|webp|gif/;
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  const mime = file.mimetype.toLowerCase();

  const isExtValid = allowedExtensions.test(ext);
  const isMimeValid = mime.startsWith('image/');

  if (isExtValid && isMimeValid) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Invalid file type. Only JPEG, PNG, WEBP, and GIF images are allowed.'
      ),
      false
    );
  }
};

// Maximum file size in MB (defaults to 5MB)
const maxFileSize = (parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 5) * 1024 * 1024;

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: maxFileSize,
    files: 5, // Up to 5 photos per listing
  },
});

module.exports = upload;
