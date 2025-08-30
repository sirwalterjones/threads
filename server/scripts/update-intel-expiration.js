const { pool } = require('../config/database');

async function updateIntelReportsExpiration() {
  const client = await pool.connect();
  
  try {
    console.log('Starting Intel Reports expiration update...');
    
    // Begin transaction
    await client.query('BEGIN');
    
    // Update all existing Intel Reports to have 5-year expiration from their creation date
    const updateQuery = `
      UPDATE intel_reports 
      SET expires_at = created_at + INTERVAL '5 years'
      WHERE expires_at IS NULL 
         OR expires_at != created_at + INTERVAL '5 years'
      RETURNING id, intel_number, created_at, expires_at
    `;
    
    const result = await client.query(updateQuery);
    
    console.log(`Updated ${result.rowCount} Intel Reports with 5-year expiration`);
    
    if (result.rowCount > 0) {
      console.log('Sample of updated reports:');
      result.rows.slice(0, 5).forEach(report => {
        console.log(`  - Intel #${report.intel_number}: Created ${report.created_at.toISOString().split('T')[0]}, Expires ${report.expires_at.toISOString().split('T')[0]}`);
      });
    }
    
    // Also update any Intel Reports that might have been created with shorter expiration
    const fixQuery = `
      UPDATE intel_reports 
      SET expires_at = created_at + INTERVAL '5 years'
      WHERE expires_at < created_at + INTERVAL '5 years'
      RETURNING id, intel_number
    `;
    
    const fixResult = await client.query(fixQuery);
    
    if (fixResult.rowCount > 0) {
      console.log(`\nFixed ${fixResult.rowCount} Intel Reports that had shorter expiration periods`);
    }
    
    // Check how many reports are now set to expire in different time periods
    const statsQuery = `
      SELECT 
        COUNT(CASE WHEN expires_at <= NOW() THEN 1 END) as already_expired,
        COUNT(CASE WHEN expires_at > NOW() AND expires_at <= NOW() + INTERVAL '30 days' THEN 1 END) as expires_30_days,
        COUNT(CASE WHEN expires_at > NOW() + INTERVAL '30 days' AND expires_at <= NOW() + INTERVAL '1 year' THEN 1 END) as expires_1_year,
        COUNT(CASE WHEN expires_at > NOW() + INTERVAL '1 year' THEN 1 END) as expires_after_1_year,
        COUNT(*) as total
      FROM intel_reports
    `;
    
    const stats = await client.query(statsQuery);
    
    console.log('\n=== Intel Reports Expiration Statistics ===');
    console.log(`Total Intel Reports: ${stats.rows[0].total}`);
    console.log(`Already Expired: ${stats.rows[0].already_expired}`);
    console.log(`Expiring in 30 days: ${stats.rows[0].expires_30_days}`);
    console.log(`Expiring in 1 year: ${stats.rows[0].expires_1_year}`);
    console.log(`Expiring after 1 year: ${stats.rows[0].expires_after_1_year}`);
    
    // Commit the transaction
    await client.query('COMMIT');
    console.log('\n✅ Successfully updated all Intel Reports expiration dates');
    
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('❌ Error updating Intel Reports expiration:', error);
    throw error;
  } finally {
    client.release();
    process.exit(0);
  }
}

// Run the update
updateIntelReportsExpiration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});