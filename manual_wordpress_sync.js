#!/usr/bin/env node

const axios = require('axios');

const WORDPRESS_URL = 'https://cmansrms.us/wp-json/wp/v2';
const API_BASE = 'https://cso.vectoronline.us/api';

async function manualWordPressSync() {
  try {
    console.log('🚀 Starting manual WordPress sync...');
    
    // Step 1: Authenticate with Threads Intel system
    console.log('🔐 Authenticating...');
    const authResponse = await axios.post(`${API_BASE}/auth/login`, {
      username: 'admin',
      password: 'admin123456'
    });
    
    const token = authResponse.data.token;
    console.log('✅ Authentication successful');
    
    // Step 2: Get recent posts from WordPress (last 24 hours)
    console.log('📥 Fetching recent WordPress posts...');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    try {
      const postsResponse = await axios.get(`${WORDPRESS_URL}/posts`, {
        params: {
          per_page: 20,
          _embed: true,
          modified_after: yesterday.toISOString(),
          orderby: 'modified',
          order: 'desc'
        },
        timeout: 30000,
        headers: {
          'User-Agent': 'Threads Intel Sync/1.0'
        }
      });
      
      console.log(`📄 Found ${postsResponse.data.length} recent posts`);
      
      if (postsResponse.data.length === 0) {
        console.log('ℹ️ No recent posts found in last 24 hours. Fetching latest 10 posts...');
        
        const latestResponse = await axios.get(`${WORDPRESS_URL}/posts`, {
          params: {
            per_page: 10,
            _embed: true,
            orderby: 'modified',
            order: 'desc'
          },
          timeout: 30000,
          headers: {
            'User-Agent': 'Threads Intel Sync/1.0'
          }
        });
        
        postsResponse.data = latestResponse.data;
        console.log(`📄 Found ${postsResponse.data.length} latest posts`);
      }
      
      // Step 3: Get categories
      console.log('📂 Fetching WordPress categories...');
      const categoriesResponse = await axios.get(`${WORDPRESS_URL}/categories`, {
        params: {
          per_page: 100,
          hide_empty: false
        },
        timeout: 30000,
        headers: {
          'User-Agent': 'Threads Intel Sync/1.0'
        }
      });
      
      console.log(`📂 Found ${categoriesResponse.data.length} categories`);
      
      // Step 4: Format data for direct sync
      const formattedPosts = postsResponse.data.map(post => {
        // Get author name from embedded data
        let authorName = 'Unknown';
        if (post._embedded && post._embedded.author && post._embedded.author[0]) {
          authorName = post._embedded.author[0].name;
        }
        
        return {
          id: post.id,
          title: { rendered: post.title.rendered },
          content: { rendered: post.content.rendered },
          excerpt: { rendered: post.excerpt.rendered },
          slug: post.slug,
          status: post.status,
          author: post.author,
          author_name: authorName,
          date: post.date,
          modified: post.modified,
          categories: post.categories,
          tags: post.tags,
          featured_media: post.featured_media,
          sticky: post.sticky,
          format: post.format
        };
      });
      
      const formattedCategories = categoriesResponse.data.map(cat => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        parent: cat.parent,
        count: cat.count,
        description: cat.description
      }));
      
      // Step 5: Send to direct sync endpoint
      console.log('📤 Sending data to Threads Intel system...');
      console.log(`📊 Sending ${formattedPosts.length} posts and ${formattedCategories.length} categories`);
      
      const syncData = {
        posts: formattedPosts,
        categories: formattedCategories,
        timestamp: new Date().toISOString(),
        source: 'manual_sync'
      };
      
      const syncResponse = await axios.post(`${API_BASE}/admin/ingest-direct`, syncData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      });
      
      console.log('✅ Sync completed successfully!');
      console.log('📊 Results:', JSON.stringify(syncResponse.data.result, null, 2));
      
      if (syncResponse.data.result?.errors) {
        console.log('⚠️ Errors during processing:');
        syncResponse.data.result.errors.forEach(error => console.log(`  - ${error}`));
      }
      
      // Step 6: Verify posts are now in system
      console.log('\n🔍 Verifying sync results...');
      const verifyResponse = await axios.get(`${API_BASE}/posts`, {
        headers: { 'Authorization': `Bearer ${token}` },
        params: { limit: 10 }
      });
      
      console.log(`📊 Total posts in system: ${verifyResponse.data.total || verifyResponse.data.data?.length || 0}`);
      
      if (verifyResponse.data.data && verifyResponse.data.data.length > 0) {
        console.log('📄 Recent posts in system:');
        verifyResponse.data.data.slice(0, 5).forEach(post => {
          console.log(`  - ${post.title} (WP ID: ${post.wp_post_id}, Date: ${post.wp_published_date?.substring(0, 10)})`);
        });
      }
      
    } catch (wpError) {
      console.error('❌ Error fetching from WordPress:', wpError.message);
      if (wpError.response) {
        console.error('WordPress response status:', wpError.response.status);
        console.error('WordPress response data:', wpError.response.data);
      }
      
      console.log('\nℹ️ This is expected due to network connectivity issues between Vercel and Azure Government.');
      console.log('The WordPress plugin should handle this automatically by pushing data instead.');
    }
    
  } catch (error) {
    console.error('❌ Manual sync failed:', error.message);
    if (error.response?.data) {
      console.error('Error details:', error.response.data);
    }
  }
}

manualWordPressSync();