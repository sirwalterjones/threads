const { execSync } = require('child_process');

console.log('Fixing WordPress category assignment with better pattern matching...\n');

// Get all categories with their slugs
const categoriesQuery = `SELECT id, slug FROM categories ORDER BY id;`;
const categoriesResult = execSync(`sqlite3 data/threads_intel.db "${categoriesQuery}"`, {
  cwd: '/Users/walterjones/threads',
  encoding: 'utf-8'
});

const categories = {};
categoriesResult.trim().split('\n').forEach(line => {
  if (line.trim()) {
    const [id, slug] = line.split('|');
    categories[slug] = id;
  }
});

console.log(`Loaded ${Object.keys(categories).length} categories`);

// Test pattern matching first
console.log('\nTesting pattern matching...');
const testContent = `<a href="/category/25-0079-21-05/" title="test">`;
const testContent2 = `<a href="/category/2021/21-0079-21-05/" title="test">`;

console.log('Test 1:', testContent.match(/\/category\/(?:\d{4}\/)?([^\/'"]+)\//));
console.log('Test 2:', testContent2.match(/\/category\/(?:\d{4}\/)?([^\/'"]+)\//));

// Direct SQL approach - let's do the matching in SQL
console.log('\nUsing SQL-based category assignment...');

// First, let's see what we're working with
const sampleQuery = `
  SELECT id, 
    CASE 
      WHEN content LIKE '%/category/%/%' THEN 
        substr(content, 
          instr(content, '/category/') + 10,
          instr(substr(content, instr(content, '/category/') + 10), '/') - 1
        )
    END as extracted_slug
  FROM posts 
  WHERE content LIKE '%/category/%' 
    AND extracted_slug IS NOT NULL
  LIMIT 10;
`;

console.log('\nSample extractions:');
const sampleResult = execSync(`sqlite3 data/threads_intel.db "${sampleQuery}"`, {
  cwd: '/Users/walterjones/threads',
  encoding: 'utf-8'
});

console.log(sampleResult);

// Now do the actual assignment using a more robust approach
console.log('\nUpdating post categories...');

// Method 1: Direct case number matches (25-0079-21-05 pattern)
const update1 = `
  UPDATE posts SET category_id = (
    SELECT c.id FROM categories c 
    WHERE posts.content LIKE '%/category/' || c.slug || '/%'
    LIMIT 1
  )
  WHERE posts.content LIKE '%/category/%'
    AND posts.category_id IS NULL;
`;

execSync(`sqlite3 data/threads_intel.db "${update1}"`, {
  cwd: '/Users/walterjones/threads'
});

// Method 2: Year-based matches (for paths like /category/2021/case-number/)
const update2 = `
  UPDATE posts SET category_id = (
    SELECT c.id FROM categories c 
    WHERE c.slug IN ('2019', '2020', '2021', '2022', '2023', '2024')
      AND posts.content LIKE '%/category/' || c.slug || '/%'
    LIMIT 1
  )
  WHERE posts.content LIKE '%/category/20%/%'
    AND posts.category_id IS NULL;
`;

execSync(`sqlite3 data/threads_intel.db "${update2}"`, {
  cwd: '/Users/walterjones/threads'
});

// Update category post counts
console.log('Updating category post counts...');
const updateCountsQuery = `
  UPDATE categories SET post_count = (
    SELECT COUNT(*) FROM posts WHERE category_id = categories.id
  );
`;

execSync(`sqlite3 data/threads_intel.db "${updateCountsQuery}"`, {
  cwd: '/Users/walterjones/threads'
});

// Show results
const resultsQuery = `
  SELECT name, post_count 
  FROM categories 
  WHERE post_count > 0 
  ORDER BY post_count DESC;
`;

const results = execSync(`sqlite3 data/threads_intel.db "${resultsQuery}"`, {
  cwd: '/Users/walterjones/threads',
  encoding: 'utf-8'
});

console.log('\nWordPress Categories with Posts:');
console.log('================================');
const lines = results.trim().split('\n').filter(line => line.trim());
if (lines.length > 0) {
  lines.forEach(line => {
    const [name, count] = line.split('|');
    console.log(`${name.padEnd(25)} ${count.padStart(6)} posts`);
  });
} else {
  console.log('No posts assigned yet - checking why...');
  
  // Debug: Check what categories exist
  const debugQuery = `SELECT COUNT(*) as total_categories FROM categories;`;
  const debugResult = execSync(`sqlite3 data/threads_intel.db "${debugQuery}"`, {
    cwd: '/Users/walterjones/threads',
    encoding: 'utf-8'
  });
  console.log(`Total categories: ${debugResult.trim()}`);
  
  // Check posts with category links
  const postsQuery = `SELECT COUNT(*) as posts_with_links FROM posts WHERE content LIKE '%/category/%';`;
  const postsResult = execSync(`sqlite3 data/threads_intel.db "${postsQuery}"`, {
    cwd: '/Users/walterjones/threads',
    encoding: 'utf-8'
  });
  console.log(`Posts with category links: ${postsResult.trim()}`);
}

console.log('\n✅ Category assignment process complete!');