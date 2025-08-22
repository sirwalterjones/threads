<?php
/**
 * Threads Intel Enhanced Sync - DEBUG VERSION (Single File)
 * Copy this entire file into WordPress as a new plugin
 */

/*
Plugin Name: Threads Intel Enhanced Sync - DEBUG
Description: Enhanced direct sync with multiple fallback mechanisms for Threads Intel system - DEBUG VERSION
Version: 3.0-DEBUG
Author: Threads Intel Team
*/

if (!defined('ABSPATH')) exit;

class ThreadsIntelEnhancedSyncDebug {
    private $vercel_api_base = 'https://cso.vectoronline.us/api';
    private $admin_username = 'admin';
    private $admin_password = 'admin123456';
    private $auth_token = null;
    private $last_sync_time = null;
    private $sync_attempts = 0;
    private $max_retries = 3;
    private $retry_delay = 300;
    private $debug_mode = true;

    public function __construct() {
        add_action('init', array($this, 'init'));
        add_action('wp_loaded', array($this, 'schedule_sync'));
        add_action('threads_intel_enhanced_sync_hook', array($this, 'perform_enhanced_sync'));
        add_action('save_post', array($this, 'trigger_immediate_sync'), 10, 1);
        add_action('wp_ajax_threads_intel_enhanced_sync', array($this, 'manual_sync_ajax'));
        add_action('wp_ajax_threads_intel_trigger_sync', array($this, 'trigger_sync_ajax'));
        add_action('wp_ajax_threads_intel_get_status', array($this, 'get_sync_status_ajax'));
        add_action('wp_ajax_threads_intel_test_connection', array($this, 'test_connection_ajax'));
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_scripts'));
        add_filter('cron_schedules', array($this, 'add_cron_schedules'));
        add_action('wp_ajax_threads_intel_heartbeat', array($this, 'heartbeat_ajax'));
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));
    }

    public function init() {
        $this->last_sync_time = get_option('threads_intel_last_sync_time');
        $this->sync_attempts = get_option('threads_intel_sync_attempts', 0);
        $this->check_sync_health();
    }

    public function add_cron_schedules($schedules) {
        $schedules['fiveminutes'] = array('interval' => 300, 'display' => __('Every 5 Minutes'));
        $schedules['tenminutes'] = array('interval' => 600, 'display' => __('Every 10 Minutes'));
        $schedules['thirtyminutes'] = array('interval' => 1800, 'display' => __('Every 30 Minutes'));
        return $schedules;
    }

    public function schedule_sync() {
        wp_clear_scheduled_hook('threads_intel_enhanced_sync_hook');
        wp_clear_scheduled_hook('threads_intel_backup_sync_hook');
        if (!wp_next_scheduled('threads_intel_enhanced_sync_hook')) {
            wp_schedule_event(time(), 'fiveminutes', 'threads_intel_enhanced_sync_hook');
            $this->log_message('Enhanced sync scheduled for every 5 minutes');
        }
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
        if (get_transient('threads_intel_sync_running')) {
            $this->log_message('Sync already running, skipping');
            return;
        }
        set_transient('threads_intel_sync_running', true, 300);
        try {
            $success = $this->perform_direct_sync();
            if (!$success && $this->sync_attempts < $this->max_retries) {
                $this->log_message('Direct sync failed, attempting retry ' . ($this->sync_attempts + 1));
                $delay = $this->retry_delay * pow(2, $this->sync_attempts);
                wp_schedule_single_event(time() + $delay, 'threads_intel_enhanced_sync_hook');
                $this->sync_attempts++;
                update_option('threads_intel_sync_attempts', $this->sync_attempts);
            } else {
                $this->sync_attempts = 0;
                update_option('threads_intel_sync_attempts', 0);
            }
        } catch (Exception $e) {
            $this->log_message('Enhanced sync error: ' . $e->getMessage());
        } finally {
            delete_transient('threads_intel_sync_running');
        }
    }

    public function perform_direct_sync() {
        $this->log_message('Starting direct sync...');
        try {
            if (!$this->authenticate()) {
                throw new Exception('Authentication failed');
            }
            $recent_posts = $this->get_recent_posts();
            if (empty($recent_posts)) {
                $this->log_message('No recent posts to sync');
                return true;
            }
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
        $args = array(
            'post_type' => 'post',
            'post_status' => 'publish',
            'posts_per_page' => 50,
            'date_query' => array(
                array('column' => 'post_modified', 'after' => '24 hours ago')
            ),
            'orderby' => 'modified',
            'order' => 'DESC'
        );
        $posts = get_posts($args);
        $this->log_message('Found ' . count($posts) . ' recent posts');
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
                'format' => get_post_format($post->ID) ?: 'standard'
            );
        }
        return $formatted_posts;
    }

    private function get_categories() {
        $this->log_message('Fetching categories...');
        $categories = get_categories(array('hide_empty' => false, 'number' => 100));
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
        if ($post_id && !$this->should_trigger_sync()) {
            return;
        }
        $this->log_message('Immediate sync triggered');
        wp_schedule_single_event(time(), 'threads_intel_enhanced_sync_hook');
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
        $this->log_message('Manual sync triggered via AJAX');
        try {
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
        wp_add_inline_script('jquery', $this->get_admin_script());
        wp_localize_script('jquery', 'threadsIntel', array(
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('threads_intel_nonce')
        ));
    }

    private function get_admin_script() {
        return '
        jQuery(document).ready(function($) {
            "use strict";
            setInterval(refreshStatus, 30000);
            refreshStatus();
            loadLogs();
            loadCronStatus();
            
            $("#manual-sync").on("click", function() {
                var $btn = $(this);
                $btn.prop("disabled", true).text("Triggering Sync...");
                $.ajax({
                    url: threadsIntel.ajaxUrl,
                    type: "POST",
                    data: {
                        action: "threads_intel_enhanced_sync",
                        nonce: threadsIntel.nonce
                    },
                    success: function(response) {
                        if (response.success) {
                            alert("Manual sync triggered successfully!");
                            refreshStatus();
                            loadLogs();
                        } else {
                            alert("Failed to trigger sync: " + (response.data || "Unknown error"));
                        }
                    },
                    error: function(xhr, status, error) {
                        console.error("Manual sync error:", {xhr: xhr, status: status, error: error});
                        alert("Failed to trigger sync. Error: " + error);
                    },
                    complete: function() {
                        $btn.prop("disabled", false).text("Trigger Manual Sync");
                    }
                });
            });
            
            $("#test-connection").on("click", function() {
                var $btn = $(this);
                $btn.prop("disabled", true).text("Testing...");
                $.ajax({
                    url: threadsIntel.ajaxUrl,
                    type: "POST",
                    data: {
                        action: "threads_intel_test_connection",
                        nonce: threadsIntel.nonce
                    },
                    success: function(response) {
                        if (response.success) {
                            alert("Connection test successful!");
                        } else {
                            alert("Connection test failed: " + (response.data || "Unknown error"));
                        }
                    },
                    error: function(xhr, status, error) {
                        console.error("Connection test error:", {xhr: xhr, status: status, error: error});
                        alert("Connection test failed. Error: " + error);
                    },
                    complete: function() {
                        $btn.prop("disabled", false).text("Test Connection");
                    }
                });
            });
            
            $("#refresh-status").on("click", function() {
                refreshStatus();
                loadLogs();
                loadCronStatus();
            });
            
            function refreshStatus() {
                $.ajax({
                    url: threadsIntel.ajaxUrl,
                    type: "POST",
                    data: {
                        action: "threads_intel_get_status",
                        nonce: threadsIntel.nonce
                    },
                    success: function(response) {
                        if (response.success) {
                            updateStatus(response.data);
                        } else {
                            $("#sync-status").html("<p style=\"color: red;\">Failed to load status: " + (response.data || "Unknown error") + "</p>");
                        }
                    },
                    error: function(xhr, status, error) {
                        console.error("Status refresh error:", {xhr: xhr, status: status, error: error});
                        $("#sync-status").html("<p style=\"color: red;\">Failed to load status. Error: " + error + "</p>");
                    }
                });
            }
            
            function updateStatus(data) {
                var statusHtml = "<table class=\"widefat\">";
                statusHtml += "<tr><td><strong>Last Sync:</strong></td><td>" + (data.last_sync || "Never") + "</td></tr>";
                statusHtml += "<tr><td><strong>Sync Attempts:</strong></td><td>" + data.sync_attempts + "</td></tr>";
                statusHtml += "<tr><td><strong>Currently Running:</strong></td><td>" + (data.is_running ? "Yes" : "No") + "</td></tr>";
                statusHtml += "<tr><td><strong>Next Scheduled:</strong></td><td>" + (data.next_scheduled ? new Date(data.next_scheduled * 1000).toLocaleString() : "Not scheduled") + "</td></tr>";
                statusHtml += "<tr><td><strong>WP Cron Disabled:</strong></td><td>" + (data.cron_disabled ? "Yes (This may cause sync issues)" : "No") + "</td></tr>";
                statusHtml += "<tr><td><strong>Debug Mode:</strong></td><td>" + (data.debug_mode ? "Enabled" : "Disabled") + "</td></tr>";
                statusHtml += "</table>";
                $("#sync-status").html(statusHtml);
            }
            
            function loadLogs() {
                $.ajax({
                    url: threadsIntel.ajaxUrl,
                    type: "POST",
                    data: {
                        action: "threads_intel_get_status",
                        nonce: threadsIntel.nonce
                    },
                    success: function(response) {
                        if (response.success && response.data.recent_logs) {
                            updateLogs(response.data.recent_logs);
                        } else {
                            $("#sync-logs").html("<p style=\"color: orange;\">No recent logs available</p>");
                        }
                    },
                    error: function(xhr, status, error) {
                        console.error("Logs load error:", {xhr: xhr, status: status, error: error});
                        $("#sync-logs").html("<p style=\"color: red;\">Failed to load logs. Error: " + error + "</p>");
                    }
                });
            }
            
            function updateLogs(logs) {
                if (!logs || logs.length === 0) {
                    $("#sync-logs").html("<p style=\"color: orange;\">No recent sync logs found</p>");
                    return;
                }
                var logsHtml = "<table class=\"widefat\">";
                logsHtml += "<thead><tr><th>Timestamp</th><th>Message</th><th>User ID</th></tr></thead><tbody>";
                logs.forEach(function(log) {
                    logsHtml += "<tr>";
                    logsHtml += "<td>" + (log.timestamp || "Unknown") + "</td>";
                    logsHtml += "<td>" + (log.message || "No message") + "</td>";
                    logsHtml += "<td>" + (log.user_id || "System") + "</td>";
                    logsHtml += "</tr>";
                });
                logsHtml += "</tbody></table>";
                $("#sync-logs").html(logsHtml);
            }
            
            function loadCronStatus() {
                $("#cron-status").html("<p style=\"color: orange;\">Cron status not available. Check WordPress Tools → Site Health → Info → Cron Events</p>");
            }
            
            console.log("Threads Intel Debug Admin loaded");
            console.log("AJAX URL:", threadsIntel.ajaxUrl);
            console.log("Nonce:", threadsIntel.nonce);
        });
        ';
    }

    public function admin_page() {
        ?>
        <div class="wrap">
            <h1>Threads Intel Enhanced Sync - DEBUG MODE</h1>
            <div class="card">
                <h2>Sync Status</h2>
                <div id="sync-status"><p>Loading status...</p></div>
                <p>
                    <button id="manual-sync" class="button button-primary">Trigger Manual Sync</button>
                    <button id="test-connection" class="button">Test Connection</button>
                    <button id="refresh-status" class="button">Refresh Status</button>
                </p>
            </div>
            <div class="card">
                <h2>Recent Sync Logs</h2>
                <div id="sync-logs"><p>Loading logs...</p></div>
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
                <div id="cron-status"><p>Loading cron status...</p></div>
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
        $logs = get_option('threads_intel_sync_logs', array());
        $logs[] = $log_entry;
        if (count($logs) > 100) {
            $logs = array_slice($logs, -100);
        }
        update_option('threads_intel_sync_logs', $logs);
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

new ThreadsIntelEnhancedSyncDebug();

