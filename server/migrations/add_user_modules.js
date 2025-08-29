const { pool } = require('../config/database');

async function addUserModules() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('🔧 Adding modules system to users table...');
    
    // Add modules column to users table
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS modules JSONB DEFAULT '{"search": true, "hotlist": true, "bolo": true, "intel": true}'::jsonb
    `);
    
    console.log('✅ Added modules column to users table');
    
    // Update existing users to have all modules enabled by default
    await client.query(`
      UPDATE users 
      SET modules = '{"search": true, "hotlist": true, "bolo": true, "intel": true}'::jsonb 
      WHERE modules IS NULL
    `);
    
    console.log('✅ Updated existing users with default module access');
    
    // Add index for better query performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_modules ON users USING GIN (modules);
    `);
    
    console.log('✅ Added index for modules column');
    
    await client.query('COMMIT');
    console.log('✅ Module system migration completed successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error adding module system:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run if called directly
if (require.main === module) {
  addUserModules()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { addUserModules };