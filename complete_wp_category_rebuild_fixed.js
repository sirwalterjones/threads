const { execSync } = require('child_process');
const fs = require('fs');

console.log('Analyzing ALL 20,144 posts for complete WordPress category extraction...\n');

try {
  // Step 1: Get all posts with WordPress category links
  console.log('Step 1: Finding all posts with WordPress category links...');
  
  const postsWithCategoriesQuery = `SELECT id, content FROM posts WHERE content LIKE '%/category/%';`;
  const result = execSync(`sqlite3 data/threads_intel.db "${postsWithCategoriesQuery}"`).toString();
  
  const postsWithCategories = result.trim().split('\n').filter(line => line.trim());
  console.log(`Found ${postsWithCategories.length} posts containing WordPress category links`);
  
  // Step 2: Extract all unique category slugs manually
  console.log('Step 2: Extracting all category slugs from post content...');
  
  const allCategorySlugs = new Set();
  
  postsWithCategories.forEach(line => {
    const [id, ...contentParts] = line.split('|');
    const content = contentParts.join('|');
    
    // Find all /category/ patterns
    const categoryMatches = content.match(/\/category\/([^\/\s"]+)/g);
    if (categoryMatches) {
      categoryMatches.forEach(match => {
        const slug = match.replace('/category/', '').replace(/["%]/g, '').trim();
        if (slug && slug.length > 0) {
          allCategorySlugs.add(slug);
        }
      });
    }
    
    // Find nested category patterns /category/parent/child/
    const nestedMatches = content.match(/\/category\/([^\/\s"]+)\/([^\/\s"]+)/g);
    if (nestedMatches) {
      nestedMatches.forEach(match => {
        const parts = match.replace('/category/', '').split('/');
        parts.forEach(part => {
          const slug = part.replace(/["%]/g, '').trim();
          if (slug && slug.length > 0) {
            allCategorySlugs.add(slug);
          }
        });
      });
    }
  });
  
  const uniqueSlugs = Array.from(allCategorySlugs).sort();
  console.log(`Found ${uniqueSlugs.length} unique WordPress category slugs`);
  
  // Step 3: Clear existing categories and create new structure
  console.log('\\nStep 3: Clearing existing categories...');
  execSync(`sqlite3 data/threads_intel.db "DELETE FROM categories;"`);
  
  // Step 4: Categorize slugs and create hierarchy
  console.log('Step 4: Creating comprehensive category hierarchy...');
  
  const yearCategories = [];
  const caseNumberCategories = [];
  const otherCategories = [];
  
  uniqueSlugs.forEach(slug => {
    if (/^\\d{4}$/.test(slug)) {
      yearCategories.push(slug);
    } else if (/^\\d{2}\\s*(ci|case)[-\\s]*\\d+/i.test(slug)) {
      caseNumberCategories.push(slug);
    } else {
      otherCategories.push(slug);
    }
  });
  
  console.log(`Category breakdown:`);
  console.log(`- Year categories: ${yearCategories.length}`);
  console.log(`- Case number categories: ${caseNumberCategories.length}`);
  console.log(`- Other categories: ${otherCategories.length}`);
  
  // Create Intel Quick Updates as default category
  execSync(`sqlite3 data/threads_intel.db "INSERT INTO categories (name, slug, parent_id, post_count) VALUES ('Intel Quick Updates', 'intel-quick-updates', NULL, 0);"`);
  
  // Create year parent categories
  console.log('Creating year parent categories...');
  yearCategories.forEach(year => {
    const name = year;
    execSync(`sqlite3 data/threads_intel.db "INSERT INTO categories (name, slug, parent_id, post_count) VALUES ('${name}', '${year}', NULL, 0);"`);
  });
  
  // Create other parent categories
  console.log('Creating other parent categories...');
  otherCategories.forEach(slug => {
    const name = slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    const safeName = name.replace(/'/g, "''");
    execSync(`sqlite3 data/threads_intel.db "INSERT INTO categories (name, slug, parent_id, post_count) VALUES ('${safeName}', '${slug}', NULL, 0);"`);
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
      
      if (fullYear && yearCategories.includes(fullYear)) {
        const parentResult = execSync(`sqlite3 data/threads_intel.db "SELECT id FROM categories WHERE slug = '${fullYear}' LIMIT 1;"`).toString().trim();
        if (parentResult) {
          const parentId = parentResult;
          const name = slug.toUpperCase().replace(/-/g, '-');
          execSync(`sqlite3 data/threads_intel.db "INSERT INTO categories (name, slug, parent_id, post_count) VALUES ('${name}', '${slug}', ${parentId}, 0);"`);
        }
      } else {
        // If no matching year parent, create as standalone category
        const name = slug.toUpperCase().replace(/-/g, '-');
        execSync(`sqlite3 data/threads_intel.db "INSERT INTO categories (name, slug, parent_id, post_count) VALUES ('${name}', '${slug}', NULL, 0);"`);
      }
    }
  });
  
  console.log(`\\nStep 5: Assigning ALL 20,144 posts to categories...`);
  
  // Get default category ID
  const defaultCategoryId = execSync(`sqlite3 data/threads_intel.db "SELECT id FROM categories WHERE slug = 'intel-quick-updates' LIMIT 1;"`).toString().trim();
  
  // First assign all posts to default category
  execSync(`sqlite3 data/threads_intel.db "UPDATE posts SET category_id = ${defaultCategoryId};"`);
  
  // Then assign posts with specific WordPress category links
  console.log('Assigning posts with WordPress category links...');
  
  const allCategories = execSync(`sqlite3 data/threads_intel.db "SELECT id, slug FROM categories;"`).toString().trim().split('\\n');
  
  let assignmentCount = 0;
  allCategories.forEach(line => {
    if (line.trim()) {
      const [categoryId, slug] = line.split('|');
      if (slug && slug !== 'intel-quick-updates') {
        // Update posts that contain this category slug in their content
        const updateQuery = `UPDATE posts SET category_id = ${categoryId} WHERE content LIKE '%/category/${slug}%' OR content LIKE '%/category/${slug}/%';`;
        execSync(`sqlite3 data/threads_intel.db "${updateQuery}"`);
        assignmentCount++;
      }
    }
  });
  
  console.log(`Processed ${assignmentCount} category assignments`);
  
  console.log('\\nStep 6: Updating post counts and cleaning up...');
  
  // Update post counts for all categories
  execSync(`sqlite3 data/threads_intel.db "UPDATE categories SET post_count = (SELECT COUNT(*) FROM posts WHERE posts.category_id = categories.id);"`);
  
  // Remove categories with no posts (except Intel Quick Updates)
  execSync(`sqlite3 data/threads_intel.db "DELETE FROM categories WHERE post_count = 0 AND slug != 'intel-quick-updates';"`);
  
  // Final verification
  const totalCategories = execSync(`sqlite3 data/threads_intel.db "SELECT COUNT(*) FROM categories;"`).toString().trim();
  const assignedPosts = execSync(`sqlite3 data/threads_intel.db "SELECT COUNT(*) FROM posts WHERE category_id IS NOT NULL;"`).toString().trim();
  const totalPosts = execSync(`sqlite3 data/threads_intel.db "SELECT COUNT(*) FROM posts;"`).toString().trim();
  
  console.log('\\n=== FINAL RESULTS ===');
  console.log(`✅ Total categories: ${totalCategories}`);
  console.log(`✅ Total posts assigned: ${assignedPosts} / ${totalPosts}`);
  
  // Show top categories
  const topCategoriesResult = execSync(`sqlite3 data/threads_intel.db "SELECT c.name, c.post_count, CASE WHEN c.parent_id IS NULL THEN 'parent' ELSE 'child of ' || p.name END as type FROM categories c LEFT JOIN categories p ON c.parent_id = p.id ORDER BY c.post_count DESC LIMIT 25;"`).toString().trim();
  
  if (topCategoriesResult) {
    console.log('\\nTop 25 WordPress categories:');
    console.log('=======================================');
    topCategoriesResult.split('\\n').forEach(line => {
      const parts = line.split('|');
      if (parts.length >= 3) {
        const [name, count, type] = parts;
        console.log(`${name.padEnd(35)} ${count.padStart(6)} posts (${type})`);
      }
    });
  }
  
  console.log('\\n✅ COMPLETE! ALL posts have been categorized with comprehensive WordPress structure.');

} catch (error) {
  console.error('Error rebuilding categories:', error.message);
  process.exit(1);
}