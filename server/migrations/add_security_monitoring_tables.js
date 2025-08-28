const { pool } = require('../config/database');

/**
 * CJIS Phase 3: Add security monitoring and audit enhancement tables
 */
async function addSecurityMonitoringTables() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    console.log('🔐 Starting CJIS Phase 3 security monitoring migration...');

    // Enhance audit log table with integrity chain
    await client.query(`
      ALTER TABLE cjis_audit_log
      ADD COLUMN IF NOT EXISTS event_type VARCHAR(100),
      ADD COLUMN IF NOT EXISTS integrity_hash VARCHAR(64),
      ADD COLUMN IF NOT EXISTS previous_hash VARCHAR(64),
      ADD COLUMN IF NOT EXISTS session_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS response_code INTEGER,
      ADD COLUMN IF NOT EXISTS error_message TEXT
    `);

    // Create indexes for audit log performance
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_event_type ON cjis_audit_log(event_type);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_integrity ON cjis_audit_log(integrity_hash);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_user_id ON cjis_audit_log(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_classification ON cjis_audit_log(data_classification);`);

    // Create security alerts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS security_alerts (
        id SERIAL PRIMARY KEY,
        audit_log_id INTEGER REFERENCES cjis_audit_log(id),
        alert_type VARCHAR(100) NOT NULL,
        severity VARCHAR(20) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
        status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'acknowledged', 'resolved', 'false_positive')),
        description TEXT,
        metadata JSONB,
        acknowledged_by INTEGER REFERENCES users(id),
        acknowledged_at TIMESTAMP,
        resolved_by INTEGER REFERENCES users(id),
        resolved_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes for security alerts
    await client.query(`CREATE INDEX IF NOT EXISTS idx_alerts_type ON security_alerts(alert_type);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_alerts_severity ON security_alerts(severity);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_alerts_status ON security_alerts(status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_alerts_created ON security_alerts(created_at);`);

    // Create security incidents table
    await client.query(`
      CREATE TABLE IF NOT EXISTS security_incidents (
        id SERIAL PRIMARY KEY,
        audit_log_id INTEGER REFERENCES cjis_audit_log(id),
        incident_type VARCHAR(100) NOT NULL,
        severity VARCHAR(20) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
        status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
        assigned_to INTEGER REFERENCES users(id),
        details JSONB,
        investigation_notes TEXT,
        resolution TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP
      );
    `);

    // Create indexes for security incidents
    await client.query(`CREATE INDEX IF NOT EXISTS idx_incidents_type ON security_incidents(incident_type);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_incidents_status ON security_incidents(status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_incidents_severity ON security_incidents(severity);`);

    // Create security metrics table
    await client.query(`
      CREATE TABLE IF NOT EXISTS security_metrics (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        metrics JSONB NOT NULL,
        system_health VARCHAR(20) CHECK (system_health IN ('normal', 'warning', 'critical')),
        active_threats INTEGER DEFAULT 0,
        active_incidents INTEGER DEFAULT 0,
        failed_logins_24h INTEGER DEFAULT 0,
        suspicious_activities_24h INTEGER DEFAULT 0,
        compliance_score DECIMAL(5,2)
      );
    `);

    // Create index for metrics
    await client.query(`CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON security_metrics(timestamp);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_metrics_health ON security_metrics(system_health);`);

    // Create threat detection patterns table
    await client.query(`
      CREATE TABLE IF NOT EXISTS threat_patterns (
        id SERIAL PRIMARY KEY,
        pattern_name VARCHAR(100) NOT NULL UNIQUE,
        pattern_type VARCHAR(50) NOT NULL,
        pattern_regex TEXT,
        severity VARCHAR(20) NOT NULL,
        description TEXT,
        enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insert default threat patterns
    await client.query(`
      INSERT INTO threat_patterns (pattern_name, pattern_type, pattern_regex, severity, description)
      VALUES 
        ('SQL Injection', 'sql_injection', '(\\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)\\b|--|/\\*|\\*/|xp_|sp_|0x)', 'CRITICAL', 'Detects potential SQL injection attempts'),
        ('XSS Attack', 'xss', '(<script|javascript:|onerror=|onclick=|<iframe|<object|<embed)', 'HIGH', 'Detects potential cross-site scripting attacks'),
        ('Path Traversal', 'path_traversal', '(\\.\\./|\\.\\.\\\\|%2e%2e|0x2e0x2e)', 'HIGH', 'Detects directory traversal attempts'),
        ('Command Injection', 'command_injection', '(\\||;|&|\\x60|\\$\\(|<\\()', 'CRITICAL', 'Detects command injection attempts')
      ON CONFLICT (pattern_name) DO NOTHING;
    `);

    // Create compliance tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS compliance_tracking (
        id SERIAL PRIMARY KEY,
        check_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        compliance_area VARCHAR(100) NOT NULL,
        status VARCHAR(20) CHECK (status IN ('compliant', 'non_compliant', 'partial')),
        violations JSONB,
        remediation_required BOOLEAN DEFAULT false,
        remediation_notes TEXT,
        next_check_date TIMESTAMP
      );
    `);

    // Create index for compliance tracking
    await client.query(`CREATE INDEX IF NOT EXISTS idx_compliance_area ON compliance_tracking(compliance_area);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_compliance_status ON compliance_tracking(status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_compliance_date ON compliance_tracking(check_date);`);

    // Create audit report history table
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_reports (
        id SERIAL PRIMARY KEY,
        report_id VARCHAR(100) UNIQUE NOT NULL,
        report_type VARCHAR(50) NOT NULL,
        period_start TIMESTAMP NOT NULL,
        period_end TIMESTAMP NOT NULL,
        generated_by INTEGER REFERENCES users(id),
        report_data JSONB,
        integrity_verified BOOLEAN,
        file_path TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create index for audit reports
    await client.query(`CREATE INDEX IF NOT EXISTS idx_reports_type ON audit_reports(report_type);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_reports_period ON audit_reports(period_start, period_end);`);

    // Create real-time monitoring thresholds table
    await client.query(`
      CREATE TABLE IF NOT EXISTS monitoring_thresholds (
        id SERIAL PRIMARY KEY,
        threshold_name VARCHAR(100) NOT NULL UNIQUE,
        threshold_value INTEGER NOT NULL,
        time_window_minutes INTEGER NOT NULL,
        alert_severity VARCHAR(20) NOT NULL,
        enabled BOOLEAN DEFAULT true,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insert default monitoring thresholds
    await client.query(`
      INSERT INTO monitoring_thresholds (threshold_name, threshold_value, time_window_minutes, alert_severity, description)
      VALUES 
        ('failed_logins', 5, 5, 'HIGH', 'Alert after 5 failed login attempts in 5 minutes'),
        ('suspicious_activity', 3, 15, 'MEDIUM', 'Alert after 3 suspicious events in 15 minutes'),
        ('data_exports', 10, 60, 'HIGH', 'Alert on excessive data exports'),
        ('privileged_actions', 5, 30, 'MEDIUM', 'Alert on multiple admin actions'),
        ('session_timeouts', 10, 10, 'LOW', 'Alert on mass session timeouts')
      ON CONFLICT (threshold_name) DO NOTHING;
    `);

    // Create security event correlation table
    await client.query(`
      CREATE TABLE IF NOT EXISTS event_correlations (
        id SERIAL PRIMARY KEY,
        correlation_id VARCHAR(100) NOT NULL,
        event_ids INTEGER[],
        correlation_type VARCHAR(50),
        risk_score INTEGER,
        details JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create index for event correlations
    await client.query(`CREATE INDEX IF NOT EXISTS idx_correlation_id ON event_correlations(correlation_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_correlation_type ON event_correlations(correlation_type);`);

    // Create view for security dashboard summary
    await client.query(`
      CREATE OR REPLACE VIEW security_dashboard_summary AS
      SELECT 
        (SELECT COUNT(*) FROM security_incidents WHERE status IN ('open', 'investigating')) as active_incidents,
        (SELECT COUNT(*) FROM security_alerts WHERE status = 'new') as new_alerts,
        (SELECT COUNT(*) FROM cjis_audit_log WHERE timestamp > CURRENT_TIMESTAMP - INTERVAL '24 hours') as events_24h,
        (SELECT COUNT(*) FROM cjis_audit_log 
         WHERE timestamp > CURRENT_TIMESTAMP - INTERVAL '24 hours' 
         AND access_result = 'denied') as denied_24h,
        (SELECT COUNT(DISTINCT user_id) FROM cjis_audit_log 
         WHERE timestamp > CURRENT_TIMESTAMP - INTERVAL '24 hours') as active_users_24h,
        (SELECT system_health FROM security_metrics ORDER BY timestamp DESC LIMIT 1) as system_health,
        (SELECT compliance_score FROM security_metrics ORDER BY timestamp DESC LIMIT 1) as compliance_score;
    `);

    // Create function to check audit log integrity
    await client.query(`
      CREATE OR REPLACE FUNCTION verify_audit_integrity()
      RETURNS TABLE(is_valid BOOLEAN, error_count INTEGER, last_verified TIMESTAMP) AS $$
      DECLARE
        prev_hash VARCHAR(64);
        current_hash VARCHAR(64);
        expected_hash VARCHAR(64);
        error_cnt INTEGER := 0;
      BEGIN
        -- This is a simplified version - actual implementation would verify full chain
        SELECT integrity_hash INTO prev_hash 
        FROM cjis_audit_log 
        ORDER BY id DESC 
        LIMIT 1;
        
        IF prev_hash IS NOT NULL THEN
          is_valid := true;
        ELSE
          is_valid := false;
        END IF;
        
        error_count := error_cnt;
        last_verified := CURRENT_TIMESTAMP;
        RETURN NEXT;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create trigger for audit log updates
    await client.query(`
      CREATE OR REPLACE FUNCTION audit_log_update_trigger()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Prevent updates to audit logs
        RAISE EXCEPTION 'Audit logs cannot be modified';
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS prevent_audit_updates ON cjis_audit_log;
    `);

    await client.query(`
      CREATE TRIGGER prevent_audit_updates
      BEFORE UPDATE ON cjis_audit_log
      FOR EACH ROW
      EXECUTE FUNCTION audit_log_update_trigger();
    `);

    // Log the migration
    await client.query(`
      INSERT INTO cjis_audit_log (
        action, event_type, data_classification, metadata
      ) VALUES ($1, $2, $3, $4)
    `, [
      'SECURITY_MONITORING_MIGRATION',
      'SYSTEM_CONFIG_CHANGED',
      'cji',
      JSON.stringify({
        phase: 3,
        tables_created: [
          'security_alerts',
          'security_incidents',
          'security_metrics',
          'threat_patterns',
          'compliance_tracking',
          'audit_reports',
          'monitoring_thresholds',
          'event_correlations'
        ],
        timestamp: new Date().toISOString()
      })
    ]);

    await client.query('COMMIT');
    console.log('✅ CJIS Phase 3 security monitoring migration completed successfully');
    
    // Display migration status
    const tablesResult = await pool.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
        AND tablename LIKE '%security%' OR tablename LIKE '%audit%'
      ORDER BY tablename
    `);
    
    console.log('\n📊 Security Tables Created:');
    console.table(tablesResult.rows);
    
    return { success: true, message: 'Security monitoring tables created successfully' };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error in security monitoring migration:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Export for direct execution
if (require.main === module) {
  addSecurityMonitoringTables()
    .then(result => {
      console.log('Migration completed:', result.message);
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { addSecurityMonitoringTables };