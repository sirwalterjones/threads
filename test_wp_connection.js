#!/usr/bin/env node

const axios = require('axios');
require('dotenv').config();

console.log('Testing WordPress connection...\n');

console.log('Environment variables:');
console.log('WORDPRESS_API_URL:', process.env.WORDPRESS_API_URL);
console.log('WORDPRESS_USERNAME:', process.env.WORDPRESS_USERNAME ? '[SET]' : '[NOT SET]');
console.log('WORDPRESS_PASSWORD:', process.env.WORDPRESS_PASSWORD ? '[SET]' : '[NOT SET]');
console.log('WORDPRESS_JWT_TOKEN:', process.env.WORDPRESS_JWT_TOKEN ? '[SET]' : '[NOT SET]');
console.log('WORDPRESS_BASIC_USER:', process.env.WORDPRESS_BASIC_USER ? '[SET]' : '[NOT SET]');
console.log('WORDPRESS_BASIC_PASS:', process.env.WORDPRESS_BASIC_PASS ? '[SET]' : '[NOT SET]');

async function testConnection() {
  try {
    const baseUrl = process.env.WORDPRESS_API_URL;
    if (!baseUrl) {
      console.error('❌ WORDPRESS_API_URL not set');
      return;
    }

    console.log(`\nTesting connection to: ${baseUrl}`);

    // Configure axios instance like the service does
    const http = axios.create({
      baseURL: baseUrl,
      timeout: 30000,
      headers: {
        'User-Agent': process.env.WORDPRESS_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    // Add auth if available
    if (process.env.WORDPRESS_BASIC_USER && process.env.WORDPRESS_BASIC_PASS) {
      http.defaults.auth = {
        username: process.env.WORDPRESS_BASIC_USER,
        password: process.env.WORDPRESS_BASIC_PASS
      };
      console.log('Using HTTP Basic Auth');
    }

    if (process.env.WORDPRESS_JWT_TOKEN) {
      http.defaults.headers.Authorization = `Bearer ${process.env.WORDPRESS_JWT_TOKEN}`;
      console.log('Using JWT Token Auth');
    }

    // Test posts endpoint
    console.log('\n📝 Testing posts endpoint...');
    const postsResponse = await http.get('/posts', {
      params: { per_page: 3, _embed: true }
    });
    
    console.log(`✅ Posts endpoint working: ${postsResponse.data.length} posts found`);
    console.log('Total posts available:', postsResponse.headers['x-wp-total']);
    console.log('Total pages:', postsResponse.headers['x-wp-totalpages']);
    
    if (postsResponse.data.length > 0) {
      const latestPost = postsResponse.data[0];
      console.log('\nLatest post:');
      console.log('- ID:', latestPost.id);
      console.log('- Title:', latestPost.title?.rendered || 'No title');
      console.log('- Date:', latestPost.date);
      console.log('- Modified:', latestPost.modified);
      console.log('- Status:', latestPost.status);
    }

    // Test categories endpoint
    console.log('\n📁 Testing categories endpoint...');
    const categoriesResponse = await http.get('/categories', {
      params: { per_page: 5 }
    });
    
    console.log(`✅ Categories endpoint working: ${categoriesResponse.data.length} categories found`);
    
    if (categoriesResponse.data.length > 0) {
      console.log('\nTop categories:');
      categoriesResponse.data.forEach(cat => {
        console.log(`- ${cat.name} (${cat.count} posts)`);
      });
    }

    // Test with modified_after parameter
    console.log('\n🕒 Testing recent posts...');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const recentResponse = await http.get('/posts', {
      params: { 
        per_page: 10, 
        modified_after: yesterday.toISOString(),
        orderby: 'modified',
        order: 'desc'
      }
    });
    
    console.log(`✅ Recent posts (last 24h): ${recentResponse.data.length} posts modified`);
    
    if (recentResponse.data.length > 0) {
      console.log('\nRecent modifications:');
      recentResponse.data.slice(0, 3).forEach(post => {
        console.log(`- ${post.title?.rendered || 'No title'} (${post.modified})`);
      });
    }

    console.log('\n🎉 All tests passed! WordPress API is accessible.');
    
  } catch (error) {
    console.error('❌ WordPress connection failed:');
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    if (error.code) {
      console.error('Code:', error.code);
    }
  }
}

testConnection();