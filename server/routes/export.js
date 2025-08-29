const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const pdfGenerator = require('../services/pdfGenerator');
const authenticateToken = require('../middleware/auth');

// Export posts to PDF
router.post('/pdf', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { postIds, includeComments = true, includeTags = true, dateRange } = req.body;
    const userId = req.user.id;
    
    // Build query to fetch posts
    let query = `
      SELECT 
        p.id,
        p.title,
        p.content,
        p.tags,
        p.created_at,
        p.likes_count,
        u.username as author_name
      FROM posts p
      LEFT JOIN users u ON p.author_id = u.id
      WHERE 1=1
    `;
    
    const queryParams = [];
    let paramIndex = 1;
    
    // Filter by post IDs if provided
    if (postIds && postIds.length > 0) {
      query += ` AND p.id = ANY($${paramIndex}::int[])`;
      queryParams.push(postIds);
      paramIndex++;
    } else {
      // Default to user's posts if no specific IDs provided
      query += ` AND p.author_id = $${paramIndex}`;
      queryParams.push(userId);
      paramIndex++;
    }
    
    // Add date range filter if provided
    if (dateRange) {
      if (dateRange.start) {
        query += ` AND p.created_at >= $${paramIndex}`;
        queryParams.push(dateRange.start);
        paramIndex++;
      }
      if (dateRange.end) {
        query += ` AND p.created_at <= $${paramIndex}`;
        queryParams.push(dateRange.end);
        paramIndex++;
      }
    }
    
    query += ' ORDER BY p.created_at DESC';
    
    // Fetch posts
    const postsResult = await client.query(query, queryParams);
    const posts = postsResult.rows;
    
    if (posts.length === 0) {
      return res.status(404).json({ error: 'No posts found for export' });
    }
    
    // Fetch comments if requested
    if (includeComments) {
      const postIdsToFetch = posts.map(p => p.id);
      const commentsResult = await client.query(
        `SELECT 
          c.id,
          c.post_id,
          c.content,
          c.created_at,
          u.username as author_name
        FROM comments c
        LEFT JOIN users u ON c.author_id = u.id
        WHERE c.post_id = ANY($1::int[])
        ORDER BY c.created_at ASC`,
        [postIdsToFetch]
      );
      
      // Group comments by post
      const commentsByPost = {};
      commentsResult.rows.forEach(comment => {
        if (!commentsByPost[comment.post_id]) {
          commentsByPost[comment.post_id] = [];
        }
        commentsByPost[comment.post_id].push(comment);
      });
      
      // Attach comments to posts
      posts.forEach(post => {
        post.comments = commentsByPost[post.id] || [];
      });
    }
    
    // Get user info
    const userResult = await client.query(
      'SELECT id, username, email FROM users WHERE id = $1',
      [userId]
    );
    const user = userResult.rows[0];
    
    // Generate PDF
    const pdfBuffer = await pdfGenerator.generatePostsPDF(posts, user, {
      includeComments,
      includeTags,
      dateRange: dateRange ? `${dateRange.start || 'Start'} to ${dateRange.end || 'End'}` : null
    });
    
    // Log the export
    const exportLogResult = await client.query(
      `INSERT INTO export_logs (
        user_id, 
        export_type, 
        post_ids, 
        post_count, 
        file_size,
        ip_address,
        user_agent,
        export_options,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id`,
      [
        userId,
        'pdf',
        posts.map(p => p.id),
        posts.length,
        pdfBuffer.length,
        req.ip,
        req.get('user-agent'),
        JSON.stringify({ includeComments, includeTags, dateRange }),
        'success'
      ]
    );
    
    // Send PDF response
    const fileName = `vector-threads-export-${new Date().getTime()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('PDF export error:', error);
    
    // Log failed export attempt
    try {
      await client.query(
        `INSERT INTO export_logs (
          user_id, 
          export_type, 
          post_ids, 
          post_count, 
          status,
          error_message
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          req.user.id,
          'pdf',
          req.body.postIds || [],
          0,
          'failed',
          error.message
        ]
      );
    } catch (logError) {
      console.error('Failed to log export error:', logError);
    }
    
    res.status(500).json({ error: 'Failed to generate PDF export' });
  } finally {
    client.release();
  }
});

// Get export history for user
router.get('/history', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const result = await client.query(
      `SELECT 
        id,
        export_type,
        post_count,
        file_size,
        export_date,
        status,
        export_options
      FROM export_logs
      WHERE user_id = $1
      ORDER BY export_date DESC
      LIMIT 50`,
      [req.user.id]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching export history:', error);
    res.status(500).json({ error: 'Failed to fetch export history' });
  } finally {
    client.release();
  }
});

// Get export statistics
router.get('/stats', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const statsResult = await client.query(
      `SELECT 
        COUNT(*) as total_exports,
        SUM(post_count) as total_posts_exported,
        SUM(file_size) as total_file_size,
        COUNT(DISTINCT export_type) as export_types_used,
        MAX(export_date) as last_export_date
      FROM export_logs
      WHERE user_id = $1 AND status = 'success'`,
      [req.user.id]
    );
    
    res.json(statsResult.rows[0]);
  } catch (error) {
    console.error('Error fetching export stats:', error);
    res.status(500).json({ error: 'Failed to fetch export statistics' });
  } finally {
    client.release();
  }
});

module.exports = router;