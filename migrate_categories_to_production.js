#!/usr/bin/env node

const axios = require('axios');

// Configuration - Use your live Vercel API endpoint
const VERCEL_API_BASE = 'https://threads-8qfennhvr-walter-jones-projects.vercel.app/api';
const WORDPRESS_API = 'https://cmansrms.us/wp-json/wp/v2';

// You'll need to get a fresh JWT token for your admin user
const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoiYWRtaW4iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTU1NjUwMDQsImV4cCI6MTc1NTY1MTQwNH0.Y2oFC36ZqBh3uomWr91U7qo2GjwpRsY_F14tkYLlqOY';

console.log('🚀 Migrating WordPress categories to live production system...\n');

async function fetchAllWordPressCategories() {
  try {
    console.log('Step 1: Fetching ALL WordPress categories...');
    
    let allCategories = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      console.log(`Fetching page ${page}...`);
      
      const response = await axios.get(`${WORDPRESS_API}/categories`, {
        params: {
          page: page,
          per_page: 100,
          _fields: 'id,name,slug,parent,count,description'
        },
        timeout: 30000
      });
      
      const categories = response.data;
      allCategories.push(...categories);
      
      const totalPages = parseInt(response.headers['x-wp-totalpages'] || '1');
      hasMore = page < totalPages;
      page++;
    }
    
    console.log(`✅ Retrieved ${allCategories.length} WordPress categories\\n`);
    return allCategories;
    
  } catch (error) {
    console.error('❌ Error fetching WordPress categories:', error.message);
    throw error;
  }
}

async function uploadCategoriesToLiveSystem(categories) {
  try {
    console.log('Step 2: Uploading categories to live system...');
    
    // Create the migration payload
    const migrationData = {
      categories: categories.map(cat => ({
        wp_category_id: cat.id,
        name: cat.name,
        slug: cat.slug,
        parent_wp_id: cat.parent || null,
        post_count: cat.count,
        description: cat.description || null
      }))
    };
    
    console.log(`Uploading ${migrationData.categories.length} categories to live system...`);
    
    // Make API call to your live admin endpoint
    const response = await axios.post(
      `${VERCEL_API_BASE}/admin/migrate-categories`,
      migrationData,
      {
        headers: {
          'Authorization': `Bearer ${JWT_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000 // 60 seconds for large upload
      }
    );
    
    console.log('✅ Categories uploaded successfully!');
    console.log('Response:', response.data);
    
    return response.data;
    
  } catch (error) {
    console.error('❌ Error uploading categories:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

async function assignPostsToCategories() {
  try {
    console.log('\\nStep 3: Triggering post-to-category assignments...');
    
    const response = await axios.post(
      `${VERCEL_API_BASE}/admin/assign-posts-categories`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${JWT_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000 // 2 minutes for assignments
      }
    );
    
    console.log('✅ Post assignments completed!');
    console.log('Assignment results:', response.data);
    
    return response.data;
    
  } catch (error) {
    console.error('❌ Error assigning posts to categories:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

async function verifyMigration() {
  try {
    console.log('\\nStep 4: Verifying migration results...');
    
    const response = await axios.get(
      `${VERCEL_API_BASE}/categories?limit=20`,
      {
        headers: {
          'Authorization': `Bearer ${JWT_TOKEN}`,
        },
        timeout: 30000
      }
    );
    
    const categories = response.data.categories || response.data;
    console.log(`\\n✅ Verification: Found ${categories.length} categories in live system`);
    
    if (categories.length > 0) {
      console.log('\\nTop categories in live system:');
      categories.slice(0, 10).forEach(cat => {
        console.log(`📁 ${cat.name} (${cat.post_count || 0} posts)`);
      });
    }
    
    return categories;
    
  } catch (error) {
    console.error('❌ Error verifying migration:', error.message);
    throw error;
  }
}

async function main() {
  try {
    console.log('🎯 Target: ' + VERCEL_API_BASE);
    console.log('📡 Source: ' + WORDPRESS_API);
    console.log('=' * 60);
    
    // Step 1: Fetch categories from WordPress
    const wpCategories = await fetchAllWordPressCategories();
    
    // Display summary
    const parentCats = wpCategories.filter(cat => cat.parent === 0);
    const childCats = wpCategories.filter(cat => cat.parent !== 0);
    
    console.log('📊 SUMMARY:');
    console.log(`   📁 Parent categories: ${parentCats.length}`);
    console.log(`   📂 Child categories: ${childCats.length}`);
    console.log(`   📝 Total WordPress posts: ${wpCategories.reduce((sum, cat) => sum + cat.count, 0)}`);
    
    // Step 2: Upload to live system
    const uploadResult = await uploadCategoriesToLiveSystem(wpCategories);
    
    // Step 3: Assign posts to categories  
    const assignmentResult = await assignPostsToCategories();
    
    // Step 4: Verify results
    const verificationResult = await verifyMigration();
    
    console.log('\\n' + '🎉'.repeat(20));
    console.log('SUCCESS: WordPress categories now live in production!');
    console.log('🎉'.repeat(20));
    console.log(`✅ Migrated: ${wpCategories.length} categories`);
    console.log(`✅ Live system: ${verificationResult.length} active categories`);
    console.log('\\n🔗 Check your live system at: https://threads-8qfennhvr-walter-jones-projects.vercel.app');
    
  } catch (error) {
    console.error('\\n❌ MIGRATION FAILED:', error.message);
    console.log('\\n🔧 Troubleshooting:');
    console.log('1. Check if JWT token is still valid');
    console.log('2. Verify live system is accessible'); 
    console.log('3. Check server logs for detailed errors');
    process.exit(1);
  }
}

// Run the migration
main();