const { pool } = require('../config/database');
const auditLogger = require('../middleware/auditLogger');
const securityMonitor = require('./securityMonitor');
const encryptionService = require('../utils/encryption');
const crypto = require('crypto');
const EventEmitter = require('events');

/**
 * CJIS v6.0 Compliant Incident Response System
 * Implements comprehensive incident detection, response, and recovery
 */
class IncidentResponseSystem extends EventEmitter {
  constructor() {
    super();
    
    this.incidentStates = {
      DETECTED: 'detected',
      TRIAGED: 'triaged',
      CONTAINED: 'contained',
      ERADICATED: 'eradicated',
      RECOVERED: 'recovered',
      LESSONS_LEARNED: 'lessons_learned',
      CLOSED: 'closed'
    };
    
    this.severityLevels = {
      CRITICAL: { level: 1, responseTime: 15, escalation: 'immediate' },
      HIGH: { level: 2, responseTime: 60, escalation: '1_hour' },
      MEDIUM: { level: 3, responseTime: 240, escalation: '4_hours' },
      LOW: { level: 4, responseTime: 1440, escalation: '24_hours' }
    };
    
    this.incidentTypes = {
      DATA_BREACH: 'data_breach',
      UNAUTHORIZED_ACCESS: 'unauthorized_access',
      MALWARE: 'malware',
      DOS_ATTACK: 'dos_attack',
      INSIDER_THREAT: 'insider_threat',
      DATA_LOSS: 'data_loss',
      SYSTEM_COMPROMISE: 'system_compromise',
      POLICY_VIOLATION: 'policy_violation',
      PHYSICAL_BREACH: 'physical_breach'
    };
    
    this.responseTeam = new Map();
    this.activeIncidents = new Map();
    this.incidentQueue = [];
    this.forensicsData = new Map();
    
    // Initialize the system
    this.initialize();
  }

  /**
   * Initialize the incident response system
   */
  async initialize() {
    try {
      // Load active incidents
      await this.loadActiveIncidents();
      
      // Setup automated detection
      this.setupAutomatedDetection();
      
      // Initialize response procedures
      await this.loadResponseProcedures();
      
      // Start monitoring
      this.startIncidentMonitoring();
      
      console.log('✅ Incident Response System initialized');
    } catch (error) {
      console.error('Failed to initialize incident response:', error);
    }
  }

  /**
   * Create a new security incident
   */
  async createIncident({
    type,
    severity,
    description,
    source,
    affectedSystems = [],
    affectedUsers = [],
    detectionMethod = 'automated',
    initialFindings = {},
    auditLogIds = []
  }) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Generate incident ID
      const incidentId = this.generateIncidentId();
      const timestamp = new Date().toISOString();
      
      // Determine response requirements
      const severityConfig = this.severityLevels[severity];
      const responseDeadline = new Date(Date.now() + severityConfig.responseTime * 60 * 1000);
      
      // Create incident record
      const incidentResult = await client.query(`
        INSERT INTO incident_response (
          incident_id, incident_type, severity, state,
          description, detection_method, response_deadline,
          affected_systems, affected_users, initial_findings,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
      `, [
        incidentId,
        type,
        severity,
        this.incidentStates.DETECTED,
        description,
        detectionMethod,
        responseDeadline,
        JSON.stringify(affectedSystems),
        JSON.stringify(affectedUsers),
        JSON.stringify(initialFindings),
        timestamp
      ]);
      
      const dbId = incidentResult.rows[0].id;
      
      // Link audit logs to incident
      if (auditLogIds.length > 0) {
        for (const auditId of auditLogIds) {
          await client.query(`
            INSERT INTO incident_audit_logs (incident_id, audit_log_id)
            VALUES ($1, $2)
          `, [dbId, auditId]);
        }
      }
      
      // Collect initial forensics
      const forensics = await this.collectForensics({
        incidentId,
        type,
        source,
        affectedSystems
      });
      
      // Store forensics data
      await client.query(`
        INSERT INTO incident_forensics (
          incident_id, data_collected, collection_time, encrypted_data
        ) VALUES ($1, $2, $3, $4)
      `, [
        dbId,
        JSON.stringify(forensics.metadata),
        timestamp,
        forensics.encryptedData
      ]);
      
