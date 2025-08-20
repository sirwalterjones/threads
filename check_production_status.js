#!/usr/bin/env node

const axios = require('axios');

const VERCEL_API_BASE = 'https://threads-8qfennhvr-walter-jones-projects.vercel.app/api';
const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoiYWRtaW4iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTU1NjUwMDQsImV4cCI6MTc1NTY1MTQwNH0.Y2oFC36ZqBh3uomWr91U7qo2GjwpRsY_F14tkYLlqOY';

console.log('🔍 Checking production database status...\n');

async function checkProductionStatus() {
  try {
    // Check posts
    console.log('1. Checking posts...');
    const postsResponse = await axios.get(`${VERCEL_API_BASE}/posts?limit=5`, {
      headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
    });
    
    const posts = postsResponse.data.posts || postsResponse.data;
    console.log(`   📝 Total posts: ${posts.length > 0 ? 'Sample of ' + posts.length : 'No posts found'}`);
    
    if (posts.length > 0) {
      console.log('   Sample post titles:');
      posts.slice(0, 3).forEach(post => {
        console.log(`   - "${post.title.slice(0, 50)}..."`);
      });
      
      // Check if posts contain WordPress category links
      const postsWithCategories = posts.filter(post => 
        post.content && post.content.includes('/category/')
      );
      console.log(`   🏷️  Posts with category links: ${postsWithCategories.length}/${posts.length}`);
    }
    
    // Check categories
    console.log('\\n2. Checking categories...');
    const categoriesResponse = await axios.get(`${VERCEL_API_BASE}/categories?limit=10`, {
      headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
    });
    
    const categories = categoriesResponse.data.categories || categoriesResponse.data;
    console.log(`   📁 Total categories: ${categories.length}`);
    
    if (categories.length > 0) {
      console.log('   Category list:');
      categories.forEach(cat => {
        console.log(`   - ${cat.name} (${cat.post_count || 0} posts) ${cat.parent_id ? '[child]' : '[parent]'}`);
      });
    }
    
    // Get admin dashboard stats
    console.log('\\n3. Checking admin dashboard...');
    const dashboardResponse = await axios.get(`${VERCEL_API_BASE}/admin/dashboard`, {
      headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
    });
    
    const stats = dashboardResponse.data;
    console.log(`   📊 Dashboard stats:`);
    console.log(`   - Total posts: ${stats.counts.totalPosts}`);
    console.log(`   - Total categories: ${stats.counts.totalCategories}`);
    console.log(`   - Recent posts (30 days): ${stats.counts.recentPosts}`);
    
    if (stats.topCategories && stats.topCategories.length > 0) {
      console.log('\\n   📈 Top categories:');
      stats.topCategories.forEach(cat => {
        console.log(`   - ${cat.name}: ${cat.post_count} posts`);
      });
    }
    
    console.log('\\n' + '='.repeat(50));
    console.log('DIAGNOSIS:');
    
    if (stats.counts.totalPosts === 0) {
      console.log('❌ No posts found in production database!');
      console.log('   Solution: Need to migrate posts from WordPress first');
    } else if (postsWithCategories && postsWithCategories.length === 0) {
      console.log('❌ Posts exist but none contain WordPress category links!');
      console.log('   Solution: Posts need to be re-ingested with proper category content');
    } else {
      console.log('✅ Posts and categories appear to be properly set up');
    }
    
  } catch (error) {
    console.error('❌ Error checking production status:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

checkProductionStatus();