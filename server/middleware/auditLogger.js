const { pool } = require('../config/database');
const crypto = require('crypto');
const encryptionService = require('../utils/encryption');

/**
 * CJIS v6.0 Compliant Comprehensive Audit Logging System
 * Implements detailed logging of all CJI access with integrity protection
 */
class AuditLogger {
  constructor() {
    this.logLevels = {
      INFO: 'info',
      WARNING: 'warning',
      ERROR: 'error',
      CRITICAL: 'critical',
      SECURITY: 'security'
    };
    
    this.eventTypes = {
      // Authentication events
      LOGIN_SUCCESS: 'LOGIN_SUCCESS',
      LOGIN_FAILED: 'LOGIN_FAILED',
      LOGOUT: 'LOGOUT',
      PASSWORD_CHANGED: 'PASSWORD_CHANGED',
      PASSWORD_RESET: 'PASSWORD_RESET',
      MFA_ENABLED: 'MFA_ENABLED',
      MFA_DISABLED: 'MFA_DISABLED',
      SESSION_TIMEOUT: 'SESSION_TIMEOUT',
      
      // Data access events
      CJI_ACCESS: 'CJI_ACCESS',
      CJI_CREATE: 'CJI_CREATE',
      CJI_UPDATE: 'CJI_UPDATE',
      CJI_DELETE: 'CJI_DELETE',
      CJI_EXPORT: 'CJI_EXPORT',
      CJI_PRINT: 'CJI_PRINT',
      FILE_UPLOAD: 'FILE_UPLOAD',
      FILE_DOWNLOAD: 'FILE_DOWNLOAD',
      
      // Administrative events
      USER_CREATED: 'USER_CREATED',
      USER_MODIFIED: 'USER_MODIFIED',
      USER_DELETED: 'USER_DELETED',
      ROLE_CHANGED: 'ROLE_CHANGED',
      PERMISSION_GRANTED: 'PERMISSION_GRANTED',
      PERMISSION_REVOKED: 'PERMISSION_REVOKED',
      SYSTEM_CONFIG_CHANGED: 'SYSTEM_CONFIG_CHANGED',
      
      // Security events
      ACCESS_DENIED: 'ACCESS_DENIED',
      INVALID_REQUEST: 'INVALID_REQUEST',
      SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
      BRUTE_FORCE_ATTEMPT: 'BRUTE_FORCE_ATTEMPT',
      SQL_INJECTION_ATTEMPT: 'SQL_INJECTION_ATTEMPT',
      XSS_ATTEMPT: 'XSS_ATTEMPT',
      
      // System events
      SYSTEM_START: 'SYSTEM_START',
      SYSTEM_STOP: 'SYSTEM_STOP',
      BACKUP_CREATED: 'BACKUP_CREATED',
      BACKUP_RESTORED: 'BACKUP_RESTORED',
      KEY_ROTATION: 'KEY_ROTATION',
      AUDIT_LOG_EXPORT: 'AUDIT_LOG_EXPORT'
    };
    
    this.dataClassifications = {
      PUBLIC: 'public',
      SENSITIVE: 'sensitive',
      CJI: 'cji'
    };
    
    // Initialize integrity chain
    this.previousHash = null;
    this.initializeIntegrityChain();
  }

  /**
   * Initialize the integrity chain for tamper detection
   */
  async initializeIntegrityChain() {
    try {
      const result = await pool.query(`
        SELECT integrity_hash 
        FROM cjis_audit_log 
        ORDER BY timestamp DESC 
        LIMIT 1
      `);
      
      if (result.rows.length > 0) {
        this.previousHash = result.rows[0].integrity_hash;
      } else {
        // Genesis block for integrity chain
        this.previousHash = crypto.createHash('sha256')
          .update('CJIS_AUDIT_LOG_GENESIS_BLOCK')
          .digest('hex');
      }
    } catch (error) {
      console.error('Failed to initialize audit integrity chain:', error);
    }
  }

