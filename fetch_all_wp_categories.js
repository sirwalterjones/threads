#!/usr/bin/env node

const axios = require('axios');

// WordPress REST API configuration from existing migration script
const WORDPRESS_API = 'https://cmansrms.us/wp-json/wp/v2';

console.log('Fetching ALL WordPress categories via REST API...\n');

async function fetchAllWordPressCategories() {
  try {
    // Fetch categories from WordPress REST API
    console.log('Step 1: Fetching categories from WordPress API...');
    
    let allCategories = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      console.log(`Fetching page ${page} of categories...`);
      
      const response = await axios.get(`${WORDPRESS_API}/categories`, {
        params: {
          page: page,
          per_page: 100, // Maximum allowed per page
          _fields: 'id,name,slug,parent,count,description'
        },
        timeout: 30000
      });
      
      const categories = response.data;
      allCategories.push(...categories);
      
      console.log(`Retrieved ${categories.length} categories from page ${page}`);
      
      // Check if there are more pages
      const totalPages = parseInt(response.headers['x-wp-totalpages'] || '1');
      hasMore = page < totalPages;
      page++;
    }
    
    console.log(`\\nTotal WordPress categories found: ${allCategories.length}`);
    
    return allCategories;
    
  } catch (error) {
    console.error('Error fetching WordPress categories:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

async function syncCategoriesToDatabase(wpCategories) {
  try {
    const { execSync } = require('child_process');
    
    console.log('\\nStep 2: Syncing categories to local database...');
    
    // Clear existing categories
    execSync(`sqlite3 data/threads_intel.db "DELETE FROM categories;"`);
    console.log('Cleared existing categories');
    
    // Create Intel Quick Updates as default category
    execSync(`sqlite3 data/threads_intel.db "INSERT INTO categories (name, slug, parent_id, post_count, wp_category_id) VALUES ('Intel Quick Updates', 'intel-quick-updates', NULL, 0, NULL);"`);
    const defaultId = execSync(`sqlite3 data/threads_intel.db "SELECT id FROM categories WHERE slug = 'intel-quick-updates';"`).toString().trim();
    
    // First pass: Create all categories without parent relationships
    console.log('Creating all categories...');
    const categoryIdMap = new Map(); // wp_id -> local_id
    
    for (const wpCat of wpCategories) {
      const safeName = wpCat.name.replace(/'/g, "''");
      const safeSlug = wpCat.slug.replace(/'/g, "''");
      
      execSync(`sqlite3 data/threads_intel.db "INSERT INTO categories (wp_category_id, name, slug, parent_id, post_count) VALUES (${wpCat.id}, '${safeName}', '${safeSlug}', NULL, ${wpCat.count});"`);
      
      const localId = execSync(`sqlite3 data/threads_intel.db "SELECT id FROM categories WHERE wp_category_id = ${wpCat.id};"`).toString().trim();
      categoryIdMap.set(wpCat.id, localId);
    }
    
    console.log(`Created ${wpCategories.length} categories`);
    
    // Second pass: Update parent relationships
    console.log('Setting up parent-child relationships...');
    let hierarchyCount = 0;
    
    for (const wpCat of wpCategories) {
      if (wpCat.parent && wpCat.parent !== 0) {
        const parentLocalId = categoryIdMap.get(wpCat.parent);
        const childLocalId = categoryIdMap.get(wpCat.id);
        
        if (parentLocalId && childLocalId) {
          execSync(`sqlite3 data/threads_intel.db "UPDATE categories SET parent_id = ${parentLocalId} WHERE id = ${childLocalId};"`);
          hierarchyCount++;
        }
      }
    }
    
    console.log(`Set up ${hierarchyCount} parent-child relationships`);
    
    // Step 3: Assign posts to categories
    console.log('\\nStep 3: Assigning posts to WordPress categories...');
    
    // First assign all posts to Intel Quick Updates
    execSync(`sqlite3 data/threads_intel.db "UPDATE posts SET category_id = ${defaultId};"`);
    
    let assignmentCount = 0;
    
    // Then assign posts to specific categories based on content
    for (const wpCat of wpCategories) {
      const localId = categoryIdMap.get(wpCat.id);
      
      // Count posts that match this category
      const matchCount = parseInt(execSync(`sqlite3 data/threads_intel.db "SELECT COUNT(*) FROM posts WHERE content LIKE '%/category/${wpCat.slug}/%';"`).toString().trim());
      
      if (matchCount > 0) {
        execSync(`sqlite3 data/threads_intel.db "UPDATE posts SET category_id = ${localId} WHERE content LIKE '%/category/${wpCat.slug}/%';"`);
        assignmentCount += matchCount;
        console.log(`✅ ${wpCat.name} (${wpCat.slug}): ${matchCount} posts assigned`);
      }
    }
    
    console.log(`\\nTotal post assignments: ${assignmentCount}`);
    
    // Step 4: Update post counts and cleanup
    console.log('\\nStep 4: Final cleanup...');
    
    execSync(`sqlite3 data/threads_intel.db "UPDATE categories SET post_count = (SELECT COUNT(*) FROM posts WHERE posts.category_id = categories.id);"`);
    
    // Remove categories with no posts (except Intel Quick Updates)  
    const emptyCount = execSync(`sqlite3 data/threads_intel.db "SELECT COUNT(*) FROM categories WHERE post_count = 0 AND slug != 'intel-quick-updates';"`).toString().trim();
    execSync(`sqlite3 data/threads_intel.db "DELETE FROM categories WHERE post_count = 0 AND slug != 'intel-quick-updates';"`);
    
    console.log(`Removed ${emptyCount} empty categories`);
    
    return { wpCategories: wpCategories.length, assigned: assignmentCount };
    
  } catch (error) {
    console.error('Error syncing to database:', error.message);
    throw error;
  }
}

async function main() {
  try {
    // Fetch all categories from WordPress
    const wpCategories = await fetchAllWordPressCategories();
    
    // Display category overview
    console.log('\\n' + '='.repeat(50));
    console.log('WORDPRESS CATEGORY OVERVIEW');
    console.log('='.repeat(50));
    
    const parentCategories = wpCategories.filter(cat => cat.parent === 0);
    const childCategories = wpCategories.filter(cat => cat.parent !== 0);
    const totalPosts = wpCategories.reduce((sum, cat) => sum + cat.count, 0);
    
    console.log(`📁 Parent categories: ${parentCategories.length}`);
    console.log(`📂 Child categories: ${childCategories.length}`);
    console.log(`📝 Total posts in categories: ${totalPosts}`);
    
    // Show top categories by post count
    console.log('\\nTop 15 WordPress categories by post count:');
    wpCategories
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)
      .forEach((cat, index) => {
        const icon = index < 3 ? '🏆' : '📊';
        const parentInfo = cat.parent ? ' (child)' : ' (parent)';
        console.log(`${icon} ${cat.name.padEnd(30)} ${cat.count.toString().padStart(6)} posts${parentInfo}`);
      });
    
    // Sync to database
    const result = await syncCategoriesToDatabase(wpCategories);
    
    // Final results
    const finalStats = {
      totalCategories: require('child_process').execSync(`sqlite3 data/threads_intel.db "SELECT COUNT(*) FROM categories;"`).toString().trim(),
      totalPosts: require('child_process').execSync(`sqlite3 data/threads_intel.db "SELECT COUNT(*) FROM posts;"`).toString().trim(),
      assignedToSpecific: require('child_process').execSync(`sqlite3 data/threads_intel.db "SELECT COUNT(*) FROM posts WHERE category_id != (SELECT id FROM categories WHERE slug = 'intel-quick-updates');"`).toString().trim()
    };
    
    console.log('\\n' + '🎉'.repeat(20));
    console.log('SUCCESS: Complete WordPress Category Migration!');
    console.log('🎉'.repeat(20));
    console.log(`✅ WordPress categories imported: ${result.wpCategories}`);
    console.log(`✅ Local categories created: ${finalStats.totalCategories}`);
    console.log(`✅ Total posts: ${finalStats.totalPosts}`);
    console.log(`✅ Posts assigned to specific categories: ${finalStats.assignedToSpecific}`);
    console.log(`✅ Posts in Intel Quick Updates: ${parseInt(finalStats.totalPosts) - parseInt(finalStats.assignedToSpecific)}`);
    
  } catch (error) {
    console.error('\\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run the migration
main();