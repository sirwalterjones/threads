const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken, authorizeRole, auditLog } = require('../middleware/auth');
const WordPressService = require('../services/wordpressService-sqlite');
const router = express.Router();

// Initialize WordPress service
const wpService = new WordPressService();

// Dashboard statistics
router.get('/dashboard', 
  authenticateToken, 
  authorizeRole(['admin']), 
  async (req, res) => {
    try {
      // Get counts for various entities (SQLite compatible)
      const statsQueries = await Promise.all([
        pool.query('SELECT COUNT(*) as count FROM posts'),
        pool.query('SELECT COUNT(*) as count FROM categories'),
        pool.query('SELECT COUNT(*) as count FROM users'),
        pool.query("SELECT COUNT(*) as count FROM posts WHERE wp_published_date >= date('now', '-30 days')"),
        pool.query("SELECT COUNT(*) as count FROM posts WHERE retention_date <= date('now', '+30 days')"),
        pool.query("SELECT COUNT(*) as count FROM audit_log WHERE timestamp >= datetime('now', '-1 day')")
      ]);

      const [posts, categories, users, recentPosts, expiringPosts, recentActivity] = statsQueries;

      // Get top categories by post count
      const topCategoriesResult = await pool.query(`
        SELECT c.name, c.post_count, c.slug
        FROM categories c
        WHERE c.post_count > 0
        ORDER BY c.post_count DESC
        LIMIT 5
      `);

      // Get recent activity
      const recentActivityResult = await pool.query(`
        SELECT 
          al.id, al.action, al.timestamp, al.table_name, al.record_id,
          al.ip_address, al.new_values,
          u.username
        FROM audit_log al
        LEFT JOIN users u ON al.user_id = u.id
        ORDER BY al.timestamp DESC
        LIMIT 10
      `);

      res.json({
        counts: {
          totalPosts: parseInt(posts.rows[0].count),
          totalCategories: parseInt(categories.rows[0].count),
          totalUsers: parseInt(users.rows[0].count),
          recentPosts: parseInt(recentPosts.rows[0].count),
          expiringPosts: parseInt(expiringPosts.rows[0].count),
          recentActivity: parseInt(recentActivity.rows[0].count)
        },
        topCategories: topCategoriesResult.rows,
        recentActivity: recentActivityResult.rows,
        storage: {
          posts_size: 'N/A (SQLite)',
          total_size: 'N/A (SQLite)'
        }
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
  }
);

// Trigger WordPress data ingestion
router.post('/ingest-wordpress', 
  authenticateToken, 
  authorizeRole(['admin']), 
  auditLog('wordpress_ingestion'),
  async (req, res) => {
    try {
      console.log('Starting WordPress ingestion...');
      const result = await wpService.performFullIngestion();
      
      res.json({
        message: 'WordPress ingestion completed successfully',
        result
      });
    } catch (error) {
      console.error('WordPress ingestion error:', error);
      res.status(500).json({ 
        error: 'WordPress ingestion failed',
        details: error.message
      });
    }
  }
);

// Purge expired data
router.post('/purge-expired', 
  authenticateToken, 
  authorizeRole(['admin']), 
  auditLog('purge_expired_data'),
  async (req, res) => {
    try {
      const purgedCount = await wpService.purgeExpiredData();
      
      res.json({
        message: 'Expired data purged successfully',
        purgedCount
      });
    } catch (error) {
      console.error('Data purge error:', error);
      res.status(500).json({ 
        error: 'Data purge failed',
        details: error.message
      });
    }
  }
);

// Get audit log
router.get('/audit-log', 
  authenticateToken, 
  authorizeRole(['admin']), 
  async (req, res) => {
    try {
      const { 
        page = 1, 
        limit = 50, 
        userId, 
        action, 
        tableName,
        dateFrom,
        dateTo 
      } = req.query;

      const offset = (page - 1) * limit;
      let whereConditions = [];
      let queryParams = [];

      if (userId) {
        whereConditions.push('al.user_id = ?');
        queryParams.push(userId);
      }

      if (action) {
        whereConditions.push('al.action LIKE ?');
        queryParams.push(`%${action}%`);
      }

      if (tableName) {
        whereConditions.push('al.table_name = ?');
        queryParams.push(tableName);
      }

      if (dateFrom) {
        whereConditions.push('al.timestamp >= ?');
        queryParams.push(dateFrom);
      }

      if (dateTo) {
        whereConditions.push('al.timestamp <= ?');
        queryParams.push(dateTo);
      }

      const whereClause = whereConditions.length > 0 ? 
        `WHERE ${whereConditions.join(' AND ')}` : '';

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM audit_log al
        ${whereClause}
      `;
      
      const countResult = await pool.query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].total);

      // Get audit entries
      const auditQuery = `
        SELECT 
          al.id, al.action, al.table_name, al.record_id,
          al.timestamp, al.ip_address, al.new_values,
          u.username
        FROM audit_log al
        LEFT JOIN users u ON al.user_id = u.id
        ${whereClause}
        ORDER BY al.timestamp DESC
        LIMIT ? OFFSET ?
      `;

      queryParams.push(limit, offset);
      const auditResult = await pool.query(auditQuery, queryParams);

      res.json({
        auditEntries: auditResult.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error fetching audit log:', error);
      res.status(500).json({ error: 'Failed to fetch audit log' });
    }
  }
);

// System health check
router.get('/health', 
  authenticateToken, 
  authorizeRole(['admin']), 
  async (req, res) => {
    try {
      const healthChecks = {
        database: false,
        wordpressApi: false,
        diskSpace: null,
        memory: null
      };

      // Database health
      try {
        await pool.query('SELECT 1');
        healthChecks.database = true;
      } catch (error) {
        console.error('Database health check failed:', error);
      }

      // WordPress API health
      try {
        const wpService = new WordPressService();
        const response = await require('axios').get(`${wpService.baseUrl}/posts?per_page=1`);
        healthChecks.wordpressApi = response.status === 200;
      } catch (error) {
        console.error('WordPress API health check failed:', error);
      }

      // System metrics
      const memoryUsage = process.memoryUsage();
      healthChecks.memory = {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024)
      };

      const overallStatus = healthChecks.database && healthChecks.wordpressApi ? 'healthy' : 'unhealthy';

      res.json({
        status: overallStatus,
        timestamp: new Date(),
        checks: healthChecks
      });
    } catch (error) {
      console.error('Health check error:', error);
      res.status(500).json({ 
        status: 'error',
        error: 'Health check failed'
      });
    }
  }
);

// Database maintenance
router.post('/maintenance', 
  authenticateToken, 
  authorizeRole(['admin']), 
  auditLog('database_maintenance'),
  async (req, res) => {
    try {
      const { action } = req.body;
      const results = {};

      switch (action) {
        case 'vacuum':
          await pool.query('VACUUM');
          results.vacuum = 'completed';
          break;

        case 'analyze':
          await pool.query('ANALYZE');
          results.analyze = 'completed';
          break;

        case 'cleanup_old_audit':
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - 90); // Keep 90 days
          
          const cleanupResult = await pool.query(
            'DELETE FROM audit_log WHERE timestamp < ?',
            [cutoffDate.toISOString()]
          );
          results.audit_cleanup = `${cleanupResult.rowCount || 0} records removed`;
          break;

        default:
          return res.status(400).json({ error: 'Invalid maintenance action' });
      }

      res.json({
        message: 'Maintenance completed successfully',
        results
      });
    } catch (error) {
      console.error('Maintenance error:', error);
      res.status(500).json({ 
        error: 'Maintenance failed',
        details: error.message
      });
    }
  }
);

module.exports = router;