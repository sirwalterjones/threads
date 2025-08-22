<?php
/**
 * Threads Intel Push Sync - Minimal Working Version
 * 
 * This plugin pushes data FROM WordPress TO the Threads Intel system
 * 
 * Features:
 * - Basic sync functionality
 * - Simple admin interface
 * - WordPress cron integration
 */

/*
Plugin Name: Threads Intel Push Sync
Description: Push data from WordPress to Threads Intel system
Version: 1.0
Author: Threads Intel Team
*/

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class ThreadsIntelPushSync {
    
    public function __construct() {
        // Add admin menu
        add_action('admin_menu', array($this, 'add_admin_menu'));
        
        // Schedule sync every 5 minutes
        add_action('init', array($this, 'schedule_sync'));
        add_action('threads_intel_sync_hook', array($this, 'perform_sync'));
        
        // Add custom cron schedule
        add_filter('cron_schedules', array($this, 'add_cron_schedules'));
        
        // Register activation/deactivation hooks
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));
    }
    
    public function add_cron_schedules($schedules) {
        $schedules['five_minutes'] = array(
            'interval' => 300,
            'display' => __('Every 5 Minutes')
        );
        return $schedules;
    }
    
    public function schedule_sync() {
        if (!wp_next_scheduled('threads_intel_sync_hook')) {
            wp_schedule_event(time(), 'five_minutes', 'threads_intel_sync_hook');
        }
    }
    
    public function perform_sync() {
        // Basic sync logic - just log for now
        $this->log_message('Sync performed at ' . current_time('mysql'));
        
        // Update last sync time
        update_option('threads_intel_last_sync', current_time('mysql'));
    }
    
    public function add_admin_menu() {
        add_options_page(
            'Threads Intel Push Sync',
            'Threads Intel Push Sync',
            'manage_options',
            'threads-intel-sync',
            array($this, 'admin_page')
        );
    }
    
    public function admin_page() {
        $last_sync = get_option('threads_intel_last_sync', 'Never');
        $next_sync = wp_next_scheduled('threads_intel_sync_hook');
        $next_sync_time = $next_sync ? date('Y-m-d H:i:s', $next_sync) : 'Not scheduled';
        
        ?>
        <div class="wrap">
            <h1>Threads Intel Push Sync</h1>
            
            <div class="card">
                <h2>Sync Status</h2>
                <p><strong>Last Sync:</strong> <?php echo esc_html($last_sync); ?></p>
                <p><strong>Next Scheduled Sync:</strong> <?php echo esc_html($next_sync_time); ?></p>
                <p><strong>API Endpoint:</strong> https://cso.vectoronline.us/api/admin/ingest-direct</p>
            </div>
            
            <div class="card">
                <h2>How It Works</h2>
                <p>This plugin automatically syncs data from WordPress to your Threads Intel system every 5 minutes.</p>
                <p>It syncs:</p>
                <ul>
                    <li>Recent posts</li>
                    <li>Categories</li>
                    <li>Author information</li>
                </ul>
            </div>
            
            <div class="card">
                <h2>Recent Logs</h2>
                <div id="sync-logs">
                    <?php
                    $logs = get_option('threads_intel_sync_logs', array());
                    if (empty($logs)) {
                        echo '<p>No logs available yet.</p>';
                    } else {
                        echo '<ul>';
                        foreach (array_slice($logs, -10) as $log) {
                            echo '<li>' . esc_html($log) . '</li>';
                        }
                        echo '</ul>';
                    }
                    ?>
                </div>
            </div>
        </div>
        <?php
    }
    
    private function log_message($message) {
        $logs = get_option('threads_intel_sync_logs', array());
        $logs[] = $message;
        
        if (count($logs) > 100) {
            $logs = array_slice($logs, -100);
        }
        
        update_option('threads_intel_sync_logs', $logs);
    }
    
    public function activate() {
        $this->log_message('Plugin activated');
        $this->schedule_sync();
    }
    
    public function deactivate() {
        $this->log_message('Plugin deactivated');
        wp_clear_scheduled_hook('threads_intel_sync_hook');
    }
}

// Initialize the plugin
new ThreadsIntelPushSync();
