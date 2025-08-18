const { execSync } = require('child_process');
const path = require('path');

// Extract all category slugs from post content
const query = `
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

try {
  console.log('Extracting WordPress categories from post content...\n');
  
  const result = execSync(`sqlite3 data/threads_intel.db "${query}"`, {
    cwd: '/Users/walterjones/threads',
    encoding: 'utf-8'
  });
  
  const categories = result.trim().split('\n').filter(cat => cat.trim());
  
  console.log(`Found ${categories.length} unique WordPress categories:\n`);
  
  // Group categories
  const years = categories.filter(cat => /^\d{4}$/.test(cat));
  const caseNumbers = categories.filter(cat => /^\d{2}-\d{4}-\d{2}-\d{2}$/.test(cat));
  const ciCases = categories.filter(cat => /^\d{2}-ci-\d+$/.test(cat));
  const others = categories.filter(cat => 
    !years.includes(cat) && 
    !caseNumbers.includes(cat) && 
    !ciCases.includes(cat)
  );
  
  console.log(`Year Categories (${years.length}):`, years.join(', '));
  console.log(`\nCase Number Categories (${caseNumbers.length}):`);
  caseNumbers.slice(0, 10).forEach(cat => console.log(`  ${cat}`));
  if (caseNumbers.length > 10) console.log(`  ... and ${caseNumbers.length - 10} more`);
  
  console.log(`\nConfidential Informant Categories (${ciCases.length}):`);
  ciCases.forEach(cat => console.log(`  ${cat}`));
  
  if (others.length > 0) {
    console.log(`\nOther Categories (${others.length}):`, others.join(', '));
  }
  
  // Now create the actual WordPress categories in the database
  console.log('\n=== Creating WordPress Categories in Database ===\n');
  
  // Clear existing synthetic categories
  execSync(`sqlite3 data/threads_intel.db "DELETE FROM categories WHERE wp_category_id >= 2000;"`, {
    cwd: '/Users/walterjones/threads'
  });
  
  let categoryId = 1800; // Start from a high number to avoid conflicts
  const insertCategories = [];
  
  // Add year categories first
  years.forEach(year => {
    categoryId++;
    insertCategories.push(`(${categoryId}, '${year}', '${year}', 0)`);
  });
  
  // Add CI categories
  ciCases.forEach(ci => {
    categoryId++;
    const name = ci.toUpperCase().replace('-CI-', ' CI-');
    insertCategories.push(`(${categoryId}, '${name}', '${ci}', 0)`);
  });
  
  // Add a sample of case number categories (limit to avoid too many)
  const sampleCases = caseNumbers.slice(0, 50); // Take first 50
  sampleCases.forEach(caseNum => {
    categoryId++;
    const name = `Case ${caseNum}`;
    insertCategories.push(`(${categoryId}, '${name}', '${caseNum}', 0)`);
  });
  
  // Insert categories in batches
  const batchSize = 50;
  for (let i = 0; i < insertCategories.length; i += batchSize) {
    const batch = insertCategories.slice(i, i + batchSize);
    const insertQuery = `INSERT INTO categories (wp_category_id, name, slug, post_count) VALUES ${batch.join(', ')};`;
    
    execSync(`sqlite3 data/threads_intel.db "${insertQuery}"`, {
      cwd: '/Users/walterjones/threads'
    });
  }
  
  console.log(`Created ${insertCategories.length} WordPress categories in database`);
  
  // Verify categories were created
  const countResult = execSync(`sqlite3 data/threads_intel.db "SELECT COUNT(*) FROM categories;"`, {
    cwd: '/Users/walterjones/threads',
    encoding: 'utf-8'
  });
  
  console.log(`Total categories in database: ${countResult.trim()}`);
  
} catch (error) {
  console.error('Error:', error.message);
}