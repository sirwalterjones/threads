const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const authenticateToken = require('../middleware/auth');
const auditLogger = require('../middleware/auditLogger');
const securityMonitor = require('../services/securityMonitor');

/**
 * CJIS v6.0 Security Dashboard API Routes
 * Provides real-time security monitoring and audit reporting
 */

// Middleware to ensure only admins can access security dashboard
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      await auditLogger.logEvent({
        eventType: 'ACCESS_DENIED',
        action: 'SECURITY_DASHBOARD_ACCESS',
        dataClassification: 'cji',
        accessResult: 'denied',
        req
      });
      
      return res.status(403).json({
        error: 'Access denied',
        message: 'Administrator privileges required'
      });
    }
    next();
  } catch (error) {
    return res.status(500).json({ error: 'Authorization check failed' });
  }
};

/**
 * GET /api/security-dashboard/overview
 * Get security dashboard overview
 */
router.get('/overview', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await auditLogger.logEvent({
      eventType: 'SECURITY_DASHBOARD_ACCESS',
      action: 'VIEW_OVERVIEW',
      dataClassification: 'cji',
      req
    });

    const overview = {
      timestamp: new Date().toISOString(),
      systemHealth: 'normal',
      activeIncidents: [],
      recentAlerts: [],
      metrics: {},
      complianceStatus: {}
    };

    // Get system health status
    const healthResult = await pool.query(`
      SELECT system_health, timestamp
      FROM security_metrics
      ORDER BY timestamp DESC
      LIMIT 1
    `);

    if (healthResult.rows.length > 0) {
      overview.systemHealth = healthResult.rows[0].system_health;
    }

    // Get active security incidents
    const incidentsResult = await pool.query(`
      SELECT 
        id, incident_type, severity, status,
        created_at, details
      FROM security_incidents
      WHERE status IN ('open', 'investigating')
      ORDER BY created_at DESC
      LIMIT 10
    `);

    overview.activeIncidents = incidentsResult.rows;

    // Get recent security alerts
    const alertsResult = await pool.query(`
      SELECT 
        id, alert_type, severity, created_at,
        description, metadata
      FROM security_alerts
      WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
      ORDER BY created_at DESC
      LIMIT 20
    `);

    overview.recentAlerts = alertsResult.rows;

    // Get security metrics for last 24 hours
    const metricsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_events,
        COUNT(CASE WHEN access_result = 'denied' THEN 1 END) as denied_events,
        COUNT(CASE WHEN data_classification = 'cji' THEN 1 END) as cji_access,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT ip_address) as unique_ips
      FROM cjis_audit_log
      WHERE timestamp > CURRENT_TIMESTAMP - INTERVAL '24 hours'
    `);

    overview.metrics = metricsResult.rows[0];

    // Get compliance status
    const complianceResult = await pool.query(`
      SELECT 
        COUNT(CASE WHEN failed_login_attempts > 0 THEN 1 END) as locked_accounts,
        COUNT(CASE WHEN password_last_changed < CURRENT_TIMESTAMP - INTERVAL '90 days' THEN 1 END) as expired_passwords,
        COUNT(CASE WHEN mfa_enabled = false THEN 1 END) as no_mfa
      FROM users
    `);

    overview.complianceStatus = complianceResult.rows[0];

    res.json(overview);
  } catch (error) {
    console.error('Security dashboard error:', error);
    res.status(500).json({ error: 'Failed to load security dashboard' });
  }
});

/**
 * GET /api/security-dashboard/audit-logs
 * Get audit logs with filtering
 */
router.get('/audit-logs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      eventType,
      userId,
      dataClassification,
      accessResult,
      page = 1,
      limit = 50
    } = req.query;

    await auditLogger.logEvent({
      eventType: 'AUDIT_LOG_VIEW',
      action: 'VIEW_AUDIT_LOGS',
      dataClassification: 'cji',
      metadata: { filters: req.query },
      req
    });

    let query = `
      SELECT 
        id, event_type, user_id, username, action,
        resource_type, resource_id, data_classification,
        access_result, ip_address, user_agent,
        request_method, request_path, response_code,
        timestamp, metadata
      FROM cjis_audit_log
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 0;

    if (startDate) {
      params.push(startDate);
      query += ` AND timestamp >= $${++paramIndex}`;
    }

    if (endDate) {
      params.push(endDate);
      query += ` AND timestamp <= $${++paramIndex}`;
    }

    if (eventType) {
      params.push(eventType);
      query += ` AND event_type = $${++paramIndex}`;
    }

    if (userId) {
      params.push(userId);
      query += ` AND user_id = $${++paramIndex}`;
    }

    if (dataClassification) {
      params.push(dataClassification);
      query += ` AND data_classification = $${++paramIndex}`;
    }

    if (accessResult) {
      params.push(accessResult);
      query += ` AND access_result = $${++paramIndex}`;
    }

    // Get total count
    const countQuery = query.replace(
      'SELECT id, event_type, user_id, username, action,',
      'SELECT COUNT(*) as total FROM ('
    ) + ') as subquery';

    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Add pagination
    query += ' ORDER BY timestamp DESC';
    const offset = (page - 1) * limit;
    params.push(limit);
    params.push(offset);
    query += ` LIMIT $${++paramIndex} OFFSET $${++paramIndex}`;

    const result = await pool.query(query, params);

    res.json({
      logs: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Audit log retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve audit logs' });
  }
});

