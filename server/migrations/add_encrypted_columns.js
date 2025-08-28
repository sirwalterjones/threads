const { pool } = require('../config/database');
const encryptionService = require('../utils/encryption');

/**
 * CJIS Phase 2: Add encrypted columns for sensitive data
 * Implements column-level encryption for Criminal Justice Information
 */
async function addEncryptedColumns() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    console.log('🔐 Starting CJIS Phase 2 encryption migration...');

    // Add encrypted columns for sensitive user data
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS email_encrypted TEXT,
      ADD COLUMN IF NOT EXISTS phone_encrypted TEXT,
      ADD COLUMN IF NOT EXISTS ssn_encrypted TEXT,
      ADD COLUMN IF NOT EXISTS address_encrypted TEXT,
      ADD COLUMN IF NOT EXISTS date_of_birth_encrypted TEXT,
      ADD COLUMN IF NOT EXISTS emergency_contact_encrypted TEXT,
      ADD COLUMN IF NOT EXISTS encryption_version INTEGER DEFAULT 1,
      ADD COLUMN IF NOT EXISTS last_encryption_rotation TIMESTAMP;
    `);

    // Add search hashes for encrypted fields (for equality searches)
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS email_hash VARCHAR(64),
      ADD COLUMN IF NOT EXISTS phone_hash VARCHAR(64),
      ADD COLUMN IF NOT EXISTS ssn_hash VARCHAR(64);
    `);

    // Create indexes on hash fields for search performance
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_email_hash ON users(email_hash);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_phone_hash ON users(phone_hash);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_ssn_hash ON users(ssn_hash);`);

    // Add encrypted columns for posts containing CJI
    await client.query(`
      ALTER TABLE posts 
      ADD COLUMN IF NOT EXISTS content_encrypted TEXT,
      ADD COLUMN IF NOT EXISTS metadata_encrypted TEXT,
      ADD COLUMN IF NOT EXISTS data_classification VARCHAR(20) DEFAULT 'public',
      ADD COLUMN IF NOT EXISTS contains_cji BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS encryption_version INTEGER DEFAULT 1;
    `);

    // Add encrypted columns for intel reports
    await client.query(`
      ALTER TABLE intel_reports 
      ADD COLUMN IF NOT EXISTS content_encrypted TEXT,
      ADD COLUMN IF NOT EXISTS sensitive_data_encrypted TEXT,
      ADD COLUMN IF NOT EXISTS classification_level VARCHAR(20) DEFAULT 'sensitive',
      ADD COLUMN IF NOT EXISTS encryption_version INTEGER DEFAULT 1;
    `);

    // Add encrypted columns for audit logs (protect sensitive audit data)
    await client.query(`
      ALTER TABLE cjis_audit_log 
      ADD COLUMN IF NOT EXISTS metadata_encrypted TEXT,
      ADD COLUMN IF NOT EXISTS encryption_version INTEGER DEFAULT 1;
    `);

    // Add encrypted file storage table
    await client.query(`
      CREATE TABLE IF NOT EXISTS encrypted_files (
        id SERIAL PRIMARY KEY,
        original_filename VARCHAR(255),
        mime_type VARCHAR(100),
        file_size INTEGER,
        data_encrypted TEXT NOT NULL,
        metadata_encrypted TEXT,
        checksum VARCHAR(64) NOT NULL,
        owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        data_classification VARCHAR(20) DEFAULT 'sensitive',
        encryption_version INTEGER DEFAULT 1,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_accessed TIMESTAMP,
        access_count INTEGER DEFAULT 0
      );
    `);
    
    // Create indexes for encrypted_files table
    await client.query(`CREATE INDEX IF NOT EXISTS idx_encrypted_files_owner ON encrypted_files(owner_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_encrypted_files_checksum ON encrypted_files(checksum);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_encrypted_files_uploaded ON encrypted_files(uploaded_at);`);

    // Add encryption key rotation tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS encryption_key_rotation (
        id SERIAL PRIMARY KEY,
        rotation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        old_key_hash VARCHAR(64) NOT NULL,
        new_key_hash VARCHAR(64) NOT NULL,
        tables_affected TEXT[],
        records_updated INTEGER,
        rotation_status VARCHAR(20) DEFAULT 'pending',
        completed_at TIMESTAMP,
        error_message TEXT,
        performed_by INTEGER REFERENCES users(id)
      );
    `);
    
    // Create indexes for encryption_key_rotation table
    await client.query(`CREATE INDEX IF NOT EXISTS idx_key_rotation_date ON encryption_key_rotation(rotation_date);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_key_rotation_status ON encryption_key_rotation(rotation_status);`);

    // Encrypt existing sensitive data
    console.log('🔐 Encrypting existing sensitive data...');
    
    // Get all users with email addresses
    const usersResult = await client.query(`
      SELECT id, email
      FROM users 
      WHERE email IS NOT NULL 
        AND email_encrypted IS NULL
    `);

    for (const user of usersResult.rows) {
      // Encrypt email
      if (user.email) {
        const encryptedEmail = encryptionService.encrypt(
          user.email,
          encryptionService.dataClassification.SENSITIVE,
          'user_email'
        );
        const emailHash = encryptionService.hashForSearch(user.email.toLowerCase());
        
        await client.query(`
          UPDATE users 
          SET email_encrypted = $1, email_hash = $2, encryption_version = 1
          WHERE id = $3
        `, [encryptedEmail, emailHash, user.id]);
      }
    }

    // Encrypt posts marked as containing CJI
    const postsResult = await client.query(`
      SELECT id, content, title
      FROM posts 
      WHERE (content ILIKE '%confidential%' 
         OR content ILIKE '%classified%' 
         OR content ILIKE '%sensitive%')
        AND content_encrypted IS NULL
      LIMIT 1000
    `);

    for (const post of postsResult.rows) {
      // Determine if post contains CJI based on content
      const containsCJI = /\b(SSN|DOB|license|arrest|conviction|warrant)\b/i.test(post.content);
      const classification = containsCJI ? 
        encryptionService.dataClassification.CJI : 
        encryptionService.dataClassification.SENSITIVE;
      
      if (containsCJI || post.content.length > 1000) {
        const encryptedContent = encryptionService.encrypt(
          post.content,
          classification,
          'post_content'
        );
        
        await client.query(`
          UPDATE posts 
          SET content_encrypted = $1, 
              data_classification = $2, 
              contains_cji = $3,
              encryption_version = 1
          WHERE id = $4
        `, [encryptedContent, classification, containsCJI, post.id]);
      }
    }

    // Create function to automatically encrypt sensitive data on insert/update
    await client.query(`
      CREATE OR REPLACE FUNCTION encrypt_sensitive_data()
      RETURNS TRIGGER AS $$
      BEGIN
        -- This is a placeholder - actual encryption happens in application layer
        -- This trigger can be used to ensure encryption flags are set
        IF NEW.email IS NOT NULL AND NEW.email_encrypted IS NULL THEN
          RAISE EXCEPTION 'Email must be encrypted before storage';
        END IF;
        
        RETURN NEW;
      END;
      $$ LANGUAGE 'plpgsql';
    `);

    // Create encryption status view for monitoring
    await client.query(`
      CREATE OR REPLACE VIEW encryption_status AS
      SELECT 
        'users' as table_name,
        COUNT(*) as total_records,
        COUNT(email_encrypted) as encrypted_emails,
        COUNT(phone_encrypted) as encrypted_phones,
        MAX(encryption_version) as latest_version
      FROM users
      UNION ALL
      SELECT 
        'posts' as table_name,
        COUNT(*) as total_records,
        COUNT(content_encrypted) as encrypted_content,
        0 as encrypted_phones,
        MAX(encryption_version) as latest_version
      FROM posts
      UNION ALL
      SELECT 
        'encrypted_files' as table_name,
        COUNT(*) as total_records,
        COUNT(data_encrypted) as encrypted_files,
        0 as encrypted_phones,
        MAX(encryption_version) as latest_version
      FROM encrypted_files;
    `);

    // Log the migration
    await client.query(`
      INSERT INTO cjis_audit_log (
        action, data_classification, metadata
      ) VALUES ($1, $2, $3)
    `, [
      'ENCRYPTION_MIGRATION',
      encryptionService.dataClassification.CJI,
      JSON.stringify({
        phase: 2,
        tables_modified: ['users', 'posts', 'intel_reports', 'cjis_audit_log', 'encrypted_files'],
        timestamp: new Date().toISOString()
      })
    ]);

    await client.query('COMMIT');
    console.log('✅ CJIS Phase 2 encryption migration completed successfully');
    
    // Display encryption status
    const statusResult = await pool.query('SELECT * FROM encryption_status');
    console.log('\n📊 Encryption Status:');
    console.table(statusResult.rows);
    
    return { success: true, message: 'Encryption columns added successfully' };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error in encryption migration:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Export for direct execution
if (require.main === module) {
  // Check for master key
  if (!process.env.CJIS_MASTER_KEY && process.env.NODE_ENV === 'production') {
    console.error('❌ CJIS_MASTER_KEY environment variable is required for encryption');
    console.log('Generate a key with: openssl rand -hex 32');
    process.exit(1);
  }

  addEncryptedColumns()
    .then(result => {
      console.log('Migration completed:', result.message);
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { addEncryptedColumns };