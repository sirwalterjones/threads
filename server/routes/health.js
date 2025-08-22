const express = require('express');
const { pool } = require('../config/database');
const CronService = require('../services/cronService');

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
      const lastSyncResult = await pool.query(`
        SELECT created_at, details 
        FROM audit_log 
        WHERE action IN ('SYNC_SUCCESS', 'SYNC_ERROR')
        ORDER BY created_at DESC 
        LIMIT 1
      `);

      if (lastSyncResult.rows.length > 0) {
        const lastLog = lastSyncResult.rows[0];
        syncStatus.lastSync = lastLog.created_at;
        
        if (lastLog.action === 'SYNC_ERROR') {
          try {
            const details = JSON.parse(lastLog.details);
            syncStatus.errors.push({
              timestamp: lastLog.created_at,
              error: details.error || 'Unknown error'
            });
          } catch (parseError) {
            syncStatus.errors.push({
              timestamp: lastLog.created_at,
              error: 'Parse error in error details'
            });
          }
        }
      }

      // Get recent sync errors
      const errorResult = await pool.query(`
        SELECT created_at, details 
        FROM audit_log 
        WHERE action = 'SYNC_ERROR' 
        AND created_at > NOW() - INTERVAL '24 hours'
        ORDER BY created_at DESC 
        LIMIT 10
      `);

      errorResult.rows.forEach(row => {
        try {
          const details = JSON.parse(row.details);
          syncStatus.errors.push({
            timestamp: row.created_at,
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
      syncStatus.status = 'database_error';
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

// Force sync endpoint (admin only)
router.post('/sync/force', async (req, res) => {
  try {
    // Check if cron service is available
    if (!global.cronService) {
      return res.status(503).json({
        status: 'error',
        message: 'Cron service not available'
      });
    }

    // Force a sync
    console.log('🔄 Force sync requested via health endpoint');
    await global.cronService.performWordPressSync();

    res.json({
      status: 'success',
      message: 'Force sync completed',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Force sync error:', error);
    res.status(500).json({
      status: 'error',
      error: error.message
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

module.exports = router;
