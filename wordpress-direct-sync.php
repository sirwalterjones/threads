<?php
/**
 * WordPress Direct Sync for Threads Intel System
 * 
 * This plugin directly sends WordPress data to Vercel instead of asking
 * Vercel to fetch it. This bypasses all connectivity issues.
 */

/*
Plugin Name: Threads Intel Direct Sync
Description: Directly sends WordPress posts to Threads Intel system
Version: 2.0
*/

if (!defined('ABSPATH')) {
    exit;
}

class ThreadsIntelDirectSync {
    
    private $vercel_api_base = 'https://threads-8qfennhvr-walter-jones-projects.vercel.app/api';
    private $admin_username = 'admin';
    private $admin_password = 'admin123456';
    private $auth_token = null;
    
    public function __construct() {
        add_action('wp', array($this, 'schedule_sync'));
        add_action('threads_intel_direct_sync_hook', array($this, 'perform_direct_sync'));
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('wp_ajax_threads_intel_direct_sync', array($this, 'manual_sync_ajax'));
        add_action('save_post', array($this, 'trigger_immediate_sync'), 10, 1);
    }
    
    public function schedule_sync() {
        if (!wp_next_scheduled('threads_intel_direct_sync_hook')) {
            wp_schedule_event(time(), 'fiveminutes', 'threads_intel_direct_sync_hook');
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
                return;
            }
            
            // Send posts directly to Vercel
            $result = $this->send_posts_to_vercel($recent_posts);
            
            $this->log_message('Direct sync completed: ' . count($recent_posts) . ' posts sent');
            
        } catch (Exception $e) {
            $this->log_message('Direct sync failed: ' . $e->getMessage());
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
    
    private function get_recent_posts() {
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
            
            // Format post data similar to WordPress REST API
            $formatted_posts[] = array(
                'id' => $post->ID,
                'title' => array('rendered' => $post->post_title),
                'content' => array('rendered' => apply_filters('the_content', $post->post_content)),
                'excerpt' => array('rendered' => $post->post_excerpt),
                'slug' => $post->post_name,
                'status' => $post->post_status,
                'author' => $post->post_author,
                'author_name' => $author ? $author->display_name : 'Unknown',
                'date' => $post->post_date,
                'modified' => $post->post_modified,
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
        $categories = get_categories(array(
            'hide_empty' => false,
            'number' => 100
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
    
    private function send_posts_to_vercel($posts) {
        // Create a new endpoint that accepts direct post data
        $data = array(
            'posts' => $posts,
            'categories' => $this->get_categories(),
            'timestamp' => current_time('mysql'),
            'source' => 'wordpress_direct'
        );
        
        $response = wp_remote_post($this->vercel_api_base . '/admin/ingest-direct', array(
            'timeout' => 120,
            'headers' => array(
                'Content-Type' => 'application/json',
                'Authorization' => 'Bearer ' . $this->auth_token
            ),
            'body' => json_encode($data)
        ));
        
        if (is_wp_error($response)) {
            throw new Exception('Direct ingest request failed: ' . $response->get_error_message());
        }
        
        $response_code = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);
        
        // If the direct endpoint doesn't exist (404), log it but don't fail
        if ($response_code === 404) {
            $this->log_message('Direct ingest endpoint not available yet. Waiting for deployment.');
            return array('status' => 'endpoint_not_ready');
        }
        
        if ($response_code !== 200) {
            throw new Exception('Direct ingest failed (HTTP ' . $response_code . '): ' . ($body['error'] ?? 'Unknown error'));
        }
        
        return $body;
    }
    
    public function trigger_immediate_sync($post_id) {
        if (get_post_status($post_id) !== 'publish') {
            return;
        }
        
        wp_schedule_single_event(time() + 5, 'threads_intel_direct_sync_hook');
    }
    
    public function add_admin_menu() {
        add_options_page(
            'Threads Intel Direct Sync',
            'Threads Intel',
            'manage_options',
            'threads-intel-direct-sync',
            array($this, 'admin_page')
        );
    }
    
    public function admin_page() {
        ?>
        <div class="wrap">
            <h1>Threads Intel Direct Sync</h1>
            <p>This plugin directly sends WordPress posts to the Threads Intel system.</p>
            
            <div class="card">
                <h2>Sync Status</h2>
                <p><strong>Next scheduled sync:</strong> <?php echo date('Y-m-d H:i:s', wp_next_scheduled('threads_intel_direct_sync_hook')); ?></p>
                <p><strong>Recent posts (last 24h):</strong> <?php echo count($this->get_recent_posts()); ?> posts</p>
                <p><strong>Last sync log:</strong></p>
                <textarea readonly style="width: 100%; height: 200px;"><?php echo esc_textarea(get_option('threads_intel_direct_sync_log', 'No logs yet')); ?></textarea>
            </div>
            
            <div class="card">
                <h2>Manual Sync</h2>
                <button id="manual-sync-btn" class="button button-primary">Send Recent Posts Now</button>
                <div id="sync-result" style="margin-top: 10px;"></div>
            </div>
        </div>
        
        <script>
        document.getElementById('manual-sync-btn').addEventListener('click', function() {
            const btn = this;
            const result = document.getElementById('sync-result');
            
            btn.disabled = true;
            btn.textContent = 'Sending...';
            result.innerHTML = '<p>Starting direct sync...</p>';
            
            fetch(ajaxurl, {
                method: 'POST',
                headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                body: 'action=threads_intel_direct_sync&_ajax_nonce=<?php echo wp_create_nonce('threads_intel_direct_sync'); ?>'
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    result.innerHTML = '<div class="notice notice-success"><p>Direct sync completed successfully!</p></div>';
                } else {
                    result.innerHTML = '<div class="notice notice-error"><p>Sync failed: ' + data.data + '</p></div>';
                }
            })
            .catch(error => {
                result.innerHTML = '<div class="notice notice-error"><p>Error: ' + error.message + '</p></div>';
            })
            .finally(() => {
                btn.disabled = false;
                btn.textContent = 'Send Recent Posts Now';
            });
        });
        </script>
        <?php
    }
    
    public function manual_sync_ajax() {
        check_ajax_referer('threads_intel_direct_sync');
        
        if (!current_user_can('manage_options')) {
            wp_die('Insufficient permissions');
        }
        
        try {
            $this->perform_direct_sync();
            wp_send_json_success('Direct sync completed');
        } catch (Exception $e) {
            wp_send_json_error($e->getMessage());
        }
    }
    
    private function log_message($message) {
        $timestamp = date('Y-m-d H:i:s');
        $log_entry = "[$timestamp] $message\n";
        
        $current_log = get_option('threads_intel_direct_sync_log', '');
        $new_log = $log_entry . $current_log;
        
        $lines = explode("\n", $new_log);
        if (count($lines) > 50) {
            $lines = array_slice($lines, 0, 50);
            $new_log = implode("\n", $lines);
        }
        
        update_option('threads_intel_direct_sync_log', $new_log);
    }
}

// Initialize
new ThreadsIntelDirectSync();

register_activation_hook(__FILE__, function() {
    wp_schedule_event(time(), 'fiveminutes', 'threads_intel_direct_sync_hook');
});

register_deactivation_hook(__FILE__, function() {
    wp_clear_scheduled_hook('threads_intel_direct_sync_hook');
});
?>