const express = require('express');
const multer = require('multer');
const path = require('path');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { pool } = require('../config/database');

const router = express.Router();

// Use memory storage since we'll store in database
const storage = multer.memoryStorage();

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
  upload.single('file')(req, res, async (err) => {
    if (err) {
      console.error('Multer error:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: `File too large. Max ${(process.env.UPLOAD_MAX_MB || '50')}MB` });
      }
      return res.status(400).json({ error: err.message || 'Upload error' });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      console.log('Processing file upload:', {
        originalname: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      });
      
      // Generate a unique filename
      const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(req.file.originalname);
      const base = path.basename(req.file.originalname, ext).replace(/[^a-z0-9-_]+/gi, '_');
      const filename = `${base}_${unique}${ext}`;
      
      // Store file in database
      const result = await pool.query(`
        INSERT INTO files (filename, original_name, mime_type, file_size, file_data, uploaded_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, filename, original_name, mime_type, file_size, uploaded_at
      `, [
        filename,
        req.file.originalname,
        req.file.mimetype,
        req.file.size,
        req.file.buffer,
        req.user.id
      ]);
      
      const fileRecord = result.rows[0];
      console.log('File stored in database:', fileRecord);
      
      // Return file info with URL that points to our file serving endpoint
      const publicPath = `/api/files/${fileRecord.id}`;
      const url = `${req.protocol}://${req.get('host')}${publicPath}`;
      
      return res.status(201).json({
        id: fileRecord.id,
        path: publicPath,
        url,
        originalName: fileRecord.original_name,
        mimeType: fileRecord.mime_type,
        size: fileRecord.file_size
      });
    } catch (e) {
      console.error('Upload processing error:', e);
      return res.status(500).json({ error: 'Upload failed' });
    }
  });
});

module.exports = router;