/**
 * GET /api/security-dashboard/verify-integrity
 * Verify audit log integrity
 */
router.get('/verify-integrity', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    await auditLogger.logEvent({
      eventType: 'INTEGRITY_VERIFICATION',
      action: 'VERIFY_AUDIT_INTEGRITY',
      dataClassification: 'cji',
      metadata: { startDate, endDate },
      req
    });

    const result = await auditLogger.verifyIntegrity(startDate, endDate);

    res.json({
      verified: result.verified,
      totalRecords: result.totalRecords,
      errors: result.errors,
      verificationDate: result.verificationDate
    });
  } catch (error) {
    console.error('Integrity verification error:', error);
    res.status(500).json({ error: 'Failed to verify integrity' });
  }
});

/**
 * GET /api/security-dashboard/alerts
 * Get security alerts
 */
router.get('/alerts', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { severity, status, limit = 50 } = req.query;

    let query = `
      SELECT * FROM security_alerts
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 0;

    if (severity) {
      params.push(severity);
      query += ` AND severity = $${++paramIndex}`;
    }

    if (status) {
      params.push(status);
      query += ` AND status = $${++paramIndex}`;
    }

    params.push(limit);
    query += ` ORDER BY created_at DESC LIMIT $${++paramIndex}`;

    const result = await pool.query(query, params);

    // Get real-time alerts from monitor
    const realtimeAlerts = securityMonitor.alertHistory.slice(-20);

    res.json({
      alerts: result.rows,
      realtimeAlerts,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Alert retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve alerts' });
  }
});

/**
 * POST /api/security-dashboard/alerts/:id/acknowledge
 * Acknowledge a security alert
 */
router.post('/alerts/:id/acknowledge', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    await pool.query(`
      UPDATE security_alerts
      SET 
        status = 'acknowledged',
        acknowledged_by = $1,
        acknowledged_at = CURRENT_TIMESTAMP,
        notes = $2
      WHERE id = $3
    `, [req.user.id, notes, id]);

    await auditLogger.logAdminAction(
      'ALERT_ACKNOWLEDGED',
      'security_alert',
      id,
      { notes },
      req
    );

    res.json({ success: true, alertId: id });
  } catch (error) {
    console.error('Alert acknowledgment error:', error);
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

/**
 * GET /api/security-dashboard/incidents
 * Get security incidents
 */
router.get('/incidents', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status, severity, page = 1, limit = 20 } = req.query;

    let query = `
      SELECT 
        si.*,
        al.event_type,
        al.user_id,
        al.username,
        al.ip_address
      FROM security_incidents si
      LEFT JOIN cjis_audit_log al ON si.audit_log_id = al.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 0;

    if (status) {
      params.push(status);
      query += ` AND si.status = $${++paramIndex}`;
    }

    if (severity) {
      params.push(severity);
      query += ` AND si.severity = $${++paramIndex}`;
    }

    const offset = (page - 1) * limit;
    params.push(limit);
    params.push(offset);
    query += ` ORDER BY si.created_at DESC LIMIT $${++paramIndex} OFFSET $${++paramIndex}`;

    const result = await pool.query(query, params);

    res.json({
      incidents: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Incident retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve incidents' });
  }
});

