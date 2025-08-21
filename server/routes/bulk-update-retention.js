const express = require('express');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');
const { pool } = require('../config/database');

const router = express.Router();

// Bulk update retention dates for WordPress posts
router.post('/update-wordpress-retention', 
  authenticateToken, 
  authorizeRole(['admin']), 
  auditLog('bulk_update_wordpress_retention'),
  async (req, res) => {
    try {
      console.log('🔍 Starting bulk update of WordPress post retention dates...');
      
      // First, get current status
      const statusQuery = `
        SELECT 
          COUNT(*) as total_posts,
          COUNT(CASE WHEN retention_date = wp_published_date + INTERVAL '5 years' THEN 1 END) as correct_retention,
          MIN(wp_published_date) as oldest_post,
          MAX(wp_published_date) as newest_post
        FROM posts 
        WHERE wp_post_id IS NOT NULL
      `;
      
      const statusResult = await pool.query(statusQuery);
      const status = statusResult.rows[0];
      
      console.log('📊 Current status:', {
        totalWordPressPosts: parseInt(status.total_posts),
        correctRetention: parseInt(status.correct_retention),
        needsUpdate: parseInt(status.total_posts) - parseInt(status.correct_retention),
        oldestPost: status.oldest_post,
        newestPost: status.newest_post
      });
      
      if (parseInt(status.total_posts) === 0) {
        return res.json({
          success: true,
          message: 'No WordPress posts found',
          postsUpdated: 0,
          totalPosts: 0
        });
      }
      
      // Update retention dates: set to published_date + 5 years
      const updateQuery = `
        UPDATE posts 
        SET retention_date = wp_published_date + INTERVAL '5 years'
        WHERE wp_post_id IS NOT NULL
          AND retention_date != wp_published_date + INTERVAL '5 years'
        RETURNING id, title, wp_published_date, retention_date
      `;
      
      const updateResult = await pool.query(updateQuery);
      
      console.log(`✅ Updated ${updateResult.rowCount} posts`);
      
      // Get verification count
      const verifyQuery = `
        SELECT 
          COUNT(*) as total_posts,
          COUNT(CASE WHEN retention_date = wp_published_date + INTERVAL '5 years' THEN 1 END) as correct_retention
        FROM posts 
        WHERE wp_post_id IS NOT NULL
      `;
      
      const verifyResult = await pool.query(verifyQuery);
      const verification = verifyResult.rows[0];
      
      const response = {
        success: true,
        message: `Successfully updated WordPress post retention dates`,
        postsUpdated: updateResult.rowCount,
        totalWordPressPosts: parseInt(verification.total_posts),
        correctRetention: parseInt(verification.correct_retention),
        retentionPolicy: '5 years from published date',
        examples: updateResult.rows.slice(0, 5).map(row => ({
          id: row.id,
          title: row.title.substring(0, 50) + (row.title.length > 50 ? '...' : ''),
          published: row.wp_published_date,
          newRetention: row.retention_date
        }))
      };
      
      console.log('🎉 Bulk retention update completed:', response);
      
      res.json(response);
      
    } catch (error) {
      console.error('❌ Error updating retention dates:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update retention dates',
        details: error.message
      });
    }
  }
);

// Get retention date status for WordPress posts
router.get('/wordpress-retention-status',
  authenticateToken,
  authorizeRole(['admin']),
  async (req, res) => {
    try {
      const statusQuery = `
        SELECT 
          COUNT(*) as total_posts,
          COUNT(CASE WHEN retention_date = wp_published_date + INTERVAL '5 years' THEN 1 END) as correct_retention,
          MIN(wp_published_date) as oldest_post,
          MAX(wp_published_date) as newest_post,
          AVG(DATE_PART('year', AGE(retention_date, wp_published_date))) as avg_retention_years
        FROM posts 
        WHERE wp_post_id IS NOT NULL
      `;
      
      const statusResult = await pool.query(statusQuery);
      const status = statusResult.rows[0];
      
      // Get some examples of posts with incorrect retention
      const examplesQuery = `
        SELECT 
          id, title, wp_published_date, retention_date,
          DATE_PART('year', AGE(retention_date, wp_published_date)) as retention_years
        FROM posts 
        WHERE wp_post_id IS NOT NULL
          AND retention_date != wp_published_date + INTERVAL '5 years'
        ORDER BY wp_published_date DESC
        LIMIT 10
      `;
      
      const examplesResult = await pool.query(examplesQuery);
      
      res.json({
        status: {
          totalWordPressPosts: parseInt(status.total_posts),
          correctRetention: parseInt(status.correct_retention),
          incorrectRetention: parseInt(status.total_posts) - parseInt(status.correct_retention),
          oldestPost: status.oldest_post,
          newestPost: status.newest_post,
          averageRetentionYears: parseFloat(status.avg_retention_years).toFixed(1)
        },
        incorrectExamples: examplesResult.rows.map(row => ({
          id: row.id,
          title: row.title.substring(0, 50) + (row.title.length > 50 ? '...' : ''),
          published: row.wp_published_date,
          currentRetention: row.retention_date,
          currentRetentionYears: parseFloat(row.retention_years).toFixed(1)
        })),
        expectedRetentionPolicy: '5 years from published date'
      });
      
    } catch (error) {
      console.error('Error getting retention status:', error);
      res.status(500).json({
        error: 'Failed to get retention status',
        details: error.message
      });
    }
  }
);

module.exports = router;