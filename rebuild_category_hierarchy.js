const { execSync } = require('child_process');

console.log('Rebuilding WordPress category hierarchy...\n');

try {
  // First, get all unique category slugs from content
  const categoryQuery = `
    SELECT DISTINCT 
      CASE 
        WHEN content LIKE '%/category/%/%' THEN 
          substr(content, 
            instr(content, '/category/') + 10,
            instr(substr(content, instr(content, '/category/') + 10), '/') - 1
          )
      END as category_slug
    FROM posts 
    WHERE content LIKE '%/category/%' 
      AND category_slug IS NOT NULL 
      AND category_slug != ''
    ORDER BY category_slug;
  `;

  const result = execSync(`sqlite3 data/threads_intel.db "${categoryQuery}"`, {
    cwd: '/Users/walterjones/threads',
    encoding: 'utf-8'
  });

  const allCategorySlugs = result.trim().split('\n').filter(cat => cat.trim());
  console.log(`Found ${allCategorySlugs.length} category slugs in post content`);

  // Clear existing categories except Intel Quick Updates
  execSync(`sqlite3 data/threads_intel.db "DELETE FROM categories WHERE wp_category_id != 1121;"`, {
    cwd: '/Users/walterjones/threads'
  });

  let categoryId = 2000; // Start from 2000 to avoid conflicts

  // Create year parent categories
  const years = ['2019', '2020', '2021', '2022', '2023', '2024'];
  const yearCategoryIds = {};

  console.log('\nCreating parent year categories...');
  for (const year of years) {
    categoryId++;
    yearCategoryIds[year] = categoryId;
    
    execSync(`sqlite3 data/threads_intel.db "INSERT INTO categories (id, wp_category_id, name, slug, parent_id, post_count) VALUES (${categoryId}, ${categoryId}, '${year}', '${year}', NULL, 0);"`, {
      cwd: '/Users/walterjones/threads'
    });
    
    console.log(`Created parent category: ${year} (ID: ${categoryId})`);
  }

  // Create child categories for case numbers and CI cases
  console.log('\nCreating child categories...');
  let childCount = 0;

  for (const slug of allCategorySlugs) {
    if (years.includes(slug)) continue; // Skip year categories, already created
    
    // Determine parent category based on slug pattern
    let parentId = null;
    let parentYear = null;
    
    // For case numbers like "21-0027-21-01" or CI cases like "21-ci-01"
    if (slug.match(/^(\d{2})-/)) {
      const yearPrefix = '20' + slug.substring(0, 2);
      parentYear = yearPrefix;
      parentId = yearCategoryIds[yearPrefix];
    }
    
    if (parentId) {
      categoryId++;
      const displayName = slug.toUpperCase().replace('-CI-', ' CI-');
      
      execSync(`sqlite3 data/threads_intel.db "INSERT INTO categories (id, wp_category_id, name, slug, parent_id, post_count) VALUES (${categoryId}, ${categoryId}, '${displayName}', '${slug}', ${parentId}, 0);"`, {
        cwd: '/Users/walterjones/threads'
      });
      
      childCount++;
      if (childCount % 20 === 0) {
        console.log(`Created ${childCount} child categories...`);
      }
    }
  }

  console.log(`\nCreated ${childCount} child categories total`);

  // Now assign posts to their proper categories
  console.log('\nAssigning posts to categories...');
  
  // First assign to child categories
  for (const slug of allCategorySlugs) {
    if (years.includes(slug)) continue;
    
    const updateQuery = `UPDATE posts SET category_id = (SELECT id FROM categories WHERE slug = '${slug}' LIMIT 1) WHERE content LIKE '%/category/${slug}/%';`;
    
    try {
      execSync(`sqlite3 data/threads_intel.db "${updateQuery}"`, {
        cwd: '/Users/walterjones/threads'
      });
    } catch (e) {
      // Skip errors
    }
  }

  // Then assign remaining posts to year parent categories
  for (const year of years) {
    const updateQuery = `UPDATE posts SET category_id = (SELECT id FROM categories WHERE slug = '${year}' LIMIT 1) WHERE content LIKE '%/category/${year}/%' AND category_id IS NULL;`;
    
    execSync(`sqlite3 data/threads_intel.db "${updateQuery}"`, {
      cwd: '/Users/walterjones/threads'
    });
  }

  // Update post counts
  console.log('\nUpdating post counts...');
  execSync(`sqlite3 data/threads_intel.db "UPDATE categories SET post_count = (SELECT COUNT(*) FROM posts WHERE category_id = categories.id);"`, {
    cwd: '/Users/walterjones/threads'
  });

  // Show results
  const finalResult = execSync(`sqlite3 data/threads_intel.db "SELECT c.name, c.post_count, p.name as parent_name FROM categories c LEFT JOIN categories p ON c.parent_id = p.id WHERE c.post_count > 0 ORDER BY c.post_count DESC LIMIT 20;"`, {
    cwd: '/Users/walterjones/threads',
    encoding: 'utf-8'
  });

  console.log('\nTop 20 categories with posts:');
  console.log('================================');
  finalResult.trim().split('\n').forEach(line => {
    const [name, count, parent] = line.split('|');
    const parentInfo = parent ? ` (child of ${parent})` : ' (parent)';
    console.log(`${name.padEnd(25)} ${count.padStart(6)} posts${parentInfo}`);
  });

  console.log('\n✅ Category hierarchy rebuilt successfully!');

} catch (error) {
  console.error('Error:', error.message);
}