/**
 * POST /api/security-dashboard/incidents/:id/update
 * Update security incident status
 */
router.post('/incidents/:id/update', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, assignedTo, notes } = req.body;

    await pool.query(`
      UPDATE security_incidents
      SET 
        status = $1,
        assigned_to = $2,
        notes = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `, [status, assignedTo, notes, id]);

    await auditLogger.logAdminAction(
      'INCIDENT_UPDATED',
      'security_incident',
      id,
      { status, assignedTo, notes },
      req
    );

    res.json({ success: true, incidentId: id });
  } catch (error) {
    console.error('Incident update error:', error);
    res.status(500).json({ error: 'Failed to update incident' });
  }
});

/**
 * GET /api/security-dashboard/report
 * Generate security audit report
 */
router.get('/report', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate, format = 'json' } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'Start date and end date are required'
      });
    }

    await auditLogger.logEvent({
      eventType: 'AUDIT_REPORT_GENERATED',
      action: 'GENERATE_REPORT',
      dataClassification: 'cji',
      metadata: { startDate, endDate, format },
      req
    });

    const report = await auditLogger.generateAuditReport(startDate, endDate);

    if (format === 'csv') {
      // Convert to CSV format
      const csv = convertReportToCSV(report);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=security-report-${report.reportId}.csv`);
      res.send(csv);
    } else {
      res.json(report);
    }
  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

/**
 * GET /api/security-dashboard/metrics
 * Get real-time security metrics
 */
router.get('/metrics', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const metrics = await securityMonitor.generateMetrics();

    // Get additional metrics
    const additionalMetrics = await pool.query(`
      SELECT 
        COUNT(DISTINCT event_type) as event_types,
        COUNT(DISTINCT user_id) as active_users,
        COUNT(CASE WHEN timestamp > CURRENT_TIMESTAMP - INTERVAL '1 hour' THEN 1 END) as last_hour_events,
        COUNT(CASE WHEN timestamp > CURRENT_TIMESTAMP - INTERVAL '24 hours' THEN 1 END) as last_day_events
      FROM cjis_audit_log
    `);

    res.json({
      ...metrics,
      ...additionalMetrics.rows[0],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Metrics retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve metrics' });
  }
});

/**
 * WebSocket endpoint for real-time monitoring
 * Note: In production, implement WebSocket server for real-time updates
 */
router.get('/realtime', authenticateToken, requireAdmin, (req, res) => {
  res.json({
    message: 'WebSocket endpoint for real-time monitoring',
    instructions: 'Connect via WebSocket to receive real-time security alerts'
  });
});

/**
 * Helper function to convert report to CSV
 */
function convertReportToCSV(report) {
  let csv = 'Report ID,Generated At,Period Start,Period End\n';
  csv += `${report.reportId},${report.generatedAt},${report.period.startDate},${report.period.endDate}\n\n`;

  csv += 'Event Statistics\n';
  csv += 'Event Type,Count,Unique Users,Denied Count\n';
  report.statistics.forEach(stat => {
    csv += `${stat.event_type},${stat.count},${stat.unique_users},${stat.denied_count}\n`;
  });

  csv += '\nSecurity Incidents\n';
  csv += 'Timestamp,Event Type,User,IP Address,Result\n';
  report.securityIncidents.forEach(incident => {
    csv += `${incident.timestamp},${incident.event_type},${incident.username},${incident.ip_address},${incident.access_result}\n`;
  });

  csv += '\nData Access Summary\n';
  csv += 'User ID,Username,Access Count,Unique Resources,Last Access\n';
  report.dataAccess.forEach(access => {
    csv += `${access.user_id},${access.username},${access.access_count},${access.unique_resources},${access.last_access}\n`;
  });

  csv += `\nIntegrity Check: ${report.integrityCheck.verified ? 'PASSED' : 'FAILED'}\n`;

  return csv;
}

module.exports = router;