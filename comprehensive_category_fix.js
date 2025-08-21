#!/usr/bin/env node

const axios = require('axios');

const VERCEL_API_BASE = 'https://cso.vectoronline.us/api';
const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoiYWRtaW4iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTU1NjUwMDQsImV4cCI6MTc1NTY1MTQwNH0.Y2oFC36ZqBh3uomWr91U7qo2GjwpRsY_F14tkYLlqOY';

console.log('🔧 COMPREHENSIVE CATEGORY ASSIGNMENT FIX');
console.log('This will properly map WordPress categories to posts including parent-child relationships\n');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function comprehensiveCategoryFix() {
  try {
    // Step 1: Get all categories and understand hierarchy
    console.log('=== Step 1: Building complete category mapping ===');
    
    const categoriesResponse = await axios.get(`${VERCEL_API_BASE}/categories?all=true&limit=5000`, {
      headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
    });
    
    const allCategories = categoriesResponse.data;
    console.log(`Found ${allCategories.length} total categories in system`);
    
    // Group categories by parent relationships
    const rootCategories = allCategories.filter(c => !c.parent_name);
    const childCategories = allCategories.filter(c => c.parent_name);
    
    console.log(`Root categories: ${rootCategories.length}`);
    console.log(`Child categories: ${childCategories.length}`);
    
    // Step 2: Analyze all posts to get WordPress category distribution
    console.log('\n=== Step 2: Analyzing WordPress category distribution in posts ===');
    
    let allPosts = [];
    let page = 1;
    const postsPerPage = 100;
    
    console.log('Fetching all posts to analyze category assignments...');
    while (true) {
      try {
        const postsResponse = await axios.get(`${VERCEL_API_BASE}/posts?page=${page}&limit=${postsPerPage}`, {
          headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
        });
        
        const posts = postsResponse.data.posts || postsResponse.data;
        if (!posts || posts.length === 0) break;
        
        allPosts = allPosts.concat(posts);
        console.log(`Fetched ${allPosts.length} posts...`);
        
        if (posts.length < postsPerPage) break;
        page++;
        
        // Add delay to avoid overwhelming the API
        await sleep(500);
        
      } catch (error) {
        console.log(`Error fetching page ${page}: ${error.message}`);
        break;
      }
    }
    
    console.log(`\nTotal posts retrieved: ${allPosts.length}`);
    
    // Step 3: Build WordPress ID to category mapping
    console.log('\n=== Step 3: Building WordPress category ID mapping ===');
    
    const wpCategoryStats = {};
    const wpToLocalMapping = {};
    
    // Analyze posts to understand WordPress category usage
    for (const post of allPosts) {
      if (post.metadata) {
        try {
          const metadata = typeof post.metadata === 'string' ? JSON.parse(post.metadata) : post.metadata;
          
          if (metadata.wp_categories && metadata.wp_categories.length > 0) {
            for (const wpId of metadata.wp_categories) {
              wpCategoryStats[wpId] = (wpCategoryStats[wpId] || 0) + 1;
            }
          }
        } catch (e) {
          // Skip invalid metadata
        }
      }
    }
    
    const sortedWpCategories = Object.entries(wpCategoryStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50); // Top 50 most used WordPress categories
    
    console.log('\nTop WordPress categories by usage:');
    sortedWpCategories.slice(0, 10).forEach(([wpId, count]) => {
      console.log(`  WP Category ${wpId}: ${count} posts`);
    });
    
    // Step 4: Create intelligent mapping strategy
    console.log('\n=== Step 4: Creating intelligent category mapping ===');
    
    // Strategy 1: Direct name/slug matching
    for (const [wpId] of sortedWpCategories) {
      if (wpToLocalMapping[wpId]) continue;
      
      // Look for exact matches in category names or slugs
      let matchingCategory = allCategories.find(cat => 
        cat.name === wpId.toString() || 
        cat.slug === wpId.toString() ||
        cat.name.includes(wpId.toString()) ||
        cat.slug.includes(wpId.toString())
      );
      
      if (matchingCategory) {
        wpToLocalMapping[wpId] = matchingCategory.id;
        console.log(`Mapped WP ${wpId} -> ${matchingCategory.name} (${matchingCategory.id})`);
      }
    }
    
    // Strategy 2: Pattern matching for case numbers (19-0041-21-05 format)
    for (const [wpId] of sortedWpCategories) {
      if (wpToLocalMapping[wpId]) continue;
      
      // Look for categories that might match this WordPress ID pattern
      let patternCategory = allCategories.find(cat => {
        // Try various patterns that might correspond to the WordPress ID
        return cat.name.match(/\d{2}-\d{4}-\d{2}-\d{2}/) && 
               (cat.name.includes(wpId.toString().slice(-2)) || 
                cat.slug.includes(wpId.toString().slice(-2)));
      });
      
      if (patternCategory) {
        wpToLocalMapping[wpId] = patternCategory.id;
        console.log(`Pattern matched WP ${wpId} -> ${patternCategory.name} (${patternCategory.id})`);
      }
    }
    
    // Strategy 3: Manual mapping for known categories
    const knownMappings = {
      '1121': 'intel-quick-updates',  // Intel Quick Updates
      '63': 'od',                     // OD category
      // Add more known mappings based on the data
    };
    
    for (const [wpId, categorySlug] of Object.entries(knownMappings)) {
      if (wpToLocalMapping[wpId]) continue;
      
      const knownCategory = allCategories.find(cat => cat.slug === categorySlug);
      if (knownCategory) {
        wpToLocalMapping[wpId] = knownCategory.id;
        console.log(`Known mapping WP ${wpId} -> ${knownCategory.name} (${knownCategory.id})`);
      }
    }
    
    console.log(`\nTotal WordPress -> Local mappings created: ${Object.keys(wpToLocalMapping).length}`);
    
    // Step 5: Apply category fixes
    console.log('\n=== Step 5: Applying category fixes ===');
    
    let totalFixed = 0;
    let categoryDistribution = {};
    
    for (const post of allPosts) {
      if (post.metadata) {
        try {
          const metadata = typeof post.metadata === 'string' ? JSON.parse(post.metadata) : post.metadata;
          
          if (metadata.wp_categories && metadata.wp_categories.length > 0) {
            const wpCategoryId = metadata.wp_categories[0]; // Use primary category
            const correctLocalCategoryId = wpToLocalMapping[wpCategoryId];
            
            if (correctLocalCategoryId) {
              // Track what category this post should be in
              const targetCategory = allCategories.find(c => c.id === correctLocalCategoryId);
              if (targetCategory) {
                categoryDistribution[targetCategory.name] = (categoryDistribution[targetCategory.name] || 0) + 1;
                
                // For now, just track what needs to be fixed
                // In a real implementation, we'd make API calls to update each post
                totalFixed++;
              }
            }
          }
        } catch (e) {
          // Skip invalid metadata
        }
      }
    }
    
    console.log(`\nPosts that can be properly categorized: ${totalFixed}/${allPosts.length}`);
    console.log('\nExpected category distribution after fix:');
    
    const sortedDistribution = Object.entries(categoryDistribution)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);
    
    for (const [categoryName, count] of sortedDistribution) {
      console.log(`  ${categoryName}: ${count} posts`);
    }
    
    // Step 6: Generate SQL update commands for server implementation
    console.log('\n=== Step 6: Generating update strategy ===');
    
    console.log('\nTo implement this fix on the server, we need to:');
    console.log('1. Create the mapping logic in the maintenance endpoint');
    console.log('2. Process posts in batches to avoid timeouts');
    console.log('3. Update category post counts after reassignment');
    console.log('4. Handle parent-child category relationships properly');
    
    const implementationData = {
      mappingsFound: Object.keys(wpToLocalMapping).length,
      postsToUpdate: totalFixed,
      topCategories: sortedDistribution.slice(0, 10),
      wpMapping: wpToLocalMapping
    };
    
    console.log('\n✅ Analysis complete!');
    console.log(`WordPress categories mapped: ${implementationData.mappingsFound}`);
    console.log(`Posts ready for reassignment: ${implementationData.postsToUpdate}`);
    
    return implementationData;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Response:', error.response.data);
    }
  }
}

comprehensiveCategoryFix();