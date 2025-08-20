#!/usr/bin/env node

const axios = require('axios');

const VERCEL_API_BASE = 'https://threads-fp5c1p1ql-walter-jones-projects.vercel.app/api';
const WORDPRESS_API = 'https://cmansrms.us/wp-json/wp/v2';
const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoiYWRtaW4iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTU1NjUwMDQsImV4cCI6MTc1NTY1MTQwNH0.Y2oFC36ZqBh3uomWr91U7qo2GjwpRsY_F14tkYLlqOY';

const BATCH_SIZE = 25; // Smaller batches to avoid timeouts
const DELAY_BETWEEN_BATCHES = 3000; // 3 seconds

console.log('🚀 COMPLETE FRESH WORDPRESS MIGRATION');
console.log('This will migrate all categories and posts with content, authors, and media\n');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function step1_MigrateCategories() {
  try {
    console.log('=== STEP 1: MIGRATING WORDPRESS CATEGORIES ===');
    
    // Fetch all WordPress categories
    let allCategories = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      const response = await axios.get(`${WORDPRESS_API}/categories`, {
        params: {
          page: page,
          per_page: 100,
          _fields: 'id,name,slug,parent,count,description'
        }
      });
      
      allCategories.push(...response.data);
      const totalPages = parseInt(response.headers['x-wp-totalpages'] || '1');
      hasMore = page < totalPages;
      page++;
      
      if (page % 5 === 0) {
        console.log(`Fetched ${allCategories.length} categories so far...`);
      }
    }
    
    console.log(`✅ Retrieved ${allCategories.length} WordPress categories`);
    
    // Upload categories to production
    const migrationData = {
      categories: allCategories.map(cat => ({
        wp_category_id: cat.id,
        name: cat.name,
        slug: cat.slug,
        parent_wp_id: cat.parent || null,
        post_count: cat.count,
        description: cat.description || null
      }))
    };
    
    const categoryResponse = await axios.post(
      `${VERCEL_API_BASE}/admin/migrate-categories`,
      migrationData,
      {
        headers: {
          'Authorization': `Bearer ${JWT_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );
    
    console.log('✅ Categories migrated:', categoryResponse.data);
    return allCategories.length;
    
  } catch (error) {
    console.error('❌ Category migration failed:', error.message);
    throw error;
  }
}

async function step2_MigratePosts() {
  try {
    console.log('\n=== STEP 2: MIGRATING WORDPRESS POSTS WITH CONTENT ===');
    
    // Get total post count
    const firstResponse = await axios.get(`${WORDPRESS_API}/posts`, {
      params: { per_page: 1, _embed: 'wp:featuredmedia,author,wp:term' }
    });
    
    const totalPosts = parseInt(firstResponse.headers['x-wp-total'] || '0');
    const totalBatches = Math.ceil(totalPosts / BATCH_SIZE);
    
    console.log(`📊 Migrating ${totalPosts} posts in ${totalBatches} batches of ${BATCH_SIZE}`);
    
    let successfulBatches = 0;
    let totalMigrated = 0;
    
    for (let batch = 1; batch <= totalBatches; batch++) {
      try {
        console.log(`\n📦 Batch ${batch}/${totalBatches}...`);
        
        // Fetch WordPress posts with full embed data
        const response = await axios.get(`${WORDPRESS_API}/posts`, {
          params: {
            page: batch,
            per_page: BATCH_SIZE,
            _embed: 'wp:featuredmedia,author,wp:term'
          }
        });
        
        const posts = response.data;
        
        if (posts.length === 0) {
          console.log('⚠️  Empty batch, skipping');
          continue;
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
            timeout: 45000
          }
        );
        
        totalMigrated += posts.length;
        successfulBatches++;
        
        const progress = (batch / totalBatches * 100).toFixed(1);
        console.log(`✅ Batch ${batch} complete: ${posts.length} posts`);
        console.log(`📈 Progress: ${progress}% (${totalMigrated}/${totalPosts} posts)`);
        
        // Rate limiting
        if (batch < totalBatches) {
          await sleep(DELAY_BETWEEN_BATCHES);
        }
        
      } catch (error) {
        console.error(`❌ Batch ${batch} failed:`, error.message);
        await sleep(DELAY_BETWEEN_BATCHES * 2); // Longer delay on failure
      }
    }
    
    console.log(`\n✅ Post migration complete: ${totalMigrated}/${totalPosts} posts migrated`);
    return { totalPosts, totalMigrated, successfulBatches };
    
  } catch (error) {
    console.error('❌ Post migration failed:', error.message);
    throw error;
  }
}

async function step3_AssignCategories() {
  try {
    console.log('\n=== STEP 3: ASSIGNING POSTS TO CATEGORIES ===');
    
    const response = await axios.post(
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
    
    console.log('✅ Category assignments:', response.data);
    return response.data;
    
  } catch (error) {
    console.error('❌ Category assignment failed:', error.message);
    return null;
  }
}

async function step4_VerifyResults() {
  try {
    console.log('\n=== STEP 4: VERIFICATION ===');
    
    const dashboardResponse = await axios.get(`${VERCEL_API_BASE}/admin/dashboard`, {
      headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
    });
    
    const stats = dashboardResponse.data;
    
    // Get sample posts to verify content
    const postsResponse = await axios.get(`${VERCEL_API_BASE}/posts?limit=3`, {
      headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
    });
    
    const posts = postsResponse.data.posts || postsResponse.data;
    
    console.log('📊 FINAL RESULTS:');
    console.log(`   📝 Total posts: ${stats.counts.totalPosts}`);
    console.log(`   📁 Total categories: ${stats.counts.totalCategories}`);
    
    if (stats.topCategories?.length > 0) {
      console.log('\n   📈 Top categories:');
      stats.topCategories.slice(0, 5).forEach(cat => {
        console.log(`      ${cat.name}: ${cat.post_count} posts`);
      });
    }
    
    console.log('\n   🔍 Sample posts verification:');
    posts.slice(0, 3).forEach((post, index) => {
      console.log(`      Post ${index + 1}: ${post.title}`);
      console.log(`         Author: ${post.author_name}`);
      console.log(`         Content: ${post.content ? `${post.content.length} chars` : 'MISSING'}`);
      console.log(`         Media: ${post.featured_media_url || 'None'}`);
      
      if (post.content && post.content.includes('/category/')) {
        const matches = post.content.match(/\/category\/([^\/\s"]+)/g);
        console.log(`         Category links: ${matches ? matches.length : 0}`);
      }
    });
    
    return {
      totalPosts: stats.counts.totalPosts,
      totalCategories: stats.counts.totalCategories,
      hasContent: posts.some(p => p.content && p.content.length > 0),
      hasRealAuthors: posts.some(p => p.author_name && p.author_name !== 'Admin' && p.author_name !== 'Unknown Author')
    };
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    return null;
  }
}

async function main() {
  const startTime = Date.now();
  
  try {
    console.log(`🎯 Target: ${VERCEL_API_BASE.replace('/api', '')}\n`);
    
    // Step 1: Migrate categories
    const categoriesCount = await step1_MigrateCategories();
    
    // Step 2: Migrate posts with content
    const postResults = await step2_MigratePosts();
    
    // Step 3: Assign categories
    const categoryResults = await step3_AssignCategories();
    
    // Step 4: Verify everything
    const verification = await step4_VerifyResults();
    
    const duration = Math.round((Date.now() - startTime) / 1000 / 60);
    
    console.log('\n' + '🎉'.repeat(30));
    console.log('COMPLETE WORDPRESS MIGRATION FINISHED!');
    console.log('🎉'.repeat(30));
    console.log(`⏱️  Total time: ${duration} minutes`);
    console.log(`📁 Categories: ${categoriesCount}`);
    console.log(`📝 Posts: ${postResults.totalMigrated}/${postResults.totalPosts}`);
    
    if (categoryResults) {
      console.log(`🏷️  Category assignments: ${categoryResults.totalAssignments}`);
    }
    
    if (verification) {
      console.log(`✅ Content working: ${verification.hasContent ? 'YES' : 'NO'}`);
      console.log(`✅ Real authors: ${verification.hasRealAuthors ? 'YES' : 'NO'}`);
    }
    
    console.log(`\n🔗 Your complete WordPress system: ${VERCEL_API_BASE.replace('/api', '')}`);
    
  } catch (error) {
    console.error('\n❌ MIGRATION FAILED:', error.message);
    process.exit(1);
  }
}

main();