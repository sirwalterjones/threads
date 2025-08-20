<?php
/**
 * WordPress Sync Trigger for Threads Intel System
 * 
 * This script runs on your WordPress site and triggers automatic syncing
 * by calling the Vercel API instead of Vercel calling WordPress.
 * 
 * Installation:
 * 1. Upload this file to your WordPress wp-content/plugins/ directory
 * 2. Activate the plugin in WordPress admin
 * 3. It will automatically sync every 5 minutes
 */

// Plugin Header
/*
Plugin Name: Threads Intel Auto Sync
Description: Automatically syncs WordPress posts to Threads Intel system
Version: 1.0
*/

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class ThreadsIntelAutoSync {
    
    private $vercel_api_base = 'https://threads-8qfennhvr-walter-jones-projects.vercel.app/api';
    private $admin_username = 'admin';
    private $admin_password = 'admin123456';
    private $auth_token = null;
    
    public function __construct() {
        // Hook into WordPress cron
        add_action('wp', array($this, 'schedule_sync'));
        add_action('threads_intel_sync_hook', array($this, 'perform_sync'));
        
        // Add admin menu for manual sync
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('wp_ajax_threads_intel_manual_sync', array($this, 'manual_sync_ajax'));
        
        // Hook into post save to trigger immediate sync
        add_action('save_post', array($this, 'trigger_immediate_sync'), 10, 1);
    }
    
    public function schedule_sync() {
        if (!wp_next_scheduled('threads_intel_sync_hook')) {
            wp_schedule_event(time(), 'fiveminutes', 'threads_intel_sync_hook');
        }
    }
    
    public function perform_sync() {
        $this->log_message('Starting automatic sync...');
        
        try {
            // Get auth token
            if (!$this->authenticate()) {
                throw new Exception('Authentication failed');
            }
            
            // Trigger incremental sync
            $result = $this->trigger_incremental_sync();
            
            if ($result) {
                $this->log_message('Sync completed successfully: ' . json_encode($result));
            } else {
                $this->log_message('Sync completed but no result returned');
            }
            
        } catch (Exception $e) {
            $this->log_message('Sync failed: ' . $e->getMessage());
        }
    }
    
    private function authenticate() {
        $response = wp_remote_post($this->vercel_api_base . '/auth/login', array(
            'timeout' => 30,
            'headers' => array('Content-Type' => 'application/json'),
            'body' => json_encode(array(
                'username' => $this->admin_username,
                'password' => $this->admin_password
            ))
        ));
        
        if (is_wp_error($response)) {
            throw new Exception('Auth request failed: ' . $response->get_error_message());
        }
        
        $body = json_decode(wp_remote_retrieve_body($response), true);
        
        if (wp_remote_retrieve_response_code($response) !== 200) {
            throw new Exception('Auth failed: ' . ($body['error'] ?? 'Unknown error'));
        }
        
        $this->auth_token = $body['token'] ?? null;
        return !empty($this->auth_token);
    }
    
    private function trigger_incremental_sync() {
        if (!$this->auth_token) {
            throw new Exception('No auth token available');
        }
        
        // Try incremental sync first
        $response = wp_remote_post($this->vercel_api_base . '/admin/ingest-wordpress-incremental', array(
            'timeout' => 60,
            'headers' => array(
                'Content-Type' => 'application/json',
                'Authorization' => 'Bearer ' . $this->auth_token
            ),
            'body' => json_encode(array())
        ));
        
        // If incremental sync doesn't exist (404), fall back to regular sync
        if (wp_remote_retrieve_response_code($response) === 404) {
            $this->log_message('Incremental sync not available, using regular sync');
            return $this->trigger_regular_sync();
        }
        
        if (is_wp_error($response)) {
            throw new Exception('Incremental sync request failed: ' . $response->get_error_message());
        }
        
        $body = json_decode(wp_remote_retrieve_body($response), true);
        
        if (wp_remote_retrieve_response_code($response) !== 200) {
            throw new Exception('Incremental sync failed: ' . ($body['error'] ?? 'Unknown error'));
        }
        
        return $body;
    }
    
    private function trigger_regular_sync() {
        $response = wp_remote_post($this->vercel_api_base . '/admin/ingest-wordpress', array(
            'timeout' => 120,
            'headers' => array(
                'Content-Type' => 'application/json',
                'Authorization' => 'Bearer ' . $this->auth_token
            ),
            'body' => json_encode(array())
        ));
        
        if (is_wp_error($response)) {
            throw new Exception('Regular sync request failed: ' . $response->get_error_message());
        }
        
        $body = json_decode(wp_remote_retrieve_body($response), true);
        
        if (wp_remote_retrieve_response_code($response) !== 200) {
            throw new Exception('Regular sync failed: ' . ($body['error'] ?? 'Unknown error'));
        }
        
        return $body;
    }
    
    public function trigger_immediate_sync($post_id) {
        // Only sync on published posts
        if (get_post_status($post_id) !== 'publish') {
            return;
        }
        
        // Schedule immediate sync (runs after page load)
        wp_schedule_single_event(time() + 5, 'threads_intel_sync_hook');
    }
    
    public function add_admin_menu() {
        add_options_page(
            'Threads Intel Sync',
            'Threads Intel',
            'manage_options',
            'threads-intel-sync',
            array($this, 'admin_page')
        );
    }
    
    public function admin_page() {
        ?>
        <div class="wrap">
            <h1>Threads Intel Auto Sync</h1>
            <p>This plugin automatically syncs your WordPress posts to the Threads Intel system.</p>
            
            <div class="card">
                <h2>Sync Status</h2>
                <p><strong>Next scheduled sync:</strong> <?php echo date('Y-m-d H:i:s', wp_next_scheduled('threads_intel_sync_hook')); ?></p>
                <p><strong>Last sync log:</strong></p>
                <textarea readonly style="width: 100%; height: 200px;"><?php echo esc_textarea(get_option('threads_intel_sync_log', 'No logs yet')); ?></textarea>
            </div>
            
            <div class="card">
                <h2>Manual Sync</h2>
                <button id="manual-sync-btn" class="button button-primary">Trigger Sync Now</button>
                <div id="sync-result" style="margin-top: 10px;"></div>
            </div>
        </div>
        
        <script>
        document.getElementById('manual-sync-btn').addEventListener('click', function() {
            const btn = this;
            const result = document.getElementById('sync-result');
            
            btn.disabled = true;
            btn.textContent = 'Syncing...';
            result.innerHTML = '<p>Starting sync...</p>';
            
            fetch(ajaxurl, {
                method: 'POST',
                headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                body: 'action=threads_intel_manual_sync&_ajax_nonce=<?php echo wp_create_nonce('threads_intel_sync'); ?>'
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    result.innerHTML = '<div class="notice notice-success"><p>Sync completed successfully!</p></div>';
                } else {
                    result.innerHTML = '<div class="notice notice-error"><p>Sync failed: ' + data.data + '</p></div>';
                }
            })
            .catch(error => {
                result.innerHTML = '<div class="notice notice-error"><p>Error: ' + error.message + '</p></div>';
            })
            .finally(() => {
                btn.disabled = false;
                btn.textContent = 'Trigger Sync Now';
            });
        });
        </script>
        <?php
    }
    
    public function manual_sync_ajax() {
        check_ajax_referer('threads_intel_sync');
        
        if (!current_user_can('manage_options')) {
            wp_die('Insufficient permissions');
        }
        
        try {
            $this->perform_sync();
            wp_send_json_success('Sync completed');
        } catch (Exception $e) {
            wp_send_json_error($e->getMessage());
        }
    }
    
    private function log_message($message) {
        $timestamp = date('Y-m-d H:i:s');
        $log_entry = "[$timestamp] $message\n";
        
        $current_log = get_option('threads_intel_sync_log', '');
        $new_log = $log_entry . $current_log;
        
        // Keep only last 50 log entries
        $lines = explode("\n", $new_log);
        if (count($lines) > 50) {
            $lines = array_slice($lines, 0, 50);
            $new_log = implode("\n", $lines);
        }
        
        update_option('threads_intel_sync_log', $new_log);
    }
}

// Add custom cron interval
add_filter('cron_schedules', function($schedules) {
    $schedules['fiveminutes'] = array(
        'interval' => 300,
        'display' => 'Every 5 Minutes'
    );
    return $schedules;
});

// Initialize the plugin
new ThreadsIntelAutoSync();

// Activation hook
register_activation_hook(__FILE__, function() {
    wp_schedule_event(time(), 'fiveminutes', 'threads_intel_sync_hook');
});

// Deactivation hook  
register_deactivation_hook(__FILE__, function() {
    wp_clear_scheduled_hook('threads_intel_sync_hook');
});
?>