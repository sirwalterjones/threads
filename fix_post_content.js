#!/usr/bin/env node

const axios = require('axios');

const VERCEL_API_BASE = 'https://threads-dfv9qdtnn-walter-jones-projects.vercel.app/api';
const WORDPRESS_API = 'https://cmansrms.us/wp-json/wp/v2';
const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoiYWRtaW4iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTU1NjUwMDQsImV4cCI6MTc1NTY1MTQwNH0.Y2oFC36ZqBh3uomWr91U7qo2GjwpRsY_F14tkYLlqOY';

console.log('🔧 Fixing post content migration...\n');

async function testWordPressContent() {
  console.log('Step 1: Testing WordPress API content...');
  
  const response = await axios.get(`${WORDPRESS_API}/posts?per_page=2`);
  const posts = response.data;
  
  console.log(`Sample WordPress post content:`);
  posts.forEach((post, index) => {
    console.log(`\n--- Post ${index + 1}: ${post.title.rendered} ---`);
    console.log(`Has content: ${post.content ? 'Yes' : 'No'}`);
    console.log(`Content length: ${post.content?.rendered?.length || 0} characters`);
    
    if (post.content?.rendered) {
      const hasCategories = post.content.rendered.includes('/category/');
      console.log(`Has category links: ${hasCategories ? 'Yes' : 'No'}`);
      
      if (hasCategories) {
        const matches = post.content.rendered.match(/\/category\/([^\/\s"]+)/g);
        console.log(`Category links: ${matches}`);
      }
      
      console.log(`Content preview: ${post.content.rendered.slice(0, 200)}...`);
    }
  });
}

async function fixBatchContent() {
  console.log('\nStep 2: Re-uploading sample batch with full content...');
  
  // Get a small batch from WordPress with full content
  const response = await axios.get(`${WORDPRESS_API}/posts?per_page=5`);
  const posts = response.data;
  
  // Process with full content
  const processedPosts = posts.map(post => {
    // Extract author information from embedded data if available
    if (post._embedded && post._embedded.author && post._embedded.author[0]) {
      const author = post._embedded.author[0];
      post.author_name = author.name || 'Unknown Author';
      post.author_slug = author.slug;
    }
    
    // Extract featured media
    if (post._embedded && post._embedded['wp:featuredmedia'] && post._embedded['wp:featuredmedia'][0]) {
      const media = post._embedded['wp:featuredmedia'][0];
      post.featured_media_url = media.source_url;
      post.featured_media_alt = media.alt_text;
    }
    
    return post;
  });
  
  // Upload to production
  const uploadResponse = await axios.post(
    `${VERCEL_API_BASE}/admin/insert-batch-data`,
    { posts: processedPosts },
    {
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    }
  );
  
  console.log('✅ Sample batch uploaded:', uploadResponse.data);
  
  console.log('\nStep 3: Checking if content was preserved...');
  
  const checkResponse = await axios.get(`${VERCEL_API_BASE}/posts?limit=5`, {
    headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
  });
  
  const dbPosts = checkResponse.data.posts || checkResponse.data;
  
  dbPosts.forEach((post, index) => {
    console.log(`\n--- DB Post ${index + 1}: ${post.title} ---`);
    console.log(`Has content: ${post.content ? 'Yes' : 'No'}`);
    console.log(`Content length: ${post.content?.length || 0} characters`);
    console.log(`Author: ${post.author_name}`);
    
    if (post.content) {
      const hasCategories = post.content.includes('/category/');
      console.log(`Has category links: ${hasCategories ? 'Yes' : 'No'}`);
      
      if (hasCategories) {
        const matches = post.content.match(/\/category\/([^\/\s"]+)/g);
        console.log(`Category links: ${matches}`);
      }
    }
  });
}

async function main() {
  try {
    await testWordPressContent();
    await fixBatchContent();
    
    console.log('\n✅ Content migration test complete!');
    console.log('If content is now working, you can re-run the full migration.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Response:', error.response.data);
    }
  }
}

main();