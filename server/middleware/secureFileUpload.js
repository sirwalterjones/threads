const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const { pool } = require('../config/database');
const encryptionService = require('../utils/encryption');

/**
 * CJIS v6.0 Compliant Secure File Upload Middleware
 * Implements file encryption, virus scanning, and secure storage
 */
class SecureFileUpload {
  constructor() {
    this.allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    this.maxFileSize = 50 * 1024 * 1024; // 50MB
    this.uploadPath = process.env.SECURE_UPLOAD_PATH || '/tmp/secure_uploads';
  }

  /**
   * Configure multer for secure file handling
   */
  getMulterConfig() {
    return multer({
      storage: multer.memoryStorage(), // Store in memory for encryption
      limits: {
        fileSize: this.maxFileSize,
        files: 5 // Maximum 5 files per upload
      },
      fileFilter: (req, file, cb) => {
        // Validate file type
        if (!this.allowedMimeTypes.includes(file.mimetype)) {
          return cb(new Error(`File type ${file.mimetype} not allowed`), false);
        }

        // Check file extension
        const ext = path.extname(file.originalname).toLowerCase();
        const dangerousExtensions = ['.exe', '.dll', '.bat', '.cmd', '.sh', '.ps1'];
        
        if (dangerousExtensions.includes(ext)) {
          return cb(new Error('Potentially dangerous file type'), false);
        }

        // Sanitize filename
        const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        file.sanitizedName = sanitizedName;

        cb(null, true);
      }
    });
  }

  /**
   * Scan file for malware (placeholder - integrate with real AV in production)
   */
  async scanForMalware(buffer, filename) {
    // Check for common malware signatures
    const signatures = [
      Buffer.from('4D5A'), // EXE signature
      Buffer.from('504B0304'), // ZIP signature (check for nested threats)
      Buffer.from('EICAR'), // EICAR test signature
    ];

    for (const signature of signatures) {
      if (buffer.includes(signature)) {
        console.warn(`⚠️  Potential threat detected in file: ${filename}`);
        // In production, integrate with ClamAV or similar
        return { clean: false, threat: 'Suspicious signature detected' };
      }
    }

    return { clean: true };
  }

  /**
   * Process and encrypt uploaded file
   */
  async processUpload(file, userId, classification = 'sensitive') {
    try {
      // Scan for malware
      const scanResult = await this.scanForMalware(file.buffer, file.originalname);
      
      if (!scanResult.clean) {
        throw new Error(`Security threat detected: ${scanResult.threat}`);
      }

      // Generate file metadata
      const fileId = crypto.randomBytes(16).toString('hex');
      const metadata = {
        originalName: file.originalname,
        sanitizedName: file.sanitizedName || file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        uploadDate: new Date().toISOString(),
        uploaderId: userId,
        fileId
      };

      // Encrypt file
      const encryptedFile = encryptionService.encryptFile(
        file.buffer,
        file.originalname,
        file.mimetype
      );

      // Store encrypted file in database
      const result = await pool.query(`
        INSERT INTO encrypted_files (
          original_filename, mime_type, file_size,
          data_encrypted, metadata_encrypted, checksum,
          owner_id, data_classification, encryption_version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, checksum
      `, [
        file.sanitizedName,
        file.mimetype,
        file.size,
        encryptedFile.data,
        encryptedFile.metadata,
        encryptedFile.checksum,
        userId,
        classification,
        1
      ]);

      // Log file upload
      await pool.query(`
        INSERT INTO cjis_audit_log (
          user_id, action, resource_type, resource_id,
          data_classification, access_result, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        userId,
        'FILE_UPLOAD',
        'encrypted_file',
        result.rows[0].id.toString(),
        classification,
        'granted',
        JSON.stringify({
          filename: file.sanitizedName,
          mimeType: file.mimetype,
          size: file.size,
          checksum: result.rows[0].checksum,
          timestamp: new Date().toISOString()
        })
      ]);

      return {
        success: true,
        fileId: result.rows[0].id,
        checksum: result.rows[0].checksum,
        filename: file.sanitizedName,
        size: file.size
      };
    } catch (error) {
      console.error('File upload processing error:', error);
      
      // Log failed upload
      await pool.query(`
        INSERT INTO cjis_audit_log (
          user_id, action, data_classification, access_result, metadata
        ) VALUES ($1, $2, $3, $4, $5)
      `, [
        userId,
        'FILE_UPLOAD_FAILED',
        classification,
        'denied',
        JSON.stringify({
          filename: file.originalname,
          error: error.message,
          timestamp: new Date().toISOString()
        })
      ]);

      throw error;
    }
  }

  /**
   * Retrieve and decrypt file
   */
  async retrieveFile(fileId, userId) {
    try {
      // Get encrypted file
      const result = await pool.query(`
        SELECT * FROM encrypted_files
        WHERE id = $1
      `, [fileId]);

      if (result.rows.length === 0) {
        throw new Error('File not found');
      }

      const encryptedFile = result.rows[0];

      // Check access permissions
      if (encryptedFile.owner_id !== userId) {
        // Check if user has admin role
        const userResult = await pool.query(`
          SELECT role FROM users WHERE id = $1
        `, [userId]);

        if (!userResult.rows[0] || userResult.rows[0].role !== 'admin') {
          throw new Error('Access denied');
        }
      }

      // Decrypt file
      const decryptedFile = encryptionService.decryptFile({
        data: encryptedFile.data_encrypted,
        metadata: encryptedFile.metadata_encrypted,
        checksum: encryptedFile.checksum
      });

      // Update access tracking
      await pool.query(`
        UPDATE encrypted_files
        SET last_accessed = CURRENT_TIMESTAMP,
            access_count = access_count + 1
        WHERE id = $1
      `, [fileId]);

      // Log file access
      await pool.query(`
        INSERT INTO cjis_audit_log (
          user_id, action, resource_type, resource_id,
          data_classification, access_result, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        userId,
        'FILE_DOWNLOAD',
        'encrypted_file',
        fileId.toString(),
        encryptedFile.data_classification,
        'granted',
        JSON.stringify({
          filename: encryptedFile.original_filename,
          timestamp: new Date().toISOString()
        })
      ]);

      return {
        data: decryptedFile.data,
        metadata: decryptedFile.metadata,
        filename: encryptedFile.original_filename,
        mimeType: encryptedFile.mime_type
      };
    } catch (error) {
      console.error('File retrieval error:', error);
      
      // Log failed access
      await pool.query(`
        INSERT INTO cjis_audit_log (
          user_id, action, resource_id, access_result, metadata
        ) VALUES ($1, $2, $3, $4, $5)
      `, [
        userId,
        'FILE_DOWNLOAD_FAILED',
        fileId?.toString(),
        'denied',
        JSON.stringify({
          error: error.message,
          timestamp: new Date().toISOString()
        })
      ]);

      throw error;
    }
  }