  /**
   * Log an audit event with full context
   */
  async logEvent({
    eventType,
    userId = null,
    username = null,
    action,
    resourceType = null,
    resourceId = null,
    dataClassification = this.dataClassifications.PUBLIC,
    accessResult = 'granted',
    ipAddress = null,
    userAgent = null,
    requestMethod = null,
    requestPath = null,
    responseCode = null,
    errorMessage = null,
    metadata = {},
    req = null
  }) {
    try {
      // Extract context from request if provided
      if (req) {
        ipAddress = ipAddress || this.getClientIp(req);
        userAgent = userAgent || req.headers['user-agent'];
        requestMethod = requestMethod || req.method;
        requestPath = requestPath || req.originalUrl || req.url;
        userId = userId || req.user?.id;
        username = username || req.user?.username;
      }
      
      // Build comprehensive audit entry
      const auditEntry = {
        eventType,
        userId,
        username,
        action,
        resourceType,
        resourceId,
        dataClassification,
        accessResult,
        ipAddress,
        userAgent,
        requestMethod,
        requestPath,
        responseCode,
        errorMessage,
        timestamp: new Date().toISOString(),
        sessionId: req?.session?.id || null,
        serverHostname: require('os').hostname(),
        processId: process.pid
      };
      
      // Add metadata
      const fullMetadata = {
        ...metadata,
        ...auditEntry,
        environment: process.env.NODE_ENV,
        nodeVersion: process.version
      };
      
      // Generate integrity hash with chain
      const integrityData = JSON.stringify({
        ...auditEntry,
        metadata: fullMetadata,
        previousHash: this.previousHash
      });
      const integrityHash = crypto.createHash('sha256').update(integrityData).digest('hex');
      
      // Store in database
      const result = await pool.query(`
        INSERT INTO cjis_audit_log (
          event_type, user_id, username, action,
          resource_type, resource_id, data_classification,
          access_result, ip_address, user_agent,
          request_method, request_path, response_code,
          error_message, metadata, integrity_hash,
          previous_hash, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, CURRENT_TIMESTAMP)
        RETURNING id, timestamp
      `, [
        eventType,
        userId,
        username,
        action,
        resourceType,
        resourceId,
        dataClassification,
        accessResult,
        ipAddress,
        userAgent,
        requestMethod,
        requestPath,
        responseCode,
        errorMessage,
        JSON.stringify(fullMetadata),
        integrityHash,
        this.previousHash
      ]);
      
      // Update previous hash for chain
      this.previousHash = integrityHash;
      
      // Check for security events that need immediate alerting
      if (this.isSecurityEvent(eventType)) {
        await this.triggerSecurityAlert(auditEntry, result.rows[0].id);
      }
      
      // Check for compliance violations
      if (this.isComplianceViolation(auditEntry)) {
        await this.triggerComplianceAlert(auditEntry, result.rows[0].id);
      }
      
      return result.rows[0];
    } catch (error) {
      console.error('Failed to log audit event:', error);
      // Audit logging failures should not break the application
      // But we should track them
      this.logToBackupSystem(error);
    }
  }

  /**
   * Log CJI access with enhanced tracking
   */
  async logCJIAccess(req, resourceType, resourceId, action, accessResult = 'granted') {
    const classification = this.determineDataClassification(resourceType);
    
    return this.logEvent({
      eventType: this.eventTypes.CJI_ACCESS,
      action: action || 'VIEW',
      resourceType,
      resourceId,
      dataClassification: classification,
      accessResult,
      metadata: {
        queryParameters: req.query,
        requestBody: this.sanitizeRequestBody(req.body),
        timestamp: new Date().toISOString()
      },
      req
    });
  }

  /**
   * Log authentication events
   */
  async logAuthentication(eventType, userId, username, success, metadata = {}, req = null) {
    return this.logEvent({
      eventType,
      userId,
      username,
      action: eventType,
      accessResult: success ? 'granted' : 'denied',
      dataClassification: this.dataClassifications.SENSITIVE,
      metadata: {
        ...metadata,
        authenticationMethod: metadata.method || 'password',
        mfaUsed: metadata.mfaUsed || false,
        timestamp: new Date().toISOString()
      },
      req
    });
  }

  /**
   * Log administrative actions
   */
  async logAdminAction(action, targetResource, targetId, changes = {}, req = null) {
    return this.logEvent({
      eventType: this.eventTypes[action] || action,
      action,
      resourceType: targetResource,
      resourceId: targetId,
      dataClassification: this.dataClassifications.CJI,
      metadata: {
        changes,
        beforeState: changes.before,
        afterState: changes.after,
        timestamp: new Date().toISOString()
      },
      req
    });
  }

  /**
   * Log security incidents
   */
  async logSecurityIncident(incidentType, severity, details = {}, req = null) {
    const event = await this.logEvent({
      eventType: incidentType,
      action: 'SECURITY_INCIDENT',
      dataClassification: this.dataClassifications.CJI,
      accessResult: 'denied',
      metadata: {
        severity,
        incidentDetails: details,
        timestamp: new Date().toISOString(),
        incidentId: crypto.randomBytes(16).toString('hex')
      },
      req
    });
    
    // Create security incident record
    await this.createSecurityIncident(event.id, incidentType, severity, details);
    
    return event;
  }

