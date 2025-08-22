<?php
/**
 * Threads Intel Push Sync - Full Featured Version
 * 
 * This plugin pushes data FROM WordPress TO the Threads Intel system
 * 
 * Features:
 * - Test connection button
 * - Manual sync trigger
 * - Real-time status display
 * - Sync logs with clear button
 * - WordPress cron monitoring
 */

/*
Plugin Name: Threads Intel Push Sync
Description: Push data from WordPress to Threads Intel system with full controls
Version: 2.0
Author: Threads Intel Team
*/

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class ThreadsIntelPushSync {
    
    private $api_url = 'https://cso.vectoronline.us/api';
    private $username = 'wrjones';
    private $password = 'W4lt3rj0n3s@';
    private $auth_token = null;
    
    public function __construct() {
        // Add admin menu
        add_action('admin_menu', array($this, 'add_admin_menu'));
        
        // Schedule sync every 5 minutes (WordPress cron)
        add_action('init', array($this, 'schedule_sync'));
        add_action('threads_intel_sync_hook', array($this, 'perform_sync'));
        
        // Add custom cron schedule
        add_filter('cron_schedules', array($this, 'add_cron_schedules'));
        
        // AJAX handlers
        add_action('wp_ajax_test_connection', array($this, 'ajax_test_connection'));
        add_action('wp_ajax_manual_sync', array($this, 'ajax_manual_sync'));
        add_action('wp_ajax_clear_logs', array($this, 'ajax_clear_logs'));
        
        // REST API endpoint for server cron
        add_action('rest_api_init', array($this, 'register_rest_routes'));
        
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
            $this->log_message('Sync scheduled for every 5 minutes');
        }
    }
    
    public function perform_sync() {
        $this->log_message('Starting automatic sync...');
        
        try {
            // Get recent posts
            $posts = $this->get_recent_posts();
            $categories = $this->get_categories();
            
            if (empty($posts) && empty($categories)) {
                $this->log_message('No data to sync');
                return;
            }
            
            $this->log_message('Found ' . count($posts) . ' posts and ' . count($categories) . ' categories to sync');
            
            // Try to send data
            $result = $this->send_data($posts, $categories);
            
            if ($result) {
                $this->log_message('Sync completed successfully');
                update_option('threads_intel_last_sync', current_time('mysql'));
                update_option('threads_intel_sync_status', 'success');
            } else {
                $this->log_message('Sync failed');
                update_option('threads_intel_sync_status', 'failed');
            }
            
        } catch (Exception $e) {
            $this->log_message('Sync error: ' . $e->getMessage());
            update_option('threads_intel_sync_status', 'error');
        }
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
        $formatted = array();
        
        foreach ($posts as $post) {
            // Get categories
            $categories = get_the_category($post->ID);
            $category_ids = array();
            foreach ($categories as $category) {
                $category_ids[] = $category->term_id;
            }
            
            // Get author info
            $author = get_userdata($post->post_author);
            
            // Format the post data exactly as Threads Intel expects
            $formatted[] = array(
                'id' => $post->ID,
                'title' => $post->post_title,
                'content' => $post->post_content,
                'excerpt' => $post->post_excerpt,
                'slug' => $post->post_name ?: 'post-' . $post->ID, // Ensure slug exists
                'status' => $post->post_status,
                'author' => $post->post_author,
                'author_name' => $author ? $author->display_name : 'Unknown',
                'date' => $post->post_date,
                'modified' => $post->post_modified,
                'wp_published_date' => $post->post_date_gmt,
                'wp_modified_date' => $post->post_modified_gmt,
                'categories' => $category_ids,
                'tags' => wp_get_post_tags($post->ID, array('fields' => 'ids')),
                'featured_media' => get_post_thumbnail_id($post->ID),
                'sticky' => is_sticky($post->ID),
                'format' => get_post_format($post->ID) ?: 'standard',
                'comment_count' => get_comments_number($post->ID),
                'ingested_at' => current_time('mysql', true), // Add ingestion timestamp
                'source' => 'wordpress_plugin'
            );
        }
        
        return $formatted;
    }
    
    private function get_categories() {
        $categories = get_categories(array('hide_empty' => false));
        $formatted = array();
        
        foreach ($categories as $cat) {
            $formatted[] = array(
                'id' => $cat->term_id,
                'name' => $cat->name,
                'slug' => $cat->slug,
                'description' => $cat->description
            );
        }
        
        return $formatted;
    }
    
    private function send_data($posts, $categories) {
        // First authenticate to get token
        if (!$this->authenticate()) {
            throw new Exception('Authentication failed');
        }
        
        $data = array(
            'posts' => $posts,
            'categories' => $categories,
            'timestamp' => current_time('mysql'),
            'source' => 'wordpress_plugin'
        );
        
        $response = wp_remote_post($this->api_url . '/admin/ingest-direct', array(
            'timeout' => 30,
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
        
        $code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        
        if ($code !== 200) {
            throw new Exception('Request failed with code ' . $code . ': ' . $body);
        }
        
        return true;
    }
    
    private function authenticate() {
        $response = wp_remote_post($this->api_url . '/auth/login', array(
            'timeout' => 30,
            'sslverify' => false,
            'headers' => array('Content-Type' => 'application/json'),
            'body' => json_encode(array(
                'username' => $this->username,
                'password' => $this->password
            ))
        ));
        
        if (is_wp_error($response)) {
            throw new Exception('Auth request failed: ' . $response->get_error_message());
        }
        
        $code = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);
        
        if ($code !== 200) {
            throw new Exception('Authentication failed with code ' . $code . ': ' . ($body['error'] ?? 'Unknown error'));
        }
        
        $this->auth_token = $body['token'] ?? null;
        if (empty($this->auth_token)) {
            throw new Exception('No token received from authentication');
        }
        
        return true;
    }
    
    public function ajax_test_connection() {
        check_ajax_referer('threads_intel_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_die('Unauthorized');
        }
        
        try {
            // Test basic connectivity first
            $response = wp_remote_get($this->api_url . '/health', array(
                'timeout' => 10,
                'sslverify' => false
            ));
            
            if (is_wp_error($response)) {
                wp_send_json_error('Connection failed: ' . $response->get_error_message());
            }
            
            $code = wp_remote_retrieve_response_code($response);
            if ($code !== 200) {
                wp_send_json_error('Health check failed with code: ' . $code);
            }
            
            // Now test authentication
            if ($this->authenticate()) {
                $this->log_message('Connection and authentication test successful');
                wp_send_json_success('Connection and authentication successful!');
            } else {
                wp_send_json_error('Authentication failed');
            }
            
        } catch (Exception $e) {
            wp_send_json_error('Connection test error: ' . $e->getMessage());
        }
    }
    
    public function ajax_manual_sync() {
        check_ajax_referer('threads_intel_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_die('Unauthorized');
        }
        
        $this->log_message('Manual sync triggered');
        $this->perform_sync();
        wp_send_json_success('Manual sync completed');
    }
    
    public function ajax_clear_logs() {
        check_ajax_referer('threads_intel_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_die('Unauthorized');
        }
        
        delete_option('threads_intel_sync_logs');
        wp_send_json_success('Logs cleared');
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
        $sync_status = get_option('threads_intel_sync_status', 'Unknown');
        $next_sync = wp_next_scheduled('threads_intel_sync_hook');
        $next_sync_time = $next_sync ? date('Y-m-d H:i:s', $next_sync) : 'Not scheduled';
        
        ?>
        <div class="wrap">
            <h1>Threads Intel Push Sync</h1>
            
            <div class="card">
                <h2>Sync Status</h2>
                <table class="widefat">
                    <tr>
                        <td><strong>Last Sync:</strong></td>
                        <td><?php echo esc_html($last_sync); ?></td>
                    </tr>
                    <tr>
                        <td><strong>Status:</strong></td>
                        <td><?php echo esc_html($sync_status); ?></td>
                    </tr>
                    <tr>
                        <td><strong>Next Scheduled Sync:</strong></td>
                        <td><?php echo esc_html($next_sync_time); ?></td>
                    </tr>
                    <tr>
                        <td><strong>API Endpoint:</strong></td>
                        <td><?php echo esc_html($this->api_url . '/admin/ingest-direct'); ?></td>
                    </tr>
                </table>
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
                <h2>Server Cron Setup (Recommended)</h2>
                <p><strong>WordPress cron is unreliable!</strong> Set up real server cron for guaranteed sync every 5 minutes.</p>
                
                <h3>Step 1: Disable WordPress Cron</h3>
                <p>Add this to your <code>wp-config.php</code>:</p>
                <pre style="background: #f0f0f0; padding: 10px; border-radius: 4px;">define('DISABLE_WP_CRON', true);</pre>
                
                <h3>Step 2: Set Up Server Cron</h3>
                <p>SSH into your server and run:</p>
                <pre style="background: #f0f0f0; padding: 10px; border-radius: 4px;">crontab -e</pre>
                
                <p>Add this line:</p>
                <pre style="background: #f0f0f0; padding: 10px; border-radius: 4px;">*/5 * * * * curl -X POST "<?php echo get_site_url(); ?>/wp-json/threads-intel/v1/sync"</pre>
                
                <h3>Step 3: Test Server Cron</h3>
                <p>Test the endpoint manually:</p>
                <pre style="background: #f0f0f0; padding: 10px; border-radius: 4px;">curl -X POST "<?php echo get_site_url(); ?>/wp-json/threads-intel/v1/sync"</pre>
                
                <p><strong>Benefits:</strong></p>
                <ul>
                    <li>✅ Runs every 5 minutes regardless of site traffic</li>
                    <li>✅ More reliable than WordPress cron</li>
                    <li>✅ Better performance (no visitor dependency)</li>
                    <li>✅ Can monitor and log cron execution</li>
                </ul>
            </div>
            
            <div class="card">
                <h2>Recent Sync Logs</h2>
                <div id="sync-logs">
                    <?php
                    $logs = get_option('threads_intel_sync_logs', array());
                    if (empty($logs)) {
                        echo '<p>No logs available yet.</p>';
                    } else {
                        echo '<ul>';
                        foreach (array_slice($logs, -20) as $log) {
                            echo '<li>' . esc_html($log) . '</li>';
                        }
                        echo '</ul>';
                    }
                    ?>
                </div>
            </div>
            
            <div class="card">
                <h2>How It Works</h2>
                <p>This plugin automatically syncs data from WordPress to your Threads Intel system every 5 minutes.</p>
                <p>It syncs:</p>
                <ul>
                    <li>Posts modified in the last 24 hours</li>
                    <li>All categories</li>
                    <li>Author information</li>
                </ul>
            </div>
        </div>
        
        <script>
        jQuery(document).ready(function($) {
            // Test connection
            $('#test-connection').on('click', function() {
                var $btn = $(this);
                $btn.prop('disabled', true).text('Testing...');
                
                $.ajax({
                    url: ajaxurl,
                    type: 'POST',
                    data: {
                        action: 'test_connection',
                        nonce: '<?php echo wp_create_nonce('threads_intel_nonce'); ?>'
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
            
            // Manual sync
            $('#manual-sync').on('click', function() {
                var $btn = $(this);
                $btn.prop('disabled', true).text('Syncing...');
                
                $.ajax({
                    url: ajaxurl,
                    type: 'POST',
                    data: {
                        action: 'manual_sync',
                        nonce: '<?php echo wp_create_nonce('threads_intel_nonce'); ?>'
                    },
                    success: function(response) {
                        if (response.success) {
                            $('#action-results').html('<div class="notice notice-success"><p>✅ ' + response.data + '</p></div>');
                            setTimeout(function() { location.reload(); }, 2000);
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
            
            // Clear logs
            $('#clear-logs').on('click', function() {
                if (confirm('Are you sure you want to clear all logs?')) {
                    var $btn = $(this);
                    $btn.prop('disabled', true).text('Clearing...');
                    
                    $.ajax({
                        url: ajaxurl,
                        type: 'POST',
                        data: {
                            action: 'clear_logs',
                            nonce: '<?php echo wp_create_nonce('threads_intel_nonce'); ?>'
                        },
                        success: function(response) {
                            if (response.success) {
                                $('#action-results').html('<div class="notice notice-success"><p>✅ ' + response.data + '</p></div>');
                                $('#sync-logs').html('<p>Logs cleared.</p>');
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
        });
        </script>
        <?php
    }
    
    private function log_message($message) {
        $logs = get_option('threads_intel_sync_logs', array());
        $logs[] = date('Y-m-d H:i:s') . ' - ' . $message;
        
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

    public function register_rest_routes() {
        register_rest_route('threads-intel/v1', '/sync', array(
            'methods' => 'POST',
            'callback' => array($this, 'rest_trigger_sync'),
            'permission_callback' => '__return_true' // Allow anyone to trigger sync
        ));
    }

    public function rest_trigger_sync($request) {
        $this->log_message('REST API sync triggered');
        $this->perform_sync();
        return new WP_REST_Response(array('message' => 'Sync triggered via REST API'), 200);
    }
}

// Initialize the plugin
new ThreadsIntelPushSync();
