const express = require('express');
const { pool } = require('../config/database');
const CronService = require('../services/cronService');
const axios = require('axios'); // Added axios for HTTP request testing

const router = express.Router();

// Health check endpoint
router.get('/', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: 'unknown',
      sync: 'unknown'
    };

    // Check database connectivity
    try {
      const dbResult = await pool.query('SELECT 1 as test');
      health.database = dbResult.rows.length > 0 ? 'connected' : 'error';
    } catch (dbError) {
      health.database = 'error';
      health.status = 'unhealthy';
    }

    // Check sync status if cron service is available
    try {
      if (global.cronService) {
        const syncStatus = global.cronService.getStatus();
        health.sync = syncStatus;
      } else {
        health.sync = 'service_not_available';
      }
    } catch (syncError) {
      health.sync = 'error';
    }

    // Check if any critical services are down
    if (health.database === 'error' || health.sync === 'error') {
      health.status = 'unhealthy';
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);

  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Detailed sync status endpoint
router.get('/sync', async (req, res) => {
  try {
    let syncStatus = {
      status: 'unknown',
      lastSync: null,
      nextSync: null,
      errors: [],
      uptime: process.uptime()
    };

    // Get last sync from database
    try {
      // First, let's check what columns exist in the audit_log table
      const tableInfoResult = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'audit_log'
      `);
      
      console.log('Available columns in audit_log:', tableInfoResult.rows.map(r => r.column_name));
      
      // Use the correct timestamp column (try common names)
      const timestampColumn = tableInfoResult.rows.find(r => 
        ['created_at', 'timestamp', 'created', 'date_created'].includes(r.column_name)
      )?.column_name || 'created_at';
      
      console.log('Using timestamp column:', timestampColumn);
      
      const lastSyncResult = await pool.query(`
        SELECT ${timestampColumn}, details 
        FROM audit_log 
        WHERE action IN ('SYNC_SUCCESS', 'SYNC_ERROR')
        ORDER BY ${timestampColumn} DESC 
        LIMIT 1
      `);

      if (lastSyncResult.rows.length > 0) {
        const lastLog = lastSyncResult.rows[0];
        syncStatus.lastSync = lastLog[timestampColumn];
        
        if (lastLog.action === 'SYNC_ERROR') {
          try {
            const details = JSON.parse(lastLog.details);
            syncStatus.errors.push({
              timestamp: lastLog[timestampColumn],
              error: details.error || 'Unknown error'
            });
          } catch (parseError) {
            syncStatus.errors.push({
              timestamp: lastLog[timestampColumn],
              error: 'Parse error in error details'
            });
          }
        }
      }

      // Get recent sync errors
      const errorResult = await pool.query(`
        SELECT ${timestampColumn}, details 
        FROM audit_log 
        WHERE action = 'SYNC_ERROR' 
        AND ${timestampColumn} > NOW() - INTERVAL '24 hours'
        ORDER BY ${timestampColumn} DESC 
        LIMIT 10
      `);

      errorResult.rows.forEach(row => {
        try {
          const details = JSON.parse(row.details);
          syncStatus.errors.push({
            timestamp: row[timestampColumn],
            error: details.error || 'Unknown error'
          });
        } catch (parseError) {
          // Skip malformed entries
        }
      });

      // Determine sync status
      if (syncStatus.lastSync) {
        const lastSyncTime = new Date(syncStatus.lastSync);
        const now = new Date();
        const timeDiff = now - lastSyncTime;
        const hoursDiff = timeDiff / (1000 * 60 * 60);

        if (hoursDiff < 1) {
          syncStatus.status = 'recent';
        } else if (hoursDiff < 6) {
          syncStatus.status = 'stale';
        } else {
          syncStatus.status = 'outdated';
        }
      } else {
        syncStatus.status = 'never';
      }

      // Get cron service status if available
      if (global.cronService) {
        const cronStatus = global.cronService.getStatus();
        syncStatus.cronService = cronStatus;
      }

    } catch (dbError) {
      console.error('Database error in sync status:', dbError);
      
      // Fallback: provide basic sync status without database
      syncStatus.status = 'unknown';
      syncStatus.lastSync = null;
      syncStatus.errors = [];
      
      // Try to get basic status from cron service if available
      if (global.cronService) {
        try {
          const cronStatus = global.cronService.getStatus();
          syncStatus.cronService = cronStatus;
          
          // If we have cron service info, we can infer some status
          if (cronStatus && cronStatus.lastRun) {
            syncStatus.lastSync = cronStatus.lastRun;
            syncStatus.status = 'available';
          }
        } catch (cronError) {
          console.error('Cron service error:', cronError);
        }
      }
      
      // Add the database error to the response for debugging
      syncStatus.databaseError = dbError.message;
    }

    res.json(syncStatus);

  } catch (error) {
    console.error('Sync status error:', error);
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

// Force sync endpoint
router.post('/sync/force', async (req, res) => {
    try {
        console.log('Force sync triggered via API');
        
        // Get WordPress URL from request body or use default
        const { wordpressUrl } = req.body;
        const targetUrl = wordpressUrl || process.env.WORDPRESS_URL || 'https://cmansrms.us';
        
        console.log(`Starting force sync from WordPress: ${targetUrl}`);
        
        // Perform the sync
        const result = await global.cronService.wordpressService.pullFromWordPressAPI(targetUrl);
        
        res.json({
            status: 'success',
            message: 'Force sync completed',
            timestamp: new Date().toISOString(),
            result: result
        });
        
    } catch (error) {
        console.error('Force sync failed:', error);
        res.status(500).json({
            status: 'error',
            message: 'Force sync failed',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Pull-based sync endpoint
router.post('/sync/pull', async (req, res) => {
    try {
        const { wordpressUrl } = req.body;
        const targetUrl = wordpressUrl || process.env.WORDPRESS_URL || 'https://cmansrms.us';
        
        console.log(`Pull-based sync triggered for: ${targetUrl}`);
        
        // Perform the sync
        const result = await global.cronService.wordpressService.pullFromWordPressAPI(targetUrl);
        
        res.json({
            status: 'success',
            message: 'Pull-based sync completed',
            timestamp: new Date().toISOString(),
            result: result
        });
        
    } catch (error) {
        console.error('Pull-based sync failed:', error);
        res.status(500).json({
            status: 'error',
            message: 'Pull-based sync failed',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Bulletproof pull sync - bypass all service classes
router.post('/sync/bulletproof', async (req, res) => {
    try {
        console.log('🚀 BULLETPROOF SYNC: Starting direct WordPress sync...');
        
        const { wordpressUrl } = req.body;
        const targetUrl = wordpressUrl || 'https://cmansrms.us';
        const baseUrl = targetUrl.endsWith('/') ? targetUrl : `${targetUrl}/`;
        
        console.log(`🎯 Target: ${baseUrl}`);
        
        // Step 1: Test connection
        console.log('📡 Step 1: Testing connection...');
        const axios = require('axios');
        
        const statusResponse = await axios.get(`${baseUrl}wp-json/threads-intel/v1/status`, {
            timeout: 30000,
            headers: { 'User-Agent': 'ThreadsIntel/1.0' }
        });
        
        if (statusResponse.status !== 200) {
            throw new Error(`Status endpoint failed: ${statusResponse.status}`);
        }
        
        console.log('✅ Connection test passed');
        
        // Step 2: Get categories
        console.log('📂 Step 2: Fetching categories...');
        const categoriesResponse = await axios.get(`${baseUrl}wp-json/threads-intel/v1/categories`, {
            timeout: 30000,
            headers: { 'User-Agent': 'ThreadsIntel/1.0' }
        });
        
        const categories = categoriesResponse.data;
        console.log(`✅ Found ${categories.length} categories`);
        
        // Step 3: Get posts (first page only for now)
        console.log('📝 Step 3: Fetching posts...');
        const postsResponse = await axios.get(`${baseUrl}wp-json/threads-intel/v1/posts?per_page=10&page=1`, {
            timeout: 30000,
            headers: { 'User-Agent': 'ThreadsIntel/1.0' }
        });
        
        const postsData = postsResponse.data;
        const posts = postsData.posts || [];
        console.log(`✅ Found ${posts.length} posts on first page`);
        
        // Step 4: Process data directly in database
        console.log('💾 Step 4: Processing data...');
        const { pool } = require('../../config/database');
        
        // Process categories
        let categoriesProcessed = 0;
        for (const category of categories.slice(0, 5)) { // Just first 5 for test
            try {
                await pool.query(
                    `INSERT INTO categories (wp_term_id, name, slug, description, parent_id, count, is_hidden) 
                     VALUES ($1, $2, $3, $4, $5, $6, false)
                     ON CONFLICT (wp_term_id) DO UPDATE SET
                     name = EXCLUDED.name,
                     slug = EXCLUDED.slug,
                     description = EXCLUDED.description,
                     parent_id = EXCLUDED.parent_id,
                     count = EXCLUDED.count,
                     updated_at = NOW()`,
                    [category.id, category.name, category.slug, category.description || '', category.parent || null, category.count || 0]
                );
                categoriesProcessed++;
            } catch (error) {
                console.error(`Failed to process category ${category.id}:`, error.message);
            }
        }
        
        // Process posts
        let postsProcessed = 0;
        for (const post of posts.slice(0, 5)) { // Just first 5 for test
            try {
                await pool.query(
                    `INSERT INTO posts (wp_post_id, title, content, excerpt, slug, status, author_id, author_name, 
                     published_at, modified_at, category_id, is_sticky, post_format, comment_count) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                     ON CONFLICT (wp_post_id) DO UPDATE SET
                     title = EXCLUDED.title,
                     content = EXCLUDED.content,
                     excerpt = EXCLUDED.excerpt,
                     slug = EXCLUDED.slug,
                     status = EXCLUDED.status,
                     author_name = EXCLUDED.author_name,
                     modified_at = EXCLUDED.modified_at,
                     category_id = EXCLUDED.category_id,
                     is_sticky = EXCLUDED.is_sticky,
                     post_format = EXCLUDED.post_format,
                     comment_count = EXCLUDED.comment_count,
                     updated_at = NOW()`,
                    [
                        post.id,
                        post.title?.rendered || post.title || '',
                        post.content?.rendered || post.content || '',
                        post.excerpt?.rendered || post.excerpt || '',
                        post.slug,
                        post.status,
                        post.author,
                        post.author_name,
                        new Date(post.date),
                        new Date(post.modified),
                        null, // category_id for now
                        post.sticky || false,
                        post.format || 'standard',
                        post.comment_count || 0
                    ]
                );
                postsProcessed++;
            } catch (error) {
                console.error(`Failed to process post ${post.id}:`, error.message);
            }
        }
        
        console.log(`✅ BULLETPROOF SYNC COMPLETED: ${categoriesProcessed} categories, ${postsProcessed} posts`);
        
        res.json({
            success: true,
            message: 'BULLETPROOF SYNC COMPLETED!',
            result: {
                categoriesProcessed,
                postsProcessed,
                timestamp: new Date().toISOString(),
                type: 'bulletproof'
            }
        });
        
    } catch (error) {
        console.error('❌ BULLETPROOF SYNC FAILED:', error);
        
        res.status(500).json({
            success: false,
            message: 'BULLETPROOF SYNC FAILED',
            error: error.message,
            errorCode: error.code,
            timestamp: new Date().toISOString()
        });
    }
});

// System metrics endpoint
router.get('/metrics', async (req, res) => {
  try {
    const metrics = {
      timestamp: new Date().toISOString(),
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        platform: process.platform,
        nodeVersion: process.version
      },
      database: {},
      sync: {}
    };

    // Database metrics
    try {
      const dbSizeResult = await pool.query(`
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      `);

      const tableCounts = await pool.query(`
        SELECT 
          'posts' as table_name, COUNT(*) as count FROM posts
        UNION ALL
        SELECT 'categories' as table_name, COUNT(*) as count FROM categories
        UNION ALL
        SELECT 'users' as table_name, COUNT(*) as count FROM users
        UNION ALL
        SELECT 'comments' as table_name, COUNT(*) as count FROM comments
        UNION ALL
        SELECT 'notifications' as table_name, COUNT(*) as count FROM notifications
        UNION ALL
        SELECT 'audit_log' as table_name, COUNT(*) as count FROM audit_log
      `);

      metrics.database = {
        tables: dbSizeResult.rows,
        counts: tableCounts.rows
      };

    } catch (dbError) {
      metrics.database = { error: dbError.message };
    }

    // Sync metrics
    if (global.cronService) {
      metrics.sync = global.cronService.getStatus();
    }

    res.json(metrics);

  } catch (error) {
    console.error('Metrics error:', error);
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

// Test external HTTP request endpoint
router.get('/test-http', async (req, res) => {
    try {
        console.log('Testing HTTP request to WordPress...');
        
        const response = await axios.get('https://cmansrms.us/wp-json/threads-intel/v1/status', {
            timeout: 10000,
            validateStatus: () => true
        });
        
        res.json({
            status: 'success',
            message: 'HTTP request test successful',
            wordpressStatus: response.status,
            wordpressData: response.data,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('HTTP request test failed:', error);
        res.status(500).json({
            status: 'error',
            message: 'HTTP request test failed',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Direct WordPress test - bypass all complex logic
router.get('/direct-wordpress-test', async (req, res) => {
    try {
        console.log('🚀 DIRECT TEST: Making HTTP request to WordPress...');
        
        // Use axios directly - no fancy service classes
        const axios = require('axios');
        const response = await axios.get('https://cmansrms.us/wp-json/threads-intel/v1/status', {
            timeout: 15000,
            headers: {
                'User-Agent': 'ThreadsIntel/1.0'
            }
        });
        
        console.log('✅ DIRECT TEST SUCCESS:', response.status);
        
        res.json({
            success: true,
            message: 'DIRECT TEST: Server CAN reach WordPress!',
            status: response.status,
            data: response.data,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ DIRECT TEST FAILED:', error.message);
        
        res.status(500).json({
            success: false,
            message: 'DIRECT TEST: Server CANNOT reach WordPress',
            error: error.message,
            errorCode: error.code,
            errorStack: error.stack,
            timestamp: new Date().toISOString()
        });
    }
});

// Test both HTTP and HTTPS to WordPress
router.get('/test-wordpress-connection', async (req, res) => {
    try {
        console.log('🧪 Testing WordPress connection with both HTTP and HTTPS...');
        
        const axios = require('axios');
        const results = {};
        
        // Test HTTPS (port 443)
        try {
            console.log('🔒 Testing HTTPS connection...');
            const httpsResponse = await axios.get('https://cmansrms.us/wp-json/threads-intel/v1/status', {
                timeout: 10000,
                headers: { 'User-Agent': 'ThreadsIntel/1.0' }
            });
            results.https = {
                success: true,
                status: httpsResponse.status,
                data: httpsResponse.data
            };
            console.log('✅ HTTPS connection successful');
        } catch (error) {
            results.https = {
                success: false,
                error: error.message,
                code: error.code
            };
            console.log('❌ HTTPS connection failed:', error.message);
        }
        
        // Test HTTP (port 80)
        try {
            console.log('🔓 Testing HTTP connection...');
            const httpResponse = await axios.get('http://cmansrms.us/wp-json/threads-intel/v1/status', {
                timeout: 10000,
                headers: { 'User-Agent': 'ThreadsIntel/1.0' }
            });
            results.http = {
                success: true,
                status: httpResponse.status,
                data: httpResponse.data
            };
            console.log('✅ HTTP connection successful');
        } catch (error) {
            results.http = {
                success: false,
                error: error.message,
                code: error.code
            };
            console.log('❌ HTTP connection failed:', error.message);
        }
        
        // Test with IP address directly
        try {
            console.log('🌐 Testing direct IP connection...');
            const ipResponse = await axios.get('http://20.158.6.234/wp-json/threads-intel/v1/status', {
                timeout: 10000,
                headers: { 'User-Agent': 'ThreadsIntel/1.0' }
            });
            results.directIP = {
                success: true,
                status: ipResponse.status,
                data: ipResponse.data
            };
            console.log('✅ Direct IP connection successful');
        } catch (error) {
            results.directIP = {
                success: false,
                error: error.message,
                code: error.code
            };
            console.log('❌ Direct IP connection failed:', error.message);
        }
        
        res.json({
            message: 'WordPress connection test results',
            results,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Connection test failed:', error);
        res.status(500).json({
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Get server IP and network info
router.get('/server-info', async (req, res) => {
    try {
        // Get server's IP address
        const serverIP = req.connection.remoteAddress || 
                        req.socket.remoteAddress || 
                        req.connection.socket?.remoteAddress ||
                        'unknown';
        
        // Get Vercel-specific info
        const vercelInfo = {
            isVercel: !!process.env.VERCEL,
            vercelUrl: process.env.VERCEL_URL,
            vercelRegion: process.env.VERCEL_REGION,
            vercelDeploymentUrl: process.env.VERCEL_DEPLOYMENT_URL
        };
        
        // Get request headers that might show IP
        const headers = {
            'x-forwarded-for': req.headers['x-forwarded-for'],
            'x-real-ip': req.headers['x-real-ip'],
            'x-vercel-forwarded-for': req.headers['x-vercel-forwarded-for'],
            'cf-connecting-ip': req.headers['cf-connecting-ip']
        };
        
        res.json({
            serverIP,
            headers,
            vercelInfo,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        res.status(500).json({
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Check external IP address
router.get('/external-ip', async (req, res) => {
    try {
        const axios = require('axios');
        const results = {};
        
        // Try multiple IP checking services
        const ipServices = [
            'https://api.ipify.org?format=json',
            'https://ipinfo.io/json',
            'https://httpbin.org/ip'
        ];
        
        for (const service of ipServices) {
            try {
                const response = await axios.get(service, { timeout: 5000 });
                results[service] = response.data;
            } catch (error) {
                results[service] = { error: error.message };
            }
        }
        
        res.json({
            message: 'External IP check results',
            results,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        res.status(500).json({
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;
