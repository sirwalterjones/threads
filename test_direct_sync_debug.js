#!/usr/bin/env node

const axios = require('axios');

const API_BASE = 'https://cso.vectoronline.us/api';

async function testDirectSync() {
  try {
    console.log('🔍 Testing direct sync with debug data...');
    
    // Get auth token
    const authResponse = await axios.post(`${API_BASE}/auth/login`, {
      username: 'admin',
      password: 'admin123456'
    });
    
    const token = authResponse.data.token;
    console.log('✅ Authentication successful');
    
    // Create test data similar to what WordPress would send  
    const testData = {
      posts: [
        {
          id: 999999,
          title: { rendered: 'Test Direct Sync Post' },
          content: { rendered: '<p>This is a test post from direct sync.</p>' },
          excerpt: { rendered: 'Test excerpt' },
          slug: 'test-direct-sync-post',
          status: 'publish',
          author: 1,
          author_name: 'Test Author',
          date: '2025-08-20T23:00:00Z',  // Add Z for proper ISO format
          modified: '2025-08-20T23:30:00Z',  // Add Z for proper ISO format
          categories: [1],
          tags: [],
          featured_media: 0,
          sticky: false,
          format: 'standard'
        }
      ],
      categories: [
        {
          id: 1,
          name: 'Test Category',
          slug: 'test-category',
          parent: 0,
          count: 1,
          description: 'Test category for debugging'
        }
      ],
      timestamp: new Date().toISOString(),
      source: 'debug_test'
    };
    
    console.log('📝 Test data validation:');
    console.log(`- Post ID type: ${typeof testData.posts[0].id} (${testData.posts[0].id})`);
    console.log(`- Post title type: ${typeof testData.posts[0].title?.rendered} (${testData.posts[0].title?.rendered})`);
    console.log(`- Post date: ${testData.posts[0].date}`);
    console.log(`- Category ID type: ${typeof testData.categories[0].id} (${testData.categories[0].id})`);
    console.log(`- Category name type: ${typeof testData.categories[0].name} (${testData.categories[0].name})`);
    
    console.log('📤 Sending test data:', JSON.stringify(testData, null, 2));
    
    // Send test data
    const response = await axios.post(`${API_BASE}/admin/ingest-direct`, testData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    console.log('✅ Direct sync response:', response.data);
    
    // Log detailed result information
    if (response.data.result?.errors) {
      console.log('⚠️ Errors during processing:');
      response.data.result.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    console.log(`📊 Processing summary:
  - Categories ingested: ${response.data.result?.categoriesIngested || 0}
  - Posts ingested: ${response.data.result?.postsIngested || 0}
  - Total posts in DB: ${response.data.result?.totalPostsInDB || 'unknown'}`);
    
    // Check if the post was actually inserted
    console.log('\n🔍 Checking if posts were inserted...');
    
    const postsResponse = await axios.get(`${API_BASE}/posts`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log(`📊 Total posts in system: ${postsResponse.data.data?.length || 0}`);
    
    if (postsResponse.data.data && postsResponse.data.data.length > 0) {
      console.log('Recent posts:');
      postsResponse.data.data.slice(0, 3).forEach(post => {
        console.log(`- ${post.title} (ID: ${post.id}, WP ID: ${post.wp_post_id})`);
      });
    } else {
      console.log('❌ No posts found in database after sync');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    if (error.response?.data?.stack) {
      console.error('Stack trace:', error.response.data.stack);
    }
  }
}

testDirectSync();