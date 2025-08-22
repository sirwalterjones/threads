<?php
/**
 * WordPress to Threads Intel Push Sync with Enhanced Logging
 * 
 * This plugin pushes data FROM WordPress TO the Threads Intel system
 * This bypasses Azure NSG outbound restrictions
 * 
 * Features:
 * - Detailed WordPress cron status monitoring
 * - Real-time sync logs
 * - Sync performance metrics
 * - Manual sync triggers
 * - Connection testing
 */

/*
Plugin Name: Threads Intel Push Sync Enhanced
Description: Push data from WordPress to Threads Intel system with detailed logging
Version: 5.1
Author: Threads Intel Team
*/

if (!defined('ABSPATH')) {
    exit;
}

class ThreadsIntelPushSyncEnhanced {
    
    private $threads_intel_api = 'https://cso.vectoronline.us/api';
    private $admin_username = 'admin';
    private $admin_password = 'admin123456';
    private $auth_token = null;
    
    public function __construct() {
        // Schedule sync every 5 minutes
        add_action('init', array($this, 'schedule_sync'));
        add_action('threads_intel_push_sync_hook', array($this, 'perform_push_sync'));
        
        // Sync on post save
        add_action('save_post', array($this, 'trigger_immediate_sync'), 10, 1);
        
        // Admin interface
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_scripts'));
        
        // Manual sync triggers
        add_action('wp_ajax_threads_intel_manual_sync', array($this, 'manual_sync_ajax'));
        add_action('wp_ajax_threads_intel_test_connection', array($this, 'test_connection_ajax'));
        add_action('wp_ajax_threads_intel_clear_logs', array($this, 'clear_logs_ajax'));
        add_action('wp_ajax_threads_intel_get_status', array($this, 'get_status_ajax'));
        
        // Add custom cron schedules
        add_filter('cron_schedules', array($this, 'add_cron_schedules'));
        
        // Register activation/deactivation hooks
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));
    }
    
    public function schedule_sync() {
        // Clear any existing schedules
        wp_clear_scheduled_hook('threads_intel_push_sync_hook');
        
        // Schedule the push sync every 5 minutes
        if (!wp_next_scheduled('threads_intel_push_sync_hook')) {
            wp_schedule_event(time(), 'five_minutes', 'threads_intel_push_sync_hook');
            $this->log_message("Push sync scheduled for every 5 minutes", 'info');
        }
        
        // Log cron status
        $this->log_cron_status();
    }
    
    public function add_cron_schedules($schedules) {
        $schedules['five_minutes'] = array(
            'interval' => 300, // 5 minutes
            'display' => __('Every 5 Minutes')
        );
        return $schedules;
    }
    
    public function perform_push_sync() {
        $sync_id = uniqid('sync_');
        $start_time = microtime(true);
        
        $this->log_message("Starting push sync {$sync_id} to Threads Intel...", 'info');
        
        try {
            // Step 1: Authenticate with Threads Intel
            $this->log_message("Step 1: Authenticating with Threads Intel...", 'info');
            if (!$this->authenticate()) {
                throw new Exception('Authentication failed');
            }
            $this->log_message("✅ Authentication successful", 'success');
            
            // Step 2: Get recent posts (last 24 hours)
            $this->log_message("Step 2: Fetching recent posts...", 'info');
            $recent_posts = $this->get_recent_posts();
            
            if (empty($recent_posts)) {
                $this->log_message("No recent posts to sync", 'info');
                $this->update_sync_status('success', 'No posts to sync', $sync_id, $start_time);
                return;
            }
            
            $this->log_message("Found " . count($recent_posts) . " posts to sync", 'info');
            
            // Step 3: Get categories
            $this->log_message("Step 3: Fetching categories...", 'info');
            $categories = $this->get_categories();
            $this->log_message("Found " . count($categories) . " categories", 'info');
            
            // Step 4: Send data to Threads Intel
            $this->log_message("Step 4: Sending data to Threads Intel...", 'info');
            $result = $this->send_data_to_threads_intel($recent_posts, $categories);
            
            if ($result) {
                $end_time = microtime(true);
                $duration = round($end_time - $start_time, 2);
                
                $this->log_message("✅ Push sync {$sync_id} completed successfully in {$duration}s", 'success');
                $this->log_message("Synced " . count($recent_posts) . " posts and " . count($categories) . " categories", 'success');
                
                $this->update_sync_status('success', "Synced " . count($recent_posts) . " posts in {$duration}s", $sync_id, $start_time);
            } else {
                throw new Exception('Failed to send data to Threads Intel');
            }
            
        } catch (Exception $e) {
            $end_time = microtime(true);
            $duration = round($end_time - $start_time, 2);
            
            $this->log_message("❌ Push sync {$sync_id} failed after {$duration}s: " . $e->getMessage(), 'error');
            $this->update_sync_status('failed', $e->getMessage(), $sync_id, $start_time);
        }
    }
    
    private function authenticate() {
        $response = wp_remote_post($this->threads_intel_api . '/auth/login', array(
            'timeout' => 30,
            'sslverify' => false,
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
    
    private function get_recent_posts() {
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
        $formatted_posts = array();
        
        foreach ($posts as $post) {
            $categories = get_the_category($post->ID);
            $category_ids = array();
            foreach ($categories as $category) {
                $category_ids[] = $category->term_id;
            }
            
            $author = get_userdata($post->post_author);
            
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
                'format' => get_post_format($post->ID) ?: 'standard',
                'comment_count' => get_comments_number($post->ID)
            );
        }
        
        return $formatted_posts;
    }
    
    private function get_categories() {
        $categories = get_categories(array(
            'hide_empty' => false,
            'number' => 1000
        ));
        
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
    
    private function send_data_to_threads_intel($posts, $categories) {
        $data = array(
            'posts' => $posts,
            'categories' => $categories,
            'timestamp' => current_time('mysql'),
            'source' => 'wordpress_push_sync_enhanced'
        );
        
        $response = wp_remote_post($this->threads_intel_api . '/admin/ingest-direct', array(
            'timeout' => 60,
            'sslverify' => false,
            'headers' => array(
                'Content-Type' => 'application/json',
                'Authorization' => 'Bearer ' . $this->auth_token
            ),
            'body' => json_encode($data)
        ));
        
        if (is_wp_error($response)) {
            throw new Exception('Request failed: ' . $response->get_error_message());
        }
        
        $response_code = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);
        
        if ($response_code !== 200) {
            throw new Exception('Request failed with code ' . $response_code . ': ' . ($body['error'] ?? 'Unknown error'));
        }
        
        return true;
    }
    
    public function trigger_immediate_sync($post_id) {
        // Don't sync on every post save, only trigger occasionally
        if ($post_id && !$this->should_trigger_sync()) {
            return;
        }
        
        $this->log_message('Immediate sync triggered by post save', 'info');
        wp_schedule_single_event(time(), 'threads_intel_push_sync_hook');
    }
    
    private function should_trigger_sync() {
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
        
        $this->log_message('Manual sync triggered via AJAX', 'info');
        $this->trigger_immediate_sync(null);
        
        wp_send_json_success('Manual sync triggered');
    }
    
    public function test_connection_ajax() {
        check_ajax_referer('threads_intel_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_die('Unauthorized');
        }
        
        try {
            if ($this->authenticate()) {
                $this->log_message('Connection test successful', 'success');
                wp_send_json_success('Connection test successful');
            } else {
                $this->log_message('Connection test failed', 'error');
                wp_send_json_error('Connection test failed');
            }
        } catch (Exception $e) {
            $this->log_message('Connection test failed: ' . $e->getMessage(), 'error');
            wp_send_json_error('Connection test failed: ' . $e->getMessage());
        }
    }
    
    public function clear_logs_ajax() {
        check_ajax_referer('threads_intel_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_die('Unauthorized');
        }
        
        delete_option('threads_intel_sync_logs');
        delete_option('threads_intel_sync_statuses');
        
        wp_send_json_success('Logs cleared successfully');
    }
    
    public function get_status_ajax() {
        check_ajax_referer('threads_intel_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_die('Unauthorized');
        }
        
        $status = $this->get_detailed_status();
        wp_send_json_success($status);
    }
    
    public function add_admin_menu() {
        add_options_page(
            'Threads Intel Push Sync Enhanced',
            'Threads Intel Push Sync Enhanced',
            'manage_options',
            'threads-intel-push-sync-enhanced',
            array($this, 'admin_page')
        );
    }
    
    public function enqueue_admin_scripts($hook) {
        if ($hook !== 'settings_page_threads-intel-push-sync-enhanced') {
            return;
        }
        
        wp_enqueue_script('jquery');
        wp_localize_script('jquery', 'threadsIntel', array(
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('threads_intel_nonce')
        ));
    }
    
    public function admin_page() {
        $last_sync = get_option('threads_intel_last_sync_time', 'Never');
        $sync_status = get_option('threads_intel_last_sync_status', 'Unknown');
        $last_error = get_option('threads_intel_last_error', 'None');
        
        ?>
        <div class="wrap">
            <h1>Threads Intel Push Sync Enhanced</h1>
            
            <div class="card">
                <h2>Sync Status</h2>
                <div id="sync-status-display">
                    <p><strong>Last Sync:</strong> <?php echo esc_html($last_sync); ?></p>
                    <p><strong>Status:</strong> <?php echo esc_html($sync_status); ?></p>
                    <p><strong>Last Error:</strong> <?php echo esc_html($last_error); ?></p>
                    <p><strong>API Endpoint:</strong> <?php echo esc_html($this->threads_intel_api); ?></p>
                </div>
                <p><button id="refresh-status" class="button">🔄 Refresh Status</button></p>
            </div>
            
            <div class="card">
                <h2>WordPress Cron Status</h2>
                <div id="cron-status-display">
                    <p>Loading cron status...</p>
                </div>
            </div>
            
            <div class="card">
                <h2>Actions</h2>
                <p>
                    <button id="test-connection" class="button button-primary">🔌 Test Connection</button>
                    <button id="manual-sync" class="button">🚀 Trigger Manual Sync</button>
                    <button id="clear-logs" class="button">🗑️ Clear Logs</button>
                </p>
                <div id="action-results">
                    <p>Click a button to test...</p>
                </div>
            </div>
            
            <div class="card">
                <h2>Recent Sync Logs</h2>
                <div id="sync-logs-display">
                    <p>Loading logs...</p>
                </div>
            </div>
            
            <div class="card">
                <h2>How It Works</h2>
                <p>This plugin pushes data FROM WordPress TO your Threads Intel system every 5 minutes.</p>
                <p>It automatically syncs:</p>
                <ul>
                    <li>Posts modified in the last 24 hours</li>
                    <li>All categories</li>
                    <li>Author information</li>
                    <li>Post metadata</li>
                </ul>
                <p><strong>Next scheduled sync:</strong> <span id="next-sync-time">Loading...</span></p>
            </div>
        </div>
        
        <script>
        jQuery(document).ready(function($) {
            // Load initial data
            loadCronStatus();
            loadSyncLogs();
            loadNextSyncTime();
            
            // Refresh status button
            $('#refresh-status').on('click', function() {
                loadCronStatus();
                loadSyncLogs();
                loadNextSyncTime();
            });
            
            // Test connection button
            $('#test-connection').on('click', function() {
                var $btn = $(this);
                $btn.prop('disabled', true).text('Testing...');
                
                $.ajax({
                    url: threadsIntel.ajaxUrl,
                    type: 'POST',
                    data: {
                        action: 'threads_intel_test_connection',
                        nonce: threadsIntel.nonce
                    },
                    success: function(response) {
                        if (response.success) {
                            $('#action-results').html('<div class="notice notice-success"><p>✅ ' + response.data + '</p></div>');
                        } else {
                            $('#action-results').html('<div class="notice notice-error"><p>❌ ' + response.data + '</p></div>');
                        }
                    },
                    error: function() {
                        $('#action-results').html('<div class="notice notice-error"><p>❌ Connection test failed</p></div>');
                    },
                    complete: function() {
                        $btn.prop('disabled', false).text('🔌 Test Connection');
                    }
                });
            });
            
            // Manual sync button
            $('#manual-sync').on('click', function() {
                var $btn = $(this);
                $btn.prop('disabled', true).text('Triggering...');
                
                $.ajax({
                    url: threadsIntel.ajaxUrl,
                    type: 'POST',
                    data: {
                        action: 'threads_intel_manual_sync',
                        nonce: threadsIntel.nonce
                    },
                    success: function(response) {
                        if (response.success) {
                            $('#action-results').html('<div class="notice notice-success"><p>✅ ' + response.data + '</p></div>');
                        } else {
                            $('#action-results').html('<div class="notice notice-error"><p>❌ ' + response.data + '</p></div>');
                        }
                    },
                    error: function() {
                        $('#action-results').html('<div class="notice notice-error"><p>❌ Manual sync failed</p></div>');
                    },
                    complete: function() {
                        $btn.prop('disabled', false).text('🚀 Trigger Manual Sync');
                    }
                });
            });
            
            // Clear logs button
            $('#clear-logs').on('click', function() {
                if (confirm('Are you sure you want to clear all logs?')) {
                    var $btn = $(this);
                    $btn.prop('disabled', true).text('Clearing...');
                    
                    $.ajax({
                        url: threadsIntel.ajaxUrl,
                        type: 'POST',
                        data: {
                            action: 'threads_intel_clear_logs',
                            nonce: threadsIntel.nonce
                        },
                        success: function(response) {
                            if (response.success) {
                                $('#action-results').html('<div class="notice notice-success"><p>✅ ' + response.data + '</p></div>');
                                loadSyncLogs();
                            } else {
                                $('#action-results').html('<div class="notice notice-error"><p>❌ ' + response.data + '</p></div>');
                            }
                        },
                        error: function() {
                            $('#action-results').html('<div class="notice notice-error"><p>❌ Clear logs failed</p></div>');
                        },
                        complete: function() {
                            $btn.prop('disabled', false).text('🗑️ Clear Logs');
                        }
                    });
                }
            });
            
            function loadCronStatus() {
                $.ajax({
                    url: threadsIntel.ajaxUrl,
                    type: 'POST',
                    data: {
                        action: 'threads_intel_get_status',
                        nonce: threadsIntel.nonce
                    },
                    success: function(response) {
                        if (response.success) {
                            var status = response.data;
                            var html = '<table class="widefat">';
                            html += '<tr><td><strong>WordPress Cron Enabled:</strong></td><td>' + (status.cron_enabled ? '✅ Yes' : '❌ No') + '</td></tr>';
                            html += '<tr><td><strong>Next Scheduled Sync:</strong></td><td>' + status.next_scheduled + '</td></tr>';
                            html += '<tr><td><strong>Last Cron Check:</strong></td><td>' + status.last_cron_check + '</td></tr>';
                            html += '<tr><td><strong>Sync Hook Registered:</strong></td><td>' + (status.sync_hook_registered ? '✅ Yes' : '❌ No') + '</td></tr>';
                            html += '<tr><td><strong>Custom Cron Schedules:</strong></td><td>' + status.custom_cron_schedules + '</td></tr>';
                            html += '</table>';
                            $('#cron-status-display').html(html);
                        }
                    }
                });
            }
            
            function loadSyncLogs() {
                $.ajax({
                    url: threadsIntel.ajaxUrl,
                    type: 'POST',
                    data: {
                        action: 'threads_intel_get_status',
                        nonce: threadsIntel.nonce
                    },
                    success: function(response) {
                        if (response.success) {
                            var status = response.data;
                            var logs = status.recent_logs || [];
                            
                            if (logs.length === 0) {
                                $('#sync-logs-display').html('<p>No logs available</p>');
                                return;
                            }
                            
                            var html = '<table class="widefat">';
                            html += '<thead><tr><th>Time</th><th>Level</th><th>Message</th></tr></thead><tbody>';
                            
                            logs.forEach(function(log) {
                                var levelClass = log.level === 'error' ? 'error' : (log.level === 'success' ? 'success' : 'info');
                                html += '<tr class="' + levelClass + '">';
                                html += '<td>' + log.timestamp + '</td>';
                                html += '<td>' + log.level.toUpperCase() + '</td>';
                                html += '<td>' + log.message + '</td>';
                                html += '</tr>';
                            });
                            
                            html += '</tbody></table>';
                            $('#sync-logs-display').html(html);
                        }
                    }
                });
            }
            
            function loadNextSyncTime() {
                $.ajax({
                    url: threadsIntel.ajaxUrl,
                    type: 'POST',
                    data: {
                        action: 'threads_intel_get_status',
                        nonce: threadsIntel.nonce
                    },
                    success: function(response) {
                        if (response.success) {
                            var status = response.data;
                            $('#next-sync-time').text(status.next_scheduled);
                        }
                    }
                });
            }
            
            // Auto-refresh every 30 seconds
            setInterval(function() {
                loadCronStatus();
                loadSyncLogs();
                loadNextSyncTime();
            }, 30000);
        });
        </script>
        
        <style>
        .widefat td { padding: 8px; }
        .widefat tr.error { background-color: #ffebee; }
        .widefat tr.success { background-color: #e8f5e8; }
        .widefat tr.info { background-color: #e3f2fd; }
        </style>
        <?php
    }
    
    private function get_detailed_status() {
        $next_scheduled = wp_next_scheduled('threads_intel_push_sync_hook');
        $cron_enabled = !defined('DISABLE_WP_CRON') || !DISABLE_WP_CRON;
        $sync_hook_registered = has_action('threads_intel_push_sync_hook');
        
        // Get recent logs
        $logs = get_option('threads_intel_sync_logs', array());
        $recent_logs = array_slice($logs, -20); // Last 20 logs
        
        // Get sync statuses
        $sync_statuses = get_option('threads_intel_sync_statuses', array());
        $recent_statuses = array_slice($sync_statuses, -10); // Last 10 statuses
        
        return array(
            'cron_enabled' => $cron_enabled,
            'next_scheduled' => $next_scheduled ? date('Y-m-d H:i:s', $next_scheduled) : 'Not scheduled',
            'last_cron_check' => date('Y-m-d H:i:s'),
            'sync_hook_registered' => $sync_hook_registered,
            'custom_cron_schedules' => '5 minutes',
            'recent_logs' => $recent_logs,
            'recent_statuses' => $recent_statuses
        );
    }
    
    private function log_message($message, $level = 'info') {
        $log_entry = array(
            'timestamp' => current_time('mysql'),
            'message' => $message,
            'level' => $level,
            'user_id' => get_current_user_id()
        );
        
        $logs = get_option('threads_intel_sync_logs', array());
        $logs[] = $log_entry;
        
        if (count($logs) > 100) {
            $logs = array_slice($logs, -100);
        }
        
        update_option('threads_intel_sync_logs', $logs);
        
        // Also log to WordPress error log
        $log_prefix = 'Threads Intel Push Sync [' . strtoupper($level) . ']';
        error_log("{$log_prefix}: {$message}");
    }
    
    private function log_cron_status() {
        $next_scheduled = wp_next_scheduled('threads_intel_push_sync_hook');
        $cron_enabled = !defined('DISABLE_WP_CRON') || !DISABLE_WP_CRON;
        
        $this->log_message("Cron status check - Enabled: " . ($cron_enabled ? 'Yes' : 'No') . ", Next sync: " . ($next_scheduled ? date('Y-m-d H:i:s', $next_scheduled) : 'Not scheduled'), 'info');
    }
    
    private function update_sync_status($status, $message, $sync_id, $start_time) {
        $end_time = microtime(true);
        $duration = round($end_time - $start_time, 2);
        
        $status_entry = array(
            'sync_id' => $sync_id,
            'status' => $status,
            'message' => $message,
            'duration' => $duration,
            'timestamp' => current_time('mysql')
        );
        
        $statuses = get_option('threads_intel_sync_statuses', array());
        $statuses[] = $status_entry;
        
        if (count($statuses) > 50) {
            $statuses = array_slice($statuses, -50);
        }
        
        update_option('threads_intel_sync_statuses', $statuses);
        
        // Update last sync info
        if ($status === 'success') {
            update_option('threads_intel_last_sync_time', current_time('mysql'));
            update_option('threads_intel_last_sync_status', $message);
            delete_option('threads_intel_last_error');
        } else {
            update_option('threads_intel_last_error', $message);
        }
    }
    
    public function activate() {
        $this->log_message('Plugin activated', 'info');
        $this->schedule_sync();
    }
    
    public function deactivate() {
        $this->log_message('Plugin deactivated', 'info');
        wp_clear_scheduled_hook('threads_intel_push_sync_hook');
    }
}

// Initialize the plugin
new ThreadsIntelPushSyncEnhanced();
