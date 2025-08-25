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

// Batch data insertion endpoint
router.post('/insert-batch-data', 
  authenticateToken, 
  authorizeRole(['admin']), 
  async (req, res) => {
    try {
      const { categories, posts } = req.body;
      
      if (!categories && !posts) {
        return res.status(400).json({ error: 'Categories or posts data required' });
      }
      
      let categoriesInserted = 0;
      let postsInserted = 0;
      
      // Insert categories if provided
      if (categories && categories.length > 0) {
        for (const cat of categories) {
          await pool.query(`
            INSERT INTO categories (wp_category_id, name, slug, parent_id, post_count)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (wp_category_id) DO UPDATE SET
              name = EXCLUDED.name,
              slug = EXCLUDED.slug,
              post_count = EXCLUDED.post_count
          `, [cat.id, cat.name, cat.slug, cat.parent || null, cat.count || 0]);
          categoriesInserted++;
        }
      }
      
      // Insert posts if provided
      if (posts && posts.length > 0) {
        // Get category mapping
        const categoryMap = {};
        const categoryResult = await pool.query('SELECT id, wp_category_id FROM categories');
        categoryResult.rows.forEach(row => {
          categoryMap[row.wp_category_id] = row.id;
        });
        
        for (const post of posts) {
          const categoryId = post.categories && post.categories.length > 0 
            ? categoryMap[post.categories[0]] || null
            : null;
            
          // Handle featured media
          const featuredMediaId = post.featured_media || null;
          const featuredMediaUrl = post.featured_media_url || null;
          
          // Handle author information
          const authorName = post.author_name || 'Unknown Author';
          const wpAuthorId = post.author || null;
          
          // Handle metadata and attachments
          const metadata = {
            wp_categories: post.categories || [],
            wp_tags: post.tags || [],
            wp_slug: post.slug || '',
            wp_link: post.link || '',
            wp_guid: post.guid?.rendered || '',
            wp_type: post.type || 'post',
            wp_format: post.format || 'standard',
            wp_meta: post.meta || {},
            featured_media: featuredMediaId,
            attachments: post.attachments || []
          };
          
          // Handle content properly - WordPress API sends content as object with .rendered property
          let postContent = '';
          if (typeof post.content === 'string') {
            postContent = post.content;
          } else if (post.content && typeof post.content === 'object') {
            postContent = post.content.rendered || post.content.raw || '';
          }
          
          console.log(`Processing post ${post.id}: content type = ${typeof post.content}, length = ${postContent.length}`);
          
          await pool.query(`
            INSERT INTO posts (
              wp_post_id, title, content, excerpt, slug, wp_published_date, wp_modified_date, 
              wp_author_id, author_name, category_id, status, featured_media_id, featured_media_url,
              metadata, ingested_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
            ON CONFLICT (wp_post_id) DO UPDATE SET
              title = EXCLUDED.title,
              content = EXCLUDED.content,
              excerpt = EXCLUDED.excerpt,
              slug = EXCLUDED.slug,
              wp_published_date = EXCLUDED.wp_published_date,
              wp_modified_date = EXCLUDED.wp_modified_date,
              wp_author_id = EXCLUDED.wp_author_id,
              author_name = EXCLUDED.author_name,
              category_id = EXCLUDED.category_id,
              featured_media_id = EXCLUDED.featured_media_id,
              featured_media_url = EXCLUDED.featured_media_url,
              metadata = EXCLUDED.metadata
          `, [
            post.id, 
            typeof post.title === 'string' ? post.title : (post.title?.rendered || ''),
            postContent,
            typeof post.excerpt === 'string' ? post.excerpt : (post.excerpt?.rendered || ''),
            post.slug || '',
            post.date,
            post.modified,
            wpAuthorId,
            authorName,
            categoryId,
            post.status,
            featuredMediaId,
            featuredMediaUrl,
            JSON.stringify(metadata)
          ]);
          postsInserted++;
        }
      }
      
      res.json({
        success: true,
        message: 'Batch data inserted successfully',
        categoriesInserted,
        postsInserted
      });
      
    } catch (error) {
      console.error('Batch data insertion failed:', error);
      res.status(500).json({ 
        error: 'Batch data insertion failed',
        details: error.message
      });
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

// Trigger WordPress incremental sync (new/updated posts only)
router.post('/ingest-wordpress-incremental', 
  authenticateToken, 
  authorizeRole(['admin']), 
  auditLog('wordpress_incremental_sync'),
  async (req, res) => {
    try {
      console.log('Starting WordPress incremental sync...');
      console.log('WordPress API URL:', wpService.baseUrl);
      console.log('Current environment variables:', {
        hasApiUrl: !!process.env.WORDPRESS_API_URL,
        hasUsername: !!process.env.WORDPRESS_USERNAME,
        hasPassword: !!process.env.WORDPRESS_PASSWORD,
        hasJwtToken: !!process.env.WORDPRESS_JWT_TOKEN
      });
      
      const result = await wpService.performIncrementalSync();
      
      res.json({
        message: 'WordPress incremental sync completed successfully',
        result
      });
    } catch (error) {
      console.error('WordPress incremental sync error:', error);
      res.status(500).json({ 
        error: 'WordPress incremental sync failed',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
);

// Direct ingest endpoint - receives WordPress data directly
router.post('/ingest-direct', 
  authenticateToken, 
  authorizeRole(['admin']), 
  auditLog('direct_wordpress_ingest'),
  async (req, res) => {
    try {
      console.log('Starting direct WordPress data ingest...');
      const { posts, categories, deleted_posts, timestamp, source } = req.body;
      
      if (!posts || !Array.isArray(posts)) {
        return res.status(400).json({ 
          error: 'Invalid data format',
          details: 'Posts array is required'
        });
      }
      
      console.log(`Received ${posts.length} posts, ${categories?.length || 0} categories, and ${deleted_posts?.length || 0} deleted posts from ${source}`);
      console.log('Sample post data:', JSON.stringify(posts[0], null, 2));
      if (deleted_posts && deleted_posts.length > 0) {
        console.log('Deleted posts:', deleted_posts);
      }
      
      const result = await wpService.ingestDirectData(posts, categories || [], deleted_posts || []);
      
      console.log('Ingest result:', result);
      
      res.json({
        message: 'Direct WordPress ingest completed successfully',
        result: result
      });
    } catch (error) {
      console.error('Direct WordPress ingest error:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({ 
        error: 'Direct WordPress ingest failed',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
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

// Cleanup deleted WordPress posts
router.post('/cleanup-deleted-posts', 
  authenticateToken, 
  authorizeRole(['admin']), 
  auditLog('cleanup_deleted_wordpress_posts'),
  async (req, res) => {
    try {
      console.log('Manual cleanup of deleted WordPress posts requested');
      const deletedCount = await wpService.cleanupDeletedPosts();
      
      res.json({
        message: 'Deleted WordPress posts cleanup completed',
        deletedCount,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Cleanup error:', error);
      res.status(500).json({ 
        error: 'Cleanup failed',
        details: error.message
      });
    }
  }
);

// Force delete specific WordPress post by ID
router.post('/force-delete-wp-post', 
  authenticateToken, 
  authorizeRole(['admin']), 
  auditLog('force_delete_wordpress_post'),
  async (req, res) => {
    try {
      const { wpPostId } = req.body;
      
      if (!wpPostId) {
        return res.status(400).json({ error: 'wpPostId is required' });
      }
      
      console.log(`Force deleting WordPress post ID: ${wpPostId}`);
      
      // Delete the post from our database
      const deleteResult = await pool.query(`
        DELETE FROM posts 
        WHERE wp_post_id = $1
        RETURNING id, title, wp_post_id
      `, [wpPostId]);
      
      if (deleteResult.rowCount === 0) {
        return res.status(404).json({ 
          error: 'Post not found',
          message: `No post found with WordPress ID: ${wpPostId}`
        });
      }
      
      const deletedPost = deleteResult.rows[0];
      console.log(`Successfully deleted post: ${deletedPost.title} (WP ID: ${deletedPost.wp_post_id})`);
      
      res.json({
        message: 'WordPress post force deleted successfully',
        deletedPost,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Force delete error:', error);
      res.status(500).json({ 
        error: 'Force delete failed',
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

// Create audit log entry (for client-side logging)
router.post('/audit/log', authenticateToken, async (req, res) => {
  try {
    const { action, table_name, record_id, meta } = req.body;

    if (!action || !table_name) {
      return res.status(400).json({ error: 'Action and table_name are required' });
    }

    const result = await pool.query(
      `INSERT INTO audit_log (user_id, action, table_name, record_id, new_values, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        req.user.id,
        action,
        table_name,
        record_id || null,
        meta ? JSON.stringify(meta) : null,
        req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0].trim() : req.ip
      ]
    );

    res.status(201).json({ 
      message: 'Audit log entry created',
      id: result.rows[0].id 
    });
  } catch (error) {
    console.error('Error creating audit log entry:', error);
    res.status(500).json({ error: 'Failed to create audit log entry' });
  }
});

// Database migration endpoint - add exact_match column to hot_lists
router.post('/migrate-hotlists', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    console.log('🔄 Starting migration: Adding exact_match column to hot_lists table...');
    
    // Check if column already exists
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'hot_lists' AND column_name = 'exact_match'
    `);
    
    if (checkColumn.rows.length > 0) {
      console.log('✅ Column exact_match already exists in hot_lists table');
      return res.json({ 
        message: 'Migration already completed',
        status: 'skipped',
        details: 'Column exact_match already exists'
      });
    }
    
    // Add the exact_match column with default value false
    await pool.query(`
      ALTER TABLE hot_lists 
      ADD COLUMN exact_match BOOLEAN NOT NULL DEFAULT false
    `);
    
    console.log('✅ Successfully added exact_match column to hot_lists table');
    
    // Update existing hot lists to have exact_match = false (word-based matching)
    const updateResult = await pool.query(`
      UPDATE hot_lists 
      SET exact_match = false 
      WHERE exact_match IS NULL
    `);
    
    console.log(`✅ Updated ${updateResult.rowCount} existing hot lists to use word-based matching`);
    
    res.json({ 
      message: 'Migration completed successfully',
      status: 'completed',
      details: `Added exact_match column and updated ${updateResult.rowCount} existing hot lists`
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    res.status(500).json({ 
      error: 'Migration failed', 
      details: error.message 
    });
  }
});

// Database migration endpoint - add 2FA columns to users table
router.post('/migrate-2fa', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    console.log('🔄 Starting migration: Adding 2FA columns to users table...');
    
    // Check if columns already exist
    const checkColumns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name IN ('totp_secret', 'totp_enabled', 'totp_backup_codes', 'force_2fa_setup')
    `);
    
    if (checkColumns.rows.length === 4) {
      console.log('✅ All 2FA columns already exist in users table');
      return res.json({ 
        message: 'Migration already completed',
        status: 'skipped',
        details: 'All 2FA columns already exist'
      });
    }
    
    // Add 2FA columns
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(255),
      ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS totp_backup_codes TEXT[],
      ADD COLUMN IF NOT EXISTS force_2fa_setup BOOLEAN DEFAULT true;
    `);
    
    console.log('✅ Successfully added 2FA columns to users table');
    
    res.json({ 
      message: '2FA migration completed successfully',
      status: 'completed',
      details: 'Added totp_secret, totp_enabled, totp_backup_codes, and force_2fa_setup columns'
    });
    
  } catch (error) {
    console.error('❌ 2FA migration failed:', error);
    res.status(500).json({ 
      error: '2FA migration failed', 
      details: error.message 
    });
  }
});

// Reset user password endpoint
router.post('/reset-user-password', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { username, newPassword } = req.body;
    
    if (!username || !newPassword) {
      return res.status(400).json({ error: 'Username and new password are required' });
    }
    
    // Check if user exists
    const userResult = await pool.query(
      'SELECT id, username FROM users WHERE username = $1',
      [username]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Hash the new password
    const bcrypt = require('bcryptjs');
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);
    
    // Update the password
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE username = $2',
      [passwordHash, username]
    );
    
    console.log(`✅ Password reset for user: ${username}`);
    
    res.json({ 
      message: 'Password reset successfully',
      username: username
    });
    
  } catch (error) {
    console.error('❌ Password reset failed:', error);
    res.status(500).json({ 
      error: 'Password reset failed', 
      details: error.message 
    });
  }
});

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

// Migrate WordPress categories to live system
router.post('/migrate-categories', 
  authenticateToken, 
  authorizeRole(['admin']), 
  auditLog('migrate_wordpress_categories'),
  async (req, res) => {
    try {
      const { categories } = req.body;
      
      if (!categories || !Array.isArray(categories)) {
        return res.status(400).json({ error: 'Categories array required' });
      }
      
      console.log(`Starting migration of ${categories.length} WordPress categories...`);
      
      // Clear existing category assignments first, then categories
      await pool.query('UPDATE posts SET category_id = NULL');
      await pool.query('DELETE FROM categories');
      console.log('Cleared existing categories and assignments');
      
      // Create Intel Quick Updates default category first
      await pool.query(`
        INSERT INTO categories (name, slug, parent_id, post_count, wp_category_id)
        VALUES ('Intel Quick Updates', 'intel-quick-updates', NULL, 0, NULL)
      `);
      
      // Create category mapping for parent relationships
      const categoryMap = new Map(); // wp_id -> local_id
      let createdCount = 0;
      let parentRelationships = [];
      
      // First pass: Create all categories without parent relationships
      for (const cat of categories) {
        const result = await pool.query(`
          INSERT INTO categories (wp_category_id, name, slug, parent_id, post_count)
          VALUES ($1, $2, $3, NULL, $4)
          RETURNING id
        `, [cat.wp_category_id, cat.name, cat.slug, cat.post_count || 0]);
        
        categoryMap.set(cat.wp_category_id, result.rows[0].id);
        
        // Store parent relationships to process later
        if (cat.parent_wp_id && cat.parent_wp_id !== 0) {
          parentRelationships.push({
            childId: result.rows[0].id,
            parentWpId: cat.parent_wp_id
          });
        }
        
        createdCount++;
      }
      
      // Second pass: Update parent relationships
      let hierarchyCount = 0;
      for (const rel of parentRelationships) {
        const parentLocalId = categoryMap.get(rel.parentWpId);
        if (parentLocalId) {
          await pool.query(
            'UPDATE categories SET parent_id = $1 WHERE id = $2',
            [parentLocalId, rel.childId]
          );
          hierarchyCount++;
        }
      }
      
      console.log(`Created ${createdCount} categories with ${hierarchyCount} parent-child relationships`);
      
      res.json({
        success: true,
        message: 'WordPress categories migrated successfully',
        categoriesCreated: createdCount,
        hierarchyRelationships: hierarchyCount,
        totalCategories: createdCount + 1 // +1 for Intel Quick Updates
      });
      
    } catch (error) {
      console.error('Category migration failed:', error);
      res.status(500).json({ 
        error: 'Category migration failed',
        details: error.message
      });
    }
  }
);

// Assign posts to WordPress categories based on content
router.post('/assign-posts-categories', 
  authenticateToken, 
  authorizeRole(['admin']), 
  auditLog('assign_posts_to_categories'),
  async (req, res) => {
    try {
      console.log('Starting post-to-category assignment process...');
      
      // Get default category ID
      const defaultResult = await pool.query(
        "SELECT id FROM categories WHERE slug = 'intel-quick-updates'"
      );
      const defaultCategoryId = defaultResult.rows[0].id;
      
      // First, assign all posts to default category
      await pool.query('UPDATE posts SET category_id = $1', [defaultCategoryId]);
      console.log('All posts assigned to Intel Quick Updates');
      
      // Get all categories with their slugs
      const categoriesResult = await pool.query(
        'SELECT id, slug FROM categories WHERE slug != $1',
        ['intel-quick-updates']
      );
      
      let assignmentCount = 0;
      const assignments = [];
      
      // Assign posts to specific categories based on content matching
      for (const category of categoriesResult.rows) {
        const result = await pool.query(`
          UPDATE posts 
          SET category_id = $1 
          WHERE content LIKE $2
          RETURNING id
        `, [category.id, `%/category/${category.slug}/%`]);
        
        if (result.rowCount > 0) {
          assignmentCount += result.rowCount;
          assignments.push({
            categorySlug: category.slug,
            postsAssigned: result.rowCount
          });
          
          if (result.rowCount > 0) {
            console.log(`Assigned ${result.rowCount} posts to category: ${category.slug}`);
          }
        }
      }
      
      // Update post counts for all categories
      await pool.query(`
        UPDATE categories 
        SET post_count = (
          SELECT COUNT(*) 
          FROM posts 
          WHERE posts.category_id = categories.id
        )
      `);
      
      // Remove empty categories (except Intel Quick Updates)
      const emptyResult = await pool.query(`
        DELETE FROM categories 
        WHERE post_count = 0 AND slug != 'intel-quick-updates'
        RETURNING slug
      `);
      
      console.log(`Assignment complete: ${assignmentCount} posts assigned to specific categories`);
      console.log(`Removed ${emptyResult.rowCount} empty categories`);
      
      res.json({
        success: true,
        message: 'Post assignments completed successfully',
        totalAssignments: assignmentCount,
        categoriesWithPosts: assignments.length,
        emptyCategoriesRemoved: emptyResult.rowCount,
        topAssignments: assignments.sort((a, b) => b.postsAssigned - a.postsAssigned).slice(0, 10)
      });
      
    } catch (error) {
      console.error('Post assignment failed:', error);
      res.status(500).json({ 
        error: 'Post assignment failed',
        details: error.message
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
          
        case 'add_media_columns':
          // Add featured media columns to posts table if they don't exist
          try {
            await pool.query(`
              ALTER TABLE posts 
              ADD COLUMN IF NOT EXISTS featured_media_id INTEGER,
              ADD COLUMN IF NOT EXISTS featured_media_url TEXT,
              ADD COLUMN IF NOT EXISTS attachments TEXT
            `);
            results.schema_update = 'Added featured media columns to posts table';
          } catch (schemaError) {
            results.schema_error = schemaError.message;
          }
          break;

        case 'fix_category_assignments':
          // Fix category assignments using WordPress metadata - simple direct mapping
          try {
            console.log('Starting simple WordPress category assignment...');
            
            // Get mapping of WordPress category IDs to local category IDs
            const categoryMappingResult = await pool.query(`
              SELECT id, wp_category_id 
              FROM categories 
              WHERE wp_category_id IS NOT NULL
            `);
            
            const categoryMap = {};
            categoryMappingResult.rows.forEach(row => {
              categoryMap[row.wp_category_id] = row.id;
            });
            
            console.log(`Found ${Object.keys(categoryMap).length} WordPress->Local category mappings`);
            
            // Get all posts with their WordPress category metadata  
            const postsResult = await pool.query(`
              SELECT id, metadata 
              FROM posts 
              WHERE metadata IS NOT NULL AND metadata::text LIKE '%wp_categories%'
            `);
            
            console.log(`Processing ${postsResult.rows.length} posts with WordPress category data...`);
            
            let assignmentCount = 0;
            const assignments = {};
            
            // Process posts in batches to avoid timeouts
            const batchSize = 100;
            for (let i = 0; i < postsResult.rows.length; i += batchSize) {
              const batch = postsResult.rows.slice(i, i + batchSize);
              
              for (const post of batch) {
                try {
                  const metadata = typeof post.metadata === 'string' 
                    ? JSON.parse(post.metadata) 
                    : post.metadata;
                  
                  if (metadata.wp_categories && Array.isArray(metadata.wp_categories) && metadata.wp_categories.length > 0) {
                    // Use the first WordPress category ID (primary category)
                    const wpCategoryId = metadata.wp_categories[0];
                    const localCategoryId = categoryMap[wpCategoryId];
                    
                    if (localCategoryId) {
                      // Update the post's category to match WordPress assignment
                      await pool.query(
                        'UPDATE posts SET category_id = $1 WHERE id = $2',
                        [localCategoryId, post.id]
                      );
                      
                      assignmentCount++;
                      assignments[wpCategoryId] = (assignments[wpCategoryId] || 0) + 1;
                    }
                  }
                } catch (parseError) {
                  // Skip posts with invalid metadata
                }
              }
              
              // Log progress
              if ((i + batchSize) % 1000 === 0) {
                console.log(`Processed ${Math.min(i + batchSize, postsResult.rows.length)} posts...`);
              }
            }
            
            // Update post counts for all categories  
            console.log('Updating category post counts...');
            await pool.query(`
              UPDATE categories 
              SET post_count = (
                SELECT COUNT(*) 
                FROM posts 
                WHERE posts.category_id = categories.id
              )
            `);
            
            results.category_fix = {
              postsProcessed: postsResult.rows.length,
              postsReassigned: assignmentCount,
              categoriesUsed: Object.keys(assignments).length,
              topAssignments: Object.entries(assignments)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 15)
                .map(([wpId, count]) => ({ wpCategoryId: wpId, postsAssigned: count }))
            };
            
            console.log(`WordPress category assignment complete: ${assignmentCount} posts properly assigned`);
            
          } catch (fixError) {
            results.category_fix_error = fixError.message;
            console.error('Category assignment fix failed:', fixError);
          }
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

// Get expiring posts for the expiration management page
router.get('/expiring-posts',
  authenticateToken,
  authorizeRole(['admin']),
  async (req, res) => {
    try {
      const { page = 1, limit = 100, daysUntilExpiry = 30 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      
      const query = `
        SELECT 
          p.id,
          p.title,
          p.content,
          p.excerpt,
          p.slug,
          p.wp_published_date,
          p.retention_date,
          p.author_name,
          p.wp_author_id,
          c.name as category_name,
          c.slug as category_slug
        FROM posts p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.retention_date <= NOW() + INTERVAL '${parseInt(daysUntilExpiry)} days'
        ORDER BY p.retention_date ASC
        LIMIT $1 OFFSET $2
      `;
      
      const countQuery = `
        SELECT COUNT(*) as total
        FROM posts p
        WHERE p.retention_date <= NOW() + INTERVAL '${parseInt(daysUntilExpiry)} days'
      `;
      
      const [postsResult, countResult] = await Promise.all([
        pool.query(query, [parseInt(limit), offset]),
        pool.query(countQuery)
      ]);
      
      const posts = postsResult.rows;
      const totalCount = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(totalCount / parseInt(limit));
      
      res.json({
        posts,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          hasNextPage: parseInt(page) < totalPages,
          hasPreviousPage: parseInt(page) > 1
        }
      });
      
    } catch (error) {
      console.error('Error fetching expiring posts:', error);
      res.status(500).json({
        error: 'Failed to fetch expiring posts',
        details: error.message
      });
    }
  }
);

// Update retention date for a single post
router.put('/posts/:id/retention',
  authenticateToken,
  authorizeRole(['admin']),
  auditLog('update_post_retention'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { retentionDays } = req.body;
      
      if (!retentionDays || retentionDays < 1) {
        return res.status(400).json({ error: 'Valid retention days required' });
      }
      
      const query = `
        UPDATE posts 
        SET retention_date = NOW() + INTERVAL '${parseInt(retentionDays)} days'
        WHERE id = $1
        RETURNING id, title, retention_date
      `;
      
      const result = await pool.query(query, [parseInt(id)]);
      
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Post not found' });
      }
      
      console.log(`Updated post ${id} retention to ${retentionDays} days`);
      
      res.json({
        success: true,
        message: 'Post retention updated successfully',
        post: result.rows[0]
      });
      
    } catch (error) {
      console.error('Error updating post retention:', error);
      res.status(500).json({
        error: 'Failed to update post retention',
        details: error.message
      });
    }
  }
);

// Bulk update retention dates for multiple posts
router.put('/posts/bulk-retention',
  authenticateToken,
  authorizeRole(['admin']),
  auditLog('bulk_update_post_retention'),
  async (req, res) => {
    try {
      const { postIds, retentionDays } = req.body;
      
      if (!postIds || !Array.isArray(postIds) || postIds.length === 0) {
        return res.status(400).json({ error: 'Post IDs array required' });
      }
      
      if (!retentionDays || retentionDays < 1) {
        return res.status(400).json({ error: 'Valid retention days required' });
      }
      
      const placeholders = postIds.map((_, index) => `$${index + 1}`).join(',');
      
      const query = `
        UPDATE posts 
        SET retention_date = NOW() + INTERVAL '${parseInt(retentionDays)} days'
        WHERE id IN (${placeholders})
        RETURNING id, title, retention_date
      `;
      
      const result = await pool.query(query, postIds.map(id => parseInt(id)));
      
      console.log(`Bulk updated ${result.rowCount} posts retention to ${retentionDays} days`);
      
      res.json({
        success: true,
        message: `Updated ${result.rowCount} posts successfully`,
        updatedCount: result.rowCount,
        posts: result.rows
      });
      
    } catch (error) {
      console.error('Error bulk updating post retention:', error);
      res.status(500).json({
        error: 'Failed to bulk update post retention',
        details: error.message
      });
    }
  }
);

module.exports = router;