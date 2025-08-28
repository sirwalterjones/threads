const { pool } = require('../config/database');

/**
 * CJIS Phase 4: Add incident response system tables
 */
async function addIncidentResponseTables() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    console.log('🚨 Starting CJIS Phase 4 incident response migration...');

    // Create main incident response table
    await client.query(`
      CREATE TABLE IF NOT EXISTS incident_response (
        id SERIAL PRIMARY KEY,
        incident_id VARCHAR(100) UNIQUE NOT NULL,
        incident_type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
        state VARCHAR(50) NOT NULL DEFAULT 'detected',
        description TEXT NOT NULL,
        detection_method VARCHAR(50) DEFAULT 'manual',
        initial_findings JSONB,
        affected_systems JSONB,
        affected_users JSONB,
        data_compromised JSONB,
        containment_actions JSONB,
        recovery_plan JSONB,
        lessons_learned JSONB,
        response_deadline TIMESTAMP,
        triage_started_at TIMESTAMP,
        containment_started_at TIMESTAMP,
        containment_completed BOOLEAN DEFAULT false,
        eradication_started_at TIMESTAMP,
        recovery_started_at TIMESTAMP,
        resolved_at TIMESTAMP,
        closed_at TIMESTAMP,
        downtime_minutes INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        state_history JSONB DEFAULT '[]'::jsonb
      );
    `);

    // Create indexes for incident response
    await client.query(`CREATE INDEX IF NOT EXISTS idx_incident_id ON incident_response(incident_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_incident_type ON incident_response(incident_type);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_incident_severity ON incident_response(severity);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_incident_state ON incident_response(state);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_incident_created ON incident_response(created_at);`);

    // Create incident responders table
    await client.query(`
      CREATE TABLE IF NOT EXISTS incident_responders (
        id SERIAL PRIMARY KEY,
        incident_id INTEGER REFERENCES incident_response(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id),
        role VARCHAR(50) NOT NULL,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        responded_at TIMESTAMP,
        actions_taken JSONB,
        notes TEXT
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_responders_incident ON incident_responders(incident_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_responders_user ON incident_responders(user_id);`);

    // Create incident forensics table
    await client.query(`
      CREATE TABLE IF NOT EXISTS incident_forensics (
        id SERIAL PRIMARY KEY,
        incident_id INTEGER REFERENCES incident_response(id) ON DELETE CASCADE,
        forensics_id VARCHAR(100) UNIQUE,
        collection_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        collector_id INTEGER REFERENCES users(id),
        data_collected JSONB,
        encrypted_data TEXT,
        integrity_hash VARCHAR(64),
        evidence_chain JSONB,
        storage_location TEXT
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_forensics_incident ON incident_forensics(incident_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_forensics_time ON incident_forensics(collection_time);`);

    // Create incident timeline table
    await client.query(`
      CREATE TABLE IF NOT EXISTS incident_timeline (
        id SERIAL PRIMARY KEY,
        incident_id INTEGER REFERENCES incident_response(id) ON DELETE CASCADE,
        event_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        event_type VARCHAR(100),
        event_description TEXT,
        performed_by INTEGER REFERENCES users(id),
        metadata JSONB
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_timeline_incident ON incident_timeline(incident_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_timeline_event ON incident_timeline(event_time);`);

    // Create incident audit logs link table
    await client.query(`
      CREATE TABLE IF NOT EXISTS incident_audit_logs (
        id SERIAL PRIMARY KEY,
        incident_id INTEGER REFERENCES incident_response(id) ON DELETE CASCADE,
        audit_log_id INTEGER REFERENCES cjis_audit_log(id)
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_incident_audit_incident ON incident_audit_logs(incident_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_incident_audit_log ON incident_audit_logs(audit_log_id);`);

    // Create containment actions catalog
    await client.query(`
      CREATE TABLE IF NOT EXISTS containment_actions (
        id SERIAL PRIMARY KEY,
        action_type VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        automated BOOLEAN DEFAULT false,
        required_permissions JSONB,
        implementation_script TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insert default containment actions
    await client.query(`
      INSERT INTO containment_actions (action_type, description, automated)
      VALUES 
        ('ISOLATE_SYSTEM', 'Isolate compromised system from network', true),
        ('DISABLE_ACCOUNT', 'Disable user account immediately', true),
        ('BLOCK_IP', 'Block IP address at firewall', true),
        ('REVOKE_ACCESS', 'Revoke user access to specific resources', true),
        ('QUARANTINE_FILE', 'Quarantine suspicious file', true),
        ('RESET_CREDENTIALS', 'Force password reset for user', true),
        ('TERMINATE_SESSIONS', 'Terminate all active sessions', true),
        ('BACKUP_EVIDENCE', 'Create forensic backup of evidence', false)
      ON CONFLICT (action_type) DO NOTHING;
    `);

    // Create incident playbooks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS incident_playbooks (
        id SERIAL PRIMARY KEY,
        incident_type VARCHAR(50) NOT NULL,
        playbook_name VARCHAR(100) NOT NULL,
        description TEXT,
        severity_threshold VARCHAR(20),
        steps JSONB NOT NULL,
        automated_actions JSONB,
        notification_template TEXT,
        enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insert default playbooks
    await client.query(`
      INSERT INTO incident_playbooks (incident_type, playbook_name, steps)
      VALUES 
        ('data_breach', 'Data Breach Response', 
         '[{"order": 1, "action": "Identify scope of breach"}, 
           {"order": 2, "action": "Contain the breach"}, 
           {"order": 3, "action": "Assess damage and impact"},
           {"order": 4, "action": "Notify affected parties"},
           {"order": 5, "action": "Remediate vulnerabilities"}]'::jsonb),
        ('malware', 'Malware Incident Response',
         '[{"order": 1, "action": "Isolate infected systems"},
           {"order": 2, "action": "Identify malware type"},
           {"order": 3, "action": "Remove malware"},
           {"order": 4, "action": "Scan entire network"},
           {"order": 5, "action": "Apply security patches"}]'::jsonb),
        ('unauthorized_access', 'Unauthorized Access Response',
         '[{"order": 1, "action": "Identify compromised accounts"},
           {"order": 2, "action": "Terminate unauthorized sessions"},
           {"order": 3, "action": "Reset credentials"},
           {"order": 4, "action": "Review access logs"},
           {"order": 5, "action": "Strengthen access controls"}]'::jsonb)
      ON CONFLICT DO NOTHING;
    `);

    // Create evidence backups table
    await client.query(`
      CREATE TABLE IF NOT EXISTS evidence_backups (
        id SERIAL PRIMARY KEY,
        incident_id VARCHAR(100) NOT NULL,
        backup_id VARCHAR(100) UNIQUE NOT NULL,
        backup_type VARCHAR(50),
        backup_location TEXT,
        backup_size_bytes BIGINT,
        integrity_hash VARCHAR(64),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER REFERENCES users(id),
        status VARCHAR(20) DEFAULT 'pending',
        metadata JSONB
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_evidence_incident ON evidence_backups(incident_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_evidence_created ON evidence_backups(created_at);`);

    // Create system isolation table
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_isolation (
        id SERIAL PRIMARY KEY,
        system_id VARCHAR(100) NOT NULL,
        isolated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        isolation_type VARCHAR(50),
        isolated_by INTEGER REFERENCES users(id),
        release_at TIMESTAMP,
        released_by INTEGER REFERENCES users(id),
        reason TEXT,
        status VARCHAR(20) DEFAULT 'isolated'
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_isolation_system ON system_isolation(system_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_isolation_status ON system_isolation(status);`);

    // Create blocked IPs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS blocked_ips (
        id SERIAL PRIMARY KEY,
        ip_address INET NOT NULL,
        blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        blocked_by INTEGER REFERENCES users(id),
        reason TEXT,
        incident_id VARCHAR(100),
        expires_at TIMESTAMP,
        status VARCHAR(20) DEFAULT 'active',
        UNIQUE(ip_address, status)
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_blocked_ip ON blocked_ips(ip_address);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_blocked_status ON blocked_ips(status);`);

    // Create incident reports table
    await client.query(`
      CREATE TABLE IF NOT EXISTS incident_reports (
        id SERIAL PRIMARY KEY,
        incident_id INTEGER REFERENCES incident_response(id),
        report_id VARCHAR(100) UNIQUE NOT NULL,
        report_type VARCHAR(50) DEFAULT 'final',
        report_data JSONB,
        generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        generated_by INTEGER REFERENCES users(id),
        file_path TEXT,
        sent_to JSONB,
        compliance_notes JSONB
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_reports_incident ON incident_reports(incident_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_reports_generated ON incident_reports(generated_at);`);

    // Create recovery validation table
    await client.query(`
      CREATE TABLE IF NOT EXISTS recovery_validation (
        id SERIAL PRIMARY KEY,
        incident_id INTEGER REFERENCES incident_response(id),
        validation_type VARCHAR(50),
        validation_status VARCHAR(20),
        validated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        validated_by INTEGER REFERENCES users(id),
        validation_results JSONB,
        notes TEXT
      );
    `);

    // Create notification templates table
    await client.query(`
      CREATE TABLE IF NOT EXISTS incident_notifications (
        id SERIAL PRIMARY KEY,
        template_name VARCHAR(100) UNIQUE NOT NULL,
        incident_types VARCHAR(50)[],
        severity_levels VARCHAR(20)[],
        notification_type VARCHAR(50),
        recipients JSONB,
        subject_template TEXT,
        body_template TEXT,
        enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insert default notification templates
    await client.query(`
      INSERT INTO incident_notifications (
        template_name, incident_types, severity_levels, 
        notification_type, subject_template, body_template
      )
      VALUES 
        ('Critical Incident Alert', 
         ARRAY['data_breach', 'system_compromise'], 
         ARRAY['CRITICAL', 'HIGH'],
         'email',
         'CRITICAL SECURITY INCIDENT: {{incident_type}} - {{incident_id}}',
         'A critical security incident has been detected requiring immediate attention.'),
        ('Incident Resolution Notice',
         ARRAY['all'],
         ARRAY['all'],
         'email',
         'RESOLVED: {{incident_type}} - {{incident_id}}',
         'The security incident {{incident_id}} has been successfully resolved.')
      ON CONFLICT (template_name) DO NOTHING;
    `);

    // Create view for incident dashboard
    await client.query(`
      CREATE OR REPLACE VIEW incident_dashboard AS
      SELECT 
        COUNT(*) as total_incidents,
        COUNT(CASE WHEN state NOT IN ('closed', 'resolved') THEN 1 END) as active_incidents,
        COUNT(CASE WHEN severity = 'CRITICAL' THEN 1 END) as critical_incidents,
        COUNT(CASE WHEN severity = 'HIGH' THEN 1 END) as high_incidents,
        COUNT(CASE WHEN created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours' THEN 1 END) as incidents_24h,
        COUNT(CASE WHEN created_at > CURRENT_TIMESTAMP - INTERVAL '7 days' THEN 1 END) as incidents_7d,
        AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/60) as avg_resolution_minutes
      FROM incident_response;
    `);

    // Create function to auto-escalate incidents
    await client.query(`
      CREATE OR REPLACE FUNCTION escalate_overdue_incidents()
      RETURNS void AS $$
      DECLARE
        incident RECORD;
      BEGIN
        FOR incident IN 
          SELECT * FROM incident_response 
          WHERE state = 'detected' 
            AND response_deadline < CURRENT_TIMESTAMP
        LOOP
          UPDATE incident_response 
          SET severity = CASE 
            WHEN severity = 'LOW' THEN 'MEDIUM'
            WHEN severity = 'MEDIUM' THEN 'HIGH'
            WHEN severity = 'HIGH' THEN 'CRITICAL'
            ELSE severity
          END
          WHERE id = incident.id;
          
          INSERT INTO incident_timeline (
            incident_id, event_type, event_description
          ) VALUES (
            incident.id, 
            'ESCALATION', 
            'Incident automatically escalated due to response deadline exceeded'
          );
        END LOOP;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Log the migration
    await client.query(`
      INSERT INTO cjis_audit_log (
        action, event_type, data_classification, metadata
      ) VALUES ($1, $2, $3, $4)
    `, [
      'INCIDENT_RESPONSE_MIGRATION',
      'SYSTEM_CONFIG_CHANGED',
      'cji',
      JSON.stringify({
        phase: 4,
        tables_created: [
          'incident_response',
          'incident_responders',
          'incident_forensics',
          'incident_timeline',
          'incident_audit_logs',
          'containment_actions',
          'incident_playbooks',
          'evidence_backups',
          'system_isolation',
          'blocked_ips',
          'incident_reports',
          'recovery_validation',
          'incident_notifications'
        ],
        timestamp: new Date().toISOString()
      })
    ]);

    await client.query('COMMIT');
    console.log('✅ CJIS Phase 4 incident response migration completed successfully');
    
    // Display migration status
    const tablesResult = await pool.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
        AND (tablename LIKE '%incident%' OR tablename LIKE '%forensics%' 
             OR tablename LIKE '%evidence%' OR tablename LIKE '%recovery%')
      ORDER BY tablename
    `);
    
    console.log('\n📊 Incident Response Tables Created:');
    console.table(tablesResult.rows);
    
    return { success: true, message: 'Incident response tables created successfully' };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error in incident response migration:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Export for direct execution
if (require.main === module) {
  addIncidentResponseTables()
    .then(result => {
      console.log('Migration completed:', result.message);
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { addIncidentResponseTables };