-- Intelligence Reports Database Schema

-- Main intel reports table
CREATE TABLE intel_reports (
    id SERIAL PRIMARY KEY,
    intel_number VARCHAR(50) UNIQUE NOT NULL,
    classification VARCHAR(50) NOT NULL CHECK (classification IN ('Sensitive', 'Narcotics Only', 'Classified', 'Law Enforcement Only')),
    date DATE NOT NULL,
    agent_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    case_number VARCHAR(100),
    subject TEXT NOT NULL,
    criminal_activity TEXT,
    summary TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP,
    review_comments TEXT,
    expires_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '90 days'),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Subject information table
CREATE TABLE intel_report_subjects (
    id SERIAL PRIMARY KEY,
    report_id INTEGER REFERENCES intel_reports(id) ON DELETE CASCADE,
    first_name VARCHAR(100),
    middle_name VARCHAR(100),
    last_name VARCHAR(100),
    address TEXT,
    date_of_birth DATE,
    race VARCHAR(50),
    sex VARCHAR(10) CHECK (sex IN ('M', 'F', 'O')),
    phone VARCHAR(50),
    social_security_number VARCHAR(20),
    license_number VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Organization/Business information table
CREATE TABLE intel_report_organizations (
    id SERIAL PRIMARY KEY,
    report_id INTEGER REFERENCES intel_reports(id) ON DELETE CASCADE,
    business_name VARCHAR(200),
    phone VARCHAR(50),
    address TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Source information table
CREATE TABLE intel_report_sources (
    id SERIAL PRIMARY KEY,
    report_id INTEGER REFERENCES intel_reports(id) ON DELETE CASCADE,
    source_id VARCHAR(100),
    rating VARCHAR(100),
    source VARCHAR(100),
    information_reliable TEXT,
    unknown_caller BOOLEAN DEFAULT FALSE,
    ci_cs BOOLEAN DEFAULT FALSE,
    first_name VARCHAR(100),
    middle_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(50),
    address TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- File attachments table
CREATE TABLE intel_report_files (
    id SERIAL PRIMARY KEY,
    report_id INTEGER REFERENCES intel_reports(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Audit log for intel reports
CREATE TABLE intel_reports_audit (
    id SERIAL PRIMARY KEY,
    report_id INTEGER REFERENCES intel_reports(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- 'created', 'updated', 'status_changed', 'expired', 'extended'
    old_values JSONB,
    new_values JSONB,
    performed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    performed_at TIMESTAMP DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- Indexes for better performance
CREATE INDEX idx_intel_reports_status ON intel_reports(status);
CREATE INDEX idx_intel_reports_classification ON intel_reports(classification);
CREATE INDEX idx_intel_reports_agent_id ON intel_reports(agent_id);
CREATE INDEX idx_intel_reports_date ON intel_reports(date);
CREATE INDEX idx_intel_reports_expires_at ON intel_reports(expires_at);
CREATE INDEX idx_intel_reports_intel_number ON intel_reports(intel_number);
CREATE INDEX idx_intel_reports_created_at ON intel_reports(created_at);

CREATE INDEX idx_intel_report_subjects_report_id ON intel_report_subjects(report_id);
CREATE INDEX idx_intel_report_subjects_name ON intel_report_subjects(last_name, first_name);

CREATE INDEX idx_intel_report_organizations_report_id ON intel_report_organizations(report_id);
CREATE INDEX idx_intel_report_organizations_name ON intel_report_organizations(business_name);

CREATE INDEX idx_intel_report_sources_report_id ON intel_report_sources(report_id);

CREATE INDEX idx_intel_report_files_report_id ON intel_report_files(report_id);

CREATE INDEX idx_intel_reports_audit_report_id ON intel_reports_audit(report_id);
CREATE INDEX idx_intel_reports_audit_action ON intel_reports_audit(action);
CREATE INDEX idx_intel_reports_audit_performed_at ON intel_reports_audit(performed_at);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_intel_report_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_intel_report_timestamp
    BEFORE UPDATE ON intel_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_intel_report_timestamp();

-- Trigger to create audit log entries
CREATE OR REPLACE FUNCTION create_intel_report_audit_log()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO intel_reports_audit (report_id, action, new_values)
        VALUES (NEW.id, 'created', row_to_json(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Check if status changed
        IF OLD.status != NEW.status THEN
            INSERT INTO intel_reports_audit (report_id, action, old_values, new_values)
            VALUES (NEW.id, 'status_changed', 
                   json_build_object('status', OLD.status),
                   json_build_object('status', NEW.status));
        END IF;
        
        -- Check if expiration extended
        IF OLD.expires_at != NEW.expires_at THEN
            INSERT INTO intel_reports_audit (report_id, action, old_values, new_values)
            VALUES (NEW.id, 'extended', 
                   json_build_object('expires_at', OLD.expires_at),
                   json_build_object('expires_at', NEW.expires_at));
        END IF;
        
        -- General update log
        INSERT INTO intel_reports_audit (report_id, action, old_values, new_values)
        VALUES (NEW.id, 'updated', row_to_json(OLD), row_to_json(NEW));
        
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO intel_reports_audit (report_id, action, old_values)
        VALUES (OLD.id, 'deleted', row_to_json(OLD));
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER intel_report_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON intel_reports
    FOR EACH ROW
    EXECUTE FUNCTION create_intel_report_audit_log();

-- Function to check for expired reports (can be called by cron job)
CREATE OR REPLACE FUNCTION check_expired_intel_reports()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    -- Mark expired reports and create audit entries
    WITH expired_reports AS (
        UPDATE intel_reports 
        SET updated_at = NOW()
        WHERE expires_at < NOW() 
        AND status = 'approved'
        RETURNING id
    )
    INSERT INTO intel_reports_audit (report_id, action, new_values)
    SELECT id, 'expired', json_build_object('expired_at', NOW())
    FROM expired_reports;
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- View for active (non-expired) reports
CREATE VIEW active_intel_reports AS
SELECT ir.*, 
       u.username as agent_name,
       reviewer.username as reviewed_by_name,
       CASE 
         WHEN ir.expires_at < NOW() THEN true 
         ELSE false 
       END as is_expired,
       CASE 
         WHEN ir.expires_at > NOW() THEN CEIL(EXTRACT(EPOCH FROM (ir.expires_at - NOW())) / 86400)
         ELSE 0
       END as days_until_expiration
FROM intel_reports ir
JOIN users u ON ir.agent_id = u.id
LEFT JOIN users reviewer ON ir.reviewed_by = reviewer.id
WHERE ir.status = 'approved' AND ir.expires_at > NOW();

-- View for reports summary with counts
CREATE VIEW intel_reports_summary AS
SELECT ir.*,
       u.username as agent_name,
       reviewer.username as reviewed_by_name,
       COUNT(DISTINCT irs.id) as subjects_count,
       COUNT(DISTINCT iro.id) as organizations_count,
       COUNT(DISTINCT irf.id) as files_count,
       CASE 
         WHEN ir.expires_at < NOW() THEN true 
         ELSE false 
       END as is_expired,
       CASE 
         WHEN ir.expires_at > NOW() THEN CEIL(EXTRACT(EPOCH FROM (ir.expires_at - NOW())) / 86400)
         ELSE 0
       END as days_until_expiration
FROM intel_reports ir
JOIN users u ON ir.agent_id = u.id
LEFT JOIN users reviewer ON ir.reviewed_by = reviewer.id
LEFT JOIN intel_report_subjects irs ON ir.id = irs.report_id
LEFT JOIN intel_report_organizations iro ON ir.id = iro.report_id
LEFT JOIN intel_report_files irf ON ir.id = irf.report_id
GROUP BY ir.id, u.username, reviewer.username;

-- Grant permissions (adjust as needed for your user roles)
GRANT SELECT, INSERT, UPDATE ON intel_reports TO admin, supervisor, agent;
GRANT SELECT, INSERT, UPDATE, DELETE ON intel_report_subjects TO admin, supervisor, agent;
GRANT SELECT, INSERT, UPDATE, DELETE ON intel_report_organizations TO admin, supervisor, agent;
GRANT SELECT, INSERT, UPDATE, DELETE ON intel_report_sources TO admin, supervisor, agent;
GRANT SELECT, INSERT, UPDATE, DELETE ON intel_report_files TO admin, supervisor, agent;

-- Only admin and supervisor can approve/reject reports
GRANT UPDATE (status, reviewed_by, reviewed_at, review_comments) ON intel_reports TO admin, supervisor;

-- Only admin can delete reports
GRANT DELETE ON intel_reports TO admin;

-- Grant sequence usage
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO admin, supervisor, agent;

-- Insert sample data for testing
-- Note: These inserts assume you have users with IDs 1, 2, 3 in your users table
/*
INSERT INTO intel_reports (
    intel_number, classification, date, agent_id, case_number,
    subject, criminal_activity, summary, status, expires_at
) VALUES 
(
    '2024-001',
    'Sensitive',
    '2024-01-15',
    1,
    'CASE-2024-001',
    'Drug trafficking investigation',
    'Suspected narcotics distribution network operating in downtown area',
    'Intelligence gathered indicates active drug trafficking operation involving multiple suspects. Requires further investigation and surveillance.',
    'approved',
    NOW() + INTERVAL '85 days'
),
(
    '2024-002',
    'Law Enforcement Only',
    '2024-01-16',
    2,
    NULL,
    'Financial fraud scheme',
    'Organized financial fraud targeting elderly victims',
    'Evidence suggests coordinated effort to defraud senior citizens through phone scams and identity theft.',
    'pending',
    NOW() + INTERVAL '90 days'
);
*/