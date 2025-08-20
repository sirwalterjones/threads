#!/usr/bin/env node

const axios = require('axios');

const VERCEL_API_BASE = 'https://threads-liugvs1cy-walter-jones-projects.vercel.app/api';
const WORDPRESS_API = 'https://cmansrms.us/wp-json/wp/v2';
const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoiYWRtaW4iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTU1NjUwMDQsImV4cCI6MTc1NTY1MTQwNH0.Y2oFC36ZqBh3uomWr91U7qo2GjwpRsY_F14tkYLlqOY';

console.log('🧪 Testing enhanced migration with authors and media...\n');

async function testEnhancedMigration() {
  try {
    console.log('Step 1: Fetching WordPress posts with full embed data...');
    
    // Get posts with embedded author and media data
    const response = await axios.get(`${WORDPRESS_API}/posts`, {
      params: {
        per_page: 3,
        _embed: 'wp:featuredmedia,author,wp:term'
      }
    });
    
    const posts = response.data;
    console.log(`Retrieved ${posts.length} posts from WordPress\n`);
    
    // Process each post to show what we're getting
    posts.forEach((post, index) => {
      console.log(`--- WordPress Post ${index + 1}: ${post.title.rendered} ---`);
      console.log(`Author ID: ${post.author}`);
      console.log(`Featured Media ID: ${post.featured_media}`);
      console.log(`Categories: ${post.categories.join(', ')}`);
      console.log(`Content length: ${post.content.rendered.length} chars`);
      
      // Check embedded data
      if (post._embedded) {
        // Author data
        if (post._embedded.author && post._embedded.author[0]) {
          const author = post._embedded.author[0];
          console.log(`✅ Author Name: ${author.name}`);
          console.log(`   Author Slug: ${author.slug}`);
          console.log(`   Author Email: ${author.email || 'Not provided'}`);
        } else {
          console.log(`❌ No author data in _embedded`);
        }
        
        // Featured media data
        if (post._embedded['wp:featuredmedia'] && post._embedded['wp:featuredmedia'][0]) {
          const media = post._embedded['wp:featuredmedia'][0];
          console.log(`✅ Featured Media: ${media.source_url}`);
          console.log(`   Media Type: ${media.media_type}`);
          console.log(`   Alt Text: ${media.alt_text || 'None'}`);
        } else {
          console.log(`❌ No featured media`);
        }
      } else {
        console.log(`❌ No _embedded data`);
      }
      
      console.log('');
    });
    
    console.log('Step 2: Processing posts like our enhanced migration...');
    
    const processedPosts = posts.map(post => {
      // Extract author information from embedded data
      if (post._embedded && post._embedded.author && post._embedded.author[0]) {
        const author = post._embedded.author[0];
        post.author_name = author.name || 'Unknown Author';
        post.author_slug = author.slug;
        post.author_email = author.email;
      }
      
      // Extract featured media from embedded data
      if (post._embedded && post._embedded['wp:featuredmedia'] && post._embedded['wp:featuredmedia'][0]) {
        const media = post._embedded['wp:featuredmedia'][0];
        post.featured_media_url = media.source_url;
        post.featured_media_alt = media.alt_text;
        post.media_type = media.media_type;
      }
      
      return post;
    });
    
    console.log('Step 3: Uploading enhanced posts to production...');
    
    const uploadResponse = await axios.post(
      `${VERCEL_API_BASE}/admin/insert-batch-data`,
      { posts: processedPosts },
      {
        headers: {
          'Authorization': `Bearer ${JWT_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );
    
    console.log('✅ Upload result:', uploadResponse.data);
    
    console.log('\nStep 4: Checking results in production database...');
    
    const checkResponse = await axios.get(`${VERCEL_API_BASE}/posts?limit=3`, {
      headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
    });
    
    const dbPosts = checkResponse.data.posts || checkResponse.data;
    
    dbPosts.forEach((post, index) => {
      console.log(`--- Production Post ${index + 1}: ${post.title} ---`);
      console.log(`Author: ${post.author_name}`);
      console.log(`Featured Media URL: ${post.featured_media_url || 'None'}`);
      console.log(`Content: ${post.content ? 'Present (' + post.content.length + ' chars)' : 'Missing'}`);
      
      if (post.content && post.content.includes('/category/')) {
        const matches = post.content.match(/\/category\/([^\/\s"]+)/g);
        console.log(`Category Links: ${matches ? matches.join(', ') : 'None'}`);
      }
      
      if (post.metadata) {
        try {
          const meta = JSON.parse(post.metadata);
          console.log(`Metadata: ${Object.keys(meta).length} fields`);
        } catch (e) {
          console.log(`Metadata: ${typeof post.metadata}`);
        }
      }
      console.log('');
    });
    
    console.log('🎯 Test Summary:');
    console.log('- Enhanced migration system is working if you see real authors and media URLs above');
    console.log('- Ready for full re-migration if needed');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response?.data) {
      console.error('Response:', error.response.data);
    }
  }
}

testEnhancedMigration();