      // Create response team assignment
      const responders = await this.assignResponseTeam(severity, type);
      
      for (const responder of responders) {
        await client.query(`
          INSERT INTO incident_responders (
            incident_id, user_id, role, assigned_at
          ) VALUES ($1, $2, $3, $4)
        `, [dbId, responder.userId, responder.role, timestamp]);
      }
      
      // Log incident creation
      await auditLogger.logEvent({
        eventType: 'INCIDENT_CREATED',
        action: 'CREATE_INCIDENT',
        resourceType: 'incident',
        resourceId: incidentId,
        dataClassification: 'cji',
        metadata: {
          incidentId,
          type,
          severity,
          affectedSystems,
          affectedUsers
        }
      });
      
      await client.query('COMMIT');
      
      // Store in active incidents
      const incident = {
        id: dbId,
        incidentId,
        type,
        severity,
        state: this.incidentStates.DETECTED,
        description,
        responseDeadline,
        responders,
        forensics: forensics.id,
        createdAt: timestamp
      };
      
      this.activeIncidents.set(incidentId, incident);
      
      // Trigger notifications
      await this.notifyResponseTeam(incident);
      
      // Emit event for real-time updates
      this.emit('incident:created', incident);
      
      // Start automated response if critical
      if (severity === 'CRITICAL') {
        await this.initiateAutomatedResponse(incident);
      }
      
      return incident;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Failed to create incident:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update incident state
   */
  async updateIncidentState(incidentId, newState, notes = '', userId = null) {
    try {
      const incident = this.activeIncidents.get(incidentId);
      if (!incident) {
        throw new Error(`Incident not found: ${incidentId}`);
      }
      
      const timestamp = new Date().toISOString();
      
      // Update database
      await pool.query(`
        UPDATE incident_response
        SET 
          state = $1,
          last_updated = $2,
          state_history = state_history || $3::jsonb
        WHERE incident_id = $4
      `, [
        newState,
        timestamp,
        JSON.stringify({
          from: incident.state,
          to: newState,
          timestamp,
          userId,
          notes
        }),
        incidentId
      ]);
      
      // Update in memory
      incident.state = newState;
      incident.lastUpdated = timestamp;
      
      // Log state change
      await auditLogger.logEvent({
        eventType: 'INCIDENT_STATE_CHANGED',
        action: 'UPDATE_INCIDENT_STATE',
        userId,
        resourceType: 'incident',
        resourceId: incidentId,
        dataClassification: 'cji',
        metadata: {
          from: incident.state,
          to: newState,
          notes
        }
      });
      
      // Execute state-specific actions
      await this.executeStateActions(incident, newState);
      
      // Emit event
      this.emit('incident:stateChanged', {
        incidentId,
        previousState: incident.state,
        newState,
        timestamp
      });
      
      return incident;
    } catch (error) {
      console.error('Failed to update incident state:', error);
      throw error;
    }
  }

