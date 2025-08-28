const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const authenticateToken = require('../middleware/auth');
const auditLogger = require('../middleware/auditLogger');
const complianceGovernance = require('../services/complianceGovernance');

/**
 * CJIS v6.0 Compliance and Governance API Routes
 * Provides personnel security, training, configuration management, and compliance reporting
 */

// Middleware to ensure only authorized users can access compliance functions
const requireComplianceRole = async (req, res, next) => {
  try {
    const authorizedRoles = ['admin', 'compliance_officer', 'security_admin'];
    
    if (!req.user || !authorizedRoles.includes(req.user.role)) {
      await auditLogger.logEvent({
        eventType: 'ACCESS_DENIED',
        action: 'COMPLIANCE_ACCESS_ATTEMPT',
        dataClassification: 'cji',
        accessResult: 'denied',
        req
      });
      
      return res.status(403).json({
        error: 'Access denied',
        message: 'Compliance management authorization required'
      });
    }
    next();
  } catch (error) {
    return res.status(500).json({ error: 'Authorization check failed' });
  }
};

/**
 * Personnel Security Management
 */

// GET /api/compliance-governance/personnel
router.get('/personnel', authenticateToken, requireComplianceRole, async (req, res) => {
  try {
    const { clearanceLevel, status, page = 1, limit = 20 } = req.query;
    
    let query = `
      SELECT 
        ps.*,
        u.username,
        u.email,
        COUNT(DISTINCT st.id) as training_count
      FROM personnel_security ps
      JOIN users u ON ps.user_id = u.id
      LEFT JOIN security_training st ON ps.user_id = st.user_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 0;
    
    if (clearanceLevel) {
      params.push(clearanceLevel);
      query += ` AND ps.clearance_level = $${++paramIndex}`;
    }
    
    if (status) {
      params.push(status);
      query += ` AND ps.status = $${++paramIndex}`;
    }
    
    query += ' GROUP BY ps.id, u.username, u.email ORDER BY ps.created_at DESC';
    
    const offset = (page - 1) * limit;
    params.push(limit, offset);
    query += ` LIMIT $${++paramIndex} OFFSET $${++paramIndex}`;
    
    const result = await pool.query(query, params);
    
    await auditLogger.logEvent({
      eventType: 'PERSONNEL_LIST_VIEWED',
      action: 'VIEW_PERSONNEL',
      dataClassification: 'cji',
      req
    });
    
    res.json({
      personnel: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Personnel retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve personnel records' });
  }
});

// POST /api/compliance-governance/personnel
router.post('/personnel', authenticateToken, requireComplianceRole, async (req, res) => {
  try {
    const {
      userId,
      fullName,
      position,
      clearanceLevel,
      backgroundCheckDate,
      fingerprintDate,
      securityBriefingDate,
      reinvestigationDue,
      accessCategories,
      certifications
    } = req.body;
    
    const record = await complianceGovernance.createPersonnelRecord({
      userId,
      fullName,
      position,
      clearanceLevel,
      backgroundCheckDate,
      fingerprintDate,
      securityBriefingDate,
      reinvestigationDue,
      accessCategories,
      certifications
    });
    
    await auditLogger.logEvent({
      eventType: 'PERSONNEL_CREATED',
      action: 'CREATE_PERSONNEL',
      resourceType: 'personnel',
      resourceId: record.id,
      dataClassification: 'cji',
      metadata: { clearanceLevel },
      req
    });
    
    res.status(201).json({
      success: true,
      record
    });
  } catch (error) {
    console.error('Personnel creation error:', error);
    res.status(500).json({ error: 'Failed to create personnel record' });
  }
});

// PUT /api/compliance-governance/personnel/:userId/clearance
router.put('/personnel/:userId/clearance', authenticateToken, requireComplianceRole, async (req, res) => {
  try {
    const { userId } = req.params;
    const { newLevel, justification, approvedBy } = req.body;
    
    const updated = await complianceGovernance.updateClearanceLevel(
      userId,
      newLevel,
      justification,
      approvedBy || req.user.id
    );
    
    await auditLogger.logEvent({
      eventType: 'CLEARANCE_UPDATED',
      action: 'UPDATE_CLEARANCE',
      resourceType: 'personnel',
      resourceId: userId,
      dataClassification: 'cji',
      metadata: { newLevel, justification },
      req
    });
    
    res.json({
      success: true,
      clearance: updated
    });
  } catch (error) {
    console.error('Clearance update error:', error);
    res.status(500).json({ error: 'Failed to update clearance level' });
  }
});

/**
 * Security Training Management
 */

// GET /api/compliance-governance/training/modules
router.get('/training/modules', authenticateToken, async (req, res) => {
  try {
    const modules = await pool.query(`
      SELECT * FROM security_training_modules
      WHERE active = true
      ORDER BY category, order_index
    `);
    
    res.json({
      modules: modules.rows
    });
  } catch (error) {
    console.error('Training modules error:', error);
    res.status(500).json({ error: 'Failed to retrieve training modules' });
  }
});

// POST /api/compliance-governance/training/assign
router.post('/training/assign', authenticateToken, requireComplianceRole, async (req, res) => {
  try {
    const { userId, moduleId, dueDate } = req.body;
    
    const assignment = await complianceGovernance.assignTraining(userId, moduleId, dueDate);
    
    await auditLogger.logEvent({
      eventType: 'TRAINING_ASSIGNED',
      action: 'ASSIGN_TRAINING',
      resourceType: 'training',
      resourceId: assignment.id,
      dataClassification: 'public',
      metadata: { userId, moduleId },
      req
    });
    
    res.status(201).json({
      success: true,
      assignment
    });
  } catch (error) {
    console.error('Training assignment error:', error);
    res.status(500).json({ error: 'Failed to assign training' });
  }
});

// POST /api/compliance-governance/training/:trainingId/complete
router.post('/training/:trainingId/complete', authenticateToken, async (req, res) => {
  try {
    const { trainingId } = req.params;
    const { score, answers } = req.body;
    
    const completion = await complianceGovernance.completeTraining(
      trainingId,
      req.user.id,
      score,
      answers
    );
    
    await auditLogger.logEvent({
      eventType: 'TRAINING_COMPLETED',
      action: 'COMPLETE_TRAINING',
      resourceType: 'training',
      resourceId: trainingId,
      dataClassification: 'public',
      metadata: { score, passed: completion.passed },
      req
    });
    
    res.json({
      success: true,
      completion
    });
  } catch (error) {
    console.error('Training completion error:', error);
    res.status(500).json({ error: 'Failed to complete training' });
  }
});

// GET /api/compliance-governance/training/compliance/:userId
router.get('/training/compliance/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const compliance = await complianceGovernance.getTrainingCompliance(userId);
    
    res.json(compliance);
  } catch (error) {
    console.error('Training compliance error:', error);
    res.status(500).json({ error: 'Failed to retrieve training compliance' });
  }
});

/**
 * Configuration Management
 */

// GET /api/compliance-governance/configuration/baseline
router.get('/configuration/baseline', authenticateToken, requireComplianceRole, async (req, res) => {
  try {
    const baseline = await pool.query(`
      SELECT * FROM configuration_baseline
      WHERE is_current = true
      ORDER BY created_at DESC
      LIMIT 1
    `);
    
    if (baseline.rows.length === 0) {
      return res.status(404).json({ error: 'No configuration baseline found' });
    }
    
    res.json({
      baseline: baseline.rows[0]
    });
  } catch (error) {
    console.error('Baseline retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve configuration baseline' });
  }
});

// POST /api/compliance-governance/configuration/baseline
router.post('/configuration/baseline', authenticateToken, requireComplianceRole, async (req, res) => {
  try {
    const { name, description, settings } = req.body;
    
    const baseline = await complianceGovernance.createConfigurationBaseline(
      name,
      description,
      settings
    );
    
    await auditLogger.logEvent({
      eventType: 'BASELINE_CREATED',
      action: 'CREATE_BASELINE',
      resourceType: 'configuration',
      resourceId: baseline.id,
      dataClassification: 'cji',
      metadata: { name },
      req
    });
    
    res.status(201).json({
      success: true,
      baseline
    });
  } catch (error) {
    console.error('Baseline creation error:', error);
    res.status(500).json({ error: 'Failed to create configuration baseline' });
  }
});

// POST /api/compliance-governance/configuration/validate
router.post('/configuration/validate', authenticateToken, requireComplianceRole, async (req, res) => {
  try {
    const { systemId } = req.body;
    
    const validation = await complianceGovernance.validateConfiguration(systemId);
    
    await auditLogger.logEvent({
      eventType: 'CONFIG_VALIDATED',
      action: 'VALIDATE_CONFIG',
      resourceType: 'configuration',
      resourceId: systemId,
      dataClassification: 'public',
      metadata: { compliant: validation.compliant },
      req
    });
    
    res.json({
      success: true,
      validation
    });
  } catch (error) {
    console.error('Configuration validation error:', error);
    res.status(500).json({ error: 'Failed to validate configuration' });
  }
});

// POST /api/compliance-governance/configuration/change
router.post('/configuration/change', authenticateToken, requireComplianceRole, async (req, res) => {
  try {
    const {
      systemId,
      changeType,
      description,
      plannedDate,
      settings
    } = req.body;
    
    const change = await complianceGovernance.requestConfigurationChange({
      systemId,
      changeType,
      description,
      plannedDate,
      requestedBy: req.user.id,
      settings
    });
    
    await auditLogger.logEvent({
      eventType: 'CONFIG_CHANGE_REQUESTED',
      action: 'REQUEST_CHANGE',
      resourceType: 'configuration',
      resourceId: change.id,
      dataClassification: 'cji',
      metadata: { changeType, systemId },
      req
    });
    
    res.status(201).json({
      success: true,
      change
    });
  } catch (error) {
    console.error('Configuration change error:', error);
    res.status(500).json({ error: 'Failed to request configuration change' });
  }
});

/**
 * Mobile Device Management
 */

// GET /api/compliance-governance/devices
router.get('/devices', authenticateToken, requireComplianceRole, async (req, res) => {
  try {
    const { status, userId, page = 1, limit = 20 } = req.query;
    
    let query = `
      SELECT 
        md.*,
        u.username,
        u.email
      FROM mobile_devices md
      JOIN users u ON md.user_id = u.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 0;
    
    if (status) {
      params.push(status);
      query += ` AND md.status = $${++paramIndex}`;
    }
    
    if (userId) {
      params.push(userId);
      query += ` AND md.user_id = $${++paramIndex}`;
    }
    
    query += ' ORDER BY md.registered_at DESC';
    
    const offset = (page - 1) * limit;
    params.push(limit, offset);
    query += ` LIMIT $${++paramIndex} OFFSET $${++paramIndex}`;
    
    const result = await pool.query(query, params);
    
    res.json({
      devices: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Device retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve devices' });
  }
});

// POST /api/compliance-governance/devices/register
router.post('/devices/register', authenticateToken, async (req, res) => {
  try {
    const {
      deviceType,
      manufacturer,
      model,
      osVersion,
      serialNumber,
      imei
    } = req.body;
    
    const device = await complianceGovernance.registerMobileDevice({
      userId: req.user.id,
      deviceType,
      manufacturer,
      model,
      osVersion,
      serialNumber,
      imei
    });
    
    await auditLogger.logEvent({
      eventType: 'DEVICE_REGISTERED',
      action: 'REGISTER_DEVICE',
      resourceType: 'device',
      resourceId: device.id,
      dataClassification: 'public',
      metadata: { deviceType, model },
      req
    });
    
    res.status(201).json({
      success: true,
      device
    });
  } catch (error) {
    console.error('Device registration error:', error);
    res.status(500).json({ error: 'Failed to register device' });
  }
});

// PUT /api/compliance-governance/devices/:deviceId/status
router.put('/devices/:deviceId/status', authenticateToken, requireComplianceRole, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { status, reason } = req.body;
    
    const updated = await complianceGovernance.updateDeviceStatus(deviceId, status, reason);
    
    await auditLogger.logEvent({
      eventType: 'DEVICE_STATUS_CHANGED',
      action: 'UPDATE_DEVICE_STATUS',
      resourceType: 'device',
      resourceId: deviceId,
      dataClassification: 'public',
      metadata: { status, reason },
      req
    });
    
    res.json({
      success: true,
      device: updated
    });
  } catch (error) {
    console.error('Device status error:', error);
    res.status(500).json({ error: 'Failed to update device status' });
  }
});

