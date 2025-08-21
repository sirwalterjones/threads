const { Pool } = require('pg');

// Neon database connection
const pool = new Pool({
  connectionString: 'postgres://neondb_owner:npg_mR0wniSkK8fH@ep-odd-scene-ad1oq0zb-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require',
});

async function migrateNeon() {
  try {
    console.log('Connecting to Neon database...');
    
    // Test connection
    const client = await pool.connect();
    console.log('Connected to Neon database successfully');
    
    // Check if is_hidden column exists
    const checkColumn = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'categories' AND column_name = 'is_hidden'
    `);
    
    if (checkColumn.rows.length > 0) {
      console.log('is_hidden column already exists in categories table');
    } else {
      // Add the is_hidden column
      await client.query(`
        ALTER TABLE categories 
        ADD COLUMN is_hidden BOOLEAN DEFAULT false
      `);
      console.log('Successfully added is_hidden column to categories table');
    }
    
    // Update existing categories to be visible by default
    const updateResult = await client.query(`
      UPDATE categories 
      SET is_hidden = false 
      WHERE is_hidden IS NULL
    `);
    console.log(`Updated ${updateResult.rowCount} categories to be visible by default`);
    
    // Check how many categories exist
    const countResult = await client.query('SELECT COUNT(*) as count FROM categories');
    console.log(`Total categories in database: ${countResult.rows[0].count}`);
    
    // Show a sample of categories
    const sampleResult = await client.query('SELECT id, name, slug, is_hidden FROM categories LIMIT 5');
    console.log('Sample categories:');
    sampleResult.rows.forEach(cat => {
      console.log(`  ID: ${cat.id}, Name: ${cat.name}, Slug: ${cat.slug}, Hidden: ${cat.is_hidden}`);
    });
    
    client.release();
    console.log('Migration completed successfully');
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the migration
migrateNeon()
  .then(() => {
    console.log('Neon migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Neon migration failed:', error);
    process.exit(1);
  });
