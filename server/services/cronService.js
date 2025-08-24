const cron = require('node-cron');
const axios = require('axios');
const { pool } = require('../config/database');
const WordPressService = require('./wordpressService');

class CronService {
  constructor() {
    this.syncJobs = new Map();
    this.lastSyncStatus = {
      success: false,
      lastAttempt: null,
      lastSuccess: null,
      errorCount: 0,
      lastError: null
    };
    this.isRunning = false;
    
    // Initialize WordPress service for pull-based sync
    this.wordpressService = new WordPressService();
  }

  // Initialize all cron jobs
  init() {
    console.log('🚀 Initializing Cron Service...');
    
    // WordPress sync every 5 minutes
    this.scheduleWordPressSync();
    
    // Health check every minute
    this.scheduleHealthCheck();
    
    // Cleanup old data daily at 2 AM
    this.scheduleCleanup();
    
    // Force sync every hour as backup
    this.scheduleBackupSync();
    
    // Hot List checking every 10 minutes
    this.scheduleHotListCheck();
    
    console.log('✅ Cron Service initialized successfully');
  }

  // Schedule WordPress sync every 5 minutes
  scheduleWordPressSync() {
    const job = cron.schedule('*/5 * * * *', async () => {
      console.log('⏰ WordPress sync cron triggered at:', new Date().toISOString());
      await this.performWordPressSync();
    }, {
      scheduled: true,
      timezone: "UTC"
    });

    this.syncJobs.set('wordpress', job);
    console.log('📅 WordPress sync scheduled: every 5 minutes');
  }

  // Schedule health check every minute
  scheduleHealthCheck() {
    const job = cron.schedule('* * * * *', async () => {
      await this.performHealthCheck();
    }, {
      scheduled: true,
      timezone: "UTC"
    });

    this.syncJobs.set('health', job);
    console.log('📊 Health check scheduled: every minute');
  }

  // Schedule cleanup daily at 2 AM UTC
  scheduleCleanup() {
    const job = cron.schedule('0 2 * * *', async () => {
      console.log('🧹 Cleanup cron triggered at:', new Date().toISOString());
      await this.performCleanup();
    }, {
      scheduled: true,
      timezone: "UTC"
    });

    this.syncJobs.set('cleanup', job);
    console.log('🗑️ Cleanup scheduled: daily at 2 AM UTC');
  }

  // Schedule backup sync every hour
  scheduleBackupSync() {
    const job = cron.schedule('0 * * * *', async () => {
      console.log('🔄 Backup sync cron triggered at:', new Date().toISOString());
      await this.performBackupSync();
    }, {
      scheduled: true,
      timezone: "UTC"
    });

    this.syncJobs.set('backup', job);
    console.log('🛡️ Backup sync scheduled: every hour');
  }

  /**
   * Perform WordPress sync using pull-based approach
   */
  async performWordPressSync() {
    try {
      console.log('Starting WordPress sync (pull-based)...');
      
      // Get WordPress URL from environment or use default
      const wordpressUrl = process.env.WORDPRESS_URL || 'https://cmansrms.us';
      
      // Use the new pull-based method
      const result = await this.wordpressService.pullFromWordPressAPI(wordpressUrl);
      
      console.log('WordPress sync completed successfully:', result);
      
      // Update sync status
      this.lastSyncStatus = {
        success: true,
        lastAttempt: new Date(),
        lastSuccess: new Date(),
        errorCount: 0,
        lastError: null
      };
      
      return result;
      
    } catch (error) {
      console.error('WordPress sync failed:', error);
      
      // Update sync status
      this.lastSyncStatus = {
        success: false,
        lastAttempt: new Date(),
        lastSuccess: this.lastSyncStatus?.lastSuccess || null,
        errorCount: (this.lastSyncStatus?.errorCount || 0) + 1,
        lastError: error.message
      };
      
      // Log the error
      this.logSyncError(error);
      
      throw error;
    }
  }

  // Method 1: Sync from WordPress API
  async syncFromWordPressAPI() {
    try {
      if (!process.env.WORDPRESS_API_URL) {
        console.log('⚠️ WordPress API URL not configured, skipping API sync');
        return false;
      }

      console.log('📡 Attempting WordPress API sync...');
      
      // This would use the existing WordPress service
      // For now, we'll return false to trigger fallback
      return false;
      
    } catch (error) {
      console.error('❌ WordPress API sync error:', error.message);
      return false;
    }
  }