// POST /api/compliance-governance/devices/:deviceId/wipe
router.post('/devices/:deviceId/wipe', authenticateToken, requireComplianceRole, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { reason } = req.body;
    
    const wipe = await complianceGovernance.wipeDevice(deviceId, reason, req.user.id);
    
    await auditLogger.logEvent({
      eventType: 'DEVICE_WIPED',
      action: 'WIPE_DEVICE',
      resourceType: 'device',
      resourceId: deviceId,
      dataClassification: 'cji',
      metadata: { reason },
      req
    });
    
    res.json({
      success: true,
      wipeRequest: wipe
    });
  } catch (error) {
    console.error('Device wipe error:', error);
    res.status(500).json({ error: 'Failed to wipe device' });
  }
});

/**
 * Compliance Reporting
 */

// GET /api/compliance-governance/compliance/score
router.get('/compliance/score', authenticateToken, requireComplianceRole, async (req, res) => {
  try {
    const score = await complianceGovernance.calculateComplianceScore();
    
    res.json({
      score,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Compliance score error:', error);
    res.status(500).json({ error: 'Failed to calculate compliance score' });
  }
});

// GET /api/compliance-governance/compliance/report
router.get('/compliance/report', authenticateToken, requireComplianceRole, async (req, res) => {
  try {
    const { startDate, endDate, format = 'json' } = req.query;
    
    const report = await complianceGovernance.generateComplianceReport(startDate, endDate);
    
    await auditLogger.logEvent({
      eventType: 'COMPLIANCE_REPORT_GENERATED',
      action: 'GENERATE_REPORT',
      dataClassification: 'cji',
      metadata: { startDate, endDate, format },
      req
    });
    
    if (format === 'pdf') {
      // In production, generate PDF report
      res.json({
        message: 'PDF generation not implemented',
        report
      });
    } else {
      res.json(report);
    }
  } catch (error) {
    console.error('Compliance report error:', error);
    res.status(500).json({ error: 'Failed to generate compliance report' });
  }
});

// GET /api/compliance-governance/compliance/gaps
router.get('/compliance/gaps', authenticateToken, requireComplianceRole, async (req, res) => {
  try {
    const gaps = await complianceGovernance.identifyComplianceGaps();
    
    res.json({
      gaps,
      totalGaps: gaps.length,
      criticalGaps: gaps.filter(g => g.severity === 'critical').length
    });
  } catch (error) {
    console.error('Compliance gaps error:', error);
    res.status(500).json({ error: 'Failed to identify compliance gaps' });
  }
});

/**
 * Audit Management
 */

// GET /api/compliance-governance/audits
router.get('/audits', authenticateToken, requireComplianceRole, async (req, res) => {
  try {
    const { status, type, page = 1, limit = 20 } = req.query;
    
    let query = `
      SELECT * FROM formal_audits
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 0;
    
    if (status) {
      params.push(status);
      query += ` AND status = $${++paramIndex}`;
    }
    
    if (type) {
      params.push(type);
      query += ` AND audit_type = $${++paramIndex}`;
    }
    
    query += ' ORDER BY scheduled_date DESC';
    
    const offset = (page - 1) * limit;
    params.push(limit, offset);
    query += ` LIMIT $${++paramIndex} OFFSET $${++paramIndex}`;
    
    const result = await pool.query(query, params);
    
    res.json({
      audits: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Audit retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve audits' });
  }
});

// POST /api/compliance-governance/audits
router.post('/audits', authenticateToken, requireComplianceRole, async (req, res) => {
  try {
    const {
      auditType,
      scheduledDate,
      scope,
      objectives,
      criteria,
      leadAuditor
    } = req.body;
    
    const audit = await complianceGovernance.scheduleAudit({
      auditType,
      scheduledDate,
      scope,
      objectives,
      criteria,
      leadAuditor
    });
    
    await auditLogger.logEvent({
      eventType: 'AUDIT_SCHEDULED',
      action: 'SCHEDULE_AUDIT',
      resourceType: 'audit',
      resourceId: audit.id,
      dataClassification: 'cji',
      metadata: { auditType, scheduledDate },
      req
    });
    
    res.status(201).json({
      success: true,
      audit
    });
  } catch (error) {
    console.error('Audit scheduling error:', error);
    res.status(500).json({ error: 'Failed to schedule audit' });
  }
});

// POST /api/compliance-governance/audits/:auditId/evidence
router.post('/audits/:auditId/evidence', authenticateToken, requireComplianceRole, async (req, res) => {
  try {
    const { auditId } = req.params;
    
    const evidence = await complianceGovernance.prepareAuditEvidence(auditId);
    
    await auditLogger.logEvent({
      eventType: 'AUDIT_EVIDENCE_PREPARED',
      action: 'PREPARE_EVIDENCE',
      resourceType: 'audit',
      resourceId: auditId,
      dataClassification: 'cji',
      metadata: { packageSize: evidence.files.length },
      req
    });
    
    res.json({
      success: true,
      evidence
    });
  } catch (error) {
    console.error('Evidence preparation error:', error);
    res.status(500).json({ error: 'Failed to prepare audit evidence' });
  }
});

// PUT /api/compliance-governance/audits/:auditId/complete
router.put('/audits/:auditId/complete', authenticateToken, requireComplianceRole, async (req, res) => {
  try {
    const { auditId } = req.params;
    const { findings, recommendations } = req.body;
    
    const result = await pool.query(`
      UPDATE formal_audits
      SET 
        status = 'completed',
        completed_date = CURRENT_TIMESTAMP,
        findings = $1,
        recommendations = $2
      WHERE id = $3
      RETURNING *
    `, [findings, recommendations, auditId]);
    
    await auditLogger.logEvent({
      eventType: 'AUDIT_COMPLETED',
      action: 'COMPLETE_AUDIT',
      resourceType: 'audit',
      resourceId: auditId,
      dataClassification: 'cji',
      metadata: { findingsCount: findings?.length || 0 },
      req
    });
    
    res.json({
      success: true,
      audit: result.rows[0]
    });
  } catch (error) {
    console.error('Audit completion error:', error);
    res.status(500).json({ error: 'Failed to complete audit' });
  }
});

/**
 * Policy Management
 */

// GET /api/compliance-governance/policies
router.get('/policies', authenticateToken, async (req, res) => {
  try {
    const policies = await pool.query(`
      SELECT * FROM security_policies
      WHERE active = true
      ORDER BY policy_area, last_reviewed DESC
    `);
    
    res.json({
      policies: policies.rows
    });
  } catch (error) {
    console.error('Policy retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve policies' });
  }
});

// POST /api/compliance-governance/policies/:policyId/acknowledge
router.post('/policies/:policyId/acknowledge', authenticateToken, async (req, res) => {
  try {
    const { policyId } = req.params;
    
    await pool.query(`
      INSERT INTO policy_acknowledgments (policy_id, user_id, acknowledged_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (policy_id, user_id) 
      DO UPDATE SET acknowledged_at = CURRENT_TIMESTAMP
    `, [policyId, req.user.id]);
    
    await auditLogger.logEvent({
      eventType: 'POLICY_ACKNOWLEDGED',
      action: 'ACKNOWLEDGE_POLICY',
      resourceType: 'policy',
      resourceId: policyId,
      dataClassification: 'public',
      req
    });
    
    res.json({
      success: true,
      message: 'Policy acknowledged successfully'
    });
  } catch (error) {
    console.error('Policy acknowledgment error:', error);
    res.status(500).json({ error: 'Failed to acknowledge policy' });
  }
});

/**
 * Dashboard Statistics
 */

// GET /api/compliance-governance/statistics
router.get('/statistics', authenticateToken, requireComplianceRole, async (req, res) => {
  try {
    // Personnel statistics
    const personnelStats = await pool.query(`
      SELECT 
        COUNT(*) as total_personnel,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_personnel,
        COUNT(CASE WHEN clearance_level = 'SECRET' THEN 1 END) as secret_clearance,
        COUNT(CASE WHEN clearance_level = 'TOP SECRET' THEN 1 END) as top_secret_clearance
      FROM personnel_security
    `);
    
    // Training statistics
    const trainingStats = await pool.query(`
      SELECT 
        COUNT(DISTINCT user_id) as users_in_training,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_trainings,
        COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_trainings,
        AVG(CASE WHEN completion_date IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (completion_date - assigned_date))/86400 
        END) as avg_completion_days
      FROM security_training
    `);
    
    // Device statistics
    const deviceStats = await pool.query(`
      SELECT 
        COUNT(*) as total_devices,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_devices,
        COUNT(CASE WHEN compliance_status ->> 'compliant' = 'true' THEN 1 END) as compliant_devices
      FROM mobile_devices
    `);
    
    // Audit statistics
    const auditStats = await pool.query(`
      SELECT 
        COUNT(*) as total_audits,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_audits,
        COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled_audits
      FROM formal_audits
      WHERE scheduled_date >= CURRENT_DATE - INTERVAL '1 year'
    `);
    
    res.json({
      personnel: personnelStats.rows[0],
      training: trainingStats.rows[0],
      devices: deviceStats.rows[0],
      audits: auditStats.rows[0],
      complianceScore: await complianceGovernance.calculateComplianceScore(),
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Statistics error:', error);
    res.status(500).json({ error: 'Failed to retrieve statistics' });
  }
});

/**
 * Test endpoint (development only)
 */
router.post('/test', authenticateToken, requireComplianceRole, async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Test endpoint disabled in production' });
    }
    
    // Create test personnel record
    const testPersonnel = await complianceGovernance.createPersonnelRecord({
      userId: req.user.id,
      fullName: 'Test User',
      position: 'Security Analyst',
      clearanceLevel: 'SECRET',
      backgroundCheckDate: new Date(),
      fingerprintDate: new Date(),
      accessCategories: ['CJI', 'PII']
    });
    
    // Assign test training
    const testTraining = await complianceGovernance.assignTraining(
      req.user.id,
      1, // Assuming module ID 1 exists
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Due in 7 days
    );
    
    res.json({
      success: true,
      testPersonnel,
      testTraining
    });
  } catch (error) {
    console.error('Test error:', error);
    res.status(500).json({ error: 'Test failed' });
  }
});

module.exports = router;