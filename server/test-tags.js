const { pool } = require('./config/database');

async function testTags() {
  console.log('Testing tags functionality...');
  
  try {
    // Test 1: Check if tags column exists
    const schemaResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'posts' AND column_name = 'tags'
    `);
    console.log('\n1. Tags column:', schemaResult.rows[0]);
    
    // Test 2: Check posts with tags
    const postsWithTags = await pool.query(`
      SELECT id, title, tags 
      FROM posts 
      WHERE tags IS NOT NULL AND array_length(tags, 1) > 0 
      LIMIT 3
    `);
    console.log('\n2. Posts with tags:', postsWithTags.rows);
    
    // Test 3: Check if our query includes tags
    const testQuery = await pool.query(`
      SELECT 
        p.id, p.title, COALESCE(p.tags, '{}') as tags
      FROM posts p
      WHERE p.id = 77436
    `);
    console.log('\n3. Test post query:', testQuery.rows[0]);
    
    // Test 4: Check what p.* returns
    const starQuery = await pool.query(`
      SELECT p.*
      FROM posts p
      WHERE p.id = 77436
    `);
    console.log('\n4. Post columns returned by p.*:', Object.keys(starQuery.rows[0]));
    console.log('   Tags value:', starQuery.rows[0].tags);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testTags();