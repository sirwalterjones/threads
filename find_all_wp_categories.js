const { execSync } = require('child_process');

console.log('Extracting ALL WordPress category slugs from post content...\n');

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
  const result = execSync(`sqlite3 data/threads_intel.db "${query}"`, {
    cwd: '/Users/walterjones/threads',
    encoding: 'utf-8'
  });
  
  const categories = result.trim().split('\n').filter(cat => cat.trim());
  
  console.log(`Found ${categories.length} unique WordPress category slugs:\n`);
  
  // Look specifically for intel-related categories
  const intelCategories = categories.filter(cat => 
    cat.toLowerCase().includes('intel') || 
    cat.toLowerCase().includes('quick') ||
    cat.toLowerCase().includes('update')
  );
  
  console.log('Intel/Quick/Update related categories:');
  console.log('=====================================');
  if (intelCategories.length > 0) {
    intelCategories.forEach(cat => console.log(cat));
  } else {
    console.log('No intel/quick/update categories found in category links');
  }
  
  console.log('\nAll categories (first 50):');
  console.log('==========================');
  categories.slice(0, 50).forEach(cat => console.log(cat));
  
  if (categories.length > 50) {
    console.log(`\n... and ${categories.length - 50} more categories`);
  }

  // Count posts for each category pattern
  console.log('\nChecking post counts for potential intel-quick-updates patterns...');
  
  const patterns = [
    'intel-quick-updates',
    'Intel-Quick-Updates', 
    'intel_quick_updates',
    'quick-updates',
    'intel-updates',
    'intelligence-updates'
  ];
  
  for (const pattern of patterns) {
    const countQuery = `SELECT COUNT(*) FROM posts WHERE content LIKE '%/category/${pattern}/%';`;
    try {
      const count = execSync(`sqlite3 data/threads_intel.db "${countQuery}"`, {
        cwd: '/Users/walterjones/threads',
        encoding: 'utf-8'
      }).trim();
      
      if (parseInt(count) > 0) {
        console.log(`Pattern '${pattern}': ${count} posts`);
      }
    } catch (e) {
      // Skip errors
    }
  }
  
} catch (error) {
  console.error('Error:', error.message);
}