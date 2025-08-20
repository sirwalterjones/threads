const { execSync } = require('child_process');

console.log('Complete WordPress category rebuild for ALL 20,144 posts...\n');

try {
  console.log('Step 1: Clear existing categories...');
  execSync(`sqlite3 data/threads_intel.db "DELETE FROM categories;"`);

  console.log('Step 2: Create Intel Quick Updates default category...');
  execSync(`sqlite3 data/threads_intel.db "INSERT INTO categories (name, slug, parent_id, post_count) VALUES ('Intel Quick Updates', 'intel-quick-updates', NULL, 0);"`);

  console.log('Step 3: Create year parent categories...');
  const years = ['2019', '2020', '2021', '2022', '2023', '2024'];
  years.forEach(year => {
    execSync(`sqlite3 data/threads_intel.db "INSERT INTO categories (name, slug, parent_id, post_count) VALUES ('${year}', '${year}', NULL, 0);"`);
  });

  console.log('Step 4: Extract and create categories from post content...');
  
  // Get all unique category patterns from posts
  const categoryPatternsQuery = `
    SELECT DISTINCT 
      SUBSTR(content, 
        INSTR(content, '/category/') + 10,
        CASE 
          WHEN INSTR(SUBSTR(content, INSTR(content, '/category/') + 10), '/') > 0
          THEN INSTR(SUBSTR(content, INSTR(content, '/category/') + 10), '/') - 1
          WHEN INSTR(SUBSTR(content, INSTR(content, '/category/') + 10), ' ') > 0  
          THEN INSTR(SUBSTR(content, INSTR(content, '/category/') + 10), ' ') - 1
          WHEN INSTR(SUBSTR(content, INSTR(content, '/category/') + 10), '"') > 0
          THEN INSTR(SUBSTR(content, INSTR(content, '/category/') + 10), '"') - 1
          ELSE 20
        END
      ) as category_slug
    FROM posts 
    WHERE content LIKE '%/category/%'
    AND LENGTH(category_slug) > 0
    AND LENGTH(category_slug) < 50
    ORDER BY category_slug;
  `;

  const categorySlugs = execSync(`sqlite3 data/threads_intel.db "${categoryPatternsQuery}"`).toString().trim();
  const uniqueSlugs = categorySlugs ? categorySlugs.split('\n').filter(slug => slug.trim() && !slug.includes('|')) : [];
  
  console.log(`Found ${uniqueSlugs.length} category slugs`);

  console.log('Step 5: Create additional categories...');
  
  // Create CI Memo category
  execSync(`sqlite3 data/threads_intel.db "INSERT OR IGNORE INTO categories (name, slug, parent_id, post_count) VALUES ('CI Memo', 'ci-memo', NULL, 0);"`);

  // Create case number categories as children of years
  const caseNumbers = [];
  uniqueSlugs.forEach(slug => {
    if (/^\\d{2}\\s*ci[-\\s]*\\d+/i.test(slug)) {
      caseNumbers.push(slug);
    }
  });

  console.log(`Creating ${caseNumbers.length} case number categories...`);
  
  caseNumbers.forEach(slug => {
    const yearMatch = slug.match(/^(\\d{2})/);
    if (yearMatch) {
      const yearPrefix = yearMatch[1];
      const fullYear = yearPrefix === '19' ? '2019' : 
                       yearPrefix === '20' ? '2020' :
                       yearPrefix === '21' ? '2021' :
                       yearPrefix === '22' ? '2022' :
                       yearPrefix === '23' ? '2023' :
                       yearPrefix === '24' ? '2024' : null;
      
      if (fullYear) {
        const parentId = execSync(`sqlite3 data/threads_intel.db "SELECT id FROM categories WHERE slug = '${fullYear}' LIMIT 1;"`).toString().trim();
        if (parentId) {
          const name = slug.toUpperCase().replace(/\\s+/g, ' ');
          execSync(`sqlite3 data/threads_intel.db "INSERT OR IGNORE INTO categories (name, slug, parent_id, post_count) VALUES ('${name}', '${slug}', ${parentId}, 0);"`);
        }
      }
    }
  });

  console.log('\\nStep 6: Assign ALL posts to categories...');
  
  // Get default category ID
  const defaultId = execSync(`sqlite3 data/threads_intel.db "SELECT id FROM categories WHERE slug = 'intel-quick-updates';"`).toString().trim();
  
  // Assign all posts to default first
  execSync(`sqlite3 data/threads_intel.db "UPDATE posts SET category_id = ${defaultId};"`);
  
  // Then assign posts with specific category patterns
  const allCategories = execSync(`sqlite3 data/threads_intel.db "SELECT id, slug FROM categories WHERE slug != 'intel-quick-updates';"`).toString().trim();
  
  if (allCategories) {
    const categories = allCategories.split('\\n');
    console.log(`Assigning posts to ${categories.length} specific categories...`);
    
    categories.forEach((line, index) => {
      if (line.trim()) {
        const [catId, slug] = line.split('|');
        if (catId && slug) {
          execSync(`sqlite3 data/threads_intel.db "UPDATE posts SET category_id = ${catId} WHERE content LIKE '%/category/${slug}%';"`);
          
          if (index % 10 === 0) {
            console.log(`Processed ${index}/${categories.length} categories...`);
          }
        }
      }
    });
  }

  console.log('\\nStep 7: Update post counts and cleanup...');
  
  // Update post counts
  execSync(`sqlite3 data/threads_intel.db "UPDATE categories SET post_count = (SELECT COUNT(*) FROM posts WHERE posts.category_id = categories.id);"`);
  
  // Remove empty categories (except default)
  execSync(`sqlite3 data/threads_intel.db "DELETE FROM categories WHERE post_count = 0 AND slug != 'intel-quick-updates';"`);

  // Final stats
  const totalCategories = execSync(`sqlite3 data/threads_intel.db "SELECT COUNT(*) FROM categories;"`).toString().trim();
  const totalPosts = execSync(`sqlite3 data/threads_intel.db "SELECT COUNT(*) FROM posts;"`).toString().trim();
  const assignedPosts = execSync(`sqlite3 data/threads_intel.db "SELECT COUNT(*) FROM posts WHERE category_id IS NOT NULL;"`).toString().trim();

  console.log('\\n=== FINAL RESULTS ===');
  console.log(`✅ Categories created: ${totalCategories}`);
  console.log(`✅ Posts assigned: ${assignedPosts}/${totalPosts}`);

  // Top categories
  const topCategories = execSync(`sqlite3 data/threads_intel.db "SELECT name, post_count FROM categories ORDER BY post_count DESC LIMIT 15;"`).toString().trim();
  
  if (topCategories) {
    console.log('\\nTop 15 categories:');
    console.log('==================');
    topCategories.split('\\n').forEach(line => {
      const [name, count] = line.split('|');
      console.log(`${name.padEnd(30)} ${count.padStart(6)} posts`);
    });
  }

  console.log('\\n✅ COMPLETE! All posts categorized.');

} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}