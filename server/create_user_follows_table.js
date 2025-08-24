const { pool } = require('./config/database');

async function createUserFollowsTable() {
  try {
    console.log('Creating user_follows table...');
    
    // Create the user_follows table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_follows (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, post_id)
      )
    `);
    
    console.log('user_follows table created successfully!');
    
    // Check if the table exists and show its structure
    const tableInfo = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'user_follows'
      ORDER BY ordinal_position
    `);
    
    console.log('Table structure:');
    tableInfo.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${row.column_default ? `DEFAULT ${row.column_default}` : ''}`);
    });
    
    // Check if there are any existing records
    const countResult = await pool.query('SELECT COUNT(*) FROM user_follows');
    console.log(`Current records in user_follows: ${countResult.rows[0].count}`);
    
  } catch (error) {
    console.error('Error creating user_follows table:', error);
  } finally {
    await pool.end();
  }
}

createUserFollowsTable();
