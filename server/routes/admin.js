const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken, authorizeRole, auditLog } = require('../middleware/auth');
const WordPressService = require('../services/wordpressService');
const router = express.Router();

// Initialize WordPress service
const wpService = new WordPressService();

// Dashboard statistics
router.get('/dashboard', 
  authenticateToken, 
  authorizeRole(['admin']), 
  async (req, res) => {
    try {
      // Get counts for various entities
      const statsQueries = await Promise.all([
        pool.query('SELECT COUNT(*) as count FROM posts'),
        pool.query('SELECT COUNT(*) as count FROM categories'),
        pool.query('SELECT COUNT(*) as count FROM users'),
        pool.query('SELECT COUNT(*) as count FROM posts WHERE wp_published_date >= NOW() - INTERVAL \'30 days\''),
        pool.query('SELECT COUNT(*) as count FROM posts WHERE retention_date <= NOW() + INTERVAL \'30 days\''),
        pool.query('SELECT COUNT(*) as count FROM audit_log WHERE timestamp >= NOW() - INTERVAL \'24 hours\'')
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
          al.action, al.timestamp, al.table_name,
          u.username
        FROM audit_log al
        LEFT JOIN users u ON al.user_id = u.id
        ORDER BY al.timestamp DESC
        LIMIT 10
      `);

      // Storage usage (approximate)
      const storageResult = await pool.query(`
        SELECT 
          pg_size_pretty(pg_total_relation_size('posts')) as posts_size,
          pg_size_pretty(pg_database_size(current_database())) as total_size
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
        storage: storageResult.rows[0]
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
  }
);

// Manual data insertion for testing
router.post('/insert-sample-data', 
  authenticateToken, 
  authorizeRole(['admin']), 
  async (req, res) => {
    try {
      console.log('Inserting sample data...');
      
      // Sample categories
      const categories = [
        {wp_category_id: 2325, name: "25-0102-21-05", slug: "25-0102-21-05", parent_id: null, post_count: 1},
        {wp_category_id: 1121, name: "Intel Quick Updates", slug: "intel-quick-updates", parent_id: null, post_count: 3},
        {wp_category_id: 61, name: "2019", slug: "2019", parent_id: null, post_count: 50}
      ];
      
      // Insert categories
      for (const cat of categories) {
        await pool.query(`
          INSERT INTO categories (wp_category_id, name, slug, parent_id, post_count)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (wp_category_id) DO UPDATE SET
            name = EXCLUDED.name,
            slug = EXCLUDED.slug,
            post_count = EXCLUDED.post_count
        `, [cat.wp_category_id, cat.name, cat.slug, cat.parent_id, cat.post_count]);
      }
      
      // Sample posts
      const posts = [
        {
          wp_post_id: 160026,
          title: "Dan Worrell", 
          excerpt: "CHEROKEE MULTI-AGENCY NARCOTICS SQUAD CASE FILE CASE # 25-0102-21-05",
          wp_published_date: "2025-08-18T15:12:36",
          author_name: "Admin",
          category_id: 1, // Will be mapped to category with wp_category_id 2325
          status: "publish"
        },
        {
          wp_post_id: 159977,
          title: "Canton 202503672 Theft",
          excerpt: "Date: 08/18/2025 Time: 09:09:36 Analyst: Fanny Silberberg On August 13, 2025, Detective Porter...",
          wp_published_date: "2025-08-18T09:28:07", 
          author_name: "Admin",
          category_id: 2, // Will be mapped to Intel Quick Updates
          status: "publish"
        },
        {
          wp_post_id: 159969,
          title: "25M1178 Jermade WILLIAMS",
          excerpt: "Date: 08/18/2025 Time: 08:06:47 Analyst: Stephanie Hardison Charges: FTA (M)",
          wp_published_date: "2025-08-18T08:19:31",
          author_name: "Admin", 
          category_id: 2,
          status: "publish"
        }
      ];
      
      // Insert posts
      for (const post of posts) {
        await pool.query(`
          INSERT INTO posts (wp_post_id, title, excerpt, wp_published_date, author_name, category_id, status, ingested_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          ON CONFLICT (wp_post_id) DO UPDATE SET
            title = EXCLUDED.title,
            excerpt = EXCLUDED.excerpt,
            wp_published_date = EXCLUDED.wp_published_date
        `, [post.wp_post_id, post.title, post.excerpt, post.wp_published_date, post.author_name, post.category_id, post.status]);
      }
      
      res.json({
        success: true,
        message: 'Sample data inserted successfully',
        categoriesInserted: categories.length,
        postsInserted: posts.length
      });
      
    } catch (error) {
      console.error('Sample data insertion failed:', error);
      res.status(500).json({ 
        error: 'Sample data insertion failed',
        details: error.message
      });
    }
  }
);

// Test WordPress connection
router.get('/test-wordpress', 
  authenticateToken, 
  authorizeRole(['admin']), 
  async (req, res) => {
    try {
      console.log('Testing WordPress connection...');
      const response = await wpService.http.get('/posts', { params: { per_page: 1 } });
      
      res.json({
        success: true,
        message: 'WordPress API connection successful',
        samplePost: response.data[0] || null,
        totalPosts: response.headers['x-wp-total'] || 'unknown'
      });
    } catch (error) {
      console.error('WordPress connection test failed:', error);
      res.status(500).json({ 
        error: 'WordPress connection failed',
        details: error.message,
        url: wpService.baseUrl
      });
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
      console.log('WordPress API URL:', wpService.baseUrl);
      
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
      let paramIndex = 1;

      if (userId) {
        whereConditions.push(`al.user_id = $${paramIndex}`);
        queryParams.push(userId);
        paramIndex++;
      }

      if (action) {
        whereConditions.push(`al.action ILIKE $${paramIndex}`);
        queryParams.push(`%${action}%`);
        paramIndex++;
      }

      if (tableName) {
        whereConditions.push(`al.table_name = $${paramIndex}`);
        queryParams.push(tableName);
        paramIndex++;
      }

      if (dateFrom) {
        whereConditions.push(`al.timestamp >= $${paramIndex}`);
        queryParams.push(dateFrom);
        paramIndex++;
      }

      if (dateTo) {
        whereConditions.push(`al.timestamp <= $${paramIndex}`);
        queryParams.push(dateTo);
        paramIndex++;
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
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
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
          await pool.query('VACUUM ANALYZE posts');
          await pool.query('VACUUM ANALYZE categories');
          await pool.query('VACUUM ANALYZE audit_log');
          results.vacuum = 'completed';
          break;

        case 'reindex':
          await pool.query('REINDEX INDEX posts_search_idx');
          results.reindex = 'completed';
          break;

        case 'update_stats':
          await pool.query('ANALYZE posts');
          await pool.query('ANALYZE categories');
          results.stats = 'updated';
          break;

        case 'cleanup_old_audit':
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - 90); // Keep 90 days
          
          const cleanupResult = await pool.query(
            'DELETE FROM audit_log WHERE timestamp < $1',
            [cutoffDate]
          );
          results.audit_cleanup = `${cleanupResult.rowCount} records removed`;
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