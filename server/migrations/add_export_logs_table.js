const { pool } = require('../config/database');

async function createExportLogsTable() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Create export_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS export_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        export_type VARCHAR(50) NOT NULL DEFAULT 'pdf',
        post_ids INTEGER[] NOT NULL,
        post_count INTEGER NOT NULL,
        file_name VARCHAR(255),
        file_size INTEGER,
        export_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        ip_address VARCHAR(45),
        user_agent TEXT,
        export_options JSONB,
        status VARCHAR(20) DEFAULT 'success',
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for better query performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_export_logs_user_id ON export_logs(user_id);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_export_logs_export_date ON export_logs(export_date DESC);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_export_logs_status ON export_logs(status);
    `);

    await client.query('COMMIT');
    console.log('Export logs table created successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating export logs table:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run migration
if (require.main === module) {
  createExportLogsTable()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { createExportLogsTable };