  /**
   * Verify audit log integrity
   */
  async verifyIntegrity(startDate = null, endDate = null) {
    try {
      let query = `
        SELECT id, integrity_hash, previous_hash, 
               event_type, user_id, username, action,
               resource_type, resource_id, data_classification,
               access_result, ip_address, user_agent,
               request_method, request_path, response_code,
               error_message, metadata, timestamp
        FROM cjis_audit_log
      `;
      
      const params = [];
      if (startDate || endDate) {
        const conditions = [];
        if (startDate) {
          conditions.push(`timestamp >= $${params.length + 1}`);
          params.push(startDate);
        }
        if (endDate) {
          conditions.push(`timestamp <= $${params.length + 1}`);
          params.push(endDate);
        }
        query += ` WHERE ${conditions.join(' AND ')}`;
      }
      
      query += ' ORDER BY timestamp ASC';
      
      const result = await pool.query(query, params);
      
      let previousHash = crypto.createHash('sha256')
        .update('CJIS_AUDIT_LOG_GENESIS_BLOCK')
        .digest('hex');
      
      const integrityErrors = [];
      
      for (const row of result.rows) {
        // Verify chain continuity
        if (row.previous_hash !== previousHash) {
          integrityErrors.push({
            id: row.id,
            error: 'Chain discontinuity',
            expected: previousHash,
            actual: row.previous_hash
          });
        }
        
        // Verify hash
        const entryData = {
          eventType: row.event_type,
          userId: row.user_id,
          username: row.username,
          action: row.action,
          resourceType: row.resource_type,
          resourceId: row.resource_id,
          dataClassification: row.data_classification,
          accessResult: row.access_result,
          ipAddress: row.ip_address,
          userAgent: row.user_agent,
          requestMethod: row.request_method,
          requestPath: row.request_path,
          responseCode: row.response_code,
          errorMessage: row.error_message,
          timestamp: row.timestamp.toISOString(),
          sessionId: row.metadata?.sessionId || null,
          serverHostname: row.metadata?.serverHostname,
          processId: row.metadata?.processId
        };
        
        const integrityData = JSON.stringify({
          ...entryData,
          metadata: row.metadata,
          previousHash: row.previous_hash
        });
        
        const calculatedHash = crypto.createHash('sha256').update(integrityData).digest('hex');
        
        if (calculatedHash !== row.integrity_hash) {
          integrityErrors.push({
            id: row.id,
            error: 'Hash mismatch - possible tampering',
            expected: calculatedHash,
            actual: row.integrity_hash
          });
        }
        
        previousHash = row.integrity_hash;
      }
      
      return {
        verified: integrityErrors.length === 0,
        totalRecords: result.rows.length,
        errors: integrityErrors,
        verificationDate: new Date().toISOString()
      };
    } catch (error) {
      console.error('Integrity verification failed:', error);
      throw error;
    }
  }

  /**
   * Generate audit report
   */
  async generateAuditReport(startDate, endDate, options = {}) {
    try {
      const report = {
        reportId: crypto.randomBytes(16).toString('hex'),
        generatedAt: new Date().toISOString(),
        period: { startDate, endDate },
        statistics: {},
        topEvents: [],
        securityIncidents: [],
        complianceIssues: [],
        userActivity: [],
        dataAccess: []
      };
      
      // Get event statistics
      const statsResult = await pool.query(`
        SELECT 
          event_type,
          COUNT(*) as count,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(CASE WHEN access_result = 'denied' THEN 1 END) as denied_count
        FROM cjis_audit_log
        WHERE timestamp BETWEEN $1 AND $2
        GROUP BY event_type
        ORDER BY count DESC
      `, [startDate, endDate]);
      
      report.statistics = statsResult.rows;
      
      // Get security incidents
      const incidentsResult = await pool.query(`
        SELECT * FROM cjis_audit_log
        WHERE timestamp BETWEEN $1 AND $2
          AND event_type IN ($3, $4, $5, $6, $7)
        ORDER BY timestamp DESC
      `, [
        startDate, endDate,
        this.eventTypes.SUSPICIOUS_ACTIVITY,
        this.eventTypes.BRUTE_FORCE_ATTEMPT,
        this.eventTypes.SQL_INJECTION_ATTEMPT,
        this.eventTypes.XSS_ATTEMPT,
        this.eventTypes.ACCESS_DENIED
      ]);
      
      report.securityIncidents = incidentsResult.rows;
      
      // Get CJI data access
      const cjiAccessResult = await pool.query(`
        SELECT 
          user_id,
          username,
          COUNT(*) as access_count,
          COUNT(DISTINCT resource_id) as unique_resources,
          MAX(timestamp) as last_access
        FROM cjis_audit_log
        WHERE timestamp BETWEEN $1 AND $2
          AND data_classification = 'cji'
        GROUP BY user_id, username
        ORDER BY access_count DESC
      `, [startDate, endDate]);
      
      report.dataAccess = cjiAccessResult.rows;
      
      // Verify integrity for the period
      report.integrityCheck = await this.verifyIntegrity(startDate, endDate);
      
      // Log the report generation
      await this.logEvent({
        eventType: this.eventTypes.AUDIT_LOG_EXPORT,
        action: 'GENERATE_REPORT',
        dataClassification: this.dataClassifications.CJI,
        metadata: {
          reportId: report.reportId,
          period: report.period,
          options
        }
      });
      
      return report;
    } catch (error) {
      console.error('Failed to generate audit report:', error);
      throw error;
    }
  }

