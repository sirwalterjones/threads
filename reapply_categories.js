#!/usr/bin/env node

const axios = require('axios');

const VERCEL_API_BASE = 'https://threads-4zk0b8gwu-walter-jones-projects.vercel.app/api';
const WORDPRESS_API = 'https://cmansrms.us/wp-json/wp/v2';
const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoiYWRtaW4iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTU1NjUwMDQsImV4cCI6MTc1NTY1MTQwNH0.Y2oFC36ZqBh3uomWr91U7qo2GjwpRsY_F14tkYLlqOY';

console.log('🔄 Re-applying WordPress categories to existing posts...\n');

async function reapplyCategoriesAndCheckResults() {
  try {
    console.log('Step 1: Checking current status...');
    const dashboardResponse = await axios.get(`${VERCEL_API_BASE}/admin/dashboard`, {
      headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
    });
    
    console.log(`Current posts: ${dashboardResponse.data.counts.totalPosts}`);
    console.log(`Current categories: ${dashboardResponse.data.counts.totalCategories}`);
    
    console.log('\nStep 2: Re-applying category assignments...');
    const assignResponse = await axios.post(
      `${VERCEL_API_BASE}/admin/assign-posts-categories`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${JWT_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 300000
      }
    );
    
    console.log('✅ Assignment results:', assignResponse.data);
    
    console.log('\nStep 3: Checking categories after assignment...');
    const categoriesResponse = await axios.get(`${VERCEL_API_BASE}/categories?all=true&limit=20`, {
      headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
    });
    
    const categories = categoriesResponse.data;
    console.log(`\n📁 Categories with posts: ${categories.filter(c => c.post_count > 0).length}`);
    
    const topCategories = categories.filter(c => c.post_count > 0).sort((a, b) => b.post_count - a.post_count).slice(0, 15);
    
    if (topCategories.length > 0) {
      console.log('\n📈 Top 15 categories:');
      topCategories.forEach(cat => {
        console.log(`   ${cat.name}: ${cat.post_count} posts ${cat.parent_name ? `(child of ${cat.parent_name})` : '(parent)'}`);
      });
    }
    
    console.log('\n✅ Category re-application complete!');
    console.log(`🔗 Check your live system: ${VERCEL_API_BASE.replace('/api', '')}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

reapplyCategoriesAndCheckResults();