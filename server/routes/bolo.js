const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const boloService = require('../services/boloService');
const auditLogger = require('../middleware/auditLogger');

// Configure multer for file uploads
// Use memory storage in production, disk storage in development
const storage = process.env.NODE_ENV === 'production' 
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '..', 'uploads', 'bolo');
        try {
          await fs.mkdir(uploadDir, { recursive: true });
          cb(null, uploadDir);
        } catch (error) {
          cb(error, null);
        }
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'bolo-' + uniqueSuffix + path.extname(file.originalname));
      }
    });

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
    files: 10 // Max 10 files
  },
  fileFilter: (req, file, cb) => {
    // Allowed file types
    const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, videos, and documents are allowed.'));
    }
  }
});

/**
 * Create a new BOLO
 * Only edit and admin roles can create BOLOs
 */
router.post('/create',
  authenticateToken,
  authorizeRole(['edit', 'admin']),
  upload.array('media', 10),
  async (req, res) => {
    try {
      const boloData = req.body;
      const userId = req.user.id;
      const files = req.files || [];
      
      // Validate required fields
      if (!boloData.type || !boloData.title || !boloData.summary) {
        return res.status(400).json({
          error: 'Missing required fields: type, title, and summary are required'
        });
      }
      
      // Create BOLO
      const bolo = await boloService.createBOLO(boloData, userId, files);
      
      // Log audit event
      await auditLogger.logEvent({
        eventType: auditLogger.eventTypes.CJI_CREATE,
        action: 'CREATE_BOLO',
        resourceType: 'bolo',
        resourceId: bolo.id,
        dataClassification: auditLogger.dataClassifications.CJI,
        metadata: {
          bolo_type: boloData.type,
          title: boloData.title,
          priority: boloData.priority,
          media_count: files.length
        },
        req
      });
      
      res.status(201).json({
        success: true,
        bolo,
        message: 'BOLO created successfully'
      });
      
    } catch (error) {
      console.error('Error creating BOLO:', error);
      res.status(500).json({
        error: 'Failed to create BOLO',
        details: error.message
      });
    }
  }
);

/**
 * Get BOLO feed
 */
router.get('/feed',
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const filters = {
        type: req.query.type,
        priority: req.query.priority,
        status: req.query.status, // Don't default to 'active' - show all if not specified
        search: req.query.search,
        limit: parseInt(req.query.limit) || 20,
        offset: parseInt(req.query.offset) || 0,
        sortBy: req.query.sortBy,
        sortOrder: req.query.sortOrder
      };
      
      const result = await boloService.getBOLOFeed(userId, filters);
      
      res.json(result);
      
    } catch (error) {
      console.error('Error fetching BOLO feed:', error);
      res.status(500).json({
        error: 'Failed to fetch BOLO feed',
        details: error.message
      });
    }
  }
);

/**
 * Get single BOLO by ID
 */
router.get('/:id',
  authenticateToken,
  async (req, res) => {
    try {
      const boloId = req.params.id;
      const userId = req.user.id;
      
      const bolo = await boloService.getBOLOById(boloId, userId, false);
      
      if (!bolo) {
        return res.status(404).json({ error: 'BOLO not found' });
      }
      
      res.json(bolo);
      
    } catch (error) {
      console.error('Error fetching BOLO:', error);
      res.status(500).json({
        error: 'Failed to fetch BOLO',
        details: error.message
      });
    }
  }
);

/**
 * Get public BOLO by share token (no auth required)
 */
router.get('/public/:token',
  async (req, res) => {
    try {
      const token = req.params.token;
      
      const bolo = await boloService.getBOLOByPublicToken(token);
      
      if (!bolo) {
        return res.status(404).json({ error: 'BOLO not found or not public' });
      }
      
      res.json(bolo);
      
    } catch (error) {
      console.error('Error fetching public BOLO:', error);
      res.status(500).json({
        error: 'Failed to fetch BOLO',
        details: error.message
      });
    }
  }
);

/**
 * Update BOLO
 * Only creator or admin can update
 */
router.put('/:id',
  authenticateToken,
  authorizeRole(['edit', 'admin']),
  upload.array('media', 10),
  async (req, res) => {
    try {
      const boloId = req.params.id;
      const updates = req.body;
      const userId = req.user.id;
      const files = req.files || [];
      
      const updatedBolo = await boloService.updateBOLO(boloId, updates, userId, files);
      
      // Log audit event
      await auditLogger.logEvent({
        eventType: auditLogger.eventTypes.CJI_UPDATE,
        action: 'UPDATE_BOLO',
        resourceType: 'bolo',
        resourceId: boloId,
        dataClassification: auditLogger.dataClassifications.CJI,
        metadata: {
          updates: Object.keys(updates),
          media_added: files.length
        },
        req
      });
      
      res.json({
        success: true,
        bolo: updatedBolo,
        message: 'BOLO updated successfully'
      });
      
    } catch (error) {
      console.error('Error updating BOLO:', error);
      
      if (error.message === 'Unauthorized to update this BOLO') {
        return res.status(403).json({ error: error.message });
      }
      
      if (error.message === 'BOLO not found') {
        return res.status(404).json({ error: error.message });
      }
      
      res.status(500).json({
        error: 'Failed to update BOLO',
        details: error.message
      });
    }
  }
);

