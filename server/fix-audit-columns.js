const { pool } = require('./config/database');

async function fixAuditColumns() {
  try {
    console.log('Adding missing columns to cjis_audit_log table...');
    
    await pool.query(`
      ALTER TABLE cjis_audit_log
      ADD COLUMN IF NOT EXISTS username VARCHAR(255)
    `);
    
    console.log('✅ Column added successfully');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

fixAuditColumns();