  /**
   * Execute containment actions
   */
  async containIncident(incidentId, containmentActions = []) {
    const incident = this.activeIncidents.get(incidentId);
    if (!incident) {
      throw new Error(`Incident not found: ${incidentId}`);
    }
    
    const results = {
      successful: [],
      failed: [],
      timestamp: new Date().toISOString()
    };
    
    // Default containment actions based on incident type
    const defaultActions = this.getDefaultContainmentActions(incident.type);
    const allActions = [...defaultActions, ...containmentActions];
    
    for (const action of allActions) {
      try {
        const result = await this.executeContainmentAction(action, incident);
        results.successful.push({
          action: action.type,
          result,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        results.failed.push({
          action: action.type,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Store containment results
    await pool.query(`
      UPDATE incident_response
      SET 
        containment_actions = $1,
        containment_completed = $2
      WHERE incident_id = $3
    `, [
      JSON.stringify(results),
      results.failed.length === 0,
      incidentId
    ]);
    
    // Update incident state if contained
    if (results.failed.length === 0) {
      await this.updateIncidentState(incidentId, this.incidentStates.CONTAINED);
    }
    
    return results;
  }

  /**
   * Execute a specific containment action
   */
  async executeContainmentAction(action, incident) {
    switch (action.type) {
      case 'ISOLATE_SYSTEM':
        return await this.isolateSystem(action.target);
        
      case 'DISABLE_ACCOUNT':
        return await this.disableAccount(action.userId);
        
      case 'BLOCK_IP':
        return await this.blockIPAddress(action.ipAddress);
        
      case 'REVOKE_ACCESS':
        return await this.revokeAccess(action.userId, action.resource);
        
      case 'QUARANTINE_FILE':
        return await this.quarantineFile(action.fileId);
        
      case 'RESET_CREDENTIALS':
        return await this.forcePasswordReset(action.userId);
        
      case 'TERMINATE_SESSIONS':
        return await this.terminateUserSessions(action.userId);
        
      case 'BACKUP_EVIDENCE':
        return await this.backupEvidence(incident.incidentId);
        
      default:
        throw new Error(`Unknown containment action: ${action.type}`);
    }
  }

  /**
   * Isolate a compromised system
   */
  async isolateSystem(systemId) {
    // In production, this would interact with network infrastructure
    await pool.query(`
      INSERT INTO system_isolation (
        system_id, isolated_at, isolation_type
      ) VALUES ($1, CURRENT_TIMESTAMP, $2)
    `, [systemId, 'network_isolation']);
    
    return { isolated: true, systemId };
  }

  /**
   * Disable user account
   */
  async disableAccount(userId) {
    await pool.query(`
      UPDATE users 
      SET 
        account_status = 'suspended',
        suspension_reason = 'Security incident',
        suspended_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [userId]);
    
    // Terminate all active sessions
    await pool.query(`
      UPDATE user_sessions
      SET is_active = false
      WHERE user_id = $1
    `, [userId]);
    
    return { disabled: true, userId };
  }

  /**
   * Block IP address
   */
  async blockIPAddress(ipAddress) {
    await pool.query(`
      INSERT INTO blocked_ips (
        ip_address, blocked_at, reason, expires_at
      ) VALUES ($1, CURRENT_TIMESTAMP, $2, $3)
    `, [
      ipAddress,
      'Security incident response',
      new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hour block
    ]);
    
    return { blocked: true, ipAddress };
  }

  /**
   * Collect forensic data
   */
  async collectForensics({ incidentId, type, source, affectedSystems }) {
    const forensicsId = crypto.randomBytes(16).toString('hex');
    const timestamp = new Date().toISOString();
    
    const forensicsData = {
      id: forensicsId,
      incidentId,
      timestamp,
      systemSnapshots: [],
      logExtracts: [],
      memoryDumps: [],
      networkCaptures: [],
      fileHashes: []
    };
    
    // Collect system state snapshots
    for (const system of affectedSystems) {
      const snapshot = await this.captureSystemSnapshot(system);
      forensicsData.systemSnapshots.push(snapshot);
    }
    
    // Extract relevant logs
    const logs = await this.extractRelevantLogs(incidentId, timestamp);
    forensicsData.logExtracts = logs;
    
    // Collect network data if available
    if (source?.ipAddress) {
      const networkData = await this.captureNetworkData(source.ipAddress);
      forensicsData.networkCaptures.push(networkData);
    }
    
    // Calculate integrity hashes
    forensicsData.integrityHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(forensicsData))
      .digest('hex');
    
    // Encrypt sensitive forensics data
    const encryptedData = encryptionService.encrypt(
      JSON.stringify(forensicsData),
      'cji',
      'forensics'
    );
    
    // Store in forensics map
    this.forensicsData.set(forensicsId, {
      metadata: {
        id: forensicsId,
        incidentId,
        timestamp,
        dataPoints: forensicsData.systemSnapshots.length + 
                   forensicsData.logExtracts.length
      },
      encryptedData
    });
    
    return {
      id: forensicsId,
      metadata: forensicsData,
      encryptedData
    };
  }

  /**
   * Capture system snapshot
   */
  async captureSystemSnapshot(systemId) {
    const snapshot = {
      systemId,
      timestamp: new Date().toISOString(),
      processes: [],
      connections: [],
      users: [],
      files: []
    };
    
    // Get current user sessions on system
    const sessions = await pool.query(`
      SELECT * FROM user_sessions
      WHERE is_active = true
    `);
    
    snapshot.users = sessions.rows;
    
    // Get recent file access
    const fileAccess = await pool.query(`
      SELECT * FROM cjis_audit_log
      WHERE resource_type = 'file'
        AND timestamp > CURRENT_TIMESTAMP - INTERVAL '1 hour'
      ORDER BY timestamp DESC
      LIMIT 100
    `);
    
    snapshot.files = fileAccess.rows;
    
    return snapshot;
  }

  /**
   * Extract relevant logs for incident
   */
  async extractRelevantLogs(incidentId, timestamp) {
    const logs = [];
    
    // Get logs around incident time
    const timeWindow = new Date(new Date(timestamp).getTime() - 60 * 60 * 1000); // 1 hour before
    
    const relevantLogs = await pool.query(`
      SELECT * FROM cjis_audit_log
      WHERE timestamp BETWEEN $1 AND $2
        AND (access_result = 'denied' 
             OR event_type LIKE '%FAILED%'
             OR event_type LIKE '%ERROR%'
             OR data_classification = 'cji')
      ORDER BY timestamp DESC
      LIMIT 500
    `, [timeWindow, timestamp]);
    
    logs.push(...relevantLogs.rows);
    
    return logs;
  }

  /**
   * Capture network data
   */
  async captureNetworkData(ipAddress) {
    // Get recent connections from this IP
    const connections = await pool.query(`
      SELECT * FROM cjis_audit_log
      WHERE ip_address = $1
        AND timestamp > CURRENT_TIMESTAMP - INTERVAL '24 hours'
      ORDER BY timestamp DESC
    `, [ipAddress]);
    
    return {
      ipAddress,
      connections: connections.rows,
      capturedAt: new Date().toISOString()
    };
  }

  /**
   * Generate recovery plan
   */
  async generateRecoveryPlan(incidentId) {
    const incident = this.activeIncidents.get(incidentId);
    if (!incident) {
      throw new Error(`Incident not found: ${incidentId}`);
    }
    
    const plan = {
      incidentId,
      generated: new Date().toISOString(),
      steps: [],
      estimatedTime: 0,
      resources: [],
      validations: []
    };
    
    // Generate recovery steps based on incident type
    switch (incident.type) {
      case this.incidentTypes.DATA_BREACH:
        plan.steps = [
          { order: 1, action: 'Verify containment completion', time: 30 },
          { order: 2, action: 'Reset all affected user credentials', time: 60 },
          { order: 3, action: 'Patch identified vulnerabilities', time: 120 },
          { order: 4, action: 'Restore from clean backups if needed', time: 240 },
          { order: 5, action: 'Implement additional monitoring', time: 60 },
          { order: 6, action: 'Verify system integrity', time: 90 },
          { order: 7, action: 'Document lessons learned', time: 60 }
        ];
        break;
        
      case this.incidentTypes.MALWARE:
        plan.steps = [
          { order: 1, action: 'Ensure malware is fully removed', time: 90 },
          { order: 2, action: 'Scan all connected systems', time: 180 },
          { order: 3, action: 'Update antivirus signatures', time: 30 },
          { order: 4, action: 'Restore clean system images', time: 240 },
          { order: 5, action: 'Verify no persistence mechanisms', time: 60 },
          { order: 6, action: 'Monitor for reinfection', time: 120 }
        ];
        break;
        
      default:
        plan.steps = [
          { order: 1, action: 'Verify incident containment', time: 30 },
          { order: 2, action: 'Remove threat artifacts', time: 60 },
          { order: 3, action: 'Apply security patches', time: 90 },
          { order: 4, action: 'Restore normal operations', time: 120 },
          { order: 5, action: 'Implement monitoring', time: 60 }
        ];
    }
    
    // Calculate total time
    plan.estimatedTime = plan.steps.reduce((total, step) => total + step.time, 0);
    
    // Add validation steps
    plan.validations = [
      'Verify all malicious artifacts removed',
      'Confirm no unauthorized access remains',
      'Validate system integrity',
      'Test restored functionality',
      'Verify security controls are effective'
    ];
    
    // Store recovery plan
    await pool.query(`
      UPDATE incident_response
      SET recovery_plan = $1
      WHERE incident_id = $2
    `, [JSON.stringify(plan), incidentId]);
    
    return plan;
  }

  /**
   * Execute recovery plan
   */
  async executeRecovery(incidentId, planId) {
    const incident = this.activeIncidents.get(incidentId);
    if (!incident) {
      throw new Error(`Incident not found: ${incidentId}`);
    }
    
    // Get recovery plan
    const result = await pool.query(`
      SELECT recovery_plan
      FROM incident_response
      WHERE incident_id = $1
    `, [incidentId]);
    
    const plan = result.rows[0].recovery_plan;
    const executionResults = [];
    
    // Execute each step
    for (const step of plan.steps) {
      try {
        const startTime = Date.now();
        
        // Log step start
        await auditLogger.logEvent({
          eventType: 'RECOVERY_STEP_STARTED',
          action: step.action,
          resourceType: 'incident',
          resourceId: incidentId,
          dataClassification: 'cji'
        });
        
        // Simulate step execution (in production, would execute actual recovery actions)
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const executionTime = Date.now() - startTime;
        
        executionResults.push({
          step: step.order,
          action: step.action,
          status: 'completed',
          executionTime,
          completedAt: new Date().toISOString()
        });
        
      } catch (error) {
        executionResults.push({
          step: step.order,
          action: step.action,
          status: 'failed',
          error: error.message,
          failedAt: new Date().toISOString()
        });
        
        // Stop execution on failure
        break;
      }
    }
    
    // Update incident state
    const allSuccessful = executionResults.every(r => r.status === 'completed');
    if (allSuccessful) {
      await this.updateIncidentState(incidentId, this.incidentStates.RECOVERED);
    }
    
    return {
      incidentId,
      planExecuted: plan,
      results: executionResults,
      success: allSuccessful
    };
  }

  /**
   * Generate incident report
   */
  async generateIncidentReport(incidentId) {
    const incident = await pool.query(`
      SELECT * FROM incident_response
      WHERE incident_id = $1
    `, [incidentId]);
    
    if (incident.rows.length === 0) {
      throw new Error(`Incident not found: ${incidentId}`);
    }
    
    const incidentData = incident.rows[0];
    
    // Get all related data
    const [responders, forensics, auditLogs, timeline] = await Promise.all([
      pool.query(`
        SELECT ir.*, u.username, u.email
        FROM incident_responders ir
        JOIN users u ON ir.user_id = u.id
        WHERE ir.incident_id = $1
      `, [incidentData.id]),
      
      pool.query(`
        SELECT * FROM incident_forensics
        WHERE incident_id = $1
        ORDER BY collection_time
      `, [incidentData.id]),
      
      pool.query(`
        SELECT al.* FROM cjis_audit_log al
        JOIN incident_audit_logs ial ON al.id = ial.audit_log_id
        WHERE ial.incident_id = $1
        ORDER BY al.timestamp
      `, [incidentData.id]),
      
      pool.query(`
        SELECT * FROM incident_timeline
        WHERE incident_id = $1
        ORDER BY event_time
      `, [incidentData.id])
    ]);
    
    const report = {
      reportId: crypto.randomBytes(16).toString('hex'),
      generatedAt: new Date().toISOString(),
      incident: {
        id: incidentData.incident_id,
        type: incidentData.incident_type,
        severity: incidentData.severity,
        state: incidentData.state,
        description: incidentData.description,
        detectedAt: incidentData.created_at,
        resolvedAt: incidentData.resolved_at
      },
      timeline: {
        detection: incidentData.created_at,
        triage: incidentData.triage_started_at,
        containment: incidentData.containment_started_at,
        eradication: incidentData.eradication_started_at,
        recovery: incidentData.recovery_started_at,
        closure: incidentData.closed_at
      },
      impact: {
        affectedSystems: incidentData.affected_systems,
        affectedUsers: incidentData.affected_users,
        dataCompromised: incidentData.data_compromised,
        downtime: incidentData.downtime_minutes
      },
      response: {
        team: responders.rows,
        actions: incidentData.containment_actions,
        recoveryPlan: incidentData.recovery_plan
      },
      forensics: forensics.rows.map(f => ({
        collectionTime: f.collection_time,
        dataPoints: f.data_collected
      })),
      recommendations: await this.generateRecommendations(incidentData),
      lessonsLearned: incidentData.lessons_learned || [],
      complianceNotes: this.generateComplianceNotes(incidentData)
    };
    
    // Store report
    await pool.query(`
      INSERT INTO incident_reports (
        incident_id, report_id, report_data, generated_at
      ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
    `, [incidentData.id, report.reportId, JSON.stringify(report)]);
    
    return report;
  }

  /**
   * Setup automated detection rules
   */
  setupAutomatedDetection() {
    // Monitor security events from security monitor
    securityMonitor.on('alert', async (alert) => {
      // Check if alert should trigger incident
      if (this.shouldCreateIncident(alert)) {
        await this.createIncident({
          type: this.mapAlertToIncidentType(alert.type),
          severity: alert.severity,
          description: `Automated detection: ${alert.type}`,
          source: alert.details,
          detectionMethod: 'automated',
          initialFindings: alert
        });
      }
    });
    
    // Monitor for specific patterns
    setInterval(() => this.checkForIncidentPatterns(), 60 * 1000); // Check every minute
  }

  /**
   * Check for incident patterns
   */
  async checkForIncidentPatterns() {
    try {
      // Check for data exfiltration
      const exfiltrationCheck = await pool.query(`
        SELECT 
          user_id,
          COUNT(*) as download_count,
          SUM((metadata->>'fileSize')::int) as total_bytes
        FROM cjis_audit_log
        WHERE action IN ('DOWNLOAD', 'EXPORT')
          AND timestamp > CURRENT_TIMESTAMP - INTERVAL '1 hour'
        GROUP BY user_id
        HAVING COUNT(*) > 50 OR SUM((metadata->>'fileSize')::int) > 1073741824
      `); // More than 50 downloads or 1GB in an hour
      
      if (exfiltrationCheck.rows.length > 0) {
        for (const row of exfiltrationCheck.rows) {
          await this.createIncident({
            type: this.incidentTypes.DATA_BREACH,
            severity: 'HIGH',
            description: 'Potential data exfiltration detected',
            affectedUsers: [row.user_id],
            detectionMethod: 'pattern_analysis',
            initialFindings: row
          });
        }
      }
      
      // Check for brute force patterns
      const bruteForceCheck = await pool.query(`
        SELECT 
          ip_address,
          COUNT(*) as attempt_count
        FROM cjis_audit_log
        WHERE event_type = 'LOGIN_FAILED'
          AND timestamp > CURRENT_TIMESTAMP - INTERVAL '5 minutes'
        GROUP BY ip_address
        HAVING COUNT(*) > 10
      `);
      
      if (bruteForceCheck.rows.length > 0) {
        for (const row of bruteForceCheck.rows) {
          await this.createIncident({
            type: this.incidentTypes.UNAUTHORIZED_ACCESS,
            severity: 'MEDIUM',
            description: 'Brute force attack detected',
            source: { ipAddress: row.ip_address },
            detectionMethod: 'pattern_analysis',
            initialFindings: row
          });
        }
      }
    } catch (error) {
      console.error('Pattern check error:', error);
    }
  }

  /**
   * Load active incidents from database
   */
  async loadActiveIncidents() {
    const result = await pool.query(`
      SELECT * FROM incident_response
      WHERE state NOT IN ('closed', 'lessons_learned')
      ORDER BY created_at DESC
    `);
    
    for (const row of result.rows) {
      this.activeIncidents.set(row.incident_id, {
        id: row.id,
        incidentId: row.incident_id,
        type: row.incident_type,
        severity: row.severity,
        state: row.state,
        description: row.description,
        responseDeadline: row.response_deadline,
        createdAt: row.created_at
      });
    }
    
    console.log(`Loaded ${this.activeIncidents.size} active incidents`);
  }

  /**
   * Load response procedures
   */
  async loadResponseProcedures() {
    // Load from database or configuration
    this.responseProcedures = new Map([
      [this.incidentTypes.DATA_BREACH, {
        steps: ['Identify scope', 'Contain breach', 'Assess damage', 'Notify affected', 'Remediate'],
        requiredRoles: ['incident_commander', 'security_analyst', 'legal_advisor'],
        notificationRequired: true,
        maxResponseTime: 60 // minutes
      }],
      [this.incidentTypes.MALWARE, {
        steps: ['Isolate system', 'Identify malware', 'Remove malware', 'Scan network', 'Patch systems'],
        requiredRoles: ['security_analyst', 'system_admin'],
        notificationRequired: false,
        maxResponseTime: 120
      }]
    ]);
  }

  /**
   * Start incident monitoring
   */
  startIncidentMonitoring() {
    // Check response deadlines
    setInterval(async () => {
      for (const [id, incident] of this.activeIncidents) {
        if (new Date(incident.responseDeadline) < new Date() && 
            incident.state === this.incidentStates.DETECTED) {
          await this.escalateIncident(id, 'Response deadline exceeded');
        }
      }
    }, 60 * 1000); // Check every minute
  }

  /**
   * Helper functions
   */
  
  generateIncidentId() {
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').substring(0, 14);
    const random = crypto.randomBytes(4).toString('hex');
    return `INC-${timestamp}-${random.toUpperCase()}`;
  }

  shouldCreateIncident(alert) {
    const incidentTriggers = ['BRUTE_FORCE_DETECTED', 'DATA_BREACH_SUSPECTED', 'MALWARE_DETECTED'];
    return incidentTriggers.includes(alert.type) || alert.severity === 'CRITICAL';
  }

  mapAlertToIncidentType(alertType) {
    const mapping = {
      'BRUTE_FORCE_DETECTED': this.incidentTypes.UNAUTHORIZED_ACCESS,
      'DATA_BREACH_SUSPECTED': this.incidentTypes.DATA_BREACH,
      'MALWARE_DETECTED': this.incidentTypes.MALWARE,
      'SQL_INJECTION_ATTEMPT': this.incidentTypes.SYSTEM_COMPROMISE,
      'EXCESSIVE_DATA_EXPORT': this.incidentTypes.DATA_LOSS
    };
    
    return mapping[alertType] || this.incidentTypes.POLICY_VIOLATION;
  }

  getDefaultContainmentActions(incidentType) {
    const actions = {
      [this.incidentTypes.DATA_BREACH]: [
        { type: 'TERMINATE_SESSIONS', scope: 'affected_users' },
        { type: 'RESET_CREDENTIALS', scope: 'affected_users' },
        { type: 'BACKUP_EVIDENCE', scope: 'all' }
      ],
      [this.incidentTypes.UNAUTHORIZED_ACCESS]: [
        { type: 'BLOCK_IP', scope: 'source' },
        { type: 'DISABLE_ACCOUNT', scope: 'affected_users' },
        { type: 'TERMINATE_SESSIONS', scope: 'all' }
      ],
      [this.incidentTypes.MALWARE]: [
        { type: 'ISOLATE_SYSTEM', scope: 'affected' },
        { type: 'QUARANTINE_FILE', scope: 'malicious' },
        { type: 'BACKUP_EVIDENCE', scope: 'all' }
      ]
    };
    
    return actions[incidentType] || [];
  }

  async assignResponseTeam(severity, type) {
    // In production, this would use an on-call schedule
    const team = [];
    
    // Get available users
    const usersResult = await pool.query(`
      SELECT id FROM users 
      WHERE role IN ('admin', 'security_analyst')
      LIMIT 3
    `);
    
    if (usersResult.rows.length > 0) {
      if (severity === 'CRITICAL' || severity === 'HIGH') {
        team.push({ userId: usersResult.rows[0].id, role: 'incident_commander' });
      }
      
      if (usersResult.rows.length > 1) {
        team.push({ userId: usersResult.rows[1].id, role: 'security_analyst' });
      }
      
      if (type === this.incidentTypes.DATA_BREACH && usersResult.rows.length > 2) {
        team.push({ userId: usersResult.rows[2].id, role: 'legal_advisor' });
      }
    }
    
    // Fallback to user 1 if no users found
    if (team.length === 0) {
      team.push({ userId: 1, role: 'incident_commander' });
    }
    
    return team;
  }

  async notifyResponseTeam(incident) {
    // In production, send emails, SMS, push notifications
    console.log(`🚨 INCIDENT ALERT: ${incident.incidentId}`);
    console.log(`Type: ${incident.type}, Severity: ${incident.severity}`);
    console.log(`Response team notified:`, incident.responders);
  }

  async initiateAutomatedResponse(incident) {
    // Execute immediate containment for critical incidents
    if (incident.type === this.incidentTypes.DATA_BREACH) {
      await this.containIncident(incident.incidentId, [
        { type: 'TERMINATE_SESSIONS', userId: 'all' }
      ]);
    }
  }

  async executeStateActions(incident, state) {
    switch (state) {
      case this.incidentStates.TRIAGED:
        // Assign priority and resources
        break;
      case this.incidentStates.CONTAINED:
        // Verify containment effectiveness
        break;
      case this.incidentStates.RECOVERED:
        // Run validation checks
        break;
      case this.incidentStates.LESSONS_LEARNED:
        // Generate final report
        await this.generateIncidentReport(incident.incidentId);
        break;
    }
  }

  async escalateIncident(incidentId, reason) {
    await auditLogger.logEvent({
      eventType: 'INCIDENT_ESCALATED',
      action: 'ESCALATE_INCIDENT',
      resourceType: 'incident',
      resourceId: incidentId,
      dataClassification: 'cji',
      metadata: { reason }
    });
    
    // Notify management
    console.error(`⚠️ INCIDENT ESCALATED: ${incidentId} - ${reason}`);
  }

  async generateRecommendations(incident) {
    const recommendations = [];
    
    if (incident.incident_type === this.incidentTypes.DATA_BREACH) {
      recommendations.push('Implement data loss prevention (DLP) controls');
      recommendations.push('Enhance user activity monitoring');
      recommendations.push('Review and update data classification policies');
    }
    
    if (incident.incident_type === this.incidentTypes.UNAUTHORIZED_ACCESS) {
      recommendations.push('Strengthen authentication requirements');
      recommendations.push('Implement IP allowlisting for sensitive resources');
      recommendations.push('Enhance intrusion detection capabilities');
    }
    
    return recommendations;
  }

  generateComplianceNotes(incident) {
    const notes = [];
    
    // CJIS specific requirements
    if (incident.data_compromised?.includes('cji')) {
      notes.push('CJI data was potentially compromised - FBI notification may be required');
      notes.push('Incident must be reported to CJIS Systems Officer within 24 hours');
    }
    
    // Response time compliance
    const responseTime = new Date(incident.triage_started_at) - new Date(incident.created_at);
    const responseMinutes = responseTime / 60000;
    
    if (responseMinutes > this.severityLevels[incident.severity].responseTime) {
      notes.push(`Response time exceeded CJIS requirement of ${this.severityLevels[incident.severity].responseTime} minutes`);
    }
    
    return notes;
  }

  // Additional helper methods for containment actions
  async revokeAccess(userId, resource) {
    await pool.query(`
      DELETE FROM user_permissions
      WHERE user_id = $1 AND resource = $2
    `, [userId, resource]);
    
    return { revoked: true, userId, resource };
  }

  async quarantineFile(fileId) {
    await pool.query(`
      UPDATE encrypted_files
      SET quarantined = true, quarantined_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [fileId]);
    
    return { quarantined: true, fileId };
  }

  async forcePasswordReset(userId) {
    await pool.query(`
      UPDATE users
      SET must_reset_password = true
      WHERE id = $1
    `, [userId]);
    
    return { resetRequired: true, userId };
  }

  async terminateUserSessions(userId) {
    const result = await pool.query(`
      UPDATE user_sessions
      SET is_active = false, terminated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND is_active = true
      RETURNING id
    `, [userId]);
    
    return { terminated: result.rows.length, userId };
  }

  async backupEvidence(incidentId) {
    const timestamp = new Date().toISOString();
    const backupId = crypto.randomBytes(16).toString('hex');
    
    // In production, this would create actual backups
    await pool.query(`
      INSERT INTO evidence_backups (
        incident_id, backup_id, created_at, status
      ) VALUES ($1, $2, $3, $4)
    `, [incidentId, backupId, timestamp, 'completed']);
    
    return { backed_up: true, backupId, timestamp };
  }
}

// Export singleton instance
const incidentResponse = new IncidentResponseSystem();
module.exports = incidentResponse;