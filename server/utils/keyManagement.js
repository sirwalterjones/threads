const crypto = require('crypto');
const { pool } = require('../config/database');
const fs = require('fs').promises;
const path = require('path');

/**
 * CJIS v6.0 Compliant Key Management System
 * Implements secure key generation, storage, rotation, and auditing
 */
class KeyManagementSystem {
  constructor() {
    this.keyStore = new Map();
    this.keyRotationInterval = 90; // days
    this.keyBackupPath = process.env.KEY_BACKUP_PATH || '/secure/keys';
    this.initialized = false;
  }

  /**
   * Initialize the key management system
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Load existing keys from secure storage
      await this.loadKeys();
      
      // Verify key integrity
      await this.verifyKeyIntegrity();
      
      // Schedule key rotation checks
      this.scheduleKeyRotation();
      
      this.initialized = true;
      console.log('✅ Key Management System initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Key Management System:', error);
      throw error;
    }
  }

  /**
   * Generate a new encryption key
   */
  generateKey(keyId, purpose = 'data_encryption', length = 32) {
    const key = crypto.randomBytes(length);
    const keyMetadata = {
      id: keyId,
      purpose,
      algorithm: 'aes-256-gcm',
      length: length * 8,
      created: new Date().toISOString(),
      lastUsed: null,
      rotationDue: new Date(Date.now() + this.keyRotationInterval * 24 * 60 * 60 * 1000).toISOString(),
      version: 1,
      hash: crypto.createHash('sha256').update(key).digest('hex')
    };

    this.keyStore.set(keyId, {
      key,
      metadata: keyMetadata
    });

    return keyMetadata;
  }

  /**
   * Get an encryption key by ID
   */
  async getKey(keyId) {
    if (!this.keyStore.has(keyId)) {
      await this.loadKey(keyId);
    }

    const keyData = this.keyStore.get(keyId);
    if (!keyData) {
      throw new Error(`Key not found: ${keyId}`);
    }

    // Update last used timestamp
    keyData.metadata.lastUsed = new Date().toISOString();
    
    // Audit key access
    await this.auditKeyAccess(keyId, 'KEY_ACCESS');

    return keyData.key;
  }

  /**
   * Store key securely
   */
  async storeKey(keyId, key, metadata) {
    try {
      // Store in memory
      this.keyStore.set(keyId, { key, metadata });

      // Encrypt key for storage
      const masterKey = this.getMasterKey();
      const encryptedKey = this.encryptKey(key, masterKey);

      // Store in database
      await pool.query(`
        INSERT INTO encryption_keys (
          key_id, encrypted_key, metadata, key_hash, created_at, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (key_id) DO UPDATE SET
          encrypted_key = $2,
          metadata = $3,
          updated_at = CURRENT_TIMESTAMP
      `, [
        keyId,
        encryptedKey,
        JSON.stringify(metadata),
        metadata.hash,
        metadata.created,
        metadata.rotationDue
      ]);

      // Backup key to secure storage
      await this.backupKey(keyId, encryptedKey, metadata);

      // Audit key creation
      await this.auditKeyAccess(keyId, 'KEY_CREATED');

      return true;
    } catch (error) {
      console.error('Failed to store key:', error);
      throw error;
    }
  }

  /**
   * Load keys from secure storage
   */
  async loadKeys() {
    try {
      const result = await pool.query(`
        SELECT key_id, encrypted_key, metadata
        FROM encryption_keys
        WHERE expires_at > CURRENT_TIMESTAMP
          AND is_active = true
      `);

      const masterKey = this.getMasterKey();

      for (const row of result.rows) {
        const key = this.decryptKey(row.encrypted_key, masterKey);
        const metadata = JSON.parse(row.metadata);
        
        this.keyStore.set(row.key_id, { key, metadata });
      }

      console.log(`Loaded ${result.rows.length} active keys`);
    } catch (error) {
      console.error('Failed to load keys:', error);
      // Continue with empty key store if database not available
    }
  }

  /**
   * Load a specific key
   */
  async loadKey(keyId) {
    try {
      const result = await pool.query(`
        SELECT encrypted_key, metadata
        FROM encryption_keys
        WHERE key_id = $1 AND is_active = true
      `, [keyId]);

      if (result.rows.length === 0) {
        return null;
      }

      const masterKey = this.getMasterKey();
      const key = this.decryptKey(result.rows[0].encrypted_key, masterKey);
      const metadata = JSON.parse(result.rows[0].metadata);

      this.keyStore.set(keyId, { key, metadata });
      return { key, metadata };
    } catch (error) {
      console.error(`Failed to load key ${keyId}:`, error);
      return null;
    }
  }

