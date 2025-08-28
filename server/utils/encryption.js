const crypto = require('crypto');
const { pool } = require('../config/database');

/**
 * CJIS v6.0 Compliant Encryption Utility
 * Implements AES-256-GCM encryption for Criminal Justice Information (CJI)
 * Provides field-level encryption for sensitive data with key rotation support
 */
class EncryptionService {
  constructor() {
    // CJIS requires minimum AES-256 encryption
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256 bits
    this.ivLength = 16; // 128 bits
    this.tagLength = 16; // 128 bits
    this.saltLength = 64; // 512 bits
    
    // Master key derivation (in production, use hardware security module or key vault)
    this.masterKey = this.getMasterKey();
    
    // Integrity key for HMAC
    this.integrityKey = this.deriveIntegrityKey();
    
    // Data classification levels for CJIS
    this.dataClassification = {
      PUBLIC: 'public',
      SENSITIVE: 'sensitive',
      CJI: 'cji' // Criminal Justice Information - highest protection
    };
  }

  /**
   * Get or generate master encryption key
   * In production, this should come from a secure key management system
   */
  getMasterKey() {
    // Check environment variable first
    if (process.env.CJIS_MASTER_KEY) {
      const key = Buffer.from(process.env.CJIS_MASTER_KEY, 'hex');
      if (key.length !== this.keyLength) {
        throw new Error('Invalid master key length. Must be 256 bits (32 bytes)');
      }
      return key;
    }
    
    // Generate a new key if none exists (for development only)
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️  CJIS WARNING: Using generated master key. Set CJIS_MASTER_KEY in production!');
      const key = crypto.randomBytes(this.keyLength);
      console.log('Generated Master Key (hex):', key.toString('hex'));
      console.log('Add to environment: CJIS_MASTER_KEY=' + key.toString('hex'));
      return key;
    }
    
