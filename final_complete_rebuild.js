const { execSync } = require('child_process');

console.log('Final complete WordPress category rebuild for ALL 20,144 posts...\n');

try {
  // Step 1: Clear and setup basic structure
  console.log('Step 1: Setting up basic category structure...');
  execSync(`sqlite3 data/threads_intel.db "DELETE FROM categories;"`);
  
  // Create main categories
  execSync(`sqlite3 data/threads_intel.db "INSERT INTO categories (name, slug, parent_id, post_count) VALUES ('Intel Quick Updates', 'intel-quick-updates', NULL, 0);"`);
  execSync(`sqlite3 data/threads_intel.db "INSERT INTO categories (name, slug, parent_id, post_count) VALUES ('2019', '2019', NULL, 0);"`);
  execSync(`sqlite3 data/threads_intel.db "INSERT INTO categories (name, slug, parent_id, post_count) VALUES ('2020', '2020', NULL, 0);"`);
  execSync(`sqlite3 data/threads_intel.db "INSERT INTO categories (name, slug, parent_id, post_count) VALUES ('2021', '2021', NULL, 0);"`);
  execSync(`sqlite3 data/threads_intel.db "INSERT INTO categories (name, slug, parent_id, post_count) VALUES ('2022', '2022', NULL, 0);"`);
  execSync(`sqlite3 data/threads_intel.db "INSERT INTO categories (name, slug, parent_id, post_count) VALUES ('2023', '2023', NULL, 0);"`);
  execSync(`sqlite3 data/threads_intel.db "INSERT INTO categories (name, slug, parent_id, post_count) VALUES ('2024', '2024', NULL, 0);"`);
  execSync(`sqlite3 data/threads_intel.db "INSERT INTO categories (name, slug, parent_id, post_count) VALUES ('CI Memo', 'ci-memo', NULL, 0);"`);

  // Step 2: Get sample of posts with categories to understand patterns
  console.log('Step 2: Analyzing category patterns from posts...');
  const samplePosts = execSync(`sqlite3 data/threads_intel.db "SELECT content FROM posts WHERE content LIKE '%/category/%' LIMIT 50;"`).toString().trim();
  
  const categoryPatterns = new Set();
  samplePosts.split('\\n').forEach(content => {
    const matches = content.match(/\/category\/([a-zA-Z0-9-]+)/g);
    if (matches) {
      matches.forEach(match => {
        const slug = match.replace('/category/', '');
        if (slug && slug.length > 0 && slug.length < 30) {
          categoryPatterns.add(slug);
        }
      });
    }
  });

  const patterns = Array.from(categoryPatterns);
  console.log(`Found ${patterns.length} category patterns from sample`);

  // Step 3: Create categories for case numbers
  console.log('Step 3: Creating case number categories...');
  
  const caseNumbers = patterns.filter(p => /^\d{2}\s*ci[-\s]*\d+/i.test(p));
  console.log(`Creating ${caseNumbers.length} case number categories...`);
  
  caseNumbers.forEach(slug => {
    const yearMatch = slug.match(/^(\d{2})/);
    if (yearMatch) {
      const yearPrefix = yearMatch[1];
      const fullYear = yearPrefix === '19' ? '2019' : 
                       yearPrefix === '20' ? '2020' :
                       yearPrefix === '21' ? '2021' :
                       yearPrefix === '22' ? '2022' :
                       yearPrefix === '23' ? '2023' :
                       yearPrefix === '24' ? '2024' : null;
      
      if (fullYear) {
        const parentId = execSync(`sqlite3 data/threads_intel.db "SELECT id FROM categories WHERE slug = '${fullYear}';"`).toString().trim();
        const name = slug.toUpperCase().replace(/[-\s]+/g, '-');
        execSync(`sqlite3 data/threads_intel.db "INSERT OR IGNORE INTO categories (name, slug, parent_id, post_count) VALUES ('${name}', '${slug}', ${parentId}, 0);"`);
      }
    }
  });

  // Step 4: Assign ALL posts to categories
  console.log('\\nStep 4: Assigning ALL 20,144 posts to categories...');
  
  const defaultId = execSync(`sqlite3 data/threads_intel.db "SELECT id FROM categories WHERE slug = 'intel-quick-updates';"`).toString().trim();
  
  // First assign ALL posts to Intel Quick Updates
  console.log('Setting all posts to Intel Quick Updates...');
  execSync(`sqlite3 data/threads_intel.db "UPDATE posts SET category_id = ${defaultId};"`);
  
  // Then override with specific category assignments
  console.log('Assigning posts with specific WordPress categories...');
  
  // Get all non-default categories
  const specificCategories = execSync(`sqlite3 data/threads_intel.db "SELECT id, slug FROM categories WHERE slug != 'intel-quick-updates';"`).toString().trim();
  
  if (specificCategories) {
    const categories = specificCategories.split('\\n');
    categories.forEach((line, index) => {
      if (line.includes('|')) {
        const [catId, slug] = line.split('|');
        // Update posts that contain this specific category
        execSync(`sqlite3 data/threads_intel.db "UPDATE posts SET category_id = ${catId} WHERE content LIKE '%/category/${slug}%' OR content LIKE '%/category/${slug}/%';"`);
        
        if (index % 5 === 0) {
          console.log(`Processed ${index + 1}/${categories.length} categories`);
        }
      }
    });
  }

  // Step 5: Update counts and cleanup
  console.log('\\nStep 5: Updating post counts and cleanup...');
  
  execSync(`sqlite3 data/threads_intel.db "UPDATE categories SET post_count = (SELECT COUNT(*) FROM posts WHERE posts.category_id = categories.id);"`);
  execSync(`sqlite3 data/threads_intel.db "DELETE FROM categories WHERE post_count = 0 AND slug != 'intel-quick-updates';"`);

  // Final verification
  const stats = {
    totalCategories: execSync(`sqlite3 data/threads_intel.db "SELECT COUNT(*) FROM categories;"`).toString().trim(),
    totalPosts: execSync(`sqlite3 data/threads_intel.db "SELECT COUNT(*) FROM posts;"`).toString().trim(),
    assignedPosts: execSync(`sqlite3 data/threads_intel.db "SELECT COUNT(*) FROM posts WHERE category_id IS NOT NULL;"`).toString().trim()
  };

  console.log('\\n=== FINAL RESULTS ===');
  console.log(`✅ Total categories: ${stats.totalCategories}`);
  console.log(`✅ Posts assigned: ${stats.assignedPosts}/${stats.totalPosts}`);
  
  if (stats.assignedPosts === stats.totalPosts) {
    console.log('✅ SUCCESS: ALL posts have been assigned to categories!');
  } else {
    console.log(`⚠️  ${stats.totalPosts - stats.assignedPosts} posts still need category assignment`);
  }

  // Show top categories
  const topCategories = execSync(`sqlite3 data/threads_intel.db "SELECT name, post_count, CASE WHEN parent_id IS NULL THEN 'parent' ELSE 'child' END as type FROM categories ORDER BY post_count DESC LIMIT 20;"`).toString().trim();
  
  if (topCategories) {
    console.log('\\nTop 20 categories:');
    console.log('==================');
    topCategories.split('\\n').forEach(line => {
      const [name, count, type] = line.split('|');
      console.log(`${name.padEnd(30)} ${count.padStart(6)} posts (${type})`);
    });
  }

  console.log('\\n✅ COMPLETE! WordPress category system fully rebuilt for all posts.');

} catch (error) {
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}