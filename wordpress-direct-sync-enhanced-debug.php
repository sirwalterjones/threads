<?php
/**
 * Enhanced WordPress Direct Sync for Threads Intel System - DEBUG VERSION
 *
 * This plugin provides multiple sync mechanisms to ensure reliable data transfer
 * to the Threads Intel system, even when WordPress cron is unreliable.
 *
 * Features:
 * - Multiple sync triggers (cron, post save, manual)
 * - Retry logic with exponential backoff
 * - Health monitoring and status reporting
 * - Fallback sync methods
 * - Detailed logging and error handling
 * - DEBUG MODE: Enhanced error reporting and status display
 */

/*
Plugin Name: Threads Intel Enhanced Direct Sync - DEBUG
Description: Enhanced direct sync with multiple fallback mechanisms for Threads Intel system - DEBUG VERSION
Version: 3.0-DEBUG
Author: Threads Intel Team
*/

if (!defined('ABSPATH')) {
    exit;
}

class ThreadsIntelEnhancedSyncDebug {

    private $vercel_api_base = 'https://cso.vectoronline.us/api';
    private $admin_username = 'admin';
    private $admin_password = 'admin123456';
    private $auth_token = null;
    private $last_sync_time = null;
    private $sync_attempts = 0;
    private $max_retries = 3;
    private $retry_delay = 300; // 5 minutes
    private $debug_mode = true;

