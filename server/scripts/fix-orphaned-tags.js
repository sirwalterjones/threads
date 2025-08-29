const { pool } = require('../config/database');

async function fixOrphanedTags() {
  const client = await pool.connect();
  
  try {
    console.log('Starting orphaned tags cleanup...');
    
    await client.query('BEGIN');
    
    // Step 1: Get all posts with tags
    const postsWithTags = await client.query(`
      SELECT id, tags 
      FROM posts 
      WHERE tags IS NOT NULL 
        AND array_length(tags, 1) > 0
    `);
    
    console.log(`Found ${postsWithTags.rows.length} posts with tags`);
    
    // Step 2: For each post, verify tags exist in comments
    let totalFixed = 0;
    
    for (const post of postsWithTags.rows) {
      const postId = post.id;
      const currentTags = post.tags;
      
      // Get all comments for this post
      const commentsResult = await client.query(`
        SELECT content FROM comments WHERE post_id = $1
      `, [postId]);
      
      // Extract all hashtags from comments
      const validTags = new Set();
      commentsResult.rows.forEach(row => {
        const content = row.content || '';
        const hashtagRegex = /#(\w+)/g;
        let match;
        while ((match = hashtagRegex.exec(content)) !== null) {
          validTags.add('#' + match[1].toLowerCase());
        }
      });
      
      // Filter current tags to only include those found in comments
      const updatedTags = currentTags.filter(tag => 
        validTags.has(tag.toLowerCase())
      );
      
      // Update if tags changed
      if (updatedTags.length !== currentTags.length) {
        console.log(`Post ${postId}: Removing orphaned tags`);
        console.log(`  Before: ${currentTags.join(', ')}`);
        console.log(`  After: ${updatedTags.join(', ') || '(none)'}`);
        
        await client.query(`
          UPDATE posts 
          SET tags = $1 
          WHERE id = $2
        `, [updatedTags.length > 0 ? updatedTags : null, postId]);
        
        totalFixed++;
      }
    }
    
    // Step 3: Clean up the normalized tags table
    const deleteResult = await client.query(`
      DELETE FROM tags 
      WHERE name NOT IN (
        SELECT DISTINCT UNNEST(tags)
        FROM posts 
        WHERE tags IS NOT NULL 
          AND array_length(tags, 1) > 0
      )
      RETURNING name
    `);
    
    if (deleteResult.rows.length > 0) {
      console.log(`Deleted ${deleteResult.rows.length} unused tags from tags table:`, 
        deleteResult.rows.map(r => r.name).join(', '));
    }
    
    // Step 4: Update usage counts
    const updateResult = await client.query(`
      UPDATE tags t
      SET usage_count = (
        SELECT COUNT(DISTINCT p.id)
        FROM posts p
        WHERE t.name = ANY(p.tags)
      )
      WHERE EXISTS (
        SELECT 1 FROM posts p WHERE t.name = ANY(p.tags)
      )
      RETURNING name, usage_count
    `);
    
    console.log(`Updated usage counts for ${updateResult.rows.length} tags`);
    
    await client.query('COMMIT');
    console.log(`\nCleanup completed! Fixed ${totalFixed} posts with orphaned tags.`);
    
    // Show current tag status
    const tagsResult = await client.query(`
      SELECT 
        UNNEST(tags) as tag,
        COUNT(*) as count
      FROM posts 
      WHERE tags IS NOT NULL 
        AND array_length(tags, 1) > 0
      GROUP BY tag
      ORDER BY count DESC
      LIMIT 10
    `);
    
    if (tagsResult.rows.length > 0) {
      console.log('\nTop tags after cleanup:');
      tagsResult.rows.forEach((row, i) => {
        console.log(`${i + 1}. ${row.tag} (${row.count} posts)`);
      });
    } else {
      console.log('\nNo tags found in posts after cleanup.');
    }
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error during cleanup:', error);
    throw error;
  } finally {
    client.release();
    process.exit(0);
  }
}

// Run the cleanup
fixOrphanedTags().catch(console.error);