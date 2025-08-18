const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();

const uploadsRoot = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsRoot)) {
  fs.mkdirSync(uploadsRoot, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsRoot);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9-_]+/gi, '_');
    cb(null, `${base}_${unique}${ext}`);
  }
});

const allowedMime = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp',
  'application/pdf',
  'audio/mpeg', 'audio/wav', 'audio/aac', 'audio/mp4', 'audio/x-m4a',
  'video/mp4', 'video/quicktime', 'video/webm'
]);

const upload = multer({
  storage,
  limits: { fileSize: (parseInt(process.env.UPLOAD_MAX_MB || '50') * 1024 * 1024) },
  fileFilter: (req, file, cb) => {
    if (allowedMime.has(file.mimetype)) cb(null, true);
    else cb(new Error('Unsupported file type'));
  }
});

router.post('/', authenticateToken, authorizeRole(['edit', 'admin']), (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: `File too large. Max ${(process.env.UPLOAD_MAX_MB || '50')}MB` });
      }
      return res.status(400).json({ error: err.message || 'Upload error' });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      const publicPath = `/uploads/${req.file.filename}`;
      const url = `${req.protocol}://${req.get('host')}${publicPath}`;
      return res.status(201).json({
        path: publicPath,
        url,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size
      });
    } catch (e) {
      return res.status(500).json({ error: 'Upload failed' });
    }
  });
});

module.exports = router;


