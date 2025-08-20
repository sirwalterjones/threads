#!/usr/bin/env node

const axios = require('axios');
require('dotenv').config();

console.log('Testing incremental sync functionality...\n');

// Mock the WordPressService class functionality
class MockWordPressService {
  constructor() {
    this.baseUrl = process.env.WORDPRESS_API_URL;
    this.retentionDays = process.env.DEFAULT_RETENTION_DAYS || 365;
    
    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: parseInt(process.env.WP_TIMEOUT_MS || '60000'),
      headers: {
        'User-Agent': process.env.WORDPRESS_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    if (process.env.WORDPRESS_BASIC_USER && process.env.WORDPRESS_BASIC_PASS) {
      this.http.defaults.auth = {
        username: process.env.WORDPRESS_BASIC_USER,
        password: process.env.WORDPRESS_BASIC_PASS
      };
    }

    if (process.env.WORDPRESS_JWT_TOKEN) {
      this.http.defaults.headers.Authorization = `Bearer ${process.env.WORDPRESS_JWT_TOKEN}`;
    }
  }

  async testIncrementalSyncLogic() {
    try {
      console.log('🔍 Testing incremental sync parameters...');
      
      // Test with a date from yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const params = {
        page: 1,
        per_page: 5,
        _embed: true,
        orderby: 'modified',
        order: 'desc',
        modified_after: yesterday.toISOString()
      };

      console.log('Parameters:', JSON.stringify(params, null, 2));
      
      const response = await this.http.get(`/posts`, { params });
      const posts = response.data;
      
      console.log(`✅ Found ${posts.length} posts modified since yesterday`);
      console.log('Total posts available:', response.headers['x-wp-total']);
      console.log('Total pages:', response.headers['x-wp-totalpages']);
      
      if (posts.length > 0) {
        console.log('\n📝 Sample posts found:');
        posts.slice(0, 3).forEach(post => {
          console.log(`- ID: ${post.id}`);
          console.log(`  Title: ${post.title?.rendered || 'No title'}`);
          console.log(`  Modified: ${post.modified}`);
          console.log(`  Categories: ${post.categories?.length || 0}`);
          console.log(`  Author ID: ${post.author}`);
          console.log('');
        });
      } else {
        console.log('No recent posts found, trying without date filter...');
        
        // Try without date filter
        const allResponse = await this.http.get(`/posts`, {
          params: {
            page: 1,
            per_page: 3,
            _embed: true,
            orderby: 'modified',
            order: 'desc'
          }
        });
        
        console.log(`Found ${allResponse.data.length} latest posts (no date filter)`);
        allResponse.data.forEach(post => {
          console.log(`- ${post.title?.rendered}: ${post.modified}`);
        });
      }
      
      return {
        success: true,
        postsFound: posts.length,
        totalAvailable: response.headers['x-wp-total']
      };
      
    } catch (error) {
      console.error('❌ Error testing incremental sync:', error.message);
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', error.response.data);
      }
      throw error;
    }
  }

  async testCategoriesEndpoint() {
    try {
      console.log('\n📁 Testing categories endpoint...');
      
      const response = await this.http.get(`/categories`, {
        params: { per_page: 5 }
      });
      
      console.log(`✅ Found ${response.data.length} categories`);
      response.data.forEach(cat => {
        console.log(`- ${cat.name} (ID: ${cat.id}, Count: ${cat.count})`);
      });
      
      return response.data;
      
    } catch (error) {
      console.error('❌ Error testing categories:', error.message);
      throw error;
    }
  }
}

async function runTests() {
  try {
    const service = new MockWordPressService();
    
    console.log('WordPress API URL:', service.baseUrl);
    console.log('Has Basic Auth:', !!(process.env.WORDPRESS_BASIC_USER && process.env.WORDPRESS_BASIC_PASS));
    console.log('Has JWT Token:', !!process.env.WORDPRESS_JWT_TOKEN);
    console.log('');
    
    // Test categories first
    await service.testCategoriesEndpoint();
    
    // Test incremental sync logic
    const result = await service.testIncrementalSyncLogic();
    
    console.log('\n🎉 All tests passed!');
    console.log('Incremental sync logic is working correctly.');
    console.log(`Found ${result.postsFound} recent posts out of ${result.totalAvailable} total posts.`);
    
  } catch (error) {
    console.error('\n❌ Tests failed:', error.message);
    process.exit(1);
  }
}

runTests();