const { pool } = require('./config/database');

/**
 * Initialize CJIS system with sample data for testing
 */
async function initializeCJISData() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Initializing CJIS security data...');
    
    await client.query('BEGIN');
    
    // 1. Initialize security metrics
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
          "failed_logins": 3,
          "data_access_events": 45,
          "configuration_changes": 2,
          "security_alerts": 3
        }'
      )
      ON CONFLICT DO NOTHING
    `);
    
    // 2. Create some security alerts
    console.log('Creating security alerts...');
    await client.query(`
      INSERT INTO security_alerts (
        alert_type, severity, description, user_id, 
        ip_address, metadata, status, created_at
      ) VALUES 
      (
        'AUTHENTICATION_SUCCESS', 'INFO', 
        'Successful login from admin user', 1,
        '127.0.0.1', '{"user_agent": "Mozilla/5.0"}', 
        'acknowledged', NOW() - INTERVAL '2 hours'
      ),
      (
        'FAILED_LOGIN_ATTEMPT', 'MEDIUM', 
        'Multiple failed login attempts detected', NULL,
        '192.168.1.100', '{"attempts": 3, "username": "testuser"}', 
        'open', NOW() - INTERVAL '30 minutes'
      ),
      (
        'DATA_ACCESS', 'LOW', 
        'Sensitive data accessed by authorized user', 2,
        '10.0.0.50', '{"resource": "user_profiles", "action": "READ"}', 
        'acknowledged', NOW() - INTERVAL '1 hour'
      )
      ON CONFLICT DO NOTHING
    `);
    
    // 3. Create sample security incidents
    console.log('Creating security incidents...');
    await client.query(`
      INSERT INTO security_incidents (
        incident_type, severity, status, description, 
        affected_users, affected_systems, detection_method,
        created_at, metadata
      ) VALUES 
      (
        'brute_force', 'high', 'resolved',
        'Brute force attack detected and blocked',
        ARRAY[1], ARRAY['auth_service'],
        'automated', NOW() - INTERVAL '1 day',
        '{"source_ip": "203.0.113.0", "attempts": 50}'
      ),
      (
        'suspicious_access', 'medium', 'investigating',
        'Unusual data access pattern detected',
        ARRAY[2], ARRAY['database'],
        'anomaly_detection', NOW() - INTERVAL '3 hours',
        '{"query_count": 1000, "data_volume": "50MB"}'
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
        'USER_LOGIN', 'LOGIN', 1, 'admin',
        'authentication', NULL, 'public',
        'success', '127.0.0.1', 'Mozilla/5.0',
        NOW() - INTERVAL '4 hours',
        '{"method": "password", "mfa": true}'
      ),
      (
        'DATA_ACCESS', 'READ', 2, 'analyst',
        'intel_report', '123', 'cji',
        'success', '10.0.0.100', 'Chrome/120.0',
        NOW() - INTERVAL '2 hours',
        '{"report_type": "threat_assessment"}'
      ),
      (
        'CONFIGURATION_CHANGE', 'UPDATE', 1, 'admin',
        'system_config', 'security_settings', 'sensitive',
        'success', '127.0.0.1', 'Mozilla/5.0',
        NOW() - INTERVAL '1 hour',
        '{"setting": "password_policy", "old_value": "12", "new_value": "14"}'
      ),
      (
        'USER_MANAGEMENT', 'CREATE', 1, 'admin',
        'user_account', '456', 'sensitive',
        'success', '127.0.0.1', 'Mozilla/5.0',
        NOW() - INTERVAL '30 minutes',
        '{"new_user": "newanalyst", "role": "analyst"}'
      ),
      (
        'REPORT_GENERATION', 'EXPORT', 3, 'supervisor',
        'compliance_report', '789', 'cji',
        'success', '192.168.1.50', 'Safari/17.0',
        NOW() - INTERVAL '15 minutes',
        '{"report_type": "monthly_compliance", "format": "pdf"}'
      )
      ON CONFLICT DO NOTHING
    `);
    
    // 5. Initialize compliance data
    console.log('Creating compliance data...');
    
    // Create personnel security records
    await client.query(`
      INSERT INTO personnel_security (
        user_id, full_name, position, clearance_level,
        background_check_date, fingerprint_date,
        security_training_date, access_authorization_date,
        last_review_date, employment_status, created_at
      ) VALUES 
      (
        1, 'Admin User', 'System Administrator', 'SECRET',
        NOW() - INTERVAL '1 year', NOW() - INTERVAL '1 year',
        NOW() - INTERVAL '1 month', NOW() - INTERVAL '11 months',
        NOW() - INTERVAL '1 week', 'active', NOW() - INTERVAL '1 year'
      ),
      (
        2, 'Analyst User', 'Intelligence Analyst', 'SECRET',
        NOW() - INTERVAL '6 months', NOW() - INTERVAL '6 months',
        NOW() - INTERVAL '2 weeks', NOW() - INTERVAL '5 months',
        NOW() - INTERVAL '3 days', 'active', NOW() - INTERVAL '6 months'
      )
      ON CONFLICT (user_id) DO NOTHING
    `);
    
    // Create training modules
    await client.query(`
      INSERT INTO security_training_modules (
        module_name, category, description, duration_hours,
        passing_score, max_attempts, expiry_days,
        is_mandatory, created_at
      ) VALUES 
      (
        'CJIS Security Awareness', 'security_awareness',
        'Basic security awareness training for CJIS compliance',
        2, 80, 3, 365, true, NOW()
      ),
      (
        'Incident Response Procedures', 'incident_response',
        'How to identify and respond to security incidents',
        1, 85, 3, 180, true, NOW()
      ),
      (
        'Data Protection and Privacy', 'privacy',
        'Understanding CJI data protection requirements',
        1.5, 80, 3, 365, true, NOW()
      )
      ON CONFLICT DO NOTHING
    `);
    
    // Create configuration baseline
    await client.query(`
      INSERT INTO configuration_baseline (
        config_name, config_type, config_value,
        is_compliant, last_checked, created_at
      ) VALUES 
      (
        'password_min_length', 'security', '14',
        true, NOW(), NOW()
      ),
      (
        'session_timeout', 'security', '30',
        true, NOW(), NOW()
      ),
      (
        'mfa_enabled', 'authentication', 'true',
        true, NOW(), NOW()
      ),
      (
        'encryption_algorithm', 'encryption', 'AES-256-GCM',
        true, NOW(), NOW()
      ),
      (
        'audit_retention_years', 'compliance', '7',
        true, NOW(), NOW()
      )
      ON CONFLICT DO NOTHING
    `);
    
    // Update incident response statistics
    await client.query(`
      INSERT INTO incident_response (
        incident_id, response_phase, actions_taken,
        resources_involved, evidence_collected,
        timestamp, metadata
      )
      SELECT 
        id, 'recovery', 
        ARRAY['Blocked IP address', 'Reset affected passwords', 'Updated firewall rules'],
        ARRAY['security_team', 'network_admin'],
        '{"logs": "auth.log", "screenshots": 5}',
        NOW() - INTERVAL '12 hours',
        '{"recovery_time": "45 minutes"}'
      FROM security_incidents
      WHERE incident_type = 'brute_force'
      LIMIT 1
      ON CONFLICT DO NOTHING
    `);
    
    await client.query('COMMIT');
    
    console.log('✅ CJIS data initialized successfully!');
    
    // Display summary
    const metrics = await client.query('SELECT COUNT(*) FROM security_metrics');
    const alerts = await client.query('SELECT COUNT(*) FROM security_alerts');
    const incidents = await client.query('SELECT COUNT(*) FROM security_incidents');
    const audit = await client.query('SELECT COUNT(*) FROM cjis_audit_log');
    const personnel = await client.query('SELECT COUNT(*) FROM personnel_security');
    const training = await client.query('SELECT COUNT(*) FROM security_training_modules');
    const config = await client.query('SELECT COUNT(*) FROM configuration_baseline');
    
    console.log('\n📊 Data Summary:');
    console.log(`  Security Metrics: ${metrics.rows[0].count}`);
    console.log(`  Security Alerts: ${alerts.rows[0].count}`);
    console.log(`  Security Incidents: ${incidents.rows[0].count}`);
    console.log(`  Audit Log Entries: ${audit.rows[0].count}`);
    console.log(`  Personnel Records: ${personnel.rows[0].count}`);
    console.log(`  Training Modules: ${training.rows[0].count}`);
    console.log(`  Configuration Items: ${config.rows[0].count}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error initializing CJIS data:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run if executed directly
if (require.main === module) {
  initializeCJISData()
    .then(() => {
      console.log('\n🎉 CJIS system ready for testing!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Failed to initialize:', error);
      process.exit(1);
    });
}

module.exports = { initializeCJISData };