  /**
   * Rotate encryption keys
   */
  async rotateKey(keyId) {
    try {
      const oldKeyData = this.keyStore.get(keyId);
      if (!oldKeyData) {
        throw new Error(`Key not found for rotation: ${keyId}`);
      }

      // Generate new key
      const newKey = crypto.randomBytes(oldKeyData.key.length);
      const newMetadata = {
        ...oldKeyData.metadata,
        version: oldKeyData.metadata.version + 1,
        created: new Date().toISOString(),
        rotationDue: new Date(Date.now() + this.keyRotationInterval * 24 * 60 * 60 * 1000).toISOString(),
        previousHash: oldKeyData.metadata.hash,
        hash: crypto.createHash('sha256').update(newKey).digest('hex')
      };

      // Store new key
      await this.storeKey(keyId, newKey, newMetadata);

      // Archive old key
      await this.archiveKey(keyId, oldKeyData.key, oldKeyData.metadata);

      // Log rotation
      await pool.query(`
        INSERT INTO encryption_key_rotation (
          old_key_hash, new_key_hash, rotation_status, completed_at
        ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      `, [
        oldKeyData.metadata.hash,
        newMetadata.hash,
        'completed'
      ]);

      // Audit key rotation
      await this.auditKeyAccess(keyId, 'KEY_ROTATED');

      console.log(`✅ Key rotated successfully: ${keyId}`);
      return newMetadata;
    } catch (error) {
      console.error(`Failed to rotate key ${keyId}:`, error);
      
      await pool.query(`
        INSERT INTO encryption_key_rotation (
          old_key_hash, rotation_status, error_message
        ) VALUES ($1, $2, $3)
      `, [
        this.keyStore.get(keyId)?.metadata?.hash || 'unknown',
        'failed',
        error.message
      ]);

      throw error;
    }
  }

  /**
   * Archive old key for compliance
   */
  async archiveKey(keyId, key, metadata) {
    const masterKey = this.getMasterKey();
    const encryptedKey = this.encryptKey(key, masterKey);

    await pool.query(`
      INSERT INTO encryption_keys_archive (
        key_id, encrypted_key, metadata, archived_at, version
      ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4)
    `, [
      keyId,
      encryptedKey,
      JSON.stringify(metadata),
      metadata.version
    ]);
  }

  /**
   * Verify key integrity
   */
  async verifyKeyIntegrity() {
    const errors = [];
    
    for (const [keyId, keyData] of this.keyStore) {
      const hash = crypto.createHash('sha256').update(keyData.key).digest('hex');
      
      if (hash !== keyData.metadata.hash) {
        errors.push({
          keyId,
          error: 'Hash mismatch',
          expected: keyData.metadata.hash,
          actual: hash
        });
      }

      // Check expiration
      if (new Date(keyData.metadata.rotationDue) < new Date()) {
        errors.push({
          keyId,
          error: 'Key expired',
          expiredAt: keyData.metadata.rotationDue
        });
      }
    }

    if (errors.length > 0) {
      console.error('Key integrity check failed:', errors);
      
      // Audit integrity failures
      for (const error of errors) {
        await this.auditKeyAccess(error.keyId, 'KEY_INTEGRITY_FAILED', error);
      }

      throw new Error('Key integrity verification failed');
    }

    console.log('✅ Key integrity verified');
  }

  /**
   * Schedule automatic key rotation
   */
  scheduleKeyRotation() {
    // Check for keys needing rotation daily
    setInterval(async () => {
      try {
        const now = new Date();
        
        for (const [keyId, keyData] of this.keyStore) {
          const rotationDue = new Date(keyData.metadata.rotationDue);
          
          if (rotationDue <= now) {
            console.log(`Key rotation due for: ${keyId}`);
            await this.rotateKey(keyId);
          }
        }
      } catch (error) {
        console.error('Key rotation check error:', error);
      }
    }, 24 * 60 * 60 * 1000); // Check daily
  }

  /**
   * Get or generate master key for key encryption
   */
  getMasterKey() {
    // Use CJIS_MASTER_KEY or KMS_MASTER_KEY
    const keyHex = process.env.KMS_MASTER_KEY || process.env.CJIS_MASTER_KEY;
    
    if (keyHex) {
      return Buffer.from(keyHex, 'hex');
    }

    // In production, this should come from a Hardware Security Module (HSM)
    // or cloud key management service (AWS KMS, Azure Key Vault, etc.)
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️  Using generated master key for KMS. Configure KMS_MASTER_KEY in production!');
      const key = crypto.randomBytes(32);
      console.log('KMS Master Key (hex):', key.toString('hex'));
      return key;
    }

