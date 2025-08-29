const { pool } = require('../config/database');

async function addSessionPreferences() {
  const client = await pool.connect();
  
  try {
    console.log('Adding session preferences to users table...');
    
    await client.query('BEGIN');
    
    // Add session_duration_hours column to users table
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS session_duration_hours INTEGER DEFAULT 24
    `);
    
    // Add constraint to ensure valid duration (between 1 hour and 30 days)
    // First check if constraint exists
    const constraintExists = await client.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'users' 
      AND constraint_name = 'check_session_duration'
    `);
    
    if (constraintExists.rows.length === 0) {
      await client.query(`
        ALTER TABLE users 
        ADD CONSTRAINT check_session_duration 
        CHECK (session_duration_hours >= 1 AND session_duration_hours <= 720)
      `);
    }
    
    console.log('Added session_duration_hours column with default of 24 hours');
    
    // Update existing users to have 24 hour default
    await client.query(`
      UPDATE users 
      SET session_duration_hours = 24 
      WHERE session_duration_hours IS NULL
    `);
    
    await client.query('COMMIT');
    console.log('Session preferences added successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error adding session preferences:', error);
    throw error;
  } finally {
    client.release();
    process.exit(0);
  }
}

addSessionPreferences().catch(console.error);