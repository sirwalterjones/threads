#!/usr/bin/env node

const axios = require('axios');

const VERCEL_API_BASE = 'https://threads-fp5c1p1ql-walter-jones-projects.vercel.app/api';
const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoiYWRtaW4iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTU1NjUwMDQsImV4cCI6MTc1NTY1MTQwNH0.Y2oFC36ZqBh3uomWr91U7qo2GjwpRsY_F14tkYLlqOY';

console.log('📊 Checking final status of WordPress migration...\n');

async function checkFinalStatus() {
  try {
    // Get dashboard stats
    console.log('=== DASHBOARD OVERVIEW ===');
    const dashboardResponse = await axios.get(`${VERCEL_API_BASE}/admin/dashboard`, {
      headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
    });
    
    const stats = dashboardResponse.data;
    console.log(`📝 Total posts: ${stats.counts.totalPosts}`);
    console.log(`📁 Total categories: ${stats.counts.totalCategories}`);
    console.log(`📈 Recent posts (30 days): ${stats.counts.recentPosts}`);
    
    if (stats.topCategories?.length > 0) {
      console.log('\n📊 Top categories:');
      stats.topCategories.forEach(cat => {
        console.log(`   ${cat.name}: ${cat.post_count} posts`);
      });
    }
    
    // Get recent posts
    console.log('\n=== RECENT POSTS ===');
    const postsResponse = await axios.get(`${VERCEL_API_BASE}/posts?limit=5`, {
      headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
    });
    
    const posts = postsResponse.data.posts || postsResponse.data;
    
    posts.forEach((post, index) => {
      console.log(`\n--- Post ${index + 1}: ${post.title} ---`);
      console.log(`Author: ${post.author_name}`);
      console.log(`Published: ${post.wp_published_date}`);
      console.log(`Content: ${post.content ? `${post.content.length} chars` : 'MISSING'}`);
      console.log(`Featured Media: ${post.featured_media_url || 'None'}`);
      console.log(`Category ID: ${post.category_id}`);
      
      // Check for category links in content
      if (post.content && post.content.includes('/category/')) {
        const matches = post.content.match(/\/category\/([^\/\s"]+)/g);
        console.log(`Category Links: ${matches ? matches.join(', ') : 'None'}`);
      }
      
      // Show content preview
      if (post.content) {
        console.log(`Content preview: ${post.content.slice(0, 150)}...`);
      }
    });
    
    // Check categories
    console.log('\n=== CATEGORY STATUS ===');
    const categoriesResponse = await axios.get(`${VERCEL_API_BASE}/categories?all=true&limit=10`, {
      headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
    });
    
    const categories = categoriesResponse.data;
    const categoriesWithPosts = categories.filter(c => c.post_count > 0);
    
    console.log(`📁 Categories with posts: ${categoriesWithPosts.length}/${categories.length}`);
    
    if (categoriesWithPosts.length > 0) {
      console.log('\nActive categories:');
      categoriesWithPosts.slice(0, 10).forEach(cat => {
        console.log(`   ${cat.name}: ${cat.post_count} posts`);
      });
    }
    
    console.log('\n=== MIGRATION STATUS ===');
    if (stats.counts.totalPosts > 9000) {
      console.log('✅ Posts: Large number imported');
    } else {
      console.log('⚠️  Posts: Lower than expected');
    }
    
    if (categoriesWithPosts.length > 1) {
      console.log('✅ Categories: Multiple active categories');
    } else {
      console.log('❌ Categories: Only Intel Quick Updates active');
    }
    
    const hasRealAuthors = posts.some(p => p.author_name && p.author_name !== 'Admin');
    if (hasRealAuthors) {
      console.log('✅ Authors: Real author names present');
    } else {
      console.log('❌ Authors: Still showing as Admin');
    }
    
    const hasContent = posts.some(p => p.content && p.content.length > 0);
    if (hasContent) {
      console.log('✅ Content: Post content is present');
    } else {
      console.log('❌ Content: Post content is missing');
    }
    
    console.log(`\n🔗 Your live system: ${VERCEL_API_BASE.replace('/api', '')}`);
    
  } catch (error) {
    console.error('❌ Error checking status:', error.message);
    if (error.response?.data) {
      console.error('Response:', error.response.data);
    }
  }
}

checkFinalStatus();