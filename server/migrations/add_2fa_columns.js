require('dotenv').config();
const { pool } = require('../config/database');

async function addTwoFactorColumns() {
  try {
    console.log('Adding 2FA columns to users table...');
    
    // Add 2FA columns if they don't exist
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(255),
      ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS totp_backup_codes TEXT[],
      ADD COLUMN IF NOT EXISTS force_2fa_setup BOOLEAN DEFAULT true;
    `);
    
    console.log('2FA columns added successfully');
    console.log('Columns added: totp_secret, totp_enabled, totp_backup_codes, force_2fa_setup');
    
  } catch (error) {
    console.error('Error adding 2FA columns:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run migration if called directly
if (require.main === module) {
  addTwoFactorColumns()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { addTwoFactorColumns };