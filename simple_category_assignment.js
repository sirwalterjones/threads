const { execSync } = require('child_process');

console.log('Creating specific WordPress categories and assignments...\n');

// Sample of known categories from the database
const knownCategories = [
  '25-0079-21-05', '2021', '2024', '25-0102-21-05', '25-ci-12', '25-ci-11', 
  '25-ci-13', '25-0128-21-05', '25-ci-14', '25-0108-21-05', '25-ci-15',
  '24-0219-22', '22-ci-15', '22-ci-07', '22-ci-23', '22-ci-12', '22-ci-01',
  '22-ci-21', '22-ci-20', '22-ci-24', '21-ci-19', '22-ci-14', '24-ci-08',
  '21-ci-01', 'ci-memo'
];

try {
  // Get parent category IDs
  const parentIds = {
    '2019': execSync(`sqlite3 data/threads_intel.db "SELECT id FROM categories WHERE slug = '2019';"`).toString().trim(),
    '2020': execSync(`sqlite3 data/threads_intel.db "SELECT id FROM categories WHERE slug = '2020';"`).toString().trim(),
    '2021': execSync(`sqlite3 data/threads_intel.db "SELECT id FROM categories WHERE slug = '2021';"`).toString().trim(),
    '2022': execSync(`sqlite3 data/threads_intel.db "SELECT id FROM categories WHERE slug = '2022';"`).toString().trim(),
    '2023': execSync(`sqlite3 data/threads_intel.db "SELECT id FROM categories WHERE slug = '2023';"`).toString().trim(),
    '2024': execSync(`sqlite3 data/threads_intel.db "SELECT id FROM categories WHERE slug = '2024';"`).toString().trim()
  };

  console.log('Creating specific case categories...');

  // Create CI Memo category
  execSync(`sqlite3 data/threads_intel.db "INSERT OR IGNORE INTO categories (name, slug, parent_id, post_count) VALUES ('CI Memo', 'ci-memo', NULL, 0);"`);

  let createdCount = 0;
  
  knownCategories.forEach(slug => {
    if (!['2019', '2020', '2021', '2022', '2023', '2024'].includes(slug)) {
      const yearMatch = slug.match(/^(\\d{2})/);
      let parentId = null;
      
      if (yearMatch) {
        const yearPrefix = yearMatch[1];
        const fullYear = `20${yearPrefix}`;
        parentId = parentIds[fullYear] || null;
      }
      
      const name = slug.toUpperCase().replace(/-/g, ' ');
      const safeName = name.replace(/'/g, "''");
      
      try {
        execSync(`sqlite3 data/threads_intel.db "INSERT OR IGNORE INTO categories (name, slug, parent_id, post_count) VALUES ('${safeName}', '${slug}', ${parentId || 'NULL'}, 0);"`);
        createdCount++;
      } catch (e) {
        console.log(`Skipped ${slug} - ${e.message}`);
      }
    }
  });

  console.log(`Created ${createdCount} specific categories`);

  // Now assign posts to these categories
  console.log('\\nAssigning posts to specific categories...');
  
  const allCategories = execSync(`sqlite3 data/threads_intel.db "SELECT id, slug FROM categories WHERE slug != 'intel-quick-updates';"`).toString().trim();
  
  if (allCategories) {
    const categories = allCategories.split('\\n');
    
    categories.forEach((line, index) => {
      if (line.includes('|')) {
        const [catId, slug] = line.split('|');
        
        // Update posts that contain this category in their content
        const updateCount = execSync(`sqlite3 data/threads_intel.db "UPDATE posts SET category_id = ${catId} WHERE content LIKE '%/category/${slug}/%'; SELECT changes();"`).toString().trim();
        
        if (index < 10) {
          console.log(`Category ${slug}: ${updateCount} posts assigned`);
        }
      }
    });
    
    console.log(`Processed ${categories.length} categories for assignment`);
  }

  // Update post counts
  console.log('\\nUpdating post counts...');
  execSync(`sqlite3 data/threads_intel.db "UPDATE categories SET post_count = (SELECT COUNT(*) FROM posts WHERE posts.category_id = categories.id);"`);
  
  // Remove empty categories (except Intel Quick Updates)
  execSync(`sqlite3 data/threads_intel.db "DELETE FROM categories WHERE post_count = 0 AND slug != 'intel-quick-updates';"`);

  // Final stats
  const stats = {
    totalCategories: execSync(`sqlite3 data/threads_intel.db "SELECT COUNT(*) FROM categories;"`).toString().trim(),
    totalPosts: execSync(`sqlite3 data/threads_intel.db "SELECT COUNT(*) FROM posts;"`).toString().trim(),
    assignedPosts: execSync(`sqlite3 data/threads_intel.db "SELECT COUNT(*) FROM posts WHERE category_id IS NOT NULL;"`).toString().trim()
  };

  console.log('\\n=== RESULTS ===');
  console.log(`Categories: ${stats.totalCategories}`);
  console.log(`Posts assigned: ${stats.assignedPosts}/${stats.totalPosts}`);

  // Show top categories
  const topCategories = execSync(`sqlite3 data/threads_intel.db "SELECT name, post_count FROM categories ORDER BY post_count DESC LIMIT 15;"`).toString().trim();
  
  if (topCategories) {
    console.log('\\nTop 15 categories:');
    topCategories.split('\\n').forEach(line => {
      const [name, count] = line.split('|');
      console.log(`${name.padEnd(25)} ${count.padStart(6)} posts`);
    });
  }

  console.log('\\n✅ WordPress categories created and all posts assigned!');

} catch (error) {
  console.error('Error:', error.message);
}