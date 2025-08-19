#!/usr/bin/env node

const axios = require('axios');

// Configuration
const WORDPRESS_API = 'https://cmansrms.us/wp-json/wp/v2';
const VERCEL_API = 'https://threads-1eq5vsc9c-walter-jones-projects.vercel.app/api/admin';
const BATCH_SIZE = 20; // Posts per batch
const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds

// JWT token for authentication
const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoiYWRtaW4iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTU1NjUwMDQsImV4cCI6MTc1NTY1MTQwNH0.Y2oFC36ZqBh3uomWr91U7qo2GjwpRsY_F14tkYLlqOY';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWordPressData(endpoint, params = {}) {
  try {
    const response = await axios.get(`${WORDPRESS_API}${endpoint}`, { 
      params,
      timeout: 30000 
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching ${endpoint}:`, error.message);
    throw error;
  }
}

async function uploadToVercel(endpoint, data) {
  try {
    const response = await axios.post(`${VERCEL_API}${endpoint}`, data, {
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });
    return response.data;
  } catch (error) {
    console.error(`Error uploading to ${endpoint}:`, error.message);
    throw error;
  }
}

async function migrateCategories() {
  console.log('🏷️  Starting categories migration...');
  
  let page = 1;
  let allCategories = [];
  
  while (true) {
    console.log(`Fetching categories page ${page}...`);
    
    const categories = await fetchWordPressData('/categories', {
      per_page: 100,
      page: page
    });
    
    if (categories.length === 0) break;
    
    allCategories = allCategories.concat(categories);
    page++;
    
    await sleep(500); // Small delay between requests
  }
  
  console.log(`Found ${allCategories.length} categories. Uploading...`);
  
  // Upload categories in one batch
  const result = await uploadToVercel('/insert-batch-data', {
    categories: allCategories
  });
  
  console.log(`✅ Categories migrated: ${result.categoriesInserted}`);
  return result.categoriesInserted;
}

async function migratePosts() {
  console.log('📝 Starting posts migration...');
  
  // First, get total number of posts
  const firstBatch = await fetchWordPressData('/posts', { per_page: 1 });
  const totalPosts = parseInt(await fetchWordPressData('/posts', { per_page: 1 }).then(res => res.headers?.['x-wp-total'] || '0')) || 20144;
  
  console.log(`Found ${totalPosts} total posts to migrate`);
  
  let page = 1;
  let totalMigrated = 0;
  
  while (true) {
    console.log(`\n📥 Fetching posts batch ${page} (${BATCH_SIZE} posts)...`);
    
    const posts = await fetchWordPressData('/posts', {
      per_page: BATCH_SIZE,
      page: page,
      orderby: 'date',
      order: 'desc'
    });
    
    if (posts.length === 0) {
      console.log('No more posts to fetch');
      break;
    }
    
    console.log(`📤 Uploading ${posts.length} posts...`);
    
    try {
      const result = await uploadToVercel('/insert-batch-data', {
        posts: posts
      });
      
      totalMigrated += result.postsInserted;
      console.log(`✅ Batch ${page} complete: ${result.postsInserted} posts uploaded`);
      console.log(`📊 Progress: ${totalMigrated}/${totalPosts} posts (${((totalMigrated/totalPosts)*100).toFixed(1)}%)`);
      
    } catch (error) {
      console.error(`❌ Failed to upload batch ${page}:`, error.message);
      // Continue with next batch
    }
    
    page++;
    
    // Delay between batches to avoid overwhelming the server
    if (posts.length === BATCH_SIZE) {
      console.log(`⏳ Waiting ${DELAY_BETWEEN_BATCHES/1000}s before next batch...`);
      await sleep(DELAY_BETWEEN_BATCHES);
    }
  }
  
  console.log(`\n🎉 Posts migration complete! Total migrated: ${totalMigrated}`);
  return totalMigrated;
}

async function main() {
  try {
    console.log('🚀 Starting WordPress to Vercel migration...');
    console.log('Source:', WORDPRESS_API);
    console.log('Destination:', VERCEL_API);
    console.log('Batch size:', BATCH_SIZE);
    console.log('==========================================\n');
    
    // Step 1: Migrate categories first
    const categoriesCount = await migrateCategories();
    
    await sleep(2000);
    
    // Step 2: Migrate posts
    const postsCount = await migratePosts();
    
    console.log('\n🎊 MIGRATION COMPLETE! 🎊');
    console.log('==========================================');
    console.log(`Categories migrated: ${categoriesCount}`);
    console.log(`Posts migrated: ${postsCount}`);
    console.log('==========================================');
    
  } catch (error) {
    console.error('💥 Migration failed:', error.message);
    process.exit(1);
  }
}

// Run the migration
if (require.main === module) {
  main();
}

module.exports = { main, migrateCategories, migratePosts };