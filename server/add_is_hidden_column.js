const { pool } = require('./config/database');

async function addIsHiddenColumn() {
  try {
    console.log('Adding is_hidden column to categories table...');
    
    // Check if column already exists (PostgreSQL)
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'categories' AND column_name = 'is_hidden'
    `);
    
    if (checkColumn.rows.length > 0) {
      console.log('is_hidden column already exists in categories table');
      return;
    }
    
    // Add the is_hidden column
    await pool.query(`
      ALTER TABLE categories 
      ADD COLUMN is_hidden BOOLEAN DEFAULT false
    `);
    
    console.log('Successfully added is_hidden column to categories table');
    
    // Update existing categories to be visible by default
    await pool.query(`
      UPDATE categories 
      SET is_hidden = false 
      WHERE is_hidden IS NULL
    `);
    
    console.log('Updated existing categories to be visible by default');
    
  } catch (error) {
    console.error('Error adding is_hidden column:', error);
    throw error;
  }
}

// Run the migration
addIsHiddenColumn()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
