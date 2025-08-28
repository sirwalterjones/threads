const { pool } = require('./config/database');

/**
 * Remove test data from CJIS tables
 */
async function removeTestData() {
  const client = await pool.connect();
  
  try {
    console.log('🧹 Removing test data from CJIS tables...');
    
    await client.query('BEGIN');
    
    // Remove test audit logs (those with generic usernames we created)
    console.log('Cleaning audit logs...');
    await client.query(`
      DELETE FROM cjis_audit_log 
      WHERE username IN ('admin', 'analyst', 'supervisor')
      AND user_id IS NULL
      AND timestamp >= NOW() - INTERVAL '5 hours'
    `);
    
    // Remove test security alerts we created
    console.log('Cleaning security alerts...');
    await client.query(`
      DELETE FROM security_alerts 
      WHERE created_at >= NOW() - INTERVAL '3 hours'
      AND description IN (
        'Successful login from admin user',
        'Multiple failed login attempts detected',
        'Unusual data access pattern detected - potential data exfiltration',
        'Active brute force attack in progress'
      )
    `);
    
    // Remove test security incidents
    console.log('Cleaning security incidents...');
    await client.query(`
      DELETE FROM security_incidents 
      WHERE title IN (
        'Brute Force Attack Blocked',
        'Unusual Data Access Pattern'
      )
      AND detected_at >= NOW() - INTERVAL '2 days'
    `);
    
    // Remove test security metrics (keep only the most recent real one if any)
    console.log('Cleaning security metrics...');
    await client.query(`
      DELETE FROM security_metrics 
      WHERE metrics::text LIKE '%"events_today": 12%'
      AND timestamp >= NOW() - INTERVAL '1 hour'
    `);
    
    await client.query('COMMIT');
    
    console.log('✅ Test data removed successfully!');
    
    // Display what remains
    const metrics = await client.query('SELECT COUNT(*) FROM security_metrics');
    const alerts = await client.query('SELECT COUNT(*) FROM security_alerts');
    const incidents = await client.query('SELECT COUNT(*) FROM security_incidents');
    const audit = await client.query('SELECT COUNT(*) FROM cjis_audit_log');
    
    console.log('\n📊 Remaining Data:');
    console.log(`  Security Metrics: ${metrics.rows[0].count}`);
    console.log(`  Security Alerts: ${alerts.rows[0].count}`);
    console.log(`  Security Incidents: ${incidents.rows[0].count}`);
    console.log(`  Audit Log Entries: ${audit.rows[0].count}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error removing test data:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

// Run if executed directly
if (require.main === module) {
  removeTestData()
    .then(() => {
      console.log('\n🎉 Test data cleaned! Dashboard will now show only real security events.');
      process.exit(0);
    })
    .catch(error => {
      console.error('Failed to remove test data:', error.message);
      process.exit(1);
    });
}

module.exports = { removeTestData };