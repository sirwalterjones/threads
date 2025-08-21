#!/usr/bin/env node

const axios = require('axios');

const VERCEL_API_BASE = 'https://cso.vectoronline.us/api';
const WORDPRESS_API = 'https://cmansrms.us/wp-json/wp/v2';
const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoiYWRtaW4iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTU1NjUwMDQsImV4cCI6MTc1NTY1MTQwNH0.Y2oFC36ZqBh3uomWr91U7qo2GjwpRsY_F14tkYLlqOY';

const BATCH_SIZE = 20; // Smaller batches to avoid rate limits
const DELAY_BETWEEN_BATCHES = 5000; // 5 seconds delay
const MAX_RETRIES = 3;

console.log('📥 RESUMING WORDPRESS POST MIGRATION');
console.log('This will get the remaining ~7,000 WordPress posts that were missed\n');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function resumeWordPressMigration() {
  try {
    // Step 1: Find where we left off
    console.log('=== Step 1: Determining migration progress ===');
    
    // Get current post count and highest WordPress post ID
    const currentPostsResponse = await axios.get(`${VERCEL_API_BASE}/admin/dashboard`, {
      headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
    });
    
    const totalCurrentPosts = currentPostsResponse.data.counts.totalPosts;
    console.log(`Current posts in system: ${totalCurrentPosts}`);
    
    // Get the latest WordPress post ID we have
    const latestPostResponse = await axios.get(`${VERCEL_API_BASE}/posts?limit=1&sortBy=wp_published_date&sortOrder=DESC`, {
      headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
    });
    
    const latestPost = latestPostResponse.data.posts[0];
    console.log(`Latest migrated post: ${latestPost.title} (WP ID: ${latestPost.wp_post_id})`);
    
    // Step 2: Get total WordPress posts to understand the gap
    console.log('\n=== Step 2: Checking WordPress API status ===');
    
    const wpTotalResponse = await axios.get(`${WORDPRESS_API}/posts`, {
      params: { per_page: 1, _embed: 'wp:featuredmedia,author,wp:term' }
    });
    
    const totalWpPosts = parseInt(wpTotalResponse.headers['x-wp-total'] || '0');
    const totalBatches = Math.ceil(totalWpPosts / BATCH_SIZE);
    
    console.log(`WordPress has ${totalWpPosts} total posts`);
    console.log(`Need to process ${totalBatches} batches of ${BATCH_SIZE} posts`);
    
    // Step 3: Resume migration from where we stopped
    console.log('\n=== Step 3: Resuming migration ===');
    
    // Start from batch 710 (where the previous migration failed)
    const startBatch = 710;
    let successfulBatches = 0;
    let totalMigrated = 0;
    let failedBatches = 0;
    
    console.log(`Starting from batch ${startBatch}/${totalBatches}`);
    
    for (let batch = startBatch; batch <= totalBatches; batch++) {
      let retryCount = 0;
      let batchSuccess = false;
      
      while (retryCount < MAX_RETRIES && !batchSuccess) {
        try {
          console.log(`\n📦 Batch ${batch}/${totalBatches} (attempt ${retryCount + 1})`);
          
          // Fetch WordPress posts with full embed data
          const response = await axios.get(`${WORDPRESS_API}/posts`, {
            params: {
              page: batch,
              per_page: BATCH_SIZE,
              _embed: 'wp:featuredmedia,author,wp:term'
            },
            timeout: 30000
          });
          
          const posts = response.data;
          
          if (posts.length === 0) {
            console.log('⚠️  Empty batch, migration complete');
            break;
          }
          
          // Process posts with full metadata
          const processedPosts = posts.map(post => {
            // Extract author information
            if (post._embedded?.author?.[0]) {
              const author = post._embedded.author[0];
              post.author_name = author.name || 'Unknown Author';
              post.author_slug = author.slug;
              post.author_email = author.email;
            }
            
            // Extract featured media
            if (post._embedded?.['wp:featuredmedia']?.[0]) {
              const media = post._embedded['wp:featuredmedia'][0];
              post.featured_media_url = media.source_url;
              post.featured_media_alt = media.alt_text;
              post.media_type = media.media_type;
            }
            
            return post;
          });
          
          // Upload batch to production
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
          
          totalMigrated += posts.length;
          successfulBatches++;
          batchSuccess = true;
          
          const progress = (batch / totalBatches * 100).toFixed(1);
          console.log(`✅ Batch ${batch} complete: ${posts.length} posts`);
          console.log(`📈 Progress: ${progress}% (${totalMigrated} new posts migrated)`);
          
          // Rate limiting delay
          await sleep(DELAY_BETWEEN_BATCHES);
          
        } catch (error) {
          retryCount++;
          console.error(`❌ Batch ${batch} attempt ${retryCount} failed: ${error.message}`);
          
          if (error.response?.status === 429) {
            // Rate limited - wait longer
            const waitTime = DELAY_BETWEEN_BATCHES * retryCount * 2;
            console.log(`Rate limited. Waiting ${waitTime/1000} seconds...`);
            await sleep(waitTime);
          } else if (error.response?.status === 403) {
            // Authentication error - might need to stop
            console.log(`Authentication error. May need to refresh token.`);
            if (retryCount >= MAX_RETRIES) {
              console.log(`Max retries reached for batch ${batch}. Continuing...`);
              failedBatches++;
              break;
            }
          } else {
            // Other error - wait and retry
            await sleep(DELAY_BETWEEN_BATCHES * retryCount);
          }
        }
      }
      
      if (!batchSuccess) {
        failedBatches++;
        console.log(`⚠️  Skipping batch ${batch} after ${MAX_RETRIES} attempts`);
      }
      
      // Progress update every 10 batches
      if (batch % 10 === 0) {
        console.log(`\n📊 Progress Report:`);
        console.log(`   Batches completed: ${successfulBatches}`);
        console.log(`   Batches failed: ${failedBatches}`);
        console.log(`   Posts migrated: ${totalMigrated}`);
        console.log(`   Overall progress: ${(batch/totalBatches*100).toFixed(1)}%`);
      }
    }
    
    // Step 4: Fix category assignments for new posts
    console.log('\n=== Step 4: Applying category assignments to new posts ===');
    
    try {
      const categoryFixResponse = await axios.post(
        `${VERCEL_API_BASE}/admin/maintenance`,
        { action: 'fix_category_assignments' },
        {
          headers: {
            'Authorization': `Bearer ${JWT_TOKEN}`,
            'Content-Type': 'application/json'
          },
          timeout: 180000
        }
      );
      
      console.log('✅ Category assignments updated:', categoryFixResponse.data.results?.category_fix);
      
    } catch (categoryError) {
      console.log('⚠️  Category assignment failed:', categoryError.message);
    }
    
    // Step 5: Final verification
    console.log('\n=== Step 5: Migration Summary ===');
    
    const finalStatsResponse = await axios.get(`${VERCEL_API_BASE}/admin/dashboard`, {
      headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
    });
    
    const finalTotalPosts = finalStatsResponse.data.counts.totalPosts;
    
    console.log('\n🎉 MIGRATION RESUME COMPLETE!');
    console.log(`📊 Final Results:`);
    console.log(`   Started with: ${totalCurrentPosts} posts`);
    console.log(`   New posts migrated: ${totalMigrated}`);
    console.log(`   Final total: ${finalTotalPosts} posts`);
    console.log(`   Successful batches: ${successfulBatches}`);
    console.log(`   Failed batches: ${failedBatches}`);
    console.log(`   WordPress target: ${totalWpPosts} posts`);
    
    const completionRate = ((finalTotalPosts / totalWpPosts) * 100).toFixed(1);
    console.log(`   Completion rate: ${completionRate}%`);
    
    console.log(`\n🔗 Your complete system: https://cso.vectoronline.us`);
    
  } catch (error) {
    console.error('❌ Migration resume failed:', error.message);
    if (error.response?.data) {
      console.error('Response:', error.response.data);
    }
  }
}

resumeWordPressMigration();