  // Method 2: Sync from WordPress plugin endpoint
  async syncFromWordPressPlugin() {
    try {
      console.log('🔌 Attempting WordPress plugin sync...');
      
      // Try to trigger sync via WordPress plugin
      const response = await axios.post(`${process.env.WORDPRESS_SITE_URL}/wp-admin/admin-ajax.php`, {
        action: 'threads_intel_trigger_sync'
      }, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (response.status === 200) {
        console.log('✅ WordPress plugin sync triggered successfully');
        return true;
      }

      return false;
      
    } catch (error) {
      console.error('❌ WordPress plugin sync error:', error.message);
      return false;
    }
  }

  // Method 3: Manual sync with retry logic
  async performManualSync() {
    try {
      console.log('🛠️ Performing manual sync...');
      
      // This would trigger a manual sync process
      // For now, we'll return false
      return false;
      
    } catch (error) {
      console.error('❌ Manual sync error:', error.message);
      return false;
    }
  }

  // Perform health check
  async performHealthCheck() {
    try {
      // Check database connectivity
      const dbCheck = await pool.query('SELECT 1');
      
      // Check last sync status
      const lastSync = await this.getLastSyncStatus();
      
      // Log health status
      if (dbCheck.rows.length > 0) {
        console.log('💚 Health check passed - DB connected, last sync:', lastSync);
      } else {
        console.log('💔 Health check failed - DB connection issue');
      }
      
    } catch (error) {
      console.error('❌ Health check error:', error.message);
    }
  }

  // Perform cleanup tasks
  async performCleanup() {
    try {
      console.log('🧹 Starting cleanup tasks...');
      
      // Clean up old audit logs (keep last 90 days)
      const auditResult = await pool.query(`
        DELETE FROM audit_log 
        WHERE created_at < NOW() - INTERVAL '90 days'
      `);
      
      // Clean up old notifications (keep last 30 days)
      const notificationResult = await pool.query(`
        DELETE FROM notifications 
        WHERE created_at < NOW() - INTERVAL '30 days'
      `);
      
      console.log(`✅ Cleanup completed: ${auditResult.rowCount} audit logs, ${notificationResult.rowCount} notifications removed`);
      
    } catch (error) {
      console.error('❌ Cleanup error:', error.message);
    }
  }

  // Perform backup sync
  async performBackupSync() {
    try {
      console.log('🛡️ Starting backup sync...');
      
      // If primary sync hasn't succeeded in the last 2 hours, force a sync
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      
      if (!this.lastSyncStatus.lastSuccess || this.lastSyncStatus.lastSuccess < twoHoursAgo) {
        console.log('⚠️ Primary sync hasn\'t succeeded recently, forcing backup sync...');
        await this.performWordPressSync();
      } else {
        console.log('✅ Primary sync is working, backup sync not needed');
      }
      
    } catch (error) {
      console.error('❌ Backup sync error:', error.message);
    }
  }

  // Schedule Hot List checking every 1 minute
  scheduleHotListCheck() {
    const job = cron.schedule('* * * * *', async () => {
      console.log('🔥 Hot List check cron triggered at:', new Date().toISOString());
      await this.performHotListCheck();
    }, {
      scheduled: true,
      timezone: "UTC"
    });
    
    this.syncJobs.set('hotListCheck', job);
    console.log('📅 Hot List check scheduled for every 1 minute');
  }

  // Perform Hot List check
  async performHotListCheck() {
    try {
      console.log('🔍 Starting Hot List check...');
      
      // Get all active hot lists
      const hotListsResult = await pool.query(`
        SELECT id, user_id, search_term
        FROM hot_lists
        WHERE is_active = true
      `);
      
      if (hotListsResult.rows.length === 0) {
        console.log('📝 No active hot lists found');
        return;
      }
      
      console.log(`🔍 Found ${hotListsResult.rows.length} active hot lists to check`);
      
      // Get posts from the last 2 minutes to check against hot lists
      const recentPostsResult = await pool.query(`
        SELECT id, title, content, excerpt, author_name
        FROM posts
        WHERE ingested_at > NOW() - INTERVAL '2 minutes'
        ORDER BY ingested_at DESC
      `);
      
      if (recentPostsResult.rows.length === 0) {
        console.log('📝 No recent posts to check');
        return;
      }
      
      console.log(`📋 Checking ${recentPostsResult.rows.length} recent posts against hot lists`);
      
      let alertsCreated = 0;
      
      // Check each hot list against each recent post
      for (const hotList of hotListsResult.rows) {
        const searchTerm = hotList.search_term.toLowerCase();
        
        for (const post of recentPostsResult.rows) {
          const searchableContent = `${post.title} ${post.content || ''} ${post.excerpt || ''}`.toLowerCase();
          
          if (searchableContent.includes(searchTerm)) {
            // Check if we already have an alert for this combination
            const existingAlert = await pool.query(`
              SELECT id FROM hot_list_alerts
              WHERE hot_list_id = $1 AND post_id = $2
            `, [hotList.id, post.id]);
            
            if (existingAlert.rows.length === 0) {
              // Create new alert
              const highlightedContent = this.createHighlightedContent(searchableContent, searchTerm, post.title);
              
              await pool.query(`
                INSERT INTO hot_list_alerts (hot_list_id, post_id, highlighted_content, created_at, is_read)
                VALUES ($1, $2, $3, NOW(), false)
              `, [hotList.id, post.id, highlightedContent]);
              
              // Also create a notification for the user
              await pool.query(`
                INSERT INTO notifications (user_id, type, title, message, data, related_post_id, created_at)
                VALUES ($1, 'hot_list_alert', $2, $3, $4, $5, NOW())
              `, [
                hotList.user_id,
                `Hot List Alert: "${hotList.search_term}"`,
                `New post matches your hot list search: "${post.title}"`,
                JSON.stringify({
                  hotListId: hotList.id,
                  searchTerm: hotList.search_term,
                  postId: post.id,
                  postTitle: post.title,
                  authorName: post.author_name
                }),
                post.id
              ]);
              
              alertsCreated++;
              console.log(`🔥 Created hot list alert for user ${hotList.user_id}, search: "${hotList.search_term}", post: "${post.title}"`);
            }
          }
        }
      }
      
      console.log(`✅ Hot List check completed. Created ${alertsCreated} new alerts`);
      
    } catch (error) {
      console.error('❌ Hot List check error:', error.message);
    }
  }

  // Create highlighted content for hot list alerts
  createHighlightedContent(content, searchTerm, title) {
    // Find the first occurrence of the search term and create a snippet around it
    const termIndex = content.indexOf(searchTerm.toLowerCase());
    if (termIndex === -1) return title;
    
    // Get context around the term (50 characters before and after)
    const start = Math.max(0, termIndex - 50);
    const end = Math.min(content.length, termIndex + searchTerm.length + 50);
    
    let snippet = content.substring(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';
    
    return snippet;
  }

  // Log sync errors to database
  async logSyncError(error) {
    try {
      await pool.query(`
        INSERT INTO audit_log (user_id, action, details, ip_address, user_agent)
        VALUES (NULL, 'SYNC_ERROR', $1, 'SYSTEM', 'CRON_SERVICE')
      `, [JSON.stringify({
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        syncMethod: 'cron'
      })]);
    } catch (dbError) {
      console.error('❌ Failed to log sync error to database:', dbError.message);
    }
  }

  // Get last sync status
  async getLastSyncStatus() {
    try {
      const result = await pool.query(`
        SELECT created_at, details 
        FROM audit_log 
        WHERE action = 'SYNC_ERROR' 
        ORDER BY created_at DESC 
        LIMIT 1
      `);
      
      if (result.rows.length > 0) {
        return {
          lastError: result.rows[0].created_at,
          errorDetails: JSON.parse(result.rows[0].details)
        };
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error getting last sync status:', error.message);
      return null;
    }
  }

  // Get service status
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastSyncStatus: this.lastSyncStatus,
      activeJobs: Array.from(this.syncJobs.keys()),
      uptime: process.uptime()
    };
  }

  // Stop all cron jobs
  stop() {
    console.log('🛑 Stopping Cron Service...');
    
    for (const [name, job] of this.syncJobs) {
      job.stop();
      console.log(`⏹️ Stopped ${name} job`);
    }
    
    this.syncJobs.clear();
    console.log('✅ Cron Service stopped');
  }

  // Restart all cron jobs
  restart() {
    console.log('🔄 Restarting Cron Service...');
    this.stop();
    this.init();
  }
}

module.exports = CronService;
