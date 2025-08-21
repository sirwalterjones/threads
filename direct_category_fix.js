#!/usr/bin/env node

const axios = require('axios');

const VERCEL_API_BASE = 'https://cso.vectoronline.us/api';
const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoiYWRtaW4iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTU1NjUwMDQsImV4cCI6MTc1NTY1MTQwNH0.Y2oFC36ZqBh3uomWr91U7qo2GjwpRsY_F14tkYLlqOY';

console.log('🔧 DIRECT CATEGORY ASSIGNMENT FIX');
console.log('This will query posts and create direct API calls to fix category assignments\n');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function directCategoryFix() {
  try {
    // Step 1: Get categories and create WordPress ID mapping
    console.log('=== Step 1: Building category mapping ===');
    
    const categoriesResponse = await axios.get(`${VERCEL_API_BASE}/categories?all=true&limit=3000`, {
      headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
    });
    
    const categories = categoriesResponse.data;
    const wpToLocalMap = {}; // WordPress ID -> Local ID mapping
    
    // Parse category metadata to find WordPress IDs
    for (const category of categories) {
      // Look for WordPress category ID patterns in the name
      if (category.name.match(/^\d{2}-\d{4}-\d{2}-\d{2}$/)) {
        // This looks like a WordPress category - try to find its WP ID from posts
        continue;
      }
    }
    
    console.log(`Found ${categories.length} local categories`);
    
    // Step 2: Get posts and their WordPress category mappings
    console.log('\n=== Step 2: Analyzing posts to build WP category mapping ===');
    
    let page = 1;
    const postsPerPage = 50;
    let totalPosts = 0;
    let wpCategoryIds = new Set();
    
    while (true) {
      const postsResponse = await axios.get(`${VERCEL_API_BASE}/posts?page=${page}&limit=${postsPerPage}`, {
        headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
      });
      
      const posts = postsResponse.data.posts || postsResponse.data;
      if (!posts || posts.length === 0) break;
      
      // Analyze metadata to find WordPress category patterns
      for (const post of posts) {
        if (post.metadata) {
          try {
            const metadata = typeof post.metadata === 'string' ? JSON.parse(post.metadata) : post.metadata;
            if (metadata.wp_categories && metadata.wp_categories.length > 0) {
              metadata.wp_categories.forEach(wpId => wpCategoryIds.add(wpId));
            }
          } catch (e) {
            // Skip invalid metadata
          }
        }
      }
      
      totalPosts += posts.length;
      console.log(`Processed ${totalPosts} posts, found ${wpCategoryIds.size} unique WordPress category IDs`);
      
      if (posts.length < postsPerPage) break;
      page++;
      
      if (page > 10) {  // Limit for testing
        console.log('Limiting to first 10 pages for analysis...');
        break;
      }
    }
    
    // Step 3: Match WordPress category IDs to category names
    console.log('\n=== Step 3: Matching WordPress categories to local categories ===');
    
    const wpCategoryArray = Array.from(wpCategoryIds);
    console.log(`WordPress category IDs found: ${wpCategoryArray.slice(0, 10).join(', ')}${wpCategoryArray.length > 10 ? '...' : ''}`);
    
    // For Intel Quick Updates (most common), we know it's WP category 1121
    const intelQuickUpdatesCategory = categories.find(c => c.slug === 'intel-quick-updates');
    if (intelQuickUpdatesCategory) {
      wpToLocalMap[1121] = intelQuickUpdatesCategory.id;
      console.log(`Mapped WP category 1121 -> Intel Quick Updates (${intelQuickUpdatesCategory.id})`);
    }
    
    // Try to map other categories by finding matching names/slugs
    for (const wpId of wpCategoryArray) {
      if (wpToLocalMap[wpId]) continue; // Already mapped
      
      // Look for categories with matching patterns
      const matchingCategory = categories.find(cat => {
        // Try exact name matches or similar patterns
        return cat.name.includes(wpId.toString()) || cat.slug.includes(wpId.toString());
      });
      
      if (matchingCategory) {
        wpToLocalMap[wpId] = matchingCategory.id;
        console.log(`Mapped WP category ${wpId} -> ${matchingCategory.name} (${matchingCategory.id})`);
      }
    }
    
    console.log(`\nTotal mappings created: ${Object.keys(wpToLocalMap).length}`);
    
    // Step 4: Update posts with correct categories (sample run)
    console.log('\n=== Step 4: Testing category updates (first 20 posts) ===');
    
    const testPostsResponse = await axios.get(`${VERCEL_API_BASE}/posts?limit=20`, {
      headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
    });
    
    const testPosts = testPostsResponse.data.posts || testPostsResponse.data;
    let fixedCount = 0;
    
    for (const post of testPosts) {
      if (post.metadata) {
        try {
          const metadata = typeof post.metadata === 'string' ? JSON.parse(post.metadata) : post.metadata;
          
          if (metadata.wp_categories && metadata.wp_categories.length > 0) {
            const wpCategoryId = metadata.wp_categories[0];
            const correctLocalCategoryId = wpToLocalMap[wpCategoryId];
            
            if (correctLocalCategoryId && correctLocalCategoryId !== post.category_id) {
              console.log(`Post "${post.title}" should be in category ${correctLocalCategoryId} (WP: ${wpCategoryId})`);
              console.log(`  Currently in: ${post.category_name || 'Unknown'}`);
              
              // For now, just log what would be fixed
              // TODO: Implement actual category update API call
              fixedCount++;
            }
          }
        } catch (e) {
          console.log(`Skipping post ${post.id}: metadata error`);
        }
      }
    }
    
    console.log(`\n✅ Analysis complete!`);
    console.log(`Posts that need category fixes: ${fixedCount}/20 in test sample`);
    console.log(`\nTo apply fixes, we need to implement the server-side maintenance action.`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Response:', error.response.data);
    }
  }
}

directCategoryFix();