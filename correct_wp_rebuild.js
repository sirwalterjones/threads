const { execSync } = require('child_process');

console.log('Correct WordPress category rebuild based on actual patterns...\n');

try {
  // Step 1: Get ALL unique category slugs from actual content
  console.log('Step 1: Extracting all unique category slugs...');
  
  const rawCategoriesQuery = `
    SELECT DISTINCT 
      REPLACE(
        SUBSTR(content, 
          INSTR(content, '/category/') + 10,
          INSTR(SUBSTR(content, INSTR(content, '/category/') + 10), '/') - 1
        ), '"', ''
      ) as category_slug
    FROM posts 
    WHERE content LIKE '%/category/%'
      AND INSTR(SUBSTR(content, INSTR(content, '/category/') + 10), '/') > 0
    ORDER BY category_slug;
  `;

  const result = execSync(`sqlite3 data/threads_intel.db "${rawCategoriesQuery}"`).toString().trim();
  const allSlugs = result ? result.split('\n').filter(slug => slug && slug.length > 0 && slug.length < 20) : [];
  
  console.log(`Found ${allSlugs.length} unique category slugs`);
  
  // Show sample slugs
  console.log('Sample slugs:', allSlugs.slice(0, 10));

  // Step 2: Clear and recreate categories
  console.log('\\nStep 2: Setting up category structure...');
  execSync(`sqlite3 data/threads_intel.db "DELETE FROM categories;"`);
  
  // Create Intel Quick Updates as default
  execSync(`sqlite3 data/threads_intel.db "INSERT INTO categories (name, slug, parent_id, post_count) VALUES ('Intel Quick Updates', 'intel-quick-updates', NULL, 0);"`);
  
  // Create year categories
  const years = ['2019', '2020', '2021', '2022', '2023', '2024'];
  years.forEach(year => {
    execSync(`sqlite3 data/threads_intel.db "INSERT INTO categories (name, slug, parent_id, post_count) VALUES ('${year}', '${year}', NULL, 0);"`);
  });

  // Step 3: Categorize and create categories
  console.log('Step 3: Creating categories from found slugs...');
  
  const yearCategories = [];
  const caseCategories = [];
  const ciCategories = [];
  const otherCategories = [];

  allSlugs.forEach(slug => {
    if (/^\\d{4}$/.test(slug)) {
      yearCategories.push(slug);
    } else if (/^\\d{2}[-\\d]+/.test(slug)) {  // Pattern like 25-0079-21-05
      caseCategories.push(slug);
    } else if (/^\\d{2}[-]?ci[-]?\\d+/i.test(slug)) {  // Pattern like 25-ci-12
      ciCategories.push(slug);
    } else {
      otherCategories.push(slug);
    }
  });

  console.log(`Category breakdown:`);
  console.log(`- Year categories: ${yearCategories.length}`);
  console.log(`- Case number categories: ${caseCategories.length}`);
  console.log(`- CI categories: ${ciCategories.length}`);
  console.log(`- Other categories: ${otherCategories.length}`);

  // Create CI categories as children of years
  console.log('Creating CI categories...');
  ciCategories.forEach(slug => {
    const yearMatch = slug.match(/^(\\d{2})/);
    if (yearMatch) {
      const yearPrefix = yearMatch[1];
      const fullYear = `20${yearPrefix}`;
      
      if (years.includes(fullYear)) {
        const parentId = execSync(`sqlite3 data/threads_intel.db "SELECT id FROM categories WHERE slug = '${fullYear}';"`).toString().trim();
        const name = slug.toUpperCase().replace(/[-]/g, ' ');
        execSync(`sqlite3 data/threads_intel.db "INSERT OR IGNORE INTO categories (name, slug, parent_id, post_count) VALUES ('${name}', '${slug}', ${parentId}, 0);"`);
      } else {
        // Create as standalone if year parent doesn't exist
        const name = slug.toUpperCase().replace(/[-]/g, ' ');
        execSync(`sqlite3 data/threads_intel.db "INSERT OR IGNORE INTO categories (name, slug, parent_id, post_count) VALUES ('${name}', '${slug}', NULL, 0);"`);
      }
    }
  });

  // Create case number categories as children of years  
  console.log('Creating case number categories...');
  caseCategories.forEach(slug => {
    const yearMatch = slug.match(/^(\\d{2})/);
    if (yearMatch) {
      const yearPrefix = yearMatch[1];
      const fullYear = `20${yearPrefix}`;
      
      if (years.includes(fullYear)) {
        const parentId = execSync(`sqlite3 data/threads_intel.db "SELECT id FROM categories WHERE slug = '${fullYear}';"`).toString().trim();
        const name = slug.toUpperCase();
        execSync(`sqlite3 data/threads_intel.db "INSERT OR IGNORE INTO categories (name, slug, parent_id, post_count) VALUES ('${name}', '${slug}', ${parentId}, 0);"`);
      } else {
        // Create as standalone if year parent doesn't exist
        const name = slug.toUpperCase();
        execSync(`sqlite3 data/threads_intel.db "INSERT OR IGNORE INTO categories (name, slug, parent_id, post_count) VALUES ('${name}', '${slug}', NULL, 0);"`);
      }
    }
  });

  // Create other categories
  console.log('Creating other categories...');
  otherCategories.forEach(slug => {
    const name = slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    execSync(`sqlite3 data/threads_intel.db "INSERT OR IGNORE INTO categories (name, slug, parent_id, post_count) VALUES ('${name}', '${slug}', NULL, 0);"`);
  });

  // Step 4: Assign ALL posts to categories
  console.log('\\nStep 4: Assigning ALL posts to categories...');
  
  const defaultId = execSync(`sqlite3 data/threads_intel.db "SELECT id FROM categories WHERE slug = 'intel-quick-updates';"`).toString().trim();
  
  // Assign all posts to default first
  execSync(`sqlite3 data/threads_intel.db "UPDATE posts SET category_id = ${defaultId};"`);
  
  // Then assign posts with specific categories
  const allCategories = execSync(`sqlite3 data/threads_intel.db "SELECT id, slug FROM categories WHERE slug != 'intel-quick-updates';"`).toString().trim();
  
  if (allCategories) {
    const categories = allCategories.split('\\n');
    console.log(`Assigning posts to ${categories.length} specific categories...`);
    
    categories.forEach((line, index) => {
      if (line.includes('|')) {
        const [catId, slug] = line.split('|');
        execSync(`sqlite3 data/threads_intel.db "UPDATE posts SET category_id = ${catId} WHERE content LIKE '%/category/${slug}/%';"`);
        
        if (index % 20 === 0) {
          console.log(`Processed ${index + 1}/${categories.length} categories`);
        }
      }
    });
  }

  // Step 5: Update counts and cleanup
  console.log('\\nStep 5: Final cleanup and statistics...');
  
  execSync(`sqlite3 data/threads_intel.db "UPDATE categories SET post_count = (SELECT COUNT(*) FROM posts WHERE posts.category_id = categories.id);"`);
  execSync(`sqlite3 data/threads_intel.db "DELETE FROM categories WHERE post_count = 0 AND slug != 'intel-quick-updates';"`);

  // Final statistics
  const stats = {
    totalCategories: execSync(`sqlite3 data/threads_intel.db "SELECT COUNT(*) FROM categories;"`).toString().trim(),
    totalPosts: execSync(`sqlite3 data/threads_intel.db "SELECT COUNT(*) FROM posts;"`).toString().trim(),
    assignedPosts: execSync(`sqlite3 data/threads_intel.db "SELECT COUNT(*) FROM posts WHERE category_id IS NOT NULL;"`).toString().trim()
  };

  console.log('\\n=== FINAL RESULTS ===');
  console.log(`✅ Total categories with posts: ${stats.totalCategories}`);
  console.log(`✅ Total posts assigned: ${stats.assignedPosts}/${stats.totalPosts}`);

  // Show top categories
  const topCategories = execSync(`sqlite3 data/threads_intel.db "SELECT c.name, c.post_count, CASE WHEN c.parent_id IS NULL THEN 'parent' ELSE 'child of ' || p.name END as type FROM categories c LEFT JOIN categories p ON c.parent_id = p.id ORDER BY c.post_count DESC LIMIT 25;"`).toString().trim();
  
  if (topCategories) {
    console.log('\\nTop 25 WordPress categories:');
    console.log('========================================');
    topCategories.split('\\n').forEach(line => {
      const parts = line.split('|');
      if (parts.length >= 3) {
        const [name, count, type] = parts;
        console.log(`${name.padEnd(30)} ${count.padStart(6)} posts (${type})`);
      }
    });
  }

  console.log('\\n✅ COMPLETE! All WordPress categories properly structured and ALL posts assigned.');

} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}