    public function __construct() {
        // Initialize the plugin
        add_action('init', array($this, 'init'));
        add_action('wp_loaded', array($this, 'schedule_sync'));

        // Multiple sync triggers
        add_action('threads_intel_enhanced_sync_hook', array($this, 'perform_enhanced_sync'));
        add_action('save_post', array($this, 'trigger_immediate_sync'), 10, 1);
        add_action('wp_ajax_threads_intel_enhanced_sync', array($this, 'manual_sync_ajax'));
        add_action('wp_ajax_threads_intel_trigger_sync', array($this, 'trigger_sync_ajax'));
        add_action('wp_ajax_threads_intel_get_status', array($this, 'get_sync_status_ajax'));
        add_action('wp_ajax_threads_intel_test_connection', array($this, 'test_connection_ajax'));

        // Admin interface
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_scripts'));

        // Custom cron schedules
        add_filter('cron_schedules', array($this, 'add_cron_schedules'));

        // Heartbeat to keep sync alive
        add_action('wp_ajax_threads_intel_heartbeat', array($this, 'heartbeat_ajax'));

        // Register activation/deactivation hooks
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));
    }

    public function init() {
        // Load last sync time from options
        $this->last_sync_time = get_option('threads_intel_last_sync_time');
        $this->sync_attempts = get_option('threads_intel_sync_attempts', 0);

        // Check if we need to force a sync (if last sync was more than 2 hours ago)
        $this->check_sync_health();
    }

    public function add_cron_schedules($schedules) {
        $schedules['fiveminutes'] = array(
            'interval' => 300, // 5 minutes
            'display' => __('Every 5 Minutes')
        );
        $schedules['tenminutes'] = array(
            'interval' => 600, // 10 minutes
            'display' => __('Every 10 Minutes')
        );
        $schedules['thirtyminutes'] = array(
            'interval' => 1800, // 30 minutes
            'display' => __('Every 30 Minutes')
        );
        return $schedules;
    }

    public function schedule_sync() {
        // Clear any existing schedules
        wp_clear_scheduled_hook('threads_intel_enhanced_sync_hook');
        wp_clear_scheduled_hook('threads_intel_backup_sync_hook');

        // Schedule the enhanced sync
        if (!wp_next_scheduled('threads_intel_enhanced_sync_hook')) {
            wp_schedule_event(time(), 'fiveminutes', 'threads_intel_enhanced_sync_hook');
            $this->log_message('Enhanced sync scheduled for every 5 minutes');
        }

        // Also schedule a backup sync every 30 minutes
        if (!wp_next_scheduled('threads_intel_backup_sync_hook')) {
            wp_schedule_event(time(), 'thirtyminutes', 'threads_intel_backup_sync_hook');
            $this->log_message('Backup sync scheduled for every 30 minutes');
        }
    }

    public function check_sync_health() {
        if (!$this->last_sync_time) {
            $this->log_message('No previous sync found, forcing immediate sync');
            $this->trigger_immediate_sync(null);
            return;
        }

        $last_sync = strtotime($this->last_sync_time);
        $two_hours_ago = time() - (2 * 60 * 60);

        if ($last_sync < $two_hours_ago) {
            $this->log_message('Last sync was more than 2 hours ago, forcing sync');
            $this->trigger_immediate_sync(null);
        }
    }

    public function perform_enhanced_sync() {
        $this->log_message('Enhanced sync triggered at ' . current_time('mysql'));

        // Check if we're already syncing
        if (get_transient('threads_intel_sync_running')) {
            $this->log_message('Sync already running, skipping');
            return;
        }

        // Set sync running flag
        set_transient('threads_intel_sync_running', true, 300); // 5 minutes

        try {
            // Method 1: Try direct sync
            $success = $this->perform_direct_sync();

            if (!$success && $this->sync_attempts < $this->max_retries) {
                $this->log_message('Direct sync failed, attempting retry ' . ($this->sync_attempts + 1));

                // Method 2: Retry with exponential backoff
                $delay = $this->retry_delay * pow(2, $this->sync_attempts);
                wp_schedule_single_event(time() + $delay, 'threads_intel_enhanced_sync_hook');

                $this->sync_attempts++;
                update_option('threads_intel_sync_attempts', $this->sync_attempts);
            } else {
                // Reset attempts on success
                $this->sync_attempts = 0;
                update_option('threads_intel_sync_attempts', 0);
            }

        } catch (Exception $e) {
            $this->log_message('Enhanced sync error: ' . $e->getMessage());
        } finally {
            // Clear sync running flag
            delete_transient('threads_intel_sync_running');
        }
    }

    public function perform_direct_sync() {
        $this->log_message('Starting direct sync...');

        try {
            if (!$this->authenticate()) {
                throw new Exception('Authentication failed');
            }

            // Get recent posts (last 24 hours)
            $recent_posts = $this->get_recent_posts();

            if (empty($recent_posts)) {
                $this->log_message('No recent posts to sync');
                return true; // Consider this a success
            }

            // Send posts directly to Vercel
            $result = $this->send_posts_to_vercel($recent_posts);

            if ($result) {
                $this->last_sync_time = current_time('mysql');
                update_option('threads_intel_last_sync_time', $this->last_sync_time);
                $this->log_message('Direct sync completed: ' . count($recent_posts) . ' posts sent');
                return true;
            }

            return false;

        } catch (Exception $e) {
            $this->log_message('Direct sync failed: ' . $e->getMessage());
            return false;
        }
    }

    private function authenticate() {
        $this->log_message('Attempting authentication...');
        
        $response = wp_remote_post($this->vercel_api_base . '/auth/login', array(
            'timeout' => 60,
            'sslverify' => false,
            'headers' => array('Content-Type' => 'application/json'),
            'body' => json_encode(array(
                'username' => $this->admin_username,
                'password' => $this->admin_password
            ))
        ));

        if (is_wp_error($response)) {
            $error_msg = 'Auth request failed: ' . $response->get_error_message();
            $this->log_message($error_msg);
            throw new Exception($error_msg);
        }

        $response_code = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);
        
        $this->log_message("Auth response code: $response_code");
        $this->log_message("Auth response body: " . print_r($body, true));

        if ($response_code !== 200) {
            $error_msg = 'Auth failed with code ' . $response_code . ': ' . ($body['error'] ?? 'Unknown error');
            $this->log_message($error_msg);
            throw new Exception($error_msg);
        }

        $this->auth_token = $body['token'] ?? null;
        $auth_success = !empty($this->auth_token);
        $this->log_message('Authentication ' . ($auth_success ? 'successful' : 'failed'));
        
        return $auth_success;
    }

    private function get_recent_posts() {
        $this->log_message('Fetching recent posts...');
        
        // Get posts modified in last 24 hours
        $args = array(
            'post_type' => 'post',
            'post_status' => 'publish',
            'posts_per_page' => 50,
            'date_query' => array(
                array(
                    'column' => 'post_modified',
                    'after' => '24 hours ago'
                )
            ),
            'orderby' => 'modified',
            'order' => 'DESC'
        );

        $posts = get_posts($args);
        $this->log_message('Found ' . count($posts) . ' recent posts');
        
        $formatted_posts = array();

        foreach ($posts as $post) {
            // Get categories
            $categories = get_the_category($post->ID);
            $category_ids = array();
            foreach ($categories as $category) {
                $category_ids[] = $category->term_id;
            }

            // Get author info
            $author = get_userdata($post->post_author);

            // Format post data
            $formatted_posts[] = array(
                'id' => $post->ID,
                'title' => array('rendered' => $post->post_title),
                'content' => array('rendered' => apply_filters('the_content', $post->post_content)),
                'excerpt' => array('rendered' => $post->post_excerpt),
                'slug' => $post->post_name,
                'status' => $post->post_status,
                'author' => $post->post_author,
                'author_name' => $author ? $author->display_name : 'Unknown',
                'date' => $post->post_date_gmt,
                'modified' => $post->post_modified_gmt,
                'categories' => $category_ids,
                'tags' => wp_get_post_tags($post->ID, array('fields' => 'ids')),
                'featured_media' => get_post_thumbnail_id($post->ID),
                'sticky' => is_sticky($post->ID),
                'format' => get_post_format($post->ID) ?: 'standard'
            );
        }

        return $formatted_posts;
    }

    private function get_categories() {
        $this->log_message('Fetching categories...');
        
        $categories = get_categories(array(
            'hide_empty' => false,
            'number' => 100
        ));

        $this->log_message('Found ' . count($categories) . ' categories');
        
        $formatted_categories = array();
        foreach ($categories as $category) {
            $formatted_categories[] = array(
                'id' => $category->term_id,
                'name' => $category->name,
                'slug' => $category->slug,
                'parent' => $category->parent,
                'count' => $category->count,
                'description' => $category->description
            );
        }

        return $formatted_categories;
    }

    private function send_posts_to_vercel($posts) {
        $this->log_message('Sending ' . count($posts) . ' posts to Vercel...');
        
        $data = array(
            'posts' => $posts,
            'categories' => $this->get_categories(),
            'timestamp' => current_time('mysql'),
            'source' => 'wordpress_enhanced_sync'
        );

        $this->log_message('Data payload size: ' . strlen(json_encode($data)) . ' bytes');

        $response = wp_remote_post($this->vercel_api_base . '/admin/ingest-direct', array(
            'timeout' => 180,
            'sslverify' => false,
            'headers' => array(
                'Content-Type' => 'application/json',
                'Authorization' => 'Bearer ' . $this->auth_token
            ),
            'body' => json_encode($data)
        ));

        if (is_wp_error($response)) {
            $error_msg = 'Direct ingest request failed: ' . $response->get_error_message();
            $this->log_message($error_msg);
            throw new Exception($error_msg);
        }

        $response_code = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);
        
        $this->log_message("Ingest response code: $response_code");
        $this->log_message("Ingest response body: " . print_r($body, true));

        if ($response_code !== 200) {
            $error_msg = 'Direct ingest failed with code ' . $response_code . ': ' . ($body['error'] ?? 'Unknown error');
            $this->log_message($error_msg);
            throw new Exception($error_msg);
        }

        $this->log_message('Successfully sent posts to Vercel');
        return true;
    }

    public function trigger_immediate_sync($post_id) {
        // Don't sync on every post save, only trigger occasionally
        if ($post_id && !$this->should_trigger_sync()) {
            return;
        }

        $this->log_message('Immediate sync triggered');
        wp_schedule_single_event(time(), 'threads_intel_enhanced_sync_hook');
    }

    private function should_trigger_sync() {
        // Only trigger sync every 15 minutes to avoid spam
        $last_trigger = get_option('threads_intel_last_trigger_time');
        $fifteen_minutes_ago = time() - (15 * 60);

        if (!$last_trigger || $last_trigger < $fifteen_minutes_ago) {
            update_option('threads_intel_last_trigger_time', time());
            return true;
        }

        return false;
    }

    public function manual_sync_ajax() {
        check_ajax_referer('threads_intel_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_die('Unauthorized');
        }

        $this->log_message('Manual sync triggered via AJAX');
        
        try {
            // Perform sync immediately
            $success = $this->perform_direct_sync();
            
            if ($success) {
                wp_send_json_success('Manual sync completed successfully');
            } else {
                wp_send_json_error('Manual sync failed');
            }
        } catch (Exception $e) {
            wp_send_json_error('Manual sync error: ' . $e->getMessage());
        }
    }

    public function trigger_sync_ajax() {
        // This endpoint can be called by external systems
        $this->log_message('External sync trigger received');
        $this->trigger_immediate_sync(null);

        wp_send_json_success('Sync triggered');
    }

    public function test_connection_ajax() {
        check_ajax_referer('threads_intel_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_die('Unauthorized');
        }

        try {
            $this->log_message('Testing connection to Vercel API...');
            
            // Test basic connectivity
            $response = wp_remote_get($this->vercel_api_base . '/health', array(
                'timeout' => 30,
                'sslverify' => false
            ));

            if (is_wp_error($response)) {
                throw new Exception('Connection test failed: ' . $response->get_error_message());
            }

            $response_code = wp_remote_retrieve_response_code($response);
            $body = wp_remote_retrieve_body($response);
            
            $this->log_message("Connection test response code: $response_code");
            $this->log_message("Connection test response body: $body");

            if ($response_code === 200) {
                wp_send_json_success('Connection test successful');
            } else {
                wp_send_json_error("Connection test failed with code $response_code");
            }

        } catch (Exception $e) {
            wp_send_json_error('Connection test error: ' . $e->getMessage());
        }
    }

    public function get_sync_status_ajax() {
        check_ajax_referer('threads_intel_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_die('Unauthorized');
        }

        $status = array(
            'last_sync' => $this->last_sync_time,
            'sync_attempts' => $this->sync_attempts,
            'is_running' => get_transient('threads_intel_sync_running'),
            'next_scheduled' => wp_next_scheduled('threads_intel_enhanced_sync_hook'),
            'cron_disabled' => defined('DISABLE_WP_CRON') && DISABLE_WP_CRON,
            'debug_mode' => $this->debug_mode,
            'recent_logs' => $this->get_recent_logs(10)
        );

        wp_send_json_success($status);
    }

    public function heartbeat_ajax() {
        // Keep the sync alive and check health
        $this->check_sync_health();
        wp_send_json_success('Heartbeat received');
    }

    public function add_admin_menu() {
        add_options_page(
            'Threads Intel Sync - DEBUG',
            'Threads Intel Sync - DEBUG',
            'manage_options',
            'threads-intel-sync-debug',
            array($this, 'admin_page')
        );
    }

    public function enqueue_admin_scripts($hook) {
        if ($hook !== 'settings_page_threads-intel-sync-debug') {
            return;
        }

        wp_enqueue_script('jquery');
        wp_enqueue_script('threads-intel-admin-debug', plugin_dir_url(__FILE__) . 'admin-debug.js', array('jquery'), '1.0', true);
        wp_localize_script('threads-intel-admin-debug', 'threadsIntel', array(
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('threads_intel_nonce')
        ));
    }

    public function admin_page() {
        ?>
        <div class="wrap">
            <h1>Threads Intel Enhanced Sync - DEBUG MODE</h1>

            <div class="card">
                <h2>Sync Status</h2>
                <div id="sync-status">
                    <p>Loading status...</p>
                </div>

                <p>
                    <button id="manual-sync" class="button button-primary">Trigger Manual Sync</button>
                    <button id="test-connection" class="button">Test Connection</button>
                    <button id="refresh-status" class="button">Refresh Status</button>
                </p>
            </div>

            <div class="card">
                <h2>Recent Sync Logs</h2>
                <div id="sync-logs">
                    <p>Loading logs...</p>
                </div>
            </div>

            <div class="card">
                <h2>Configuration</h2>
                <p><strong>API Endpoint:</strong> <?php echo esc_html($this->vercel_api_base); ?></p>
                <p><strong>Last Sync:</strong> <?php echo esc_html($this->last_sync_time ?: 'Never'); ?></p>
                <p><strong>Sync Attempts:</strong> <?php echo esc_html($this->sync_attempts); ?></p>
                <p><strong>Next Scheduled:</strong> <?php echo esc_html(wp_next_scheduled('threads_intel_enhanced_sync_hook') ? date('Y-m-d H:i:s', wp_next_scheduled('threads_intel_enhanced_sync_hook')) : 'Not scheduled'); ?></p>
                <p><strong>Debug Mode:</strong> <?php echo $this->debug_mode ? 'Enabled' : 'Disabled'; ?></p>
                <p><strong>WP Cron Disabled:</strong> <?php echo (defined('DISABLE_WP_CRON') && DISABLE_WP_CRON) ? 'Yes (This may cause sync issues)' : 'No'; ?></p>
            </div>

            <div class="card">
                <h2>WordPress Cron Status</h2>
                <div id="cron-status">
                    <p>Loading cron status...</p>
                </div>
            </div>
        </div>
        <?php
    }

    private function get_recent_logs($limit = 10) {
        $logs = get_option('threads_intel_sync_logs', array());
        return array_slice($logs, -$limit);
    }

    private function log_message($message) {
        $log_entry = array(
            'timestamp' => current_time('mysql'),
            'message' => $message,
            'user_id' => get_current_user_id()
        );

        // Store in WordPress options (keep last 100 entries)
        $logs = get_option('threads_intel_sync_logs', array());
        $logs[] = $log_entry;

        // Keep only last 100 entries
        if (count($logs) > 100) {
            $logs = array_slice($logs, -100);
        }

        update_option('threads_intel_sync_logs', $logs);

        // Also log to WordPress error log
        error_log('Threads Intel Sync: ' . $message);
    }

    public function activate() {
        $this->log_message('Plugin activated');
        $this->schedule_sync();
    }

    public function deactivate() {
        $this->log_message('Plugin deactivated');
        wp_clear_scheduled_hook('threads_intel_enhanced_sync_hook');
        wp_clear_scheduled_hook('threads_intel_backup_sync_hook');
    }
}

// Initialize the plugin
new ThreadsIntelEnhancedSyncDebug();

