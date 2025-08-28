const { pool } = require('../config/database');

/**
 * CJIS Compliance Migration: Password History and Security Tracking
 * Implements password history tracking and user security metadata
 * Required for CJIS v6.0 password policy compliance
 */

async function addPasswordHistoryTables() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Create password history table for CJIS compliance
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_password_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        -- Index for efficient queries
        UNIQUE(user_id, password_hash)
      );
    `);

    // Add password security columns to users table
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS last_password_change TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS password_never_expires BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS account_locked_until TIMESTAMP NULL,
      ADD COLUMN IF NOT EXISTS last_password_breach_check TIMESTAMP NULL,
      ADD COLUMN IF NOT EXISTS password_strength_score INTEGER DEFAULT 0;
    `);

    // Create session management table for CJIS session tracking
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ip_address INET,
        user_agent TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create security incidents table for CJIS incident response
    await client.query(`
      CREATE TABLE IF NOT EXISTS security_incidents (
        id SERIAL PRIMARY KEY,
        incident_type VARCHAR(100) NOT NULL,
        severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
        status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        affected_user_ids INTEGER[],
        detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP NULL,
        assigned_to INTEGER REFERENCES users(id),
        metadata JSONB DEFAULT '{}',
        
        -- Audit fields
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create personnel security tracking for CJIS personnel requirements
    await client.query(`
      CREATE TABLE IF NOT EXISTS personnel_security (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        
        -- Background check information
        background_check_date DATE,
        background_check_status VARCHAR(50) CHECK (background_check_status IN ('pending', 'approved', 'rejected', 'expired')),
        background_check_type VARCHAR(100),
        
        -- Training and certification
        last_security_training_date DATE,
        next_security_training_due DATE,
        training_completion_status VARCHAR(50) DEFAULT 'pending',
        
        -- Access review
        last_access_review_date DATE,
        next_access_review_due DATE,
        access_review_status VARCHAR(50) DEFAULT 'pending',
        
        -- Security clearance
        security_clearance_level VARCHAR(50),
        clearance_expiry_date DATE,
        
        -- Audit fields
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE(user_id)
      );
    `);

    // Create enhanced audit log table for CJIS comprehensive auditing
    await client.query(`
      CREATE TABLE IF NOT EXISTS cjis_audit_log (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        session_id INTEGER REFERENCES user_sessions(id),
        
        -- Action details
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(50),
        resource_id VARCHAR(100),
        
        -- CJIS-specific fields
        data_classification VARCHAR(20) CHECK (data_classification IN ('public', 'sensitive', 'cji')),
        access_result VARCHAR(20) CHECK (access_result IN ('granted', 'denied', 'failed')),
        
        -- Technical details
        ip_address INET,
        user_agent TEXT,
        request_method VARCHAR(10),
        request_path TEXT,
        response_status INTEGER,
        
        -- Timing
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processing_duration_ms INTEGER,
        
        -- Additional context
        metadata JSONB DEFAULT '{}',
        
        -- Integrity protection (hash of critical fields)
        integrity_hash VARCHAR(64)
      );
    `);

    // Create password breach monitoring table
    await client.query(`
      CREATE TABLE IF NOT EXISTS password_breach_monitoring (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        check_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        breach_detected BOOLEAN NOT NULL,
        breach_count INTEGER DEFAULT 0,
        action_taken VARCHAR(100),
        next_check_due TIMESTAMP
      );
    `);

    // Create configuration management table for CJIS change control
    await client.query(`
      CREATE TABLE IF NOT EXISTS configuration_changes (
        id SERIAL PRIMARY KEY,
        change_type VARCHAR(50) NOT NULL,
        component VARCHAR(100) NOT NULL,
        change_description TEXT NOT NULL,
        old_configuration JSONB,
        new_configuration JSONB,
        changed_by INTEGER NOT NULL REFERENCES users(id),
        change_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approval_status VARCHAR(20) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
        approved_by INTEGER REFERENCES users(id),
        approval_date TIMESTAMP,
        rollback_data JSONB
      );
    `);

    // Create indexes for performance
    await client.query(`CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active);`);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cjis_audit_user_id ON cjis_audit_log(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cjis_audit_timestamp ON cjis_audit_log(timestamp);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cjis_audit_action ON cjis_audit_log(action);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cjis_audit_classification ON cjis_audit_log(data_classification);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cjis_audit_result ON cjis_audit_log(access_result);`);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_breach_monitoring_user ON password_breach_monitoring(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_breach_monitoring_date ON password_breach_monitoring(check_date);`);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_config_changes_component ON configuration_changes(component);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_config_changes_date ON configuration_changes(change_date);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_config_changes_status ON configuration_changes(approval_status);`);

    // Insert initial password history for existing users
    await client.query(`
      INSERT INTO user_password_history (user_id, password_hash)
      SELECT id, password_hash 
      FROM users 
      WHERE password_hash IS NOT NULL
      ON CONFLICT (user_id, password_hash) DO NOTHING;
    `);

    // Update last_password_change for existing users
    await client.query(`
      UPDATE users 
      SET last_password_change = created_at 
      WHERE last_password_change IS NULL;
    `);

    // Create functions for automatic timestamp updates
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Create triggers for automatic timestamp updates
    await client.query(`
      CREATE TRIGGER update_personnel_security_updated_at 
        BEFORE UPDATE ON personnel_security
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await client.query(`
      CREATE TRIGGER update_security_incidents_updated_at 
        BEFORE UPDATE ON security_incidents
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    // Create function for audit log integrity checking
    await client.query(`
      CREATE OR REPLACE FUNCTION calculate_audit_integrity_hash(
        p_user_id INTEGER,
        p_action VARCHAR,
        p_timestamp TIMESTAMP,
        p_ip_address INET
      ) RETURNS VARCHAR(64) AS $$
      BEGIN
        RETURN MD5(
          COALESCE(p_user_id::text, '') || '|' ||
          COALESCE(p_action, '') || '|' ||
          COALESCE(p_timestamp::text, '') || '|' ||
          COALESCE(p_ip_address::text, '')
        );
      END;
      $$ language 'plpgsql';
    `);

    await client.query('COMMIT');
    console.log('✅ CJIS password history and security tables created successfully');
    
    return { success: true, message: 'CJIS security tables created' };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating CJIS security tables:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Export for direct execution
if (require.main === module) {
  addPasswordHistoryTables()
    .then(result => {
      console.log('Migration completed:', result.message);
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { addPasswordHistoryTables };