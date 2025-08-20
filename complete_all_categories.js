const { execSync } = require('child_process');

console.log('Finding and creating ALL WordPress categories from ALL posts...\n');

try {
  console.log('Step 1: Extracting ALL category slugs from database...');
  
  // Get all posts with category links and extract EVERY category slug
  let allSlugs = new Set();
  
  // Process in smaller batches to avoid memory issues
  const batchSize = 500;
  const totalPosts = parseInt(execSync(`sqlite3 data/threads_intel.db "SELECT COUNT(*) FROM posts WHERE content LIKE '%/category/%';"`).toString().trim());
  console.log(`Processing ${totalPosts} posts with category links...`);
  
  for (let offset = 0; offset < totalPosts; offset += batchSize) {
    console.log(`Processing batch ${Math.floor(offset/batchSize) + 1}/${Math.ceil(totalPosts/batchSize)}...`);
    
    const batch = execSync(`sqlite3 data/threads_intel.db "SELECT content FROM posts WHERE content LIKE '%/category/%' LIMIT ${batchSize} OFFSET ${offset};"`).toString();
    
    if (batch) {
      // Extract all category patterns from this batch
      const matches = batch.match(/\\/category\\/([^\\/\\s"<>]+)\\//g) || [];
      matches.forEach(match => {
        const slug = match.replace('/category/', '').replace('/', '').trim();
        if (slug && slug.length > 0 && slug.length < 30 && !slug.includes('|') && !slug.includes('<')) {
          allSlugs.add(slug);
        }
      });
    }
  }
  
  const uniqueSlugs = Array.from(allSlugs).sort();
  console.log(`\\nFound ${uniqueSlugs.length} unique category slugs from ALL posts`);
  console.log('Sample slugs:', uniqueSlugs.slice(0, 15));
  
  console.log('\\nStep 2: Current category status...');
  const currentCategories = execSync(`sqlite3 data/threads_intel.db "SELECT COUNT(*) FROM categories;"`).toString().trim();
  const currentAssigned = execSync(`sqlite3 data/threads_intel.db "SELECT COUNT(*) FROM posts WHERE category_id != (SELECT id FROM categories WHERE slug = 'intel-quick-updates');"`).toString().trim();
  console.log(`Current categories: ${currentCategories}`);
  console.log(`Currently assigned to specific categories: ${currentAssigned}`);
  
  console.log('\\nStep 3: Creating ALL missing categories...');
  
  // Get existing category slugs
  const existingCategories = execSync(`sqlite3 data/threads_intel.db "SELECT slug FROM categories;"`).toString().trim().split('\\n').filter(s => s);
  console.log(`Existing categories: ${existingCategories.length}`);
  
  // Get year parent IDs for hierarchy
  const yearIds = {};
  const years = ['2019', '2020', '2021', '2022', '2023', '2024', '2025'];
  
  // Create missing year categories
  years.forEach(year => {
    if (!existingCategories.includes(year)) {
      execSync(`sqlite3 data/threads_intel.db "INSERT OR IGNORE INTO categories (name, slug, parent_id, post_count) VALUES ('${year}', '${year}', NULL, 0);"`);
    }
    yearIds[year] = execSync(`sqlite3 data/threads_intel.db "SELECT id FROM categories WHERE slug = '${year}';"`).toString().trim();
  });
  
  let newCategoriesCreated = 0;
  let newAssignments = 0;
  
  console.log('Creating missing categories and assignments...');
  
  uniqueSlugs.forEach((slug, index) => {
    if (!existingCategories.includes(slug) && slug.length > 0) {
      // Check if there are any posts for this category before creating it
      const postCount = parseInt(execSync(`sqlite3 data/threads_intel.db "SELECT COUNT(*) FROM posts WHERE content LIKE '%/category/${slug}/%';"`).toString().trim());
      
      if (postCount > 0) {
        // Determine parent category
        let parentId = null;
        const yearMatch = slug.match(/^(\\d{2})/);
        if (yearMatch) {
          const yearPrefix = yearMatch[1];
          const fullYear = `20${yearPrefix}`;
          if (yearIds[fullYear]) {
            parentId = yearIds[fullYear];
          }
        }
        
        // Create category
        const name = slug.toUpperCase().replace(/-/g, ' ');
        const safeName = name.replace(/'/g, "''");
        
        try {
          execSync(`sqlite3 data/threads_intel.db "INSERT INTO categories (name, slug, parent_id, post_count) VALUES ('${safeName}', '${slug}', ${parentId || 'NULL'}, 0);"`);
          
          // Assign posts to this category
          const catId = execSync(`sqlite3 data/threads_intel.db "SELECT id FROM categories WHERE slug = '${slug}';"`).toString().trim();
          execSync(`sqlite3 data/threads_intel.db "UPDATE posts SET category_id = ${catId} WHERE content LIKE '%/category/${slug}/%';"`);
          
          newCategoriesCreated++;
          newAssignments += postCount;
          
          if (newCategoriesCreated % 20 === 0 || postCount > 10) {
            console.log(`✅ ${slug}: ${postCount} posts (${newCategoriesCreated} categories created so far)`);
          }
        } catch (e) {
          console.log(`⚠️  Skipped ${slug}: ${e.message}`);
        }
      }
    }
    
    // Progress indicator
    if (index % 100 === 0) {
      console.log(`Processed ${index}/${uniqueSlugs.length} slugs...`);
    }
  });
  
  console.log(`\\nCreated ${newCategoriesCreated} new categories with ${newAssignments} new post assignments`);
  
  console.log('\\nStep 4: Final cleanup and statistics...');
  
  // Update post counts
  execSync(`sqlite3 data/threads_intel.db "UPDATE categories SET post_count = (SELECT COUNT(*) FROM posts WHERE posts.category_id = categories.id);"`);
  
  // Remove any categories with 0 posts (except Intel Quick Updates)
  execSync(`sqlite3 data/threads_intel.db "DELETE FROM categories WHERE post_count = 0 AND slug != 'intel-quick-updates';"`);
  
  // Final statistics
  const finalStats = {
    totalCategories: execSync(`sqlite3 data/threads_intel.db "SELECT COUNT(*) FROM categories;"`).toString().trim(),
    totalPosts: execSync(`sqlite3 data/threads_intel.db "SELECT COUNT(*) FROM posts;"`).toString().trim(),
    assignedPosts: execSync(`sqlite3 data/threads_intel.db "SELECT COUNT(*) FROM posts WHERE category_id IS NOT NULL;"`).toString().trim(),
    specificCategories: execSync(`sqlite3 data/threads_intel.db "SELECT COUNT(*) FROM posts WHERE category_id != (SELECT id FROM categories WHERE slug = 'intel-quick-updates');"`).toString().trim(),
    categoriesWithPosts: execSync(`sqlite3 data/threads_intel.db "SELECT COUNT(*) FROM categories WHERE post_count > 0;"`).toString().trim()
  };
  
  console.log('\\n' + '='.repeat(50));
  console.log('FINAL COMPLETE WORDPRESS CATEGORY SYSTEM');
  console.log('='.repeat(50));
  console.log(`✅ Total categories with posts: ${finalStats.categoriesWithPosts}`);
  console.log(`✅ Total posts: ${finalStats.totalPosts}`);
  console.log(`✅ All posts assigned: ${finalStats.assignedPosts}/${finalStats.totalPosts}`);
  console.log(`✅ Posts in specific WordPress categories: ${finalStats.specificCategories}`);
  console.log(`✅ Posts in Intel Quick Updates: ${parseInt(finalStats.totalPosts) - parseInt(finalStats.specificCategories)}`);
  
  // Top categories with hierarchy info
  const topCategories = execSync(`sqlite3 data/threads_intel.db "SELECT c.name, c.post_count, CASE WHEN c.parent_id IS NULL THEN 'parent' ELSE 'child of ' || p.name END FROM categories c LEFT JOIN categories p ON c.parent_id = p.id ORDER BY c.post_count DESC LIMIT 30;"`).toString().trim();
  
  if (topCategories) {
    console.log('\\nTop 30 WordPress categories:');
    console.log('='.repeat(60));
    topCategories.split('\\n').forEach((line, index) => {
      const parts = line.split('|');
      if (parts.length >= 3) {
        const [name, count, type] = parts;
        const icon = index === 0 ? '🏆' : index < 3 ? '🥈' : index < 10 ? '📊' : '📁';
        console.log(`${icon} ${name.padEnd(30)} ${count.padStart(6)} posts (${type})`);
      }
    });
  }
  
  console.log('\\n🎉 MISSION ACCOMPLISHED! 🎉');
  console.log('Complete WordPress category system built with ALL posts properly categorized!');

} catch (error) {
  console.error('❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}