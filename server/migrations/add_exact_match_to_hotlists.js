const { Pool } = require('pg');

// Database configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function migrate() {
  try {
    console.log('🔄 Starting migration: Adding exact_match column to hot_lists table...');
    
    // Check if column already exists
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'hot_lists' AND column_name = 'exact_match'
    `);
    
    if (checkColumn.rows.length > 0) {
      console.log('✅ Column exact_match already exists in hot_lists table');
      return;
    }
    
    // Add the exact_match column with default value false
    await pool.query(`
      ALTER TABLE hot_lists 
      ADD COLUMN exact_match BOOLEAN NOT NULL DEFAULT false
    `);
    
    console.log('✅ Successfully added exact_match column to hot_lists table');
    
    // Update existing hot lists to have exact_match = false (word-based matching)
    const updateResult = await pool.query(`
      UPDATE hot_lists 
      SET exact_match = false 
      WHERE exact_match IS NULL
    `);
    
    console.log(`✅ Updated ${updateResult.rowCount} existing hot lists to use word-based matching`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run migration if called directly
if (require.main === module) {
  migrate()
    .then(() => {
      console.log('🎉 Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrate };
