const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const authenticateToken = require('../middleware/auth');
const auditLogger = require('../middleware/auditLogger');
const incidentResponse = require('../services/incidentResponse');

/**
 * CJIS v6.0 Incident Response API Routes
 * Provides incident management, response, and recovery capabilities
 */

// Middleware to ensure only authorized users can manage incidents
const requireIncidentRole = async (req, res, next) => {
  try {
    const authorizedRoles = ['admin', 'security_analyst', 'incident_responder'];
    
    if (!req.user || !authorizedRoles.includes(req.user.role)) {
      await auditLogger.logEvent({
        eventType: 'ACCESS_DENIED',
        action: 'INCIDENT_ACCESS_ATTEMPT',
        dataClassification: 'cji',
        accessResult: 'denied',
        req
      });
      
      return res.status(403).json({
        error: 'Access denied',
        message: 'Incident response authorization required'
      });
    }
    next();
  } catch (error) {
    return res.status(500).json({ error: 'Authorization check failed' });
  }
};

/**
 * GET /api/incident-response/incidents
 * Get all incidents with filtering
 */
router.get('/incidents', authenticateToken, requireIncidentRole, async (req, res) => {
  try {
    const {
      state,
      severity,
      type,
      startDate,
      endDate,
      page = 1,
      limit = 20
    } = req.query;

    let query = `
      SELECT 
        ir.*,
        COUNT(DISTINCT irsp.user_id) as responder_count,
        COUNT(DISTINCT ial.audit_log_id) as audit_log_count
      FROM incident_response ir
      LEFT JOIN incident_responders irsp ON ir.id = irsp.incident_id
      LEFT JOIN incident_audit_logs ial ON ir.id = ial.incident_id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 0;

    if (state) {
      params.push(state);
      query += ` AND ir.state = $${++paramIndex}`;
    }

    if (severity) {
      params.push(severity);
      query += ` AND ir.severity = $${++paramIndex}`;
    }

    if (type) {
      params.push(type);
      query += ` AND ir.incident_type = $${++paramIndex}`;
    }

    if (startDate) {
      params.push(startDate);
      query += ` AND ir.created_at >= $${++paramIndex}`;
    }

    if (endDate) {
      params.push(endDate);
      query += ` AND ir.created_at <= $${++paramIndex}`;
    }

    query += ' GROUP BY ir.id ORDER BY ir.created_at DESC';

    // Add pagination
    const offset = (page - 1) * limit;
    params.push(limit);
    params.push(offset);
    query += ` LIMIT $${++paramIndex} OFFSET $${++paramIndex}`;

    const result = await pool.query(query, params);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM incident_response ir
      WHERE 1=1 ${state ? 'AND state = $1' : ''} 
            ${severity ? `AND severity = $${state ? 2 : 1}` : ''}
    `;
    const countParams = [];
    if (state) countParams.push(state);
    if (severity) countParams.push(severity);
    
    const countResult = await pool.query(countQuery, countParams);

    await auditLogger.logEvent({
      eventType: 'INCIDENT_LIST_VIEWED',
      action: 'VIEW_INCIDENTS',
      dataClassification: 'cji',
      req
    });

    res.json({
      incidents: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(countResult.rows[0].total / limit)
      }
    });
  } catch (error) {
    console.error('Incident retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve incidents' });
  }
});

/**
 * POST /api/incident-response/incidents
 * Create a new incident
 */
router.post('/incidents', authenticateToken, requireIncidentRole, async (req, res) => {
  try {
    const {
      type,
      severity,
      description,
      affectedSystems,
      affectedUsers,
      initialFindings
    } = req.body;

    const incident = await incidentResponse.createIncident({
      type,
      severity,
      description,
      source: { ipAddress: req.ip },
      affectedSystems: affectedSystems || [],
      affectedUsers: affectedUsers || [],
      detectionMethod: 'manual',
      initialFindings: initialFindings || {}
    });

    await auditLogger.logEvent({
      eventType: 'INCIDENT_CREATED',
      action: 'CREATE_INCIDENT',
      resourceType: 'incident',
      resourceId: incident.incidentId,
      dataClassification: 'cji',
      metadata: { type, severity },
      req
    });

    res.status(201).json({
      success: true,
      incident
    });
  } catch (error) {
    console.error('Incident creation error:', error);
    res.status(500).json({ error: 'Failed to create incident' });
  }
});

