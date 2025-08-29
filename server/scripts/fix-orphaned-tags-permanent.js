const { pool } = require('../config/database');

async function cleanupOrphanedTags() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('🧹 Starting permanent fix for orphaned tags...');
    
    // 1. Clean up orphaned post_tags entries (posts that don't exist)
    const orphanedPostTags = await client.query(`
      DELETE FROM post_tags 
      WHERE post_id NOT IN (SELECT id FROM posts)
      RETURNING post_id, tag_id
    `);
    console.log(`✅ Removed ${orphanedPostTags.rowCount} orphaned post_tags entries`);
    
    // 2. Comments don't have tags - skip this step
    console.log('✅ Comments do not have tags - skipping comment tag cleanup');
    
    // 3. Delete tags that have no associations at all
    const unusedTags = await client.query(`
      DELETE FROM tags 
      WHERE id NOT IN (
        SELECT DISTINCT tag_id FROM post_tags
      )
      RETURNING id, name
    `);
    
    if (unusedTags.rowCount > 0) {
      console.log(`✅ Removed ${unusedTags.rowCount} unused tags:`);
      unusedTags.rows.forEach(tag => {
        console.log(`   - ${tag.name} (ID: ${tag.id})`);
      });
    } else {
      console.log('✅ No unused tags found');
    }
    
    // 4. Add triggers to prevent future orphaned tags
    
    // Drop existing triggers if they exist
    await client.query(`
      DROP TRIGGER IF EXISTS cleanup_post_tags_on_delete ON posts;
      DROP TRIGGER IF EXISTS cleanup_comment_tags_on_delete ON comments;
      DROP TRIGGER IF EXISTS cleanup_unused_tags ON post_tags;
    `);
    
    // Create function to clean up post tags when a post is deleted
    await client.query(`
      CREATE OR REPLACE FUNCTION cleanup_post_tags()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Delete associated post_tags entries
        DELETE FROM post_tags WHERE post_id = OLD.id;
        
        -- Clean up tags that are now unused
        DELETE FROM tags 
        WHERE id NOT IN (
          SELECT DISTINCT tag_id FROM post_tags
        );
        
        RETURN OLD;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    // Create function to clean up comment tags when a comment is deleted
    await client.query(`
      CREATE OR REPLACE FUNCTION cleanup_comment_tags()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Comments use tags array, no separate table to clean
        -- Just ensure tags array is cleared (already handled by DELETE)
        
        -- Clean up tags that are now unused  
        DELETE FROM tags 
        WHERE id NOT IN (
          SELECT DISTINCT tag_id FROM post_tags
        );
        
        RETURN OLD;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    // Create triggers
    await client.query(`
      CREATE TRIGGER cleanup_post_tags_on_delete
      BEFORE DELETE ON posts
      FOR EACH ROW
      EXECUTE FUNCTION cleanup_post_tags();
    `);
    
    await client.query(`
      CREATE TRIGGER cleanup_comment_tags_on_delete
      BEFORE DELETE ON comments
      FOR EACH ROW
      EXECUTE FUNCTION cleanup_comment_tags();
    `);
    
    console.log('✅ Created database triggers to prevent future orphaned tags');
    
    // 5. Add foreign key constraints with CASCADE DELETE for extra safety
    // First, check if constraints already exist
    const constraintsExist = await client.query(`
      SELECT COUNT(*) FROM information_schema.table_constraints 
      WHERE constraint_name = 'post_tags_post_id_fkey_cascade'
    `);
    
    if (constraintsExist.rows[0].count == 0) {
      // Drop existing foreign key constraints if they exist
      await client.query(`
        ALTER TABLE post_tags 
        DROP CONSTRAINT IF EXISTS post_tags_post_id_fkey;
      `);
      
      // Add new constraints with CASCADE DELETE
      await client.query(`
        ALTER TABLE post_tags 
        ADD CONSTRAINT post_tags_post_id_fkey_cascade 
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;
      `);
      
      console.log('✅ Added CASCADE DELETE constraints to prevent orphaned tag associations');
    }
    
    // 6. Verify the fix
    const remainingOrphans = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM post_tags WHERE post_id NOT IN (SELECT id FROM posts)) as orphaned_post_tags,
        (SELECT COUNT(*) FROM tags WHERE id NOT IN (
          SELECT DISTINCT tag_id FROM post_tags
        )) as unused_tags
    `);
    
    console.log('\n📊 Final verification:');
    console.log('   Orphaned post_tags:', remainingOrphans.rows[0].orphaned_post_tags);
    console.log('   Unused tags:', remainingOrphans.rows[0].unused_tags);
    
    await client.query('COMMIT');
    console.log('\n✅ Permanent fix for orphaned tags completed successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error applying permanent fix:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run if called directly
if (require.main === module) {
  cleanupOrphanedTags()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { cleanupOrphanedTags };