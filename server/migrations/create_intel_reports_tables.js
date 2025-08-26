const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function createIntelReportsTables() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Creating intel_reports table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS intel_reports (
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
      )
    `);

    console.log('Creating intel_report_subjects table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS intel_report_subjects (
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
      )
    `);

    console.log('Creating intel_report_organizations table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS intel_report_organizations (
        id SERIAL PRIMARY KEY,
        report_id INTEGER REFERENCES intel_reports(id) ON DELETE CASCADE,
        business_name VARCHAR(200),
        phone VARCHAR(50),
        address TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('Creating intel_report_sources table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS intel_report_sources (
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
      )
    `);

    console.log('Creating intel_report_files table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS intel_report_files (
        id SERIAL PRIMARY KEY,
        report_id INTEGER REFERENCES intel_reports(id) ON DELETE CASCADE,
        filename VARCHAR(255) NOT NULL,
        original_filename VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size INTEGER,
        mime_type VARCHAR(100),
        uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('Creating intel_reports_audit table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS intel_reports_audit (
        id SERIAL PRIMARY KEY,
        report_id INTEGER REFERENCES intel_reports(id) ON DELETE CASCADE,
        action VARCHAR(50) NOT NULL,
        old_values JSONB,
        new_values JSONB,
        performed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        performed_at TIMESTAMP DEFAULT NOW(),
        ip_address INET,
        user_agent TEXT
      )
    `);

    console.log('Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_intel_reports_status ON intel_reports(status);
      CREATE INDEX IF NOT EXISTS idx_intel_reports_classification ON intel_reports(classification);
      CREATE INDEX IF NOT EXISTS idx_intel_reports_agent_id ON intel_reports(agent_id);
      CREATE INDEX IF NOT EXISTS idx_intel_reports_date ON intel_reports(date);
      CREATE INDEX IF NOT EXISTS idx_intel_reports_expires_at ON intel_reports(expires_at);
      CREATE INDEX IF NOT EXISTS idx_intel_reports_intel_number ON intel_reports(intel_number);
    `);

    await client.query('COMMIT');
    console.log('✅ All Intel Reports tables created successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating tables:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function runMigration() {
  try {
    await createIntelReportsTables();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
