const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Unified search endpoint
router.get('/unified', authenticateToken, async (req, res) => {
  try {
    const { 
      q: searchTerm,
      page = 1,
      limit = 20
    } = req.query;
    
    const offset = (page - 1) * limit;
    const userId = req.user.id;
    
    // If no search term, return empty results
    if (!searchTerm || searchTerm.trim().length === 0) {
      return res.json({
        posts: [],
        bolos: [],
        intelReports: [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0,
          pages: 0
        }
      });
    }
    
    const cleanSearch = searchTerm.trim();
    const searchPattern = `%${cleanSearch}%`;
    
    // Search posts
    const postsQuery = `
      SELECT 
        p.id, p.wp_post_id, p.title, p.content, p.excerpt, p.author_name,
        p.wp_published_date, p.ingested_at, p.retention_date, p.status,
        p.metadata, p.category_id, c.name as category_name, c.slug as category_slug,
        COALESCE(p.tags, '{}') as tags,
        'post' as result_type
      FROM posts p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE (
        p.title ILIKE $1 OR 
        p.content ILIKE $1 OR
        p.excerpt ILIKE $1 OR
        p.author_name ILIKE $1
      )
      ORDER BY p.wp_published_date DESC
      LIMIT $2 OFFSET $3
    `;
    
    // Search BOLOs
    const bolosQuery = `
      SELECT 
        b.id, b.case_number, b.title, b.type, b.priority, b.status,
        b.subject_name, b.subject_description, b.incident_location,
        b.incident_date, b.created_at, b.created_by,
        u.username as creator_username,
        'bolo' as result_type
      FROM bolos b
      LEFT JOIN users u ON b.created_by = u.id
      WHERE b.status NOT IN ('cancelled', 'expired') AND (
        b.title ILIKE $1 OR 
        b.subject_name ILIKE $1 OR
        b.subject_description ILIKE $1 OR
        b.incident_location ILIKE $1 OR
        b.case_number ILIKE $1 OR
        b.vehicle_make ILIKE $1 OR
        b.vehicle_model ILIKE $1 OR
        b.vehicle_color ILIKE $1
      )
      ORDER BY b.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    // Search Intel Reports (only approved ones for non-admins)
    const intelReportsQuery = `
      SELECT 
        ir.id, ir.intel_number, ir.classification, ir.date, 
        ir.case_number, ir.subject, ir.criminal_activity, 
        ir.summary, ir.status, ir.created_at,
        u.username as agent_name,
        'intel' as result_type
      FROM intel_reports ir
      LEFT JOIN users u ON ir.agent_id = u.id
      WHERE (
        ${req.user.role === 'admin' || req.user.super_admin ? '1=1' : 'ir.status = \'approved\''}
      ) AND (
        ir.subject ILIKE $1 OR
        ir.criminal_activity ILIKE $1 OR
        ir.summary ILIKE $1 OR
        ir.case_number ILIKE $1 OR
        ir.intel_number ILIKE $1
      )
      ORDER BY ir.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    // Execute all searches in parallel
    const [postsResult, bolosResult, intelResult] = await Promise.all([
      pool.query(postsQuery, [searchPattern, limit, offset]),
      pool.query(bolosQuery, [searchPattern, limit, offset]),
      pool.query(intelReportsQuery, [searchPattern, limit, offset])
    ]);
    
    // Count total results for pagination
    const countQueries = await Promise.all([
      pool.query(
        `SELECT COUNT(*) as count FROM posts p 
         WHERE p.title ILIKE $1 OR p.content ILIKE $1 OR p.excerpt ILIKE $1 OR p.author_name ILIKE $1`,
        [searchPattern]
      ),
      pool.query(
        `SELECT COUNT(*) as count FROM bolos b 
         WHERE b.status NOT IN ('cancelled', 'expired') AND (
           b.title ILIKE $1 OR b.subject_name ILIKE $1 OR b.subject_description ILIKE $1 OR 
           b.incident_location ILIKE $1 OR b.case_number ILIKE $1 OR b.vehicle_make ILIKE $1 OR
           b.vehicle_model ILIKE $1 OR b.vehicle_color ILIKE $1
         )`,
        [searchPattern]
      ),
      pool.query(
        `SELECT COUNT(*) as count FROM intel_reports ir 
         WHERE (${req.user.role === 'admin' || req.user.super_admin ? '1=1' : 'ir.status = \'approved\''}) 
         AND (ir.subject ILIKE $1 OR ir.criminal_activity ILIKE $1 OR ir.summary ILIKE $1 OR 
              ir.case_number ILIKE $1 OR ir.intel_number ILIKE $1)`,
        [searchPattern]
      )
    ]);
    
    const totalCount = 
      parseInt(countQueries[0].rows[0].count) + 
      parseInt(countQueries[1].rows[0].count) + 
      parseInt(countQueries[2].rows[0].count);
    
    // Debug logging
    console.log('Unified search results:', {
      query: searchTerm,
      posts: postsResult.rows.length,
      bolos: bolosResult.rows.length,
      intelReports: intelResult.rows.length,
      totalCount
    });
    
    res.json({
      posts: postsResult.rows,
      bolos: bolosResult.rows,
      intelReports: intelResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
    
  } catch (error) {
    console.error('Unified search error:', error);
    res.status(500).json({ error: 'Failed to perform search' });
  }
});

module.exports = router;