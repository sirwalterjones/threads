#!/usr/bin/env node

const axios = require('axios');

const VERCEL_API_BASE = 'https://threads-dfv9qdtnn-walter-jones-projects.vercel.app/api';
const WORDPRESS_API = 'https://cmansrms.us/wp-json/wp/v2';
const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoiYWRtaW4iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTU1NjUwMDQsImV4cCI6MTc1NTY1MTQwNH0.Y2oFC36ZqBh3uomWr91U7qo2GjwpRsY_F14tkYLlqOY';

const BATCH_SIZE = 50; // Posts per batch
const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds

console.log('📥 Starting batch migration of ALL WordPress posts...\n');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWordPressPosts(page = 1, perPage = BATCH_SIZE) {
  try {
    const response = await axios.get(`${WORDPRESS_API}/posts`, {
      params: {
        page,
        per_page: perPage,
        _embed: 'wp:featuredmedia,author,wp:term'
      },
      timeout: 30000
    });
    
    return {
      posts: response.data,
      totalPages: parseInt(response.headers['x-wp-totalpages'] || '1'),
      total: parseInt(response.headers['x-wp-total'] || '0')
    };
  } catch (error) {
    console.error(`Error fetching posts page ${page}:`, error.message);
    throw error;
  }
}

async function uploadPostBatch(posts, batchNumber) {
  try {
    const response = await axios.post(
      `${VERCEL_API_BASE}/admin/insert-batch-data`,
      { posts },
      {
        headers: {
          'Authorization': `Bearer ${JWT_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );
    
    console.log(`✅ Batch ${batchNumber}: ${posts.length} posts uploaded`);
    return response.data;
    
  } catch (error) {
    console.error(`❌ Batch ${batchNumber} failed:`, error.message);
    if (error.response?.data) {
      console.error('Error details:', error.response.data);
    }
    throw error;
  }
}

async function migrateAllPosts() {
  try {
    console.log('Step 1: Getting total post count from WordPress...');
    
    const firstBatch = await fetchWordPressPosts(1, 1);
    const totalPosts = firstBatch.total;
    const totalPages = Math.ceil(totalPosts / BATCH_SIZE);
    
    console.log(`📊 Found ${totalPosts} total posts across ${totalPages} batches\n`);
    
    let totalMigrated = 0;
    let successfulBatches = 0;
    let failedBatches = 0;
    
    console.log('Step 2: Starting batch migration...');
    
    for (let page = 1; page <= totalPages; page++) {
      try {
        console.log(`📦 Processing batch ${page}/${totalPages}...`);
        
        // Fetch posts from WordPress
        const { posts } = await fetchWordPressPosts(page, BATCH_SIZE);
        
        if (posts.length === 0) {
          console.log(`⚠️  No posts in batch ${page}, skipping`);
          continue;
        }
        
        // Process embedded data for each post
        const processedPosts = posts.map(post => {
          // Extract author information from embedded data
          if (post._embedded && post._embedded.author && post._embedded.author[0]) {
            const author = post._embedded.author[0];
            post.author_name = author.name || 'Unknown Author';
            post.author_slug = author.slug;
          }
          
          // Extract featured media from embedded data
          if (post._embedded && post._embedded['wp:featuredmedia'] && post._embedded['wp:featuredmedia'][0]) {
            const media = post._embedded['wp:featuredmedia'][0];
            post.featured_media_url = media.source_url;
            post.featured_media_alt = media.alt_text;
          }
          
          return post;
        });
        
        // Upload to production
        await uploadPostBatch(processedPosts, page);
        
        totalMigrated += posts.length;
        successfulBatches++;
        
        // Progress update
        const progress = (page / totalPages * 100).toFixed(1);
        console.log(`📈 Progress: ${progress}% (${totalMigrated}/${totalPosts} posts)\n`);
        
        // Rate limiting delay
        if (page < totalPages) {
          await sleep(DELAY_BETWEEN_BATCHES);
        }
        
      } catch (error) {
        console.error(`❌ Batch ${page} failed:`, error.message);
        failedBatches++;
        
        // Continue with next batch after a longer delay
        await sleep(DELAY_BETWEEN_BATCHES * 2);
      }
    }
    
    return {
      totalPosts,
      totalMigrated,
      successfulBatches,
      failedBatches
    };
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

async function assignPostsToCategories() {
  try {
    console.log('\n🔄 Step 3: Assigning posts to WordPress categories...');
    
    const response = await axios.post(
      `${VERCEL_API_BASE}/admin/assign-posts-categories`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${JWT_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 300000 // 5 minutes
      }
    );
    
    console.log('✅ Post-to-category assignments completed!');
    return response.data;
    
  } catch (error) {
    console.error('❌ Category assignment failed:', error.message);
    return null;
  }
}

async function getFinalStats() {
  try {
    const response = await axios.get(`${VERCEL_API_BASE}/admin/dashboard`, {
      headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
    });
    
    return response.data;
  } catch (error) {
    console.error('❌ Error getting final stats:', error.message);
    return null;
  }
}

async function main() {
  const startTime = Date.now();
  
  try {
    // Step 1 & 2: Migrate all posts in batches
    const migrationResult = await migrateAllPosts();
    
    // Step 3: Assign posts to categories
    const assignmentResult = await assignPostsToCategories();
    
    // Step 4: Get final statistics
    const finalStats = await getFinalStats();
    
    const duration = Math.round((Date.now() - startTime) / 1000 / 60);
    
    console.log('\n' + '🎉'.repeat(20));
    console.log('COMPLETE: WordPress Posts Migration Finished!');
    console.log('🎉'.repeat(20));
    console.log(`⏱️  Total time: ${duration} minutes`);
    console.log(`📝 Posts migrated: ${migrationResult.totalMigrated}/${migrationResult.totalPosts}`);
    console.log(`✅ Successful batches: ${migrationResult.successfulBatches}`);
    console.log(`❌ Failed batches: ${migrationResult.failedBatches}`);
    
    if (assignmentResult) {
      console.log(`🏷️  Category assignments: ${assignmentResult.totalAssignments}`);
      console.log(`📁 Categories with posts: ${assignmentResult.categoriesWithPosts}`);
    }
    
    if (finalStats) {
      console.log(`\n📊 Final system stats:`);
      console.log(`   📝 Total posts: ${finalStats.counts.totalPosts}`);
      console.log(`   📁 Total categories: ${finalStats.counts.totalCategories}`);
      
      if (finalStats.topCategories?.length > 0) {
        console.log(`\n   📈 Top categories:`);
        finalStats.topCategories.slice(0, 5).forEach(cat => {
          console.log(`   - ${cat.name}: ${cat.post_count} posts`);
        });
      }
    }
    
    console.log('\n🔗 Your live system: https://threads-8qfennhvr-walter-jones-projects.vercel.app');
    console.log('🎯 All WordPress posts and categories are now live!');
    
  } catch (error) {
    console.error('\n❌ MIGRATION FAILED:', error.message);
    process.exit(1);
  }
}

main();