/**
 * GET /api/incident-response/incidents/:id
 * Get incident details
 */
router.get('/incidents/:id', authenticateToken, requireIncidentRole, async (req, res) => {
  try {
    const { id } = req.params;

    const incidentResult = await pool.query(`
      SELECT * FROM incident_response
      WHERE incident_id = $1
    `, [id]);

    if (incidentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    const incident = incidentResult.rows[0];

    // Get responders
    const respondersResult = await pool.query(`
      SELECT ir.*, u.username, u.email
      FROM incident_responders ir
      JOIN users u ON ir.user_id = u.id
      WHERE ir.incident_id = $1
    `, [incident.id]);

    // Get forensics
    const forensicsResult = await pool.query(`
      SELECT id, incident_id, collection_time, data_collected
      FROM incident_forensics
      WHERE incident_id = $1
      ORDER BY collection_time DESC
    `, [incident.id]);

    // Get timeline
    const timelineResult = await pool.query(`
      SELECT * FROM incident_timeline
      WHERE incident_id = $1
      ORDER BY event_time
    `, [incident.id]);

    await auditLogger.logCJIAccess(
      req,
      'incident',
      id,
      'VIEW'
    );

    res.json({
      incident,
      responders: respondersResult.rows,
      forensics: forensicsResult.rows,
      timeline: timelineResult.rows
    });
  } catch (error) {
    console.error('Incident detail error:', error);
    res.status(500).json({ error: 'Failed to retrieve incident details' });
  }
});

/**
 * PUT /api/incident-response/incidents/:id/state
 * Update incident state
 */
router.put('/incidents/:id/state', authenticateToken, requireIncidentRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { newState, notes } = req.body;

    const updatedIncident = await incidentResponse.updateIncidentState(
      id,
      newState,
      notes,
      req.user.id
    );

    await auditLogger.logEvent({
      eventType: 'INCIDENT_STATE_CHANGED',
      action: 'UPDATE_INCIDENT_STATE',
      resourceType: 'incident',
      resourceId: id,
      dataClassification: 'cji',
      metadata: { newState, notes },
      req
    });

    res.json({
      success: true,
      incident: updatedIncident
    });
  } catch (error) {
    console.error('State update error:', error);
    res.status(500).json({ error: 'Failed to update incident state' });
  }
});

/**
 * POST /api/incident-response/incidents/:id/contain
 * Execute containment actions
 */
router.post('/incidents/:id/contain', authenticateToken, requireIncidentRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { actions } = req.body;

    const results = await incidentResponse.containIncident(id, actions || []);

    await auditLogger.logEvent({
      eventType: 'INCIDENT_CONTAINED',
      action: 'CONTAIN_INCIDENT',
      resourceType: 'incident',
      resourceId: id,
      dataClassification: 'cji',
      metadata: results,
      req
    });

    res.json({
      success: true,
      containmentResults: results
    });
  } catch (error) {
    console.error('Containment error:', error);
    res.status(500).json({ error: 'Failed to contain incident' });
  }
});

/**
 * POST /api/incident-response/incidents/:id/recover
 * Generate and execute recovery plan
 */
router.post('/incidents/:id/recover', authenticateToken, requireIncidentRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { execute } = req.body;

    // Generate recovery plan
    const plan = await incidentResponse.generateRecoveryPlan(id);

    let executionResults = null;
    if (execute) {
      executionResults = await incidentResponse.executeRecovery(id, plan.id);
    }

    await auditLogger.logEvent({
      eventType: 'RECOVERY_INITIATED',
      action: 'START_RECOVERY',
      resourceType: 'incident',
      resourceId: id,
      dataClassification: 'cji',
      metadata: { planGenerated: true, executed: !!execute },
      req
    });

    res.json({
      success: true,
      recoveryPlan: plan,
      executionResults
    });
  } catch (error) {
    console.error('Recovery error:', error);
    res.status(500).json({ error: 'Failed to initiate recovery' });
  }
});

/**
 * GET /api/incident-response/incidents/:id/report
 * Generate incident report
 */
router.get('/incidents/:id/report', authenticateToken, requireIncidentRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { format = 'json' } = req.query;

    const report = await incidentResponse.generateIncidentReport(id);

    await auditLogger.logEvent({
      eventType: 'INCIDENT_REPORT_GENERATED',
      action: 'GENERATE_REPORT',
      resourceType: 'incident',
      resourceId: id,
      dataClassification: 'cji',
      metadata: { format },
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
    console.error('Report generation error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

/**
 * POST /api/incident-response/incidents/:id/forensics
 * Collect forensic data
 */
router.post('/incidents/:id/forensics', authenticateToken, requireIncidentRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { systems } = req.body;

    const forensics = await incidentResponse.collectForensics({
      incidentId: id,
      type: 'manual_collection',
      source: { requestedBy: req.user.id },
      affectedSystems: systems || []
    });

    await auditLogger.logEvent({
      eventType: 'FORENSICS_COLLECTED',
      action: 'COLLECT_FORENSICS',
      resourceType: 'incident',
      resourceId: id,
      dataClassification: 'cji',
      metadata: { dataPoints: forensics.metadata.dataPoints },
      req
    });

    res.json({
      success: true,
      forensicsId: forensics.id,
      dataPoints: forensics.metadata.dataPoints
    });
  } catch (error) {
    console.error('Forensics collection error:', error);
    res.status(500).json({ error: 'Failed to collect forensics' });
  }
});

/**
 * GET /api/incident-response/playbooks
 * Get incident response playbooks
 */
router.get('/playbooks', authenticateToken, requireIncidentRole, async (req, res) => {
  try {
    const playbooks = await pool.query(`
      SELECT * FROM incident_playbooks
      WHERE enabled = true
      ORDER BY incident_type
    `);

    res.json({
      playbooks: playbooks.rows
    });
  } catch (error) {
    console.error('Playbook retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve playbooks' });
  }
});

/**
 * GET /api/incident-response/statistics
 * Get incident statistics
 */
router.get('/statistics', authenticateToken, requireIncidentRole, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let dateFilter = '';
    const params = [];
    
    if (startDate && endDate) {
      dateFilter = 'WHERE created_at BETWEEN $1 AND $2';
      params.push(startDate, endDate);
    }

    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_incidents,
        COUNT(CASE WHEN state = 'closed' THEN 1 END) as resolved_incidents,
        COUNT(CASE WHEN state IN ('detected', 'triaged') THEN 1 END) as active_incidents,
        COUNT(CASE WHEN severity = 'CRITICAL' THEN 1 END) as critical_incidents,
        AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/60) as avg_resolution_minutes,
        COUNT(DISTINCT incident_type) as incident_types
      FROM incident_response
      ${dateFilter}
    `, params);

    // Get incidents by type
    const byType = await pool.query(`
      SELECT 
        incident_type,
        COUNT(*) as count,
        AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/60) as avg_resolution_minutes
      FROM incident_response
      ${dateFilter}
      GROUP BY incident_type
    `, params);

    // Get incidents by severity
    const bySeverity = await pool.query(`
      SELECT 
        severity,
        COUNT(*) as count,
        AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/60) as avg_resolution_minutes
      FROM incident_response
      ${dateFilter}
      GROUP BY severity
    `, params);

    res.json({
      overall: stats.rows[0],
      byType: byType.rows,
      bySeverity: bySeverity.rows,
      period: { startDate, endDate }
    });
  } catch (error) {
    console.error('Statistics error:', error);
    res.status(500).json({ error: 'Failed to generate statistics' });
  }
});

/**
 * POST /api/incident-response/test
 * Test incident creation (development only)
 */
router.post('/test', authenticateToken, requireIncidentRole, async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Test endpoint disabled in production' });
    }

    const testIncident = await incidentResponse.createIncident({
      type: 'unauthorized_access',
      severity: 'MEDIUM',
      description: 'Test incident for Phase 4 validation',
      source: { ipAddress: '192.168.1.100' },
      affectedSystems: ['test-system-1'],
      affectedUsers: [req.user.id],
      detectionMethod: 'test',
      initialFindings: { test: true }
    });

    res.json({
      success: true,
      testIncident
    });
  } catch (error) {
    console.error('Test incident error:', error);
    res.status(500).json({ error: 'Failed to create test incident' });
  }
});

/**
 * WebSocket endpoint for real-time incident updates
 */
router.get('/realtime', authenticateToken, requireIncidentRole, (req, res) => {
  res.json({
    message: 'WebSocket endpoint for real-time incident updates',
    instructions: 'Connect via WebSocket to receive incident notifications'
  });
});

module.exports = router;