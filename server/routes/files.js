const express = require('express');
const { pool } = require('../config/database');

const router = express.Router();

// Serve file by ID from database
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get file from database
    const result = await pool.query(`
      SELECT filename, original_name, mime_type, file_size, file_data
      FROM files 
      WHERE id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const file = result.rows[0];
    
    // Set appropriate headers
    res.set({
      'Content-Type': file.mime_type,
      'Content-Length': file.file_size,
      'Content-Disposition': `inline; filename="${file.original_name}"`,
      'Cache-Control': 'public, max-age=31536000' // Cache for 1 year
    });
    
    // Send file data
    res.send(file.file_data);
    
  } catch (error) {
    console.error('Error serving file:', error);
    res.status(500).json({ error: 'Failed to serve file' });
  }
});

// Serve file by ID with filename in path (for prettier URLs / caching)
router.get('/:id/:filename', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get file from database (ignore filename, it's only for readability)
    const result = await pool.query(`
      SELECT filename, original_name, mime_type, file_size, file_data
      FROM files 
      WHERE id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const file = result.rows[0];
    
    res.set({
      'Content-Type': file.mime_type,
      'Content-Length': file.file_size,
      'Content-Disposition': `inline; filename="${file.original_name}"`,
      'Cache-Control': 'public, max-age=31536000'
    });
    
    res.send(file.file_data);
    
  } catch (error) {
    console.error('Error serving file (with filename):', error);
    res.status(500).json({ error: 'Failed to serve file' });
  }
});

// Get file metadata by ID
router.get('/:id/info', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT id, filename, original_name, mime_type, file_size, uploaded_at, uploaded_by
      FROM files 
      WHERE id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.json(result.rows[0]);
    
  } catch (error) {
    console.error('Error getting file info:', error);
    res.status(500).json({ error: 'Failed to get file info' });
  }
});

module.exports = router;