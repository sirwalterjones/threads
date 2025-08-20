const { execSync } = require('child_process');

console.log('Analyzing ALL 20,144 posts for complete WordPress category extraction...\n');

try {
  // Get ALL posts and analyze their content for WordPress category patterns
  console.log('Step 1: Analyzing all post content for WordPress category patterns...');
  
  const allCategoriesQuery = `
    SELECT DISTINCT 
      CASE 
        -- Extract categories from /category/parent/child/ patterns
        WHEN content LIKE '%/category/%/%' THEN 
          TRIM(REPLACE(REPLACE(
            SUBSTR(content, 
              INSTR(content, '/category/') + 10,
              CASE 
                WHEN INSTR(SUBSTR(content, INSTR(content, '/category/') + 10), '/') > 0
                THEN INSTR(SUBSTR(content, INSTR(content, '/category/') + 10), '/') - 1
                ELSE LENGTH(SUBSTR(content, INSTR(content, '/category/') + 10))
              END
            ), '%', ''), '"', ''))
        -- Extract categories from /category/single/ patterns  
        WHEN content LIKE '%/category/%' THEN 
          TRIM(REPLACE(REPLACE(
            SUBSTR(content, 
              INSTR(content, '/category/') + 10,
              CASE 
                WHEN INSTR(SUBSTR(content, INSTR(content, '/category/') + 10), '/') > 0
                THEN INSTR(SUBSTR(content, INSTR(content, '/category/') + 10), '/') - 1
                WHEN INSTR(SUBSTR(content, INSTR(content, '/category/') + 10), ' ') > 0
                THEN INSTR(SUBSTR(content, INSTR(content, '/category/') + 10), ' ') - 1
                WHEN INSTR(SUBSTR(content, INSTR(content, '/category/') + 10), '"') > 0
                THEN INSTR(SUBSTR(content, INSTR(content, '/category/') + 10), '"') - 1
                ELSE LENGTH(SUBSTR(content, INSTR(content, '/category/') + 10))
              END
            ), '%', ''), '"', ''))
      END as category_slug
    FROM posts 
    WHERE content LIKE '%/category/%'
      AND category_slug IS NOT NULL 
      AND category_slug != ''
      AND LENGTH(category_slug) > 0
    UNION
    -- Also extract child categories from /category/parent/child/ patterns
    SELECT DISTINCT 
      TRIM(REPLACE(REPLACE(
        SUBSTR(
          SUBSTR(content, INSTR(content, '/category/') + 10),
          INSTR(SUBSTR(content, INSTR(content, '/category/') + 10), '/') + 1,
          CASE 
            WHEN INSTR(SUBSTR(SUBSTR(content, INSTR(content, '/category/') + 10), INSTR(SUBSTR(content, INSTR(content, '/category/') + 10), '/') + 1), '/') > 0
            THEN INSTR(SUBSTR(SUBSTR(content, INSTR(content, '/category/') + 10), INSTR(SUBSTR(content, INSTR(content, '/category/') + 10), '/') + 1), '/') - 1
            WHEN INSTR(SUBSTR(SUBSTR(content, INSTR(content, '/category/') + 10), INSTR(SUBSTR(content, INSTR(content, '/category/') + 10), '/') + 1), ' ') > 0
            THEN INSTR(SUBSTR(SUBSTR(content, INSTR(content, '/category/') + 10), INSTR(SUBSTR(content, INSTR(content, '/category/') + 10), '/') + 1), ' ') - 1
            WHEN INSTR(SUBSTR(SUBSTR(content, INSTR(content, '/category/') + 10), INSTR(SUBSTR(content, INSTR(content, '/category/') + 10), '/') + 1), '"') > 0
            THEN INSTR(SUBSTR(SUBSTR(content, INSTR(content, '/category/') + 10), INSTR(SUBSTR(content, INSTR(content, '/category/') + 10), '/') + 1), '"') - 1
            ELSE LENGTH(SUBSTR(SUBSTR(content, INSTR(content, '/category/') + 10), INSTR(SUBSTR(content, INSTR(content, '/category/') + 10), '/') + 1))
          END
        ), '%', ''), '"', '')) as category_slug
    FROM posts 
    WHERE content LIKE '%/category/%/%'
      AND INSTR(SUBSTR(content, INSTR(content, '/category/') + 10), '/') > 0
      AND category_slug IS NOT NULL 
      AND category_slug != ''
      AND LENGTH(category_slug) > 2
    ORDER BY category_slug;
  `;

  const result = execSync(`sqlite3 data/threads_intel.db "${allCategoriesQuery}"`).toString().trim();
  const allCategorySlugs = result ? result.split('\n').filter(slug => slug.trim()) : [];
  
  console.log(`Found ${allCategorySlugs.length} unique WordPress category slugs from ALL posts`);

  // Clear existing categories
  console.log('\\nStep 2: Clearing existing categories...');
  execSync(`sqlite3 data/threads_intel.db "DELETE FROM categories;"`);

  // Analyze patterns and create hierarchy
  console.log('\\nStep 3: Creating comprehensive category hierarchy...');

  // Create Intel Quick Updates as default category
  execSync(`sqlite3 data/threads_intel.db "INSERT OR IGNORE INTO categories (name, slug, parent_id, post_count) VALUES ('Intel Quick Updates', 'intel-quick-updates', NULL, 0);"`);

  // Categorize all found slugs
  const yearCategories = [];
  const caseNumberCategories = [];
  const ciCategories = [];
  const otherCategories = [];

  allCategorySlugs.forEach(slug => {
    if (/^\\d{4}$/.test(slug)) {
      yearCategories.push(slug);
    } else if (/^\\d{2}\\s*(ci|case)\\s*-?\\s*\\d+/i.test(slug)) {
      caseNumberCategories.push(slug);
    } else if (/ci\\s*-?\\s*memo/i.test(slug) || /memo/i.test(slug)) {
      otherCategories.push(slug);
    } else {
      otherCategories.push(slug);
    }
  });

  console.log(`Category breakdown:`);
  console.log(`- Year categories: ${yearCategories.length}`);
  console.log(`- Case number categories: ${caseNumberCategories.length}`);
  console.log(`- Other categories: ${otherCategories.length}`);

  // Create year parent categories
  console.log('\\nCreating year parent categories...');
  yearCategories.forEach(year => {
    execSync(`sqlite3 data/threads_intel.db "INSERT OR IGNORE INTO categories (name, slug, parent_id, post_count) VALUES ('${year}', '${year}', NULL, 0);"`);
  });

  // Create other parent categories
  console.log('Creating other parent categories...');
  otherCategories.forEach(slug => {
    const name = slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    execSync(`sqlite3 data/threads_intel.db "INSERT OR IGNORE INTO categories (name, slug, parent_id, post_count) VALUES ('${name.replace(/'/g, "''")}', '${slug}', NULL, 0);"`);
  });

  // Create case number categories as children of year categories
  console.log('Creating case number child categories...');
  caseNumberCategories.forEach(slug => {
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
        const parentResult = execSync(`sqlite3 data/threads_intel.db "SELECT id FROM categories WHERE slug = '${fullYear}' LIMIT 1;"`).toString().trim();
        if (parentResult) {
          const parentId = parentResult;
          const name = slug.toUpperCase().replace(/-/g, '-');
          execSync(`sqlite3 data/threads_intel.db "INSERT OR IGNORE INTO categories (name, slug, parent_id, post_count) VALUES ('${name}', '${slug}', ${parentId}, 0);"`);
        }
      }
    }
  });

  console.log(`\\nStep 4: Assigning ALL 20,144 posts to categories...`);

  // First, assign posts that have WordPress category links
  console.log('Assigning posts with WordPress category links...');
  const categoryAssignmentQuery = `
    UPDATE posts 
    SET category_id = (
      SELECT c.id 
      FROM categories c 
      WHERE posts.content LIKE '%/category/' || c.slug || '/%' 
         OR posts.content LIKE '%/category/' || c.slug || ' %'
         OR posts.content LIKE '%/category/' || c.slug || '"%'
      ORDER BY LENGTH(c.slug) DESC 
      LIMIT 1
    )
    WHERE posts.content LIKE '%/category/%';
  `;

  execSync(`sqlite3 data/threads_intel.db "${categoryAssignmentQuery}"`);

  // Assign remaining posts to Intel Quick Updates
  console.log('Assigning remaining posts to Intel Quick Updates...');
  const defaultCategoryId = execSync(`sqlite3 data/threads_intel.db "SELECT id FROM categories WHERE slug = 'intel-quick-updates' LIMIT 1;"`).toString().trim();
  
  execSync(`sqlite3 data/threads_intel.db "UPDATE posts SET category_id = ${defaultCategoryId} WHERE category_id IS NULL;"`);

  console.log('\\nStep 5: Updating post counts and cleaning up...');
  
  // Update post counts
  execSync(`sqlite3 data/threads_intel.db "UPDATE categories SET post_count = (SELECT COUNT(*) FROM posts WHERE posts.category_id = categories.id);"`);
  
  // Remove categories with no posts
  execSync(`sqlite3 data/threads_intel.db "DELETE FROM categories WHERE post_count = 0;"`);

  // Final statistics
  const finalStats = execSync(`sqlite3 data/threads_intel.db "SELECT COUNT(*) as total_categories FROM categories;"`).toString().trim();
  const assignedPosts = execSync(`sqlite3 data/threads_intel.db "SELECT COUNT(*) as assigned_posts FROM posts WHERE category_id IS NOT NULL;"`).toString().trim();
  
  console.log('\\n=== FINAL RESULTS ===');
  console.log(`✅ Total categories with posts: ${finalStats}`);
  console.log(`✅ Total posts assigned: ${assignedPosts}`);

  // Show top categories
  const topCategories = execSync(`sqlite3 data/threads_intel.db "SELECT c.name, c.post_count, CASE WHEN c.parent_id IS NULL THEN 'parent' ELSE 'child of ' || p.name END as type FROM categories c LEFT JOIN categories p ON c.parent_id = p.id ORDER BY c.post_count DESC LIMIT 25;"`).toString().trim();
  
  console.log('\\nTop 25 WordPress categories:');
  console.log('=======================================');
  if (topCategories) {
    topCategories.split('\\n').forEach(line => {
      const [name, count, type] = line.split('|');
      console.log(`${name.padEnd(35)} ${count.padStart(6)} posts (${type})`);
    });
  }

  console.log('\\n✅ Complete! ALL posts have been categorized with comprehensive WordPress category structure.');

} catch (error) {
  console.error('Error rebuilding categories:', error.message);
  process.exit(1);
}