  /**
   * Delete encrypted file
   */
  async deleteFile(fileId, userId) {
    try {
      // Check ownership
      const result = await pool.query(`
        SELECT owner_id, original_filename, data_classification
        FROM encrypted_files
        WHERE id = $1
      `, [fileId]);

      if (result.rows.length === 0) {
        throw new Error('File not found');
      }

      const file = result.rows[0];

      if (file.owner_id !== userId) {
        // Check admin role
        const userResult = await pool.query(`
          SELECT role FROM users WHERE id = $1
        `, [userId]);

        if (!userResult.rows[0] || userResult.rows[0].role !== 'admin') {
          throw new Error('Access denied');
        }
      }

      // Delete file
      await pool.query(`
        DELETE FROM encrypted_files
        WHERE id = $1
      `, [fileId]);

      // Log deletion
      await pool.query(`
        INSERT INTO cjis_audit_log (
          user_id, action, resource_type, resource_id,
          data_classification, access_result, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        userId,
        'FILE_DELETE',
        'encrypted_file',
        fileId.toString(),
        file.data_classification,
        'granted',
        JSON.stringify({
          filename: file.original_filename,
          timestamp: new Date().toISOString()
        })
      ]);

      return { success: true };
    } catch (error) {
      console.error('File deletion error:', error);
      throw error;
    }
  }

  /**
   * Express middleware for secure file upload
   */
  uploadMiddleware() {
    const upload = this.getMulterConfig();
    
    return async (req, res, next) => {
      upload.single('file')(req, res, async (err) => {
        if (err) {
          return res.status(400).json({
            error: 'File upload failed',
            message: err.message
          });
        }

        if (!req.file) {
          return res.status(400).json({
            error: 'No file provided'
          });
        }

        try {
          // Process and encrypt file
          const result = await this.processUpload(
            req.file,
            req.user.id,
            req.body.classification || 'sensitive'
          );

          req.uploadedFile = result;
          next();
        } catch (error) {
          return res.status(500).json({
            error: 'File processing failed',
            message: error.message
          });
        }
      });
    };
  }

  /**
   * Express middleware for secure file download
   */
  downloadMiddleware() {
    return async (req, res) => {
      try {
        const fileId = req.params.fileId;
        const userId = req.user.id;

        const file = await this.retrieveFile(fileId, userId);

        // Set headers
        res.setHeader('Content-Type', file.mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
        res.setHeader('Content-Length', file.data.length);
        
        // Security headers
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        // Send file
        res.send(file.data);
      } catch (error) {
        res.status(error.message === 'Access denied' ? 403 : 404).json({
          error: error.message
        });
      }
    };
  }
}

// Export singleton instance
const secureFileUpload = new SecureFileUpload();
module.exports = secureFileUpload;