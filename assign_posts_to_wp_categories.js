const { execSync } = require('child_process');

console.log('Assigning posts to actual WordPress categories based on content links...\n');

// Get all categories
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

// Update posts based on category links in their content
console.log('Updating posts with category assignments...');

let updatedCount = 0;
const batchSize = 100;

// Process posts in batches to avoid memory issues
const totalPostsResult = execSync(`sqlite3 data/threads_intel.db "SELECT COUNT(*) FROM posts WHERE content LIKE '%/category/%';"`, {
  cwd: '/Users/walterjones/threads',
  encoding: 'utf-8'
});

const totalPosts = parseInt(totalPostsResult.trim());
console.log(`Processing ${totalPosts} posts with category links...`);

for (let offset = 0; offset < totalPosts; offset += batchSize) {
  const postsQuery = `
    SELECT id, content 
    FROM posts 
    WHERE content LIKE '%/category/%' 
    LIMIT ${batchSize} OFFSET ${offset};
  `;
  
  const postsResult = execSync(`sqlite3 data/threads_intel.db "${postsQuery}"`, {
    cwd: '/Users/walterjones/threads',
    encoding: 'utf-8'
  });
  
  const posts = postsResult.trim().split('\n').filter(line => line.trim());
  
  for (const line of posts) {
    if (!line.trim()) continue;
    
    const parts = line.split('|');
    if (parts.length < 2) continue;
    
    const postId = parts[0];
    const content = parts.slice(1).join('|'); // Rejoin in case content has |
    
    // Extract category slug from content
    const categoryMatch = content.match(/\/category\/([^\/'"]+)\//);
    if (categoryMatch) {
      const categorySlug = categoryMatch[1];
      const categoryId = categories[categorySlug];
      
      if (categoryId) {
        // Update post with correct category
        const updateQuery = `UPDATE posts SET category_id = ${categoryId} WHERE id = ${postId};`;
        execSync(`sqlite3 data/threads_intel.db "${updateQuery}"`, {
          cwd: '/Users/walterjones/threads'
        });
        updatedCount++;
        
        if (updatedCount % 100 === 0) {
          process.stdout.write(`\rUpdated ${updatedCount} posts...`);
        }
      }
    }
  }
}

console.log(`\n\nUpdated ${updatedCount} posts with WordPress category assignments`);

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

// Show final category distribution
const finalCountsQuery = `
  SELECT name, post_count 
  FROM categories 
  WHERE post_count > 0 
  ORDER BY post_count DESC 
  LIMIT 20;
`;

const finalResult = execSync(`sqlite3 data/threads_intel.db "${finalCountsQuery}"`, {
  cwd: '/Users/walterjones/threads',
  encoding: 'utf-8'
});

console.log('\nTop 20 WordPress Categories by Post Count:');
console.log('==========================================');
finalResult.trim().split('\n').forEach(line => {
  if (line.trim()) {
    const [name, count] = line.split('|');
    console.log(`${name.padEnd(30)} ${count.padStart(6)} posts`);
  }
});

console.log('\n✅ WordPress category assignment complete!');