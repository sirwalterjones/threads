const { pool } = require('../config/database');

async function addSessionTimeoutPreference() {
  const client = await pool.connect();
  
  try {
    console.log('Adding session timeout preference to users table...');
    
    await client.query('BEGIN');
    
    // Add session_timeout_minutes column to users table
    // Default to 30 minutes (CJIS standard), max 1440 (24 hours)
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS session_timeout_minutes INTEGER 
      DEFAULT 30 
      CHECK (session_timeout_minutes >= 5 AND session_timeout_minutes <= 1440)
    `);
    
    console.log('Added session_timeout_minutes column to users table');
    
    // Add comment for documentation
    await client.query(`
      COMMENT ON COLUMN users.session_timeout_minutes IS 
      'User-configurable session timeout in minutes. Min: 5, Max: 1440 (24 hours), Default: 30 (CJIS standard)'
    `);
    
    await client.query('COMMIT');
    console.log('Migration completed successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
    process.exit(0);
  }
}

// Run the migration
addSessionTimeoutPreference().catch(console.error);