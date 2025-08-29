const { pool } = require('../config/database');

async function cleanupStaleTags() {
  const client = await pool.connect();
  
  try {
    console.log('Starting tag cleanup...');
    
    await client.query('BEGIN');
    
    // Step 1: Get all unique tags from posts that actually exist
    const validTagsResult = await client.query(`
      SELECT DISTINCT UNNEST(tags) as tag
      FROM posts 
      WHERE tags IS NOT NULL 
        AND array_length(tags, 1) > 0
        AND id IN (SELECT id FROM posts)
    `);
    
    const validTags = new Set(validTagsResult.rows.map(r => r.tag.toLowerCase()));
    console.log(`Found ${validTags.size} valid tags in use`);
    
    // Step 2: Clean up the normalized tags table
    // Remove tags that don't exist in any post
    const deleteResult = await client.query(`
      DELETE FROM tags 
      WHERE LOWER(name) NOT IN (
        SELECT DISTINCT LOWER(UNNEST(tags))
        FROM posts 
        WHERE tags IS NOT NULL 
          AND array_length(tags, 1) > 0
      )
      RETURNING name
    `);
    
    console.log(`Deleted ${deleteResult.rows.length} stale tags from tags table:`, 
      deleteResult.rows.map(r => r.name));
    
    // Step 3: Clean up post_tags associations
    const cleanAssocResult = await client.query(`
      DELETE FROM post_tags 
      WHERE post_id NOT IN (SELECT id FROM posts)
      RETURNING *
    `);
    
    console.log(`Deleted ${cleanAssocResult.rows.length} orphaned post_tags associations`);
    
    // Step 4: Update usage counts for remaining tags
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
    
    // Step 5: Remove tags with zero usage count
    const zeroUsageResult = await client.query(`
      DELETE FROM tags 
      WHERE usage_count = 0 OR usage_count IS NULL
      RETURNING name
    `);
    
    console.log(`Deleted ${zeroUsageResult.rows.length} tags with zero usage`);
    
    await client.query('COMMIT');
    console.log('Tag cleanup completed successfully!');
    
    // Show current popular tags
    const popularResult = await client.query(`
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
    
    console.log('\nTop 10 tags after cleanup:');
    popularResult.rows.forEach((row, i) => {
      console.log(`${i + 1}. ${row.tag} (${row.count} posts)`);
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error during tag cleanup:', error);
    throw error;
  } finally {
    client.release();
    process.exit(0);
  }
}

// Run the cleanup
cleanupStaleTags().catch(console.error);