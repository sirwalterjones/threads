<?php
/**
 * WordPress Status Endpoint for Threads Intel System
 * 
 * This plugin provides a simple status endpoint that allows the Threads Intel
 * system to check WordPress availability and get basic sync information.
 * 
 * Features:
 * - Status endpoint for health checks
 * - Sync trigger endpoint for manual syncs
 * - Basic WordPress information
 * - No complex sync logic (handled by Threads Intel)
 */

/*
Plugin Name: Threads Intel Status Endpoint
Description: Simple status endpoint for Threads Intel pull-based sync
Version: 4.0
Author: Threads Intel Team
*/

if (!defined('ABSPATH')) {
    exit;
}

class ThreadsIntelStatusEndpoint {
    
    public function __construct() {
        // Add REST API endpoints
        add_action('rest_api_init', array($this, 'register_endpoints'));
        
        // Admin interface
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_scripts'));
        
        // Register activation/deactivation hooks
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));
    }
    
    public function register_endpoints() {
        // Status endpoint for health checks
        register_rest_route('threads-intel/v1', '/status', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_status'),
            'permission_callback' => '__return_true'
        ));
        
        // Sync trigger endpoint
        register_rest_route('threads-intel/v1', '/trigger-sync', array(
            'methods' => 'POST',
            'callback' => array($this, 'trigger_sync'),
            'permission_callback' => '__return_true'
        ));
        
        // Posts endpoint for data fetching
        register_rest_route('threads-intel/v1', '/posts', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_posts'),
            'permission_callback' => '__return_true',
            'args' => array(
                'per_page' => array(
                    'default' => 100,
                    'sanitize_callback' => 'absint',
                    'validate_callback' => function($param) {
                        return $param > 0 && $param <= 1000;
                    }
                ),
                'page' => array(
                    'default' => 1,
                    'sanitize_callback' => 'absint',
                    'validate_callback' => function($param) {
                        return $param > 0;
                    }
                ),
                'modified_after' => array(
                    'default' => null,
                    'sanitize_callback' => 'sanitize_text_field'
                )
            )
        ));
        
        // Categories endpoint
        register_rest_route('threads-intel/v1', '/categories', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_categories'),
            'permission_callback' => '__return_true'
        ));
    }
    
    public function get_status() {
        $status = array(
            'status' => 'healthy',
            'timestamp' => current_time('mysql'),
            'wordpress_version' => get_bloginfo('version'),
            'php_version' => PHP_VERSION,
            'site_url' => get_site_url(),
            'home_url' => get_home_url(),
            'timezone' => get_option('timezone_string'),
            'cron_disabled' => defined('DISABLE_WP_CRON') && DISABLE_WP_CRON,
            'last_sync_attempt' => get_option('threads_intel_last_sync_attempt'),
            'sync_status' => get_option('threads_intel_sync_status', 'unknown')
        );
        
        return new WP_REST_Response($status, 200);
    }
    
    public function trigger_sync() {
        // Update sync status
        update_option('threads_intel_last_sync_attempt', current_time('mysql'));
        update_option('threads_intel_sync_status', 'triggered');
        
        $response = array(
            'message' => 'Sync triggered successfully',
            'timestamp' => current_time('mysql'),
            'status' => 'triggered'
        );
        
        return new WP_REST_Response($response, 200);
    }
    
    public function get_posts($request) {
        $per_page = $request->get_param('per_page');
        $page = $request->get_param('page');
        $modified_after = $request->get_param('modified_after');
        
        $args = array(
            'post_type' => 'post',
            'post_status' => 'publish',
            'posts_per_page' => $per_page,
            'paged' => $page,
            'orderby' => 'modified',
            'order' => 'DESC'
        );
        
        // Add date filter if specified
        if ($modified_after) {
            $args['date_query'] = array(
                array(
                    'column' => 'post_modified',
                    'after' => $modified_after
                )
            );
        }
        
        $query = new WP_Query($args);
        $posts = array();
        
        if ($query->have_posts()) {
            while ($query->have_posts()) {
                $query->the_post();
                $post_id = get_the_ID();
                
                // Get categories
                $categories = get_the_category($post_id);
                $category_ids = array();
                foreach ($categories as $category) {
                    $category_ids[] = $category->term_id;
                }
                
                // Get author info
                $author = get_userdata(get_the_author_meta('ID'));
                
                // Get featured image
                $featured_image = get_post_thumbnail_id($post_id);
                $featured_image_url = '';
                if ($featured_image) {
                    $featured_image_url = wp_get_attachment_url($featured_image);
                }
                
                $posts[] = array(
                    'id' => $post_id,
                    'title' => array('rendered' => get_the_title()),
                    'content' => array('rendered' => apply_filters('the_content', get_the_content())),
                    'excerpt' => array('rendered' => get_the_excerpt()),
                    'slug' => get_post_field('post_name'),
                    'status' => get_post_status(),
                    'author' => get_the_author_meta('ID'),
                    'author_name' => $author ? $author->display_name : 'Unknown',
                    'date' => get_the_date('Y-m-d H:i:s'),
                    'modified' => get_the_modified_date('Y-m-d H:i:s'),
                    'categories' => $category_ids,
                    'tags' => wp_get_post_tags($post_id, array('fields' => 'ids')),
                    'featured_media' => $featured_image,
                    'featured_media_url' => $featured_image_url,
                    'sticky' => is_sticky($post_id),
                    'format' => get_post_format($post_id) ?: 'standard',
                    'comment_count' => get_comments_number($post_id)
                );
            }
        }
        
        wp_reset_postdata();
        
        $response = array(
            'posts' => $posts,
            'pagination' => array(
                'current_page' => $page,
                'per_page' => $per_page,
                'total_posts' => $query->found_posts,
                'total_pages' => $query->max_num_pages
            )
        );
        
        return new WP_REST_Response($response, 200);
    }
    
    public function get_categories() {
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
        
        return new WP_REST_Response($formatted_categories, 200);
    }
    
    public function add_admin_menu() {
        add_options_page(
            'Threads Intel Status',
            'Threads Intel Status',
            'manage_options',
            'threads-intel-status',
            array($this, 'admin_page')
        );
    }
    
    public function enqueue_admin_scripts($hook) {
        if ($hook !== 'settings_page_threads-intel-status') {
            return;
        }
        
        wp_enqueue_script('jquery');
        wp_enqueue_script('threads-intel-admin', plugin_dir_url(__FILE__) . 'admin.js', array('jquery'), '1.0', true);
        wp_localize_script('threads-intel-admin', 'threadsIntel', array(
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('threads_intel_nonce')
        ));
    }
    
    public function admin_page() {
        $site_url = get_site_url();
        $status_endpoint = $site_url . '/wp-json/threads-intel/v1/status';
        $posts_endpoint = $site_url . '/wp-json/threads-intel/v1/posts';
        $categories_endpoint = $site_url . '/wp-json/threads-intel/v1/categories';
        $trigger_endpoint = $site_url . '/wp-json/threads-intel/v1/trigger-sync';
        
        ?>
        <div class="wrap">
            <h1>Threads Intel Status Endpoint</h1>
            
            <div class="card">
                <h2>API Endpoints</h2>
                <p><strong>Status:</strong> <code><?php echo esc_html($status_endpoint); ?></code></p>
                <p><strong>Posts:</strong> <code><?php echo esc_html($posts_endpoint); ?></code></p>
                <p><strong>Categories:</strong> <code><?php echo esc_html($categories_endpoint); ?></code></p>
                <p><strong>Trigger Sync:</strong> <code><?php echo esc_html($trigger_endpoint); ?></code></p>
            </div>
            
            <div class="card">
                <h2>Test Endpoints</h2>
                <p>
                    <button id="test-status" class="button button-primary">Test Status Endpoint</button>
                    <button id="test-posts" class="button">Test Posts Endpoint</button>
                    <button id="test-categories" class="button">Test Categories Endpoint</button>
                </p>
                <div id="test-results">
                    <p>Click a button to test the endpoints...</p>
                </div>
            </div>
            
            <div class="card">
                <h2>Sync Information</h2>
                <p><strong>Last Sync Attempt:</strong> <?php echo esc_html(get_option('threads_intel_last_sync_attempt', 'Never')); ?></p>
                <p><strong>Sync Status:</strong> <?php echo esc_html(get_option('threads_intel_sync_status', 'Unknown')); ?></p>
                <p><strong>WordPress Version:</strong> <?php echo esc_html(get_bloginfo('version')); ?></p>
                <p><strong>PHP Version:</strong> <?php echo esc_html(PHP_VERSION); ?></p>
            </div>
        </div>
        <?php
    }
    
    public function activate() {
        // Flush rewrite rules to register new endpoints
        flush_rewrite_rules();
    }
    
    public function deactivate() {
        // Flush rewrite rules
        flush_rewrite_rules();
    }
}

// Initialize the plugin
new ThreadsIntelStatusEndpoint();