/**
 * Update BOLO status
 * Only creator or admin can update status
 */
router.patch('/:id/status',
  authenticateToken,
  authorizeRole(['edit', 'admin']),
  async (req, res) => {
    try {
      const boloId = req.params.id;
      const { status } = req.body;
      const userId = req.user.id;
      
      if (!status) {
        return res.status(400).json({ error: 'Status is required' });
      }
      
      if (!['pending', 'active', 'cancelled', 'resolved', 'expired'].includes(status)) {
        return res.status(400).json({ 
          error: 'Invalid status. Must be: pending, active, cancelled, resolved, or expired' 
        });
      }
      
      const updatedBolo = await boloService.updateBOLO(boloId, { status }, userId);
      
      res.json({
        success: true,
        bolo: updatedBolo,
        message: `BOLO status updated to ${status}`
      });
      
    } catch (error) {
      console.error('Error updating BOLO status:', error);
      
      if (error.message === 'Unauthorized to update this BOLO') {
        return res.status(403).json({ error: error.message });
      }
      
      res.status(500).json({
        error: 'Failed to update BOLO status',
        details: error.message
      });
    }
  }
);

/**
 * Repost BOLO
 */
router.post('/:id/repost',
  authenticateToken,
  async (req, res) => {
    try {
      const boloId = req.params.id;
      const userId = req.user.id;
      const { message } = req.body;
      
      const result = await boloService.repostBOLO(boloId, userId, message);
      
      res.json(result);
      
    } catch (error) {
      console.error('Error reposting BOLO:', error);
      
      if (error.message === 'Already reposted this BOLO') {
        return res.status(400).json({ error: error.message });
      }
      
      res.status(500).json({
        error: 'Failed to repost BOLO',
        details: error.message
      });
    }
  }
);

/**
 * Add comment to BOLO
 */
router.post('/:id/comment',
  authenticateToken,
  async (req, res) => {
    try {
      const boloId = req.params.id;
      const userId = req.user.id;
      const { content, isInternal } = req.body;
      
      if (!content || !content.trim()) {
        return res.status(400).json({ error: 'Comment content is required' });
      }
      
      const comment = await boloService.addComment(boloId, userId, content, isInternal);
      
      res.status(201).json({
        success: true,
        comment,
        message: 'Comment added successfully'
      });
      
    } catch (error) {
      console.error('Error adding comment:', error);
      res.status(500).json({
        error: 'Failed to add comment',
        details: error.message
      });
    }
  }
);

/**
 * Save/Unsave BOLO
 */
router.post('/:id/save',
  authenticateToken,
  async (req, res) => {
    try {
      const boloId = req.params.id;
      const userId = req.user.id;
      
      const result = await boloService.toggleSaveBOLO(boloId, userId);
      
      res.json({
        success: true,
        saved: result.saved,
        message: result.saved ? 'BOLO saved' : 'BOLO unsaved'
      });
      
    } catch (error) {
      console.error('Error toggling save:', error);
      res.status(500).json({
        error: 'Failed to save/unsave BOLO',
        details: error.message
      });
    }
  }
);

/**
 * Get user's saved BOLOs
 */
router.get('/saved/list',
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const limit = parseInt(req.query.limit) || 20;
      const offset = parseInt(req.query.offset) || 0;
      
      const savedBolos = await boloService.getSavedBOLOs(userId, limit, offset);
      
      res.json({
        bolos: savedBolos,
        total: savedBolos.length
      });
      
    } catch (error) {
      console.error('Error fetching saved BOLOs:', error);
      res.status(500).json({
        error: 'Failed to fetch saved BOLOs',
        details: error.message
      });
    }
  }
);

/**
 * Upload additional media to existing BOLO
 */
router.post('/:id/media',
  authenticateToken,
  authorizeRole(['edit', 'admin']),
  upload.array('media', 5),
  async (req, res) => {
    try {
      const boloId = req.params.id;
      const userId = req.user.id;
      const files = req.files || [];
      
      if (files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }
      
      // TODO: Add media to existing BOLO
      // This would need to be implemented in boloService
      
      res.json({
        success: true,
        message: `${files.length} file(s) uploaded successfully`
      });
      
    } catch (error) {
      console.error('Error uploading media:', error);
      res.status(500).json({
        error: 'Failed to upload media',
        details: error.message
      });
    }
  }
);

/**
 * Get BOLO statistics (for dashboard)
 */
router.get('/stats/overview',
  authenticateToken,
  async (req, res) => {
    try {
      const stats = await boloService.getBOLOStatistics();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching BOLO statistics:', error);
      res.status(500).json({
        error: 'Failed to fetch statistics',
        details: error.message
      });
    }
  }
);

module.exports = router;