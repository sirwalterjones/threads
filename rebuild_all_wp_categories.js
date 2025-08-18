const { execSync } = require('child_process');

console.log('Rebuilding ALL WordPress categories with complete hierarchy...\n');

try {
  // Get ALL unique category slugs from post content
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
  console.log(`Found ${allCategorySlugs.length} unique WordPress category slugs`);

  // Clear ALL existing categories except Intel Quick Updates (preserve it since it's working)
  console.log('\nClearing existing categories...');
  execSync(`sqlite3 data/threads_intel.db "UPDATE posts SET category_id = NULL WHERE category_id != (SELECT id FROM categories WHERE wp_category_id = 1121);"`, {
    cwd: '/Users/walterjones/threads'
  });
  
  execSync(`sqlite3 data/threads_intel.db "DELETE FROM categories WHERE wp_category_id != 1121;"`, {
    cwd: '/Users/walterjones/threads'
  });

  let categoryId = 3000; // Start from 3000 to avoid conflicts
  const categoryMap = {}; // slug -> id mapping
  
  // Preserve Intel Quick Updates in the map
  const intelResult = execSync(`sqlite3 data/threads_intel.db "SELECT id FROM categories WHERE wp_category_id = 1121;"`, {
    cwd: '/Users/walterjones/threads',
    encoding: 'utf-8'
  });
  if (intelResult.trim()) {
    categoryMap['intel-quick-updates'] = parseInt(intelResult.trim());
  }

  console.log('\nAnalyzing category patterns...');
  
  // Categorize all slugs
  const years = allCategorySlugs.filter(slug => /^\d{4}$/.test(slug)).sort();
  const caseNumbers = allCategorySlugs.filter(slug => /^\d{2}-\d{4}-\d{2}-\d{2}$/.test(slug)).sort();
  const ciCases = allCategorySlugs.filter(slug => /^\d{2}-ci-\d+$/.test(slug)).sort();
  const otherCategories = allCategorySlugs.filter(slug => 
    !years.includes(slug) && 
    !caseNumbers.includes(slug) && 
    !ciCases.includes(slug) &&
    slug !== 'intel-quick-updates'
  );

  console.log(`- Year categories: ${years.length}`);
  console.log(`- Case number categories: ${caseNumbers.length}`);
  console.log(`- CI categories: ${ciCases.length}`);
  console.log(`- Other categories: ${otherCategories.length}`);

  // Create year parent categories first
  console.log('\nCreating year parent categories...');
  for (const year of years) {
    categoryId++;
    categoryMap[year] = categoryId;
    
    execSync(`sqlite3 data/threads_intel.db "INSERT INTO categories (id, wp_category_id, name, slug, parent_id, post_count) VALUES (${categoryId}, ${categoryId}, '${year}', '${year}', NULL, 0);"`, {
      cwd: '/Users/walterjones/threads'
    });
    
    console.log(`Created year category: ${year}`);
  }

  // Create other parent categories if needed
  console.log('\nCreating other parent categories...');
  for (const slug of otherCategories) {
    categoryId++;
    categoryMap[slug] = categoryId;
    
    const displayName = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    execSync(`sqlite3 data/threads_intel.db "INSERT INTO categories (id, wp_category_id, name, slug, parent_id, post_count) VALUES (${categoryId}, ${categoryId}, '${displayName}', '${slug}', NULL, 0);"`, {
      cwd: '/Users/walterjones/threads'
    });
    
    console.log(`Created category: ${displayName}`);
  }

  // Create child categories (case numbers and CI cases)
  console.log('\nCreating child case number categories...');
  let childCount = 0;
  
  for (const slug of caseNumbers) {
    const yearPrefix = '20' + slug.substring(0, 2);
    const parentId = categoryMap[yearPrefix];
    
    if (parentId) {
      categoryId++;
      categoryMap[slug] = categoryId;
      
      const displayName = `Case ${slug.toUpperCase()}`;
      
      execSync(`sqlite3 data/threads_intel.db "INSERT INTO categories (id, wp_category_id, name, slug, parent_id, post_count) VALUES (${categoryId}, ${categoryId}, '${displayName}', '${slug}', ${parentId}, 0);"`, {
        cwd: '/Users/walterjones/threads'
      });
      
      childCount++;
      if (childCount % 50 === 0) {
        console.log(`Created ${childCount} case number categories...`);
      }
    }
  }

  console.log('\nCreating CI child categories...');
  for (const slug of ciCases) {
    const yearPrefix = '20' + slug.substring(0, 2);
    const parentId = categoryMap[yearPrefix];
    
    if (parentId) {
      categoryId++;
      categoryMap[slug] = categoryId;
      
      const displayName = slug.toUpperCase().replace('-CI-', ' CI-');
      
      execSync(`sqlite3 data/threads_intel.db "INSERT INTO categories (id, wp_category_id, name, slug, parent_id, post_count) VALUES (${categoryId}, ${categoryId}, '${displayName}', '${slug}', ${parentId}, 0);"`, {
        cwd: '/Users/walterjones/threads'
      });
      
      childCount++;
    }
  }

  console.log(`\nCreated ${childCount} total child categories`);

  // Now assign posts to their proper categories
  console.log('\nAssigning posts to categories...');
  let assignedCount = 0;

  for (const slug of allCategorySlugs) {
    if (categoryMap[slug]) {
      const updateQuery = `UPDATE posts SET category_id = ${categoryMap[slug]} WHERE content LIKE '%/category/${slug}/%';`;
      
      try {
        execSync(`sqlite3 data/threads_intel.db "${updateQuery}"`, {
          cwd: '/Users/walterjones/threads'
        });
        assignedCount++;
      } catch (e) {
        console.error(`Error assigning posts for category ${slug}: ${e.message}`);
      }
    }
  }

  console.log(`\nProcessed ${assignedCount} category assignments`);

  // Update post counts and remove empty categories
  console.log('\nUpdating post counts...');
  execSync(`sqlite3 data/threads_intel.db "UPDATE categories SET post_count = (SELECT COUNT(*) FROM posts WHERE category_id = categories.id);"`, {
    cwd: '/Users/walterjones/threads'
  });

  console.log('Removing categories with no posts...');
  execSync(`sqlite3 data/threads_intel.db "DELETE FROM categories WHERE post_count = 0;"`, {
    cwd: '/Users/walterjones/threads'
  });

  // Show final results
  const finalResult = execSync(`sqlite3 data/threads_intel.db "SELECT c.name, c.post_count, p.name as parent_name FROM categories c LEFT JOIN categories p ON c.parent_id = p.id WHERE c.post_count > 0 ORDER BY c.post_count DESC LIMIT 20;"`, {
    cwd: '/Users/walterjones/threads',
    encoding: 'utf-8'
  });

  console.log('\nTop 20 WordPress categories with posts:');
  console.log('=======================================');
  finalResult.trim().split('\n').forEach(line => {
    if (line.trim()) {
      const [name, count, parent] = line.split('|');
      const parentInfo = parent ? ` (child of ${parent})` : ' (parent)';
      console.log(`${name.padEnd(30)} ${count.padStart(6)} posts${parentInfo}`);
    }
  });

  // Count total categories
  const totalResult = execSync(`sqlite3 data/threads_intel.db "SELECT COUNT(*) FROM categories WHERE post_count > 0;"`, {
    cwd: '/Users/walterjones/threads',
    encoding: 'utf-8'
  });

  console.log(`\n✅ Complete! ${totalResult.trim()} WordPress categories with posts available.`);

} catch (error) {
  console.error('Error:', error.message);
}