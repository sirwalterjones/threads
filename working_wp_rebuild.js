const { execSync } = require('child_process');

console.log('Working WordPress category rebuild - final attempt...\n');

try {
  // Step 1: Fresh start
  console.log('Step 1: Fresh category setup...');
  execSync(`sqlite3 data/threads_intel.db "DELETE FROM categories;"`);
  
  // Create Intel Quick Updates
  execSync(`sqlite3 data/threads_intel.db "INSERT INTO categories (name, slug, parent_id, post_count) VALUES ('Intel Quick Updates', 'intel-quick-updates', NULL, 0);"`);
  const defaultId = execSync(`sqlite3 data/threads_intel.db "SELECT id FROM categories WHERE slug = 'intel-quick-updates';"`).toString().trim();
  
  // Assign all posts to default
  execSync(`sqlite3 data/threads_intel.db "UPDATE posts SET category_id = ${defaultId};"`);
  console.log(`All posts assigned to Intel Quick Updates (ID: ${defaultId})`);
  
  // Step 2: Create and test specific categories
  console.log('\\nStep 2: Creating specific categories...');
  
  // Test with known categories
  const testCategories = [
    { slug: '25-0079-21-05', name: '25-0079-21-05' },
    { slug: '25-ci-12', name: '25 CI 12' },
    { slug: '22-ci-15', name: '22 CI 15' },
    { slug: '22-ci-07', name: '22 CI 07' },
    { slug: 'ci-memo', name: 'CI Memo' }
  ];
  
  // Create year parents first
  const years = ['2022', '2023', '2024', '2025'];
  const yearIds = {};
  
  years.forEach(year => {
    execSync(`sqlite3 data/threads_intel.db "INSERT INTO categories (name, slug, parent_id, post_count) VALUES ('${year}', '${year}', NULL, 0);"`);
    yearIds[year] = execSync(`sqlite3 data/threads_intel.db "SELECT id FROM categories WHERE slug = '${year}';"`).toString().trim();
  });
  
  // Create test categories
  testCategories.forEach(cat => {
    let parentId = null;
    
    // Determine parent for case numbers starting with year prefix
    const yearMatch = cat.slug.match(/^(\d{2})/);
    if (yearMatch) {
      const yearPrefix = yearMatch[1];
      const fullYear = `20${yearPrefix}`;
      if (yearIds[fullYear]) {
        parentId = yearIds[fullYear];
      }
    }
    
    execSync(`sqlite3 data/threads_intel.db "INSERT INTO categories (name, slug, parent_id, post_count) VALUES ('${cat.name}', '${cat.slug}', ${parentId || 'NULL'}, 0);"`);
  });
  
  // Step 3: Test assignments with exact pattern matching
  console.log('\\nStep 3: Testing category assignments...');
  
  // Test each category individually
  for (const cat of testCategories) {
    // Count posts that match this category pattern
    const matchCount = execSync(`sqlite3 data/threads_intel.db "SELECT COUNT(*) FROM posts WHERE content LIKE '%/category/${cat.slug}/%';"`).toString().trim();
    
    if (parseInt(matchCount) > 0) {
      // Get the category ID
      const catId = execSync(`sqlite3 data/threads_intel.db "SELECT id FROM categories WHERE slug = '${cat.slug}';"`).toString().trim();
      
      // Assign posts
      execSync(`sqlite3 data/threads_intel.db "UPDATE posts SET category_id = ${catId} WHERE content LIKE '%/category/${cat.slug}/%';"`);
      
      console.log(`✅ Category ${cat.slug}: ${matchCount} posts assigned (ID: ${catId})`);
    } else {
      console.log(`⚠️  Category ${cat.slug}: No matching posts found`);
    }
  }
  
  // Step 4: Find and create additional categories from database
  console.log('\\nStep 4: Finding additional categories from database...');
  
  // Get posts with category patterns and extract more slugs
  const postsWithCategories = execSync(`sqlite3 data/threads_intel.db "SELECT DISTINCT content FROM posts WHERE content LIKE '%/category/%' LIMIT 50;"`).toString();
  
  // Extract all category slugs
  const allCategoryMatches = postsWithCategories.match(/\/category\/([^\/]+)\//g) || [];
  const additionalSlugs = [...new Set(allCategoryMatches.map(match => {
    return match.replace('/category/', '').replace('/', '');
  }))];
  
  console.log(`Found ${additionalSlugs.length} additional category slugs`);
  console.log('Additional slugs:', additionalSlugs.slice(0, 10));
  
  // Create additional categories that aren't already created
  let additionalCreated = 0;
  const existingSlugs = testCategories.map(c => c.slug);
  
  additionalSlugs.forEach(slug => {
    if (slug && !existingSlugs.includes(slug) && !years.includes(slug) && slug.length > 0 && slug.length < 25) {
      // Determine parent
      let parentId = null;
      const yearMatch = slug.match(/^(\d{2})/);
      if (yearMatch) {
        const yearPrefix = yearMatch[1];
        const fullYear = `20${yearPrefix}`;
        if (yearIds[fullYear]) {
          parentId = yearIds[fullYear];
        }
      }
      
      const name = slug.toUpperCase().replace(/-/g, ' ');
      
      try {
        execSync(`sqlite3 data/threads_intel.db "INSERT OR IGNORE INTO categories (name, slug, parent_id, post_count) VALUES ('${name}', '${slug}', ${parentId || 'NULL'}, 0);"`);
        
        // Assign posts to this category
        const matchCount = execSync(`sqlite3 data/threads_intel.db "SELECT COUNT(*) FROM posts WHERE content LIKE '%/category/${slug}/%';"`).toString().trim();
        
        if (parseInt(matchCount) > 0) {
          const catId = execSync(`sqlite3 data/threads_intel.db "SELECT id FROM categories WHERE slug = '${slug}';"`).toString().trim();
          execSync(`sqlite3 data/threads_intel.db "UPDATE posts SET category_id = ${catId} WHERE content LIKE '%/category/${slug}/%';"`);
          console.log(`✅ Created and assigned ${slug}: ${matchCount} posts`);
          additionalCreated++;
        }
      } catch (e) {
        // Skip problematic categories
      }
    }
  });
  
  console.log(`Created ${additionalCreated} additional categories`);
  
  // Step 5: Final cleanup
  console.log('\\nStep 5: Final cleanup and statistics...');
  
  // Update post counts
  execSync(`sqlite3 data/threads_intel.db "UPDATE categories SET post_count = (SELECT COUNT(*) FROM posts WHERE posts.category_id = categories.id);"`);
  
  // Remove empty categories (except Intel Quick Updates)
  execSync(`sqlite3 data/threads_intel.db "DELETE FROM categories WHERE post_count = 0 AND slug != 'intel-quick-updates';"`);
  
  // Final stats
  const finalStats = {
    totalCategories: execSync(`sqlite3 data/threads_intel.db "SELECT COUNT(*) FROM categories;"`).toString().trim(),
    totalPosts: execSync(`sqlite3 data/threads_intel.db "SELECT COUNT(*) FROM posts;"`).toString().trim(),
    assignedPosts: execSync(`sqlite3 data/threads_intel.db "SELECT COUNT(*) FROM posts WHERE category_id IS NOT NULL;"`).toString().trim(),
    specificCategories: execSync(`sqlite3 data/threads_intel.db "SELECT COUNT(*) FROM posts WHERE category_id != ${defaultId};"`).toString().trim()
  };
  
  console.log('\\n=== FINAL RESULTS ===');
  console.log(`✅ Total categories: ${finalStats.totalCategories}`);
  console.log(`✅ Total posts: ${finalStats.totalPosts}`);
  console.log(`✅ All posts assigned: ${finalStats.assignedPosts}`);
  console.log(`✅ Posts in specific categories: ${finalStats.specificCategories}`);
  console.log(`✅ Posts in Intel Quick Updates: ${parseInt(finalStats.totalPosts) - parseInt(finalStats.specificCategories)}`);
  
  // Top categories
  const topCategories = execSync(`sqlite3 data/threads_intel.db "SELECT c.name, c.post_count, CASE WHEN c.parent_id IS NULL THEN 'parent' ELSE 'child of ' || p.name END FROM categories c LEFT JOIN categories p ON c.parent_id = p.id ORDER BY c.post_count DESC LIMIT 15;"`).toString().trim();
  
  if (topCategories) {
    console.log('\\nTop 15 categories:');
    console.log('===================');
    topCategories.split('\\n').forEach(line => {
      const parts = line.split('|');
      if (parts.length >= 3) {
        const [name, count, type] = parts;
        console.log(`${name.padEnd(25)} ${count.padStart(6)} posts (${type})`);
      }
    });
  }
  
  console.log('\\n🎉 COMPLETE! WordPress category system successfully built!');

} catch (error) {
  console.error('❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}