    throw new Error('KMS_MASTER_KEY or CJIS_MASTER_KEY not configured');
  }

  /**
   * Encrypt a key for storage
   */
  encryptKey(key, masterKey) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(key),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  }

  /**
   * Decrypt a stored key
   */
  decryptKey(encryptedKey, masterKey) {
    const buffer = Buffer.from(encryptedKey, 'base64');
    
    const iv = buffer.slice(0, 16);
    const authTag = buffer.slice(16, 32);
    const encrypted = buffer.slice(32);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, iv);
    decipher.setAuthTag(authTag);
    
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
  }

  /**
   * Backup key to secure storage
   */
  async backupKey(keyId, encryptedKey, metadata) {
    if (process.env.NODE_ENV === 'production') {
      try {
        const backupPath = path.join(this.keyBackupPath, `${keyId}.key`);
        const backupData = {
          keyId,
          encryptedKey,
          metadata,
          backedUpAt: new Date().toISOString()
        };
        
        await fs.writeFile(backupPath, JSON.stringify(backupData), 'utf8');
        console.log(`Key backed up: ${keyId}`);
      } catch (error) {
        console.error('Key backup failed:', error);
        // Don't throw - backup failure shouldn't stop key creation
      }
    }
  }

  /**
   * Audit key access
   */
  async auditKeyAccess(keyId, action, details = {}) {
    try {
      await pool.query(`
        INSERT INTO cjis_audit_log (
          action, resource_type, resource_id, 
          data_classification, metadata
        ) VALUES ($1, $2, $3, $4, $5)
      `, [
        action,
        'encryption_key',
        keyId,
        'cji',
        JSON.stringify({
          ...details,
          timestamp: new Date().toISOString()
        })
      ]);
    } catch (error) {
      console.error('Failed to audit key access:', error);
    }
  }

  /**
   * Generate key status report
   */
  async generateKeyReport() {
    const report = {
      totalKeys: this.keyStore.size,
      activeKeys: 0,
      expiredKeys: 0,
      rotationsDue: 0,
      keysByPurpose: {},
      oldestKey: null,
      newestKey: null
    };

    const now = new Date();

    for (const [keyId, keyData] of this.keyStore) {
      const rotationDue = new Date(keyData.metadata.rotationDue);
      
      if (rotationDue > now) {
        report.activeKeys++;
      } else {
        report.expiredKeys++;
      }

      if (rotationDue <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)) {
        report.rotationsDue++;
      }

      const purpose = keyData.metadata.purpose;
      report.keysByPurpose[purpose] = (report.keysByPurpose[purpose] || 0) + 1;

      const created = new Date(keyData.metadata.created);
      if (!report.oldestKey || created < new Date(report.oldestKey.created)) {
        report.oldestKey = { keyId, created: keyData.metadata.created };
      }
      if (!report.newestKey || created > new Date(report.newestKey.created)) {
        report.newestKey = { keyId, created: keyData.metadata.created };
      }
    }

    return report;
  }
}

// Create tables if they don't exist
async function createKeyManagementTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS encryption_keys (
        key_id VARCHAR(255) PRIMARY KEY,
        encrypted_key TEXT NOT NULL,
        metadata JSONB NOT NULL,
        key_hash VARCHAR(64) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        is_active BOOLEAN DEFAULT true
      );
    `);
    
    // Create indexes for encryption_keys table
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_keys_expires ON encryption_keys(expires_at);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_keys_active ON encryption_keys(is_active);`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS encryption_keys_archive (
        id SERIAL PRIMARY KEY,
        key_id VARCHAR(255) NOT NULL,
        encrypted_key TEXT NOT NULL,
        metadata JSONB NOT NULL,
        version INTEGER NOT NULL,
        archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Create indexes for encryption_keys_archive table
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_archive_key_id ON encryption_keys_archive(key_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_archive_date ON encryption_keys_archive(archived_at);`);

    console.log('✅ Key management tables created');
  } catch (error) {
    console.error('Failed to create key management tables:', error);
  }
}

// Export singleton instance
const keyManagement = new KeyManagementSystem();

// Initialize on module load
if (process.env.NODE_ENV !== 'test') {
  createKeyManagementTables().then(() => {
    keyManagement.initialize().catch(console.error);
  });
}

module.exports = keyManagement;