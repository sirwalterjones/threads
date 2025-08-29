const { pool } = require('../config/database');

async function cleanupOrphanedTags() {
  const client = await pool.connect();
  
  try {
    console.log('Starting orphaned tags cleanup...');
    
    // Begin transaction
    await client.query('BEGIN');
    
    // Find orphaned tags (tags not associated with any posts)
    const orphanedTags = await client.query(`
      SELECT t.id, t.name, t.usage_count
      FROM tags t
      WHERE NOT EXISTS (
        SELECT 1 FROM posts p 
        WHERE t.name = ANY(p.tags)
      )
    `);
    
    console.log(`Found ${orphanedTags.rows.length} orphaned tags`);
    
    if (orphanedTags.rows.length > 0) {
      console.log('Orphaned tags to be removed:');
      orphanedTags.rows.forEach(tag => {
        console.log(`  - ${tag.name} (usage_count: ${tag.usage_count})`);
      });
      
      // Delete orphaned tags
      const deleteResult = await client.query(`
        DELETE FROM tags t
        WHERE NOT EXISTS (
          SELECT 1 FROM posts p 
          WHERE t.name = ANY(p.tags)
        )
        RETURNING name
      `);
      
      console.log(`Deleted ${deleteResult.rows.length} orphaned tags`);
    }
    
    // Recalculate usage counts for remaining tags
    console.log('\nRecalculating tag usage counts...');
    
    // Get all tags with their actual usage
    const tagUsage = await client.query(`
      WITH tag_usage AS (
        SELECT 
          tag_name,
          COUNT(*) as actual_count
        FROM (
          SELECT unnest(tags) as tag_name FROM posts WHERE tags IS NOT NULL
        ) t
        GROUP BY tag_name
      )
      SELECT 
        t.id,
        t.name,
        t.usage_count as current_count,
        COALESCE(tu.actual_count, 0) as actual_count
      FROM tags t
      LEFT JOIN tag_usage tu ON t.name = tu.tag_name
      WHERE t.usage_count != COALESCE(tu.actual_count, 0)
    `);
    
    if (tagUsage.rows.length > 0) {
      console.log(`Found ${tagUsage.rows.length} tags with incorrect usage counts`);
      
      for (const tag of tagUsage.rows) {
        await client.query(
          'UPDATE tags SET usage_count = $1 WHERE id = $2',
          [tag.actual_count, tag.id]
        );
        console.log(`  - Updated ${tag.name}: ${tag.current_count} -> ${tag.actual_count}`);
      }
    } else {
      console.log('All tag usage counts are correct');
    }
    
    // Commit transaction
    await client.query('COMMIT');
    console.log('\nTag cleanup completed successfully!');
    
    // Show final tag stats
    const finalStats = await client.query(`
      SELECT 
        COUNT(*) as total_tags,
        SUM(usage_count) as total_usage,
        MAX(usage_count) as max_usage,
        AVG(usage_count)::numeric(10,2) as avg_usage
      FROM tags
    `);
    
    console.log('\nFinal tag statistics:');
    console.log(`  Total tags: ${finalStats.rows[0].total_tags}`);
    console.log(`  Total usage: ${finalStats.rows[0].total_usage}`);
    console.log(`  Max usage: ${finalStats.rows[0].max_usage}`);
    console.log(`  Average usage: ${finalStats.rows[0].avg_usage}`);
    
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
cleanupOrphanedTags().catch(console.error);