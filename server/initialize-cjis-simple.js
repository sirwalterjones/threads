const { pool } = require('./config/database');

/**
 * Simple CJIS data initialization for dashboard testing
 */
async function initializeCJISData() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Initializing CJIS security data...');
    
    await client.query('BEGIN');
    
    // 1. Initialize security metrics (single record)
    console.log('Creating security metrics...');
    await client.query(`
      INSERT INTO security_metrics (
        timestamp, system_health, active_threats, active_incidents,
        failed_logins_24h, suspicious_activities_24h, compliance_score, metrics
      ) VALUES (
        NOW(), 'normal', 0, 2, 3, 1, 85.5,
        '{
          "events_today": 12,
          "active_users": 5,
          "active_sessions": 8,
          "failed_logins": 3
        }'::jsonb
      )
      ON CONFLICT DO NOTHING
    `);
    
    // 2. Create security alerts (simplified)
    console.log('Creating security alerts...');
    await client.query(`
      INSERT INTO security_alerts (
        alert_type, severity, status, description, metadata, created_at
      ) VALUES 
      (
        'AUTHENTICATION_SUCCESS', 'LOW', 'resolved',
        'Successful login from admin user',
        '{"ip_address": "127.0.0.1", "user_agent": "Mozilla/5.0"}'::jsonb,
        NOW() - INTERVAL '2 hours'
      ),
      (
        'FAILED_LOGIN_ATTEMPT', 'MEDIUM', 'acknowledged',
        'Multiple failed login attempts detected',
        '{"ip_address": "192.168.1.100", "attempts": 3}'::jsonb,
        NOW() - INTERVAL '30 minutes'
      ),
      (
        'SUSPICIOUS_DATA_ACCESS', 'HIGH', 'new',
        'Unusual data access pattern detected - potential data exfiltration',
        '{"ip_address": "10.0.0.50", "resource": "user_profiles", "volume": "large"}'::jsonb,
        NOW() - INTERVAL '1 hour'
      ),
      (
        'BRUTE_FORCE_DETECTED', 'CRITICAL', 'new',
        'Active brute force attack in progress',
        '{"ip_address": "203.0.113.42", "attempts": 150, "target": "admin"}'::jsonb,
        NOW() - INTERVAL '10 minutes'
      )
      ON CONFLICT DO NOTHING
    `);
    
    // 3. Create security incidents
    console.log('Creating security incidents...');
    await client.query(`
      INSERT INTO security_incidents (
        incident_type, severity, status, title, description,
        affected_user_ids, detected_at, created_at, metadata
      ) VALUES 
      (
        'brute_force', 'high', 'resolved',
        'Brute Force Attack Blocked',
        'Automated system detected and blocked a brute force attack targeting admin accounts',
        ARRAY[1], NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day',
        '{"source_ip": "203.0.113.0", "attempts": 50, "detection_method": "automated"}'::jsonb
      ),
      (
        'suspicious_access', 'medium', 'investigating',
        'Unusual Data Access Pattern',
        'Anomaly detection identified suspicious database query patterns',
        ARRAY[2], NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours',
        '{"query_count": 1000, "data_volume": "50MB", "detection_method": "anomaly_detection"}'::jsonb
      )
      ON CONFLICT DO NOTHING
    `);
    
    // 4. Add audit log entries
    console.log('Creating audit log entries...');
    await client.query(`
      INSERT INTO cjis_audit_log (
        event_type, action, user_id, username,
        resource_type, resource_id, data_classification,
        access_result, ip_address, user_agent,
        timestamp, metadata
      ) VALUES 
      (
        'USER_LOGIN', 'LOGIN', NULL, 'admin',
        'authentication', NULL, 'public',
        'granted', '127.0.0.1', 'Mozilla/5.0',
        NOW() - INTERVAL '4 hours',
        '{"method": "password", "mfa": true}'::jsonb
      ),
      (
        'DATA_ACCESS', 'READ', NULL, 'analyst',
        'intel_report', '123', 'cji',
        'granted', '10.0.0.100', 'Chrome/120.0',
        NOW() - INTERVAL '2 hours',
        '{"report_type": "threat_assessment"}'::jsonb
      ),
      (
        'CONFIGURATION_CHANGE', 'UPDATE', NULL, 'admin',
        'system_config', 'security_settings', 'sensitive',
        'granted', '127.0.0.1', 'Mozilla/5.0',
        NOW() - INTERVAL '1 hour',
        '{"setting": "password_policy"}'::jsonb
      ),
      (
        'USER_MANAGEMENT', 'CREATE', NULL, 'admin',
        'user_account', '456', 'sensitive',
        'granted', '127.0.0.1', 'Mozilla/5.0',
        NOW() - INTERVAL '30 minutes',
        '{"new_user": "newanalyst", "role": "analyst"}'::jsonb
      ),
      (
        'REPORT_GENERATION', 'EXPORT', NULL, 'supervisor',
        'compliance_report', '789', 'cji',
        'granted', '192.168.1.50', 'Safari/17.0',
        NOW() - INTERVAL '15 minutes',
        '{"report_type": "monthly_compliance", "format": "pdf"}'::jsonb
      )
      ON CONFLICT DO NOTHING
    `);
    
    await client.query('COMMIT');
    
    console.log('✅ CJIS data initialized successfully!');
    
    // Display summary
    const metrics = await client.query('SELECT COUNT(*) FROM security_metrics');
    const alerts = await client.query('SELECT COUNT(*) FROM security_alerts');
    const incidents = await client.query('SELECT COUNT(*) FROM security_incidents');
    const audit = await client.query('SELECT COUNT(*) FROM cjis_audit_log');
    
    console.log('\n📊 Data Summary:');
    console.log(`  Security Metrics: ${metrics.rows[0].count}`);
    console.log(`  Security Alerts: ${alerts.rows[0].count}`);
    console.log(`  Security Incidents: ${incidents.rows[0].count}`);
    console.log(`  Audit Log Entries: ${audit.rows[0].count}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error initializing CJIS data:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

// Run if executed directly
if (require.main === module) {
  initializeCJISData()
    .then(() => {
      console.log('\n🎉 CJIS dashboard data ready!');
      console.log('👉 Visit /security in your browser to see the dashboard');
      process.exit(0);
    })
    .catch(error => {
      console.error('Failed to initialize:', error.message);
      process.exit(1);
    });
}

module.exports = { initializeCJISData };