    throw new Error('CJIS_MASTER_KEY environment variable is required in production');
  }

  /**
   * Derive integrity key from master key
   * @returns {Buffer} - Integrity key for HMAC
   */
  deriveIntegrityKey() {
    const salt = Buffer.from('cjis-integrity-key', 'utf8');
    return crypto.pbkdf2Sync(this.masterKey, salt, 100000, this.keyLength, 'sha256');
  }

  /**
   * Derive a data encryption key from master key using PBKDF2
   * @param {string} context - Context for key derivation (e.g., 'user_data', 'audit_log')
   * @param {Buffer} salt - Salt for key derivation
   * @returns {Buffer} - Derived encryption key
   */
  deriveKey(context, salt) {
    const info = Buffer.from(`cjis-encryption-${context}`, 'utf8');
    return crypto.pbkdf2Sync(this.masterKey, Buffer.concat([salt, info]), 100000, this.keyLength, 'sha256');
  }

  /**
   * Encrypt data using AES-256-GCM
   * @param {string} plaintext - Data to encrypt
   * @param {string} classification - Data classification level
   * @param {string} context - Encryption context (e.g., table name)
   * @returns {Object} - Encrypted data with metadata
   */
  encrypt(plaintext, classification = this.dataClassification.SENSITIVE, context = 'general') {
    try {
      if (!plaintext) {
        return null;
      }

      // Generate random salt and IV
      const salt = crypto.randomBytes(this.saltLength);
      const iv = crypto.randomBytes(this.ivLength);
      
      // Derive encryption key
      const key = this.deriveKey(context, salt);
      
      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);
      
      // Add additional authenticated data (AAD)
      const aad = Buffer.from(JSON.stringify({
        classification,
        context,
        timestamp: Date.now(),
        algorithm: this.algorithm
      }));
      cipher.setAAD(aad, { plaintextLength: Buffer.byteLength(plaintext) });
      
      // Encrypt data
      const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final()
      ]);
      
      // Get authentication tag
      const authTag = cipher.getAuthTag();
      
      // Combine all components into a single encrypted package
      const encryptedData = {
        ciphertext: encrypted.toString('base64'),
        salt: salt.toString('base64'),
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        aad: aad.toString('base64'),
        algorithm: this.algorithm,
        classification,
        context,
        version: 1
      };
      
      // Return as base64-encoded JSON for database storage
      return Buffer.from(JSON.stringify(encryptedData)).toString('base64');
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data using AES-256-GCM
   * @param {string} encryptedPackage - Base64-encoded encrypted package
   * @returns {string} - Decrypted plaintext
   */
  decrypt(encryptedPackage) {
    try {
      if (!encryptedPackage) {
        return null;
      }

      // Parse encrypted package
      const encryptedData = JSON.parse(Buffer.from(encryptedPackage, 'base64').toString('utf8'));
      
      // Extract components
      const ciphertext = Buffer.from(encryptedData.ciphertext, 'base64');
      const salt = Buffer.from(encryptedData.salt, 'base64');
      const iv = Buffer.from(encryptedData.iv, 'base64');
      const authTag = Buffer.from(encryptedData.authTag, 'base64');
      const aad = Buffer.from(encryptedData.aad, 'base64');
      
      // Derive decryption key
      const key = this.deriveKey(encryptedData.context, salt);
      
      // Create decipher
      const decipher = crypto.createDecipheriv(encryptedData.algorithm, key, iv);
      decipher.setAuthTag(authTag);
      decipher.setAAD(aad, { plaintextLength: ciphertext.length });
      
      // Decrypt data
      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
      ]);
      
      return decrypted.toString('utf8');
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Encrypt multiple fields in an object
   * @param {Object} data - Object containing fields to encrypt
   * @param {Array} fields - Array of field names to encrypt
   * @param {string} classification - Data classification level
   * @returns {Object} - Object with specified fields encrypted
   */
  encryptFields(data, fields, classification = this.dataClassification.SENSITIVE) {
    const encrypted = { ...data };
    
    for (const field of fields) {
      if (data[field] !== undefined && data[field] !== null) {
        encrypted[field] = this.encrypt(
          typeof data[field] === 'string' ? data[field] : JSON.stringify(data[field]),
          classification,
          field
        );
      }
    }
    
    return encrypted;
  }

  /**
   * Decrypt multiple fields in an object
   * @param {Object} data - Object containing encrypted fields
   * @param {Array} fields - Array of field names to decrypt
   * @returns {Object} - Object with specified fields decrypted
   */
  decryptFields(data, fields) {
    const decrypted = { ...data };
    
    for (const field of fields) {
      if (data[field]) {
        try {
          const plaintext = this.decrypt(data[field]);
          // Try to parse as JSON if applicable
          try {
            decrypted[field] = JSON.parse(plaintext);
          } catch {
            decrypted[field] = plaintext;
          }
        } catch (error) {
          console.error(`Failed to decrypt field ${field}:`, error);
          decrypted[field] = null;
        }
      }
    }
    
    return decrypted;
  }

  /**
   * Hash sensitive data for searching without exposing plaintext
   * @param {string} data - Data to hash
   * @param {string} salt - Optional salt for hashing
   * @returns {string} - Hashed value
   */
  hashForSearch(data, salt = '') {
    if (!data) return null;
    
    const hash = crypto.createHash('sha256');
    hash.update(salt + data);
    return hash.digest('hex');
  }

  /**
   * Generate a secure random token
   * @param {number} length - Token length in bytes
   * @returns {string} - Random token as hex string
   */
  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Encrypt file data for secure storage
   * @param {Buffer} fileBuffer - File data as buffer
   * @param {string} filename - Original filename
   * @param {string} mimeType - File MIME type
   * @returns {Object} - Encrypted file package
   */
  encryptFile(fileBuffer, filename, mimeType) {
    const metadata = {
      filename,
      mimeType,
      size: fileBuffer.length,
      uploadDate: new Date().toISOString()
    };
    
    // Encrypt file data
    const encryptedData = this.encrypt(fileBuffer.toString('base64'), this.dataClassification.CJI, 'file_upload');
    
    // Encrypt metadata separately
    const encryptedMetadata = this.encrypt(JSON.stringify(metadata), this.dataClassification.SENSITIVE, 'file_metadata');
    
    return {
      data: encryptedData,
      metadata: encryptedMetadata,
      checksum: crypto.createHash('sha256').update(fileBuffer).digest('hex')
    };
  }

  /**
   * Decrypt file data
   * @param {Object} encryptedFile - Encrypted file package
   * @returns {Object} - Decrypted file data and metadata
   */
  decryptFile(encryptedFile) {
    const decryptedData = Buffer.from(this.decrypt(encryptedFile.data), 'base64');
    const metadata = JSON.parse(this.decrypt(encryptedFile.metadata));
    
    // Verify checksum
    const checksum = crypto.createHash('sha256').update(decryptedData).digest('hex');
    if (checksum !== encryptedFile.checksum) {
      throw new Error('File integrity check failed');
    }
    
    return {
      data: decryptedData,
      metadata
    };
  }

  /**
   * Generate integrity signature for data
   * @param {string|Object} data - Data to sign
   * @returns {string} - HMAC signature
   */
  generateIntegritySignature(data) {
    const hmac = crypto.createHmac('sha256', this.integrityKey);
    hmac.update(typeof data === 'string' ? data : JSON.stringify(data));
    return hmac.digest('hex');
  }

  /**
   * Verify data integrity
   * @param {string|Object} data - Data to verify
   * @param {string} signature - Expected signature
   * @returns {boolean} - True if integrity is valid
   */
  verifyIntegrity(data, signature) {
    const expectedSignature = this.generateIntegritySignature(data);
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(signature)
    );
  }

  /**
   * Rotate encryption keys (for key rotation policy)
   * @param {string} oldKeyHex - Old master key as hex string
   * @param {string} newKeyHex - New master key as hex string
   * @returns {Promise<boolean>} - Success status
   */
  async rotateKeys(oldKeyHex, newKeyHex) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Store old key temporarily
      const oldMasterKey = this.masterKey;
      this.masterKey = Buffer.from(oldKeyHex, 'hex');
      
      // Get all encrypted data that needs re-encryption
      const tables = [
        { name: 'users', fields: ['email', 'phone_number'] },
        { name: 'audit_log', fields: ['old_values', 'new_values'] },
        { name: 'security_incidents', fields: ['description', 'metadata'] }
      ];
      
      for (const table of tables) {
        const result = await client.query(`SELECT id, ${table.fields.join(', ')} FROM ${table.name}`);
        
        for (const row of result.rows) {
          // Decrypt with old key
          const decrypted = this.decryptFields(row, table.fields);
          
          // Switch to new key
          this.masterKey = Buffer.from(newKeyHex, 'hex');
          
          // Re-encrypt with new key
          const encrypted = this.encryptFields(decrypted, table.fields);
          
          // Update database
          const updates = table.fields.map(field => `${field} = $${table.fields.indexOf(field) + 2}`).join(', ');
          const values = table.fields.map(field => encrypted[field]);
          
          await client.query(
            `UPDATE ${table.name} SET ${updates} WHERE id = $1`,
            [row.id, ...values]
          );
          
          // Switch back to old key for next iteration
          this.masterKey = Buffer.from(oldKeyHex, 'hex');
        }
      }
      
      // Commit transaction
      await client.query('COMMIT');
      
      // Update master key
      this.masterKey = Buffer.from(newKeyHex, 'hex');
      
      // Log key rotation
      await pool.query(`
        INSERT INTO cjis_audit_log (
          action, data_classification, metadata
        ) VALUES ($1, $2, $3)
      `, [
        'KEY_ROTATION',
        this.dataClassification.CJI,
        JSON.stringify({
          timestamp: new Date().toISOString(),
          success: true,
          tablesUpdated: tables.map(t => t.name)
        })
      ]);
      
      console.log('✅ Encryption keys rotated successfully');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Key rotation failed:', error);
      
      // Restore original key
      this.masterKey = oldMasterKey;
      
      // Log failure
      await pool.query(`
        INSERT INTO cjis_audit_log (
          action, data_classification, metadata
        ) VALUES ($1, $2, $3)
      `, [
        'KEY_ROTATION_FAILED',
        this.dataClassification.CJI,
        JSON.stringify({
          timestamp: new Date().toISOString(),
          error: error.message
        })
      ]);
      
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Validate encryption health
   * @returns {Object} - Encryption system status
   */
  async validateEncryption() {
    try {
      // Test encryption/decryption
      const testData = 'CJIS Encryption Test ' + Date.now();
      const encrypted = this.encrypt(testData, this.dataClassification.CJI, 'test');
      const decrypted = this.decrypt(encrypted);
      
      const encryptionWorks = testData === decrypted;
      
      // Check key presence
      const hasKey = !!this.masterKey;
      const keySource = process.env.CJIS_MASTER_KEY ? 'environment' : 'generated';
      
      // Check algorithm compliance
      const algorithmCompliant = this.algorithm === 'aes-256-gcm';
      
      return {
        healthy: encryptionWorks && hasKey && algorithmCompliant,
        encryption: {
          working: encryptionWorks,
          algorithm: this.algorithm,
          keyLength: this.keyLength * 8,
          keySource
        },
        compliance: {
          cjis: algorithmCompliant,
          keyStrength: this.keyLength * 8 >= 256
        }
      };
    } catch (error) {
      console.error('Encryption validation error:', error);
      return {
        healthy: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
const encryptionService = new EncryptionService();
module.exports = encryptionService;