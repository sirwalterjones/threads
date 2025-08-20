#!/usr/bin/env node

const axios = require('axios');

const VERCEL_API_BASE = 'https://cso.threadsonline.us/api';
const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoiYWRtaW4iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTU1NjUwMDQsImV4cCI6MTc1NTY1MTQwNH0.Y2oFC36ZqBh3uomWr91U7qo2GjwpRsY_F14tkYLlqOY';

console.log('🔧 FIXING CATEGORY ASSIGNMENTS');
console.log('This will properly assign posts to their WordPress categories using metadata');

async function fixCategoryAssignments() {
  try {
    console.log('\n=== Step 1: Add database maintenance for category assignment ===');
    
    // Add the category assignment maintenance action
    const maintenanceResponse = await axios.post(
      `${VERCEL_API_BASE}/admin/maintenance`,
      { action: 'fix_category_assignments' },
      {
        headers: {
          'Authorization': `Bearer ${JWT_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000
      }
    );
    
    console.log('✅ Maintenance result:', maintenanceResponse.data);
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    
    if (error.response?.status === 400 && error.response?.data?.error === 'Invalid maintenance action') {
      console.log('\n📝 The fix_category_assignments maintenance action needs to be added to the server.');
      console.log('I will create a direct fix script instead...');
      
      // Alternative approach - create a direct SQL fix
      await createDirectFix();
    }
  }
}

async function createDirectFix() {
  console.log('\n=== Creating Direct Category Assignment Fix ===');
  
  // Get some sample posts to understand the metadata structure
  const postsResponse = await axios.get(`${VERCEL_API_BASE}/posts?limit=5`, {
    headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
  });
  
  const posts = postsResponse.data.posts || postsResponse.data;
  
  console.log('📊 Analyzing post metadata structure...');
  posts.forEach((post, index) => {
    console.log(`\nPost ${index + 1}: ${post.title}`);
    console.log(`  Current category: ${post.category_name}`);
    
    if (post.metadata) {
      try {
        const metadata = typeof post.metadata === 'string' ? JSON.parse(post.metadata) : post.metadata;
        console.log(`  WP Categories: ${JSON.stringify(metadata.wp_categories)}`);
      } catch (e) {
        console.log(`  Metadata parse error: ${e.message}`);
      }
    }
  });
  
  console.log('\n🎯 The fix needs to be implemented on the server side.');
  console.log('Posts have wp_categories in their metadata that need to be mapped to local category IDs.');
}

fixCategoryAssignments();