  /**
   * Helper: Get client IP address
   */
  getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
           req.headers['x-real-ip'] ||
           req.connection?.remoteAddress ||
           req.socket?.remoteAddress ||
           req.ip;
  }

  /**
   * Helper: Determine data classification
   */
  determineDataClassification(resourceType) {
    const cjiResources = ['criminal_record', 'warrant', 'arrest', 'conviction', 'intel_report'];
    const sensitiveResources = ['user', 'profile', 'post', 'comment'];
    
    if (cjiResources.includes(resourceType)) {
      return this.dataClassifications.CJI;
    } else if (sensitiveResources.includes(resourceType)) {
      return this.dataClassifications.SENSITIVE;
    }
    
    return this.dataClassifications.PUBLIC;
  }

  /**
   * Helper: Sanitize request body for logging
   */
  sanitizeRequestBody(body) {
    if (!body) return null;
    
    const sanitized = { ...body };
    const sensitiveFields = ['password', 'ssn', 'creditCard', 'token', 'secret'];
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  /**
   * Helper: Check if event is security-related
   */
  isSecurityEvent(eventType) {
    const securityEvents = [
      this.eventTypes.SUSPICIOUS_ACTIVITY,
      this.eventTypes.BRUTE_FORCE_ATTEMPT,
      this.eventTypes.SQL_INJECTION_ATTEMPT,
      this.eventTypes.XSS_ATTEMPT,
      this.eventTypes.ACCESS_DENIED
    ];
    
    return securityEvents.includes(eventType);
  }

  /**
   * Helper: Check for compliance violations
   */
  isComplianceViolation(auditEntry) {
    // Check for violations
    if (auditEntry.eventType === this.eventTypes.SESSION_TIMEOUT && 
        auditEntry.metadata?.sessionDuration > 1800000) { // 30 minutes
      return true;
    }
    
    if (auditEntry.dataClassification === 'cji' && 
        auditEntry.accessResult === 'denied') {
      return true;
    }
    
    return false;
  }

  /**
   * Trigger security alert
   */
  async triggerSecurityAlert(auditEntry, auditId) {
    // In production, this would send alerts via email, SMS, or monitoring system
    console.error('🚨 SECURITY ALERT:', {
      eventType: auditEntry.eventType,
      user: auditEntry.username,
      ip: auditEntry.ipAddress,
      auditId
    });
    
    // Store alert
    await pool.query(`
      INSERT INTO security_alerts (
        audit_log_id, alert_type, severity,
        description, metadata
      ) VALUES ($1, $2, $3, $4, $5)
    `, [
      auditId,
      auditEntry.eventType,
      'HIGH',
      `Security event detected: ${auditEntry.eventType}`,
      JSON.stringify(auditEntry)
    ]);
  }

  /**
   * Trigger compliance alert
   */
  async triggerComplianceAlert(auditEntry, auditId) {
    console.warn('⚠️ COMPLIANCE ALERT:', {
      issue: 'Potential compliance violation',
      auditId,
      details: auditEntry
    });
  }

  /**
   * Create security incident record
   */
  async createSecurityIncident(auditId, incidentType, severity, details) {
    await pool.query(`
      INSERT INTO security_incidents (
        audit_log_id, incident_type, severity,
        status, details, created_at
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
    `, [
      auditId,
      incidentType,
      severity,
      'open',
      JSON.stringify(details)
    ]);
  }

  /**
   * Backup logging system for audit failures
   */
  logToBackupSystem(error) {
    const fs = require('fs').promises;
    const path = require('path');
    const logPath = path.join(__dirname, '../../logs/audit-backup.log');
    
    const entry = {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack
    };
    
    // Append to file as backup
    fs.appendFile(logPath, JSON.stringify(entry) + '\n').catch(console.error);
  }
}

// Export singleton instance
const auditLogger = new AuditLogger();
module.exports = auditLogger;