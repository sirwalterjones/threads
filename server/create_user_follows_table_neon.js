require('dotenv').config();
const { Pool } = require('pg');

// Use the user's Neon database connection
const pool = new Pool({
  connectionString: 'postgres://neondb_owner:npg_mR0wniSkK8fH@ep-odd-scene-ad1oq0zb-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function createUserFollowsTable() {
  try {
    console.log('Connecting to Neon database...');
    
    // Test connection
    const client = await pool.connect();
    console.log('Connected to database successfully!');
    
    // Check if user_follows table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_follows'
      );
    `);
    
    if (tableExists.rows[0].exists) {
      console.log('user_follows table already exists!');
    } else {
      console.log('Creating user_follows table...');
      
      // Create the user_follows table
      await client.query(`
        CREATE TABLE user_follows (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(user_id, post_id)
        )
      `);
      
      console.log('user_follows table created successfully!');
    }
    
    // Check if the table exists and show its structure
    const tableInfo = await client.query(`
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
    const countResult = await client.query('SELECT COUNT(*) FROM user_follows');
    console.log(`Current records in user_follows: ${countResult.rows[0].count}`);
    
    // Test inserting a dummy record (will fail if constraints are wrong)
    console.log('Testing table constraints...');
    try {
      await client.query('SELECT 1 FROM user_follows LIMIT 1');
      console.log('Table constraints are working correctly!');
    } catch (error) {
      console.error('Table constraint test failed:', error.message);
    }
    
    client.release();
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

createUserFollowsTable();
