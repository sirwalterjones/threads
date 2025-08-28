const { pool } = require('../config/database');

/**
 * CJIS Phase 5: Add compliance and governance system tables
 */
async function addComplianceGovernanceTables() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    console.log('🏛️ Starting CJIS Phase 5 compliance governance migration...');

    // Create personnel security table
    await client.query(`
      CREATE TABLE IF NOT EXISTS personnel_security (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) UNIQUE,
        full_name VARCHAR(255) NOT NULL,
        position VARCHAR(100),
        department VARCHAR(100),
        clearance_level VARCHAR(50) CHECK (clearance_level IN ('NONE', 'PUBLIC TRUST', 'SECRET', 'TOP SECRET')),
        clearance_granted_date DATE,
        clearance_expiration_date DATE,
        background_check_date DATE,
        background_check_status VARCHAR(50),
        fingerprint_date DATE,
        fingerprint_status VARCHAR(50),
        security_briefing_date DATE,
        reinvestigation_due DATE,
        access_categories JSONB DEFAULT '[]'::jsonb,
        certifications JSONB DEFAULT '[]'::jsonb,
        training_history JSONB DEFAULT '[]'::jsonb,
        clearance_history JSONB DEFAULT '[]'::jsonb,
        status VARCHAR(50) DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes for personnel security
    await client.query(`CREATE INDEX IF NOT EXISTS idx_personnel_user ON personnel_security(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_personnel_clearance ON personnel_security(clearance_level);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_personnel_status ON personnel_security(status);`);

    // Create security training modules table
    await client.query(`
      CREATE TABLE IF NOT EXISTS security_training_modules (
        id SERIAL PRIMARY KEY,
        module_code VARCHAR(50) UNIQUE NOT NULL,
        module_name VARCHAR(200) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        duration_hours DECIMAL(5,2),
        passing_score INTEGER DEFAULT 80,
        content JSONB,
        questions JSONB,
        required_for_roles VARCHAR(50)[],
        required_for_clearance VARCHAR(50)[],
        validity_period_days INTEGER DEFAULT 365,
        order_index INTEGER,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insert default training modules
    await client.query(`
      INSERT INTO security_training_modules (
        module_code, module_name, category, duration_hours, 
        required_for_roles, validity_period_days
      )
      VALUES 
        ('CJIS-BASIC', 'CJIS Security Awareness', 'Security', 2.0, 
         ARRAY['all'], 365),
        ('CJIS-ADVANCED', 'Advanced CJIS Compliance', 'Security', 4.0,
         ARRAY['admin', 'security_admin'], 365),
        ('PRIVACY-101', 'Privacy and Data Protection', 'Privacy', 1.5,
         ARRAY['all'], 365),
        ('INCIDENT-RESPONSE', 'Incident Response Procedures', 'Security', 3.0,
         ARRAY['security_analyst', 'incident_responder'], 180),
        ('ACCESS-CONTROL', 'Access Control and Authentication', 'Security', 2.0,
         ARRAY['all'], 365),
        ('MOBILE-SECURITY', 'Mobile Device Security', 'Security', 1.0,
         ARRAY['all'], 365),
        ('AUDIT-COMPLIANCE', 'Audit and Compliance', 'Compliance', 2.5,
         ARRAY['compliance_officer', 'admin'], 365),
        ('PHYSICAL-SECURITY', 'Physical Security Requirements', 'Security', 1.5,
         ARRAY['all'], 730)
      ON CONFLICT (module_code) DO NOTHING;
    `);

    // Create security training assignments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS security_training (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        module_id INTEGER REFERENCES security_training_modules(id),
        assigned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        due_date TIMESTAMP,
        started_date TIMESTAMP,
        completion_date TIMESTAMP,
        score DECIMAL(5,2),
        attempts INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT 'assigned',
        completion_data JSONB,
        certificate_id VARCHAR(100),
        expires_at TIMESTAMP,
        notes TEXT,
        UNIQUE(user_id, module_id, assigned_date)
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_training_user ON security_training(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_training_module ON security_training(module_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_training_status ON security_training(status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_training_due ON security_training(due_date);`);

    // Create configuration baseline table
    await client.query(`
      CREATE TABLE IF NOT EXISTS configuration_baseline (
        id SERIAL PRIMARY KEY,
        baseline_id VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        version VARCHAR(50),
        settings JSONB NOT NULL,
        security_controls JSONB,
        approved_by INTEGER REFERENCES users(id),
        approved_date TIMESTAMP,
        effective_date TIMESTAMP,
        expiration_date TIMESTAMP,
        is_current BOOLEAN DEFAULT false,
        compliance_standard VARCHAR(100),
        validation_rules JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER REFERENCES users(id)
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_baseline_current ON configuration_baseline(is_current);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_baseline_id ON configuration_baseline(baseline_id);`);

    // Create configuration changes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS configuration_changes (
        id SERIAL PRIMARY KEY,
        change_id VARCHAR(100) UNIQUE NOT NULL,
        system_id VARCHAR(100),
        change_type VARCHAR(50),
        description TEXT,
        justification TEXT,
        risk_assessment JSONB,
        previous_config JSONB,
        new_config JSONB,
        planned_date TIMESTAMP,
        implemented_date TIMESTAMP,
        rollback_plan JSONB,
        approval_status VARCHAR(50) DEFAULT 'pending',
        approved_by INTEGER REFERENCES users(id),
        approved_date TIMESTAMP,
        requested_by INTEGER REFERENCES users(id),
        requested_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        validation_status VARCHAR(50),
        validation_results JSONB,
        notes TEXT
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_changes_system ON configuration_changes(system_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_changes_status ON configuration_changes(approval_status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_changes_date ON configuration_changes(planned_date);`);

    // Create mobile device management table
    await client.query(`
      CREATE TABLE IF NOT EXISTS mobile_devices (
        id SERIAL PRIMARY KEY,
        device_id VARCHAR(100) UNIQUE NOT NULL,
        user_id INTEGER REFERENCES users(id),
        device_type VARCHAR(50),
        manufacturer VARCHAR(100),
        model VARCHAR(100),
        os_version VARCHAR(50),
        serial_number VARCHAR(100),
        imei VARCHAR(100),
        mac_address VARCHAR(17),
        registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen TIMESTAMP,
        last_compliance_check TIMESTAMP,
        compliance_status JSONB,
        security_features JSONB,
        installed_apps JSONB,
        encryption_enabled BOOLEAN DEFAULT false,
        passcode_enabled BOOLEAN DEFAULT false,
        biometric_enabled BOOLEAN DEFAULT false,
        remote_wipe_enabled BOOLEAN DEFAULT false,
        jailbreak_detected BOOLEAN DEFAULT false,
        status VARCHAR(50) DEFAULT 'pending',
        approval_date TIMESTAMP,
        approved_by INTEGER REFERENCES users(id),
        retirement_date TIMESTAMP,
        notes TEXT
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_devices_user ON mobile_devices(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_devices_status ON mobile_devices(status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_devices_compliance ON mobile_devices(compliance_status);`);

    // Create device wipe requests table
    await client.query(`
      CREATE TABLE IF NOT EXISTS device_wipe_requests (
        id SERIAL PRIMARY KEY,
        device_id INTEGER REFERENCES mobile_devices(id),
        requested_by INTEGER REFERENCES users(id),
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reason TEXT NOT NULL,
        urgency VARCHAR(20) DEFAULT 'normal',
        executed_at TIMESTAMP,
        execution_status VARCHAR(50),
        execution_result JSONB,
        approved_by INTEGER REFERENCES users(id),
        approved_at TIMESTAMP
      );
    `);

    // Create compliance assessments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS compliance_assessments (
        id SERIAL PRIMARY KEY,
        assessment_id VARCHAR(100) UNIQUE NOT NULL,
        assessment_type VARCHAR(50),
        assessment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        performed_by INTEGER REFERENCES users(id),
        policy_areas JSONB,
        findings JSONB,
        gaps JSONB,
        recommendations JSONB,
        compliance_score DECIMAL(5,2),
        risk_level VARCHAR(20),
        next_assessment_date DATE,
        status VARCHAR(50) DEFAULT 'in_progress',
        report_generated BOOLEAN DEFAULT false,
        report_path TEXT,
        notes TEXT
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_assessments_type ON compliance_assessments(assessment_type);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_assessments_date ON compliance_assessments(assessment_date);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_assessments_status ON compliance_assessments(status);`);

    // Create compliance metrics table
    await client.query(`
      CREATE TABLE IF NOT EXISTS compliance_metrics (
        id SERIAL PRIMARY KEY,
        metric_date DATE DEFAULT CURRENT_DATE,
        policy_area VARCHAR(100),
        metric_name VARCHAR(200),
        metric_value DECIMAL(10,2),
        target_value DECIMAL(10,2),
        unit VARCHAR(50),
        compliance_percentage DECIMAL(5,2),
        trend VARCHAR(20),
        data_source VARCHAR(100),
        calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        UNIQUE(metric_date, policy_area, metric_name)
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_metrics_date ON compliance_metrics(metric_date);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_metrics_area ON compliance_metrics(policy_area);`);

    // Create formal audits table
    await client.query(`
      CREATE TABLE IF NOT EXISTS formal_audits (
        id SERIAL PRIMARY KEY,
        audit_id VARCHAR(100) UNIQUE NOT NULL,
        audit_type VARCHAR(50),
        audit_scope TEXT,
        audit_objectives TEXT,
        audit_criteria JSONB,
        scheduled_date DATE,
        start_date DATE,
        end_date DATE,
        lead_auditor VARCHAR(200),
        audit_team JSONB,
        status VARCHAR(50) DEFAULT 'scheduled',
        findings JSONB,
        recommendations JSONB,
        corrective_actions JSONB,
        evidence_collected JSONB,
        report_issued_date DATE,
        report_path TEXT,
        follow_up_required BOOLEAN DEFAULT false,
        follow_up_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER REFERENCES users(id)
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_audits_type ON formal_audits(audit_type);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audits_status ON formal_audits(status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audits_scheduled ON formal_audits(scheduled_date);`);

    // Create audit evidence table
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_evidence (
        id SERIAL PRIMARY KEY,
        audit_id INTEGER REFERENCES formal_audits(id),
        evidence_type VARCHAR(50),
        evidence_name VARCHAR(200),
        evidence_description TEXT,
        collected_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        collected_by INTEGER REFERENCES users(id),
        file_path TEXT,
        file_hash VARCHAR(64),
        metadata JSONB,
        retention_period_days INTEGER DEFAULT 2555
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_evidence_audit ON audit_evidence(audit_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_evidence_type ON audit_evidence(evidence_type);`);

    // Create security policies table
    await client.query(`
      CREATE TABLE IF NOT EXISTS security_policies (
        id SERIAL PRIMARY KEY,
        policy_id VARCHAR(100) UNIQUE NOT NULL,
        policy_name VARCHAR(200) NOT NULL,
        policy_area VARCHAR(100),
        version VARCHAR(20),
        description TEXT,
        requirements JSONB,
        controls JSONB,
        effective_date DATE,
        last_reviewed DATE,
        next_review_date DATE,
        owner VARCHAR(200),
        approved_by INTEGER REFERENCES users(id),
        document_path TEXT,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_policies_area ON security_policies(policy_area);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_policies_active ON security_policies(active);`);

    // Insert default security policies
    await client.query(`
      INSERT INTO security_policies (
        policy_id, policy_name, policy_area, version,
        description, effective_date
      )
      VALUES 
        ('POL-001', 'Information Exchange Agreements', 'Policy Area 1', '1.0',
         'Establishes information exchange agreements and user agreements', CURRENT_DATE),
        ('POL-002', 'Security Awareness Training', 'Policy Area 2', '1.0',
         'Defines security awareness and training requirements', CURRENT_DATE),
        ('POL-003', 'Incident Response', 'Policy Area 3', '1.0',
         'Outlines incident response procedures and requirements', CURRENT_DATE),
        ('POL-004', 'Auditing and Accountability', 'Policy Area 4', '1.0',
         'Establishes audit requirements and accountability measures', CURRENT_DATE),
        ('POL-005', 'Access Control', 'Policy Area 5', '1.0',
         'Defines access control policies and procedures', CURRENT_DATE),
        ('POL-006', 'Identification and Authentication', 'Policy Area 6', '1.0',
         'Specifies identification and authentication requirements', CURRENT_DATE),
        ('POL-007', 'Configuration Management', 'Policy Area 7', '1.0',
         'Establishes configuration management procedures', CURRENT_DATE),
        ('POL-008', 'Media Protection', 'Policy Area 8', '1.0',
         'Defines media protection and sanitization requirements', CURRENT_DATE),
        ('POL-009', 'Physical Protection', 'Policy Area 9', '1.0',
         'Outlines physical security requirements', CURRENT_DATE),
        ('POL-010', 'System and Communications Protection', 'Policy Area 10', '1.0',
         'Establishes system and network security requirements', CURRENT_DATE),
        ('POL-011', 'Formal Audits', 'Policy Area 11', '1.0',
         'Defines formal audit procedures and requirements', CURRENT_DATE),
        ('POL-012', 'Personnel Security', 'Policy Area 12', '1.0',
         'Establishes personnel security requirements', CURRENT_DATE),
        ('POL-013', 'Mobile Devices', 'Policy Area 13', '1.0',
         'Defines mobile device security requirements', CURRENT_DATE)
      ON CONFLICT (policy_id) DO NOTHING;
    `);

    // Create policy acknowledgments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS policy_acknowledgments (
        id SERIAL PRIMARY KEY,
        policy_id INTEGER REFERENCES security_policies(id),
        user_id INTEGER REFERENCES users(id),
        acknowledged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ip_address INET,
        user_agent TEXT,
        UNIQUE(policy_id, user_id)
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_acknowledgments_policy ON policy_acknowledgments(policy_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_acknowledgments_user ON policy_acknowledgments(user_id);`);

    // Create compliance reporting table
    await client.query(`
      CREATE TABLE IF NOT EXISTS compliance_reports (
        id SERIAL PRIMARY KEY,
        report_id VARCHAR(100) UNIQUE NOT NULL,
        report_type VARCHAR(50),
        report_period_start DATE,
        report_period_end DATE,
        generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        generated_by INTEGER REFERENCES users(id),
        overall_score DECIMAL(5,2),
        policy_scores JSONB,
        findings JSONB,
        recommendations JSONB,
        executive_summary TEXT,
        detailed_results JSONB,
        file_path TEXT,
        distribution_list JSONB,
        status VARCHAR(50) DEFAULT 'draft'
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_reports_type ON compliance_reports(report_type);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_reports_period ON compliance_reports(report_period_start, report_period_end);`);

    // Create compliance dashboard view
    await client.query(`
      CREATE OR REPLACE VIEW compliance_dashboard AS
      SELECT 
        (SELECT COUNT(*) FROM personnel_security WHERE status = 'active') as active_personnel,
        (SELECT COUNT(*) FROM security_training WHERE status = 'completed' 
         AND completion_date > CURRENT_DATE - INTERVAL '1 year') as completed_trainings,
        (SELECT COUNT(*) FROM mobile_devices WHERE status = 'approved') as approved_devices,
        (SELECT AVG(compliance_score) FROM compliance_assessments 
         WHERE assessment_date > CURRENT_DATE - INTERVAL '90 days') as avg_compliance_score,
        (SELECT COUNT(*) FROM formal_audits WHERE status = 'scheduled') as scheduled_audits,
        (SELECT COUNT(*) FROM configuration_changes WHERE approval_status = 'pending') as pending_changes
    `);

    // Create function to calculate training compliance
    await client.query(`
      CREATE OR REPLACE FUNCTION calculate_training_compliance(p_user_id INTEGER)
      RETURNS TABLE (
        total_required INTEGER,
        completed INTEGER,
        in_progress INTEGER,
        overdue INTEGER,
        compliance_percentage DECIMAL
      ) AS $$
      BEGIN
        RETURN QUERY
        SELECT 
          COUNT(*)::INTEGER as total_required,
          COUNT(CASE WHEN st.status = 'completed' THEN 1 END)::INTEGER as completed,
          COUNT(CASE WHEN st.status = 'in_progress' THEN 1 END)::INTEGER as in_progress,
          COUNT(CASE WHEN st.status = 'overdue' OR 
                (st.status != 'completed' AND st.due_date < CURRENT_TIMESTAMP) 
                THEN 1 END)::INTEGER as overdue,
          CASE 
            WHEN COUNT(*) > 0 
            THEN (COUNT(CASE WHEN st.status = 'completed' THEN 1 END) * 100.0 / COUNT(*))::DECIMAL(5,2)
            ELSE 100.0
          END as compliance_percentage
        FROM security_training st
        JOIN security_training_modules stm ON st.module_id = stm.id
        WHERE st.user_id = p_user_id
          AND stm.active = true;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create function to validate configuration compliance
    await client.query(`
      CREATE OR REPLACE FUNCTION validate_configuration_compliance(p_system_id VARCHAR)
      RETURNS TABLE (
        compliant BOOLEAN,
        violations JSONB,
        checked_at TIMESTAMP
      ) AS $$
      DECLARE
        v_baseline JSONB;
        v_current JSONB;
      BEGIN
        -- Get current baseline
        SELECT settings INTO v_baseline
        FROM configuration_baseline
        WHERE is_current = true
        LIMIT 1;
        
        -- In production, would fetch actual system configuration
        -- For now, return mock validation
        RETURN QUERY
        SELECT 
          true as compliant,
          '[]'::jsonb as violations,
          CURRENT_TIMESTAMP as checked_at;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Log the migration
    await client.query(`
      INSERT INTO cjis_audit_log (
        action, event_type, data_classification, metadata
      ) VALUES ($1, $2, $3, $4)
    `, [
      'COMPLIANCE_GOVERNANCE_MIGRATION',
      'SYSTEM_CONFIG_CHANGED',
      'cji',
      JSON.stringify({
        phase: 5,
        tables_created: [
          'personnel_security',
          'security_training_modules',
          'security_training',
          'configuration_baseline',
          'configuration_changes',
          'mobile_devices',
          'device_wipe_requests',
          'compliance_assessments',
          'compliance_metrics',
          'formal_audits',
          'audit_evidence',
          'security_policies',
          'policy_acknowledgments',
          'compliance_reports'
        ],
        timestamp: new Date().toISOString()
      })
    ]);

    await client.query('COMMIT');
    console.log('✅ CJIS Phase 5 compliance governance migration completed successfully');
    
    // Display migration status
    const tablesResult = await pool.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
        AND (tablename LIKE '%personnel%' OR tablename LIKE '%training%' 
             OR tablename LIKE '%compliance%' OR tablename LIKE '%audit%'
             OR tablename LIKE '%device%' OR tablename LIKE '%policy%'
             OR tablename LIKE '%configuration%')
      ORDER BY tablename
    `);
    
    console.log('\n📊 Compliance Governance Tables Created:');
    console.table(tablesResult.rows);
    
    return { success: true, message: 'Compliance governance tables created successfully' };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error in compliance governance migration:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Export for direct execution
if (require.main === module) {
  addComplianceGovernanceTables()
    .then(result => {
      console.log('Migration completed:', result.message);
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { addComplianceGovernanceTables };