const { pool } = require('../config/database');
const auditLogger = require('../middleware/auditLogger');
const EventEmitter = require('events');

/**
 * CJIS v6.0 Compliant Real-time Security Monitoring System
 * Monitors system activity for security threats and compliance violations
 */
class SecurityMonitor extends EventEmitter {
  constructor() {
    super();
    
    this.monitoringEnabled = true;
    this.alertThresholds = {
      failedLogins: 5,           // Alert after 5 failed logins
      suspiciousActivity: 3,     // Alert after 3 suspicious events
      dataExports: 10,           // Alert on excessive data exports
      privilegedActions: 5,      // Alert on multiple admin actions
      sessionTimeouts: 10        // Alert on mass session timeouts
    };
    
    this.timeWindows = {
      failedLogins: 5 * 60 * 1000,      // 5 minutes
      suspiciousActivity: 15 * 60 * 1000, // 15 minutes
      dataExports: 60 * 60 * 1000,      // 1 hour
      privilegedActions: 30 * 60 * 1000, // 30 minutes
      sessionTimeouts: 10 * 60 * 1000    // 10 minutes
    };
    
    this.activeMonitors = new Map();
    this.alertHistory = [];
    this.metrics = {
      totalEvents: 0,
      securityEvents: 0,
      alertsTriggered: 0,
      threatsDetected: 0
    };
    
    // Start monitoring
    this.initializeMonitoring();
  }

  /**
   * Initialize real-time monitoring
   */
  async initializeMonitoring() {
    try {
      // Start periodic checks
      this.startPeriodicMonitoring();
      
      // Initialize threat detection patterns
      this.initializeThreatPatterns();
      
      // Load baseline metrics
      await this.loadBaselineMetrics();
      
      console.log('✅ Security monitoring system initialized');
    } catch (error) {
      console.error('Failed to initialize security monitoring:', error);
    }
  }

  /**
   * Start periodic monitoring checks
   */
  startPeriodicMonitoring() {
    // Check for anomalies every minute
    setInterval(() => this.checkForAnomalies(), 60 * 1000);
    
    // Check for compliance violations every 5 minutes
    setInterval(() => this.checkComplianceStatus(), 5 * 60 * 1000);
    
    // Generate metrics every 10 minutes
    setInterval(() => this.generateMetrics(), 10 * 60 * 1000);
    
    // Clean up old data every hour
    setInterval(() => this.cleanupOldData(), 60 * 60 * 1000);
  }

  /**
   * Monitor authentication events
   */
  async monitorAuthentication(eventType, userId, username, success, metadata = {}) {
    this.metrics.totalEvents++;
    
    if (!success) {
      // Track failed login attempts
      const key = `failed_login_${userId || username || metadata.ipAddress}`;
      await this.trackEvent(key, 'failedLogins');
      
      // Check for brute force attacks
      const count = this.getEventCount(key, this.timeWindows.failedLogins);
      if (count >= this.alertThresholds.failedLogins) {
        await this.triggerAlert('BRUTE_FORCE_DETECTED', {
          userId,
          username,
          attempts: count,
          ipAddress: metadata.ipAddress
        });
      }
    }
    
    // Check for suspicious login patterns
    await this.detectSuspiciousLoginPatterns(userId, metadata);
  }

  /**
   * Monitor data access events
   */
  async monitorDataAccess(userId, resourceType, resourceId, action, classification) {
    this.metrics.totalEvents++;
    
    // Track CJI data access
    if (classification === 'cji') {
      const key = `cji_access_${userId}`;
      await this.trackEvent(key, 'dataAccess');
      
      // Check for excessive data access
      await this.detectExcessiveDataAccess(userId, resourceType);
    }
    
    // Monitor data exports
    if (action === 'EXPORT' || action === 'DOWNLOAD') {
      const key = `data_export_${userId}`;
      await this.trackEvent(key, 'dataExports');
      
      const count = this.getEventCount(key, this.timeWindows.dataExports);
      if (count >= this.alertThresholds.dataExports) {
        await this.triggerAlert('EXCESSIVE_DATA_EXPORT', {
          userId,
          exportCount: count,
          resourceType
        });
      }
    }
  }

  /**
   * Monitor administrative actions
   */
  async monitorAdminAction(userId, action, targetResource, changes = {}) {
    this.metrics.totalEvents++;
    
    const key = `admin_action_${userId}`;
    await this.trackEvent(key, 'privilegedActions');
    
    // Check for suspicious admin activity
    const count = this.getEventCount(key, this.timeWindows.privilegedActions);
    if (count >= this.alertThresholds.privilegedActions) {
      await this.triggerAlert('EXCESSIVE_ADMIN_ACTIVITY', {
        userId,
        actionCount: count,
        recentActions: this.getRecentEvents(key)
      });
    }
    
    // Monitor critical changes
    if (this.isCriticalChange(action, targetResource)) {
      await this.triggerAlert('CRITICAL_SYSTEM_CHANGE', {
        userId,
        action,
        targetResource,
        changes
      });
    }
  }

  /**
   * Detect suspicious login patterns
   */
  async detectSuspiciousLoginPatterns(userId, metadata) {
    if (!userId) return;
    
    try {
      // Check for impossible travel
      const recentLogins = await pool.query(`
        SELECT ip_address, timestamp, metadata
        FROM cjis_audit_log
        WHERE user_id = $1 
          AND event_type = 'LOGIN_SUCCESS'
          AND timestamp > CURRENT_TIMESTAMP - INTERVAL '1 hour'
        ORDER BY timestamp DESC
        LIMIT 5
      `, [userId]);
      
      if (recentLogins.rows.length > 1) {
        const locations = recentLogins.rows.map(row => ({
          ip: row.ip_address,
          time: row.timestamp,
          location: row.metadata?.geoLocation
        }));
        
        // Check for impossible travel between locations
        for (let i = 1; i < locations.length; i++) {
          if (this.isImpossibleTravel(locations[i-1], locations[i])) {
            await this.triggerAlert('IMPOSSIBLE_TRAVEL_DETECTED', {
              userId,
              locations: [locations[i-1], locations[i]]
            });
            break;
          }
        }
      }
      
      // Check for unusual login times
      const hour = new Date().getHours();
      if (hour >= 2 && hour <= 5) { // 2 AM - 5 AM
        const key = `unusual_time_${userId}`;
        await this.trackEvent(key, 'suspiciousActivity');
      }
    } catch (error) {
      console.error('Failed to detect suspicious patterns:', error);
    }
  }

  /**
   * Detect excessive data access
   */
  async detectExcessiveDataAccess(userId, resourceType) {
    try {
      // Check access frequency
      const result = await pool.query(`
        SELECT COUNT(*) as access_count
        FROM cjis_audit_log
        WHERE user_id = $1
          AND resource_type = $2
          AND timestamp > CURRENT_TIMESTAMP - INTERVAL '1 hour'
      `, [userId, resourceType]);
      
      const accessCount = parseInt(result.rows[0].access_count);
      
      // Get baseline for comparison
      const baseline = await this.getBaselineAccessRate(userId, resourceType);
      
      if (accessCount > baseline * 3) { // 3x normal rate
        await this.triggerAlert('ABNORMAL_ACCESS_PATTERN', {
          userId,
          resourceType,
          currentRate: accessCount,
          baseline
        });
      }
    } catch (error) {
      console.error('Failed to detect excessive access:', error);
    }
  }

  /**
   * Check for system anomalies
   */
  async checkForAnomalies() {
    if (!this.monitoringEnabled) return;
    
    try {
      // Check for mass logouts (possible security incident)
      const logoutResult = await pool.query(`
        SELECT COUNT(*) as count
        FROM cjis_audit_log
        WHERE event_type = 'SESSION_TIMEOUT'
          AND timestamp > CURRENT_TIMESTAMP - INTERVAL '10 minutes'
      `);
      
      const logoutCount = parseInt(logoutResult.rows[0].count);
      if (logoutCount >= this.alertThresholds.sessionTimeouts) {
        await this.triggerAlert('MASS_SESSION_TIMEOUT', {
          count: logoutCount,
          possibleCause: 'System issue or security incident'
        });
      }
      
      // Check for SQL injection attempts
      const injectionResult = await pool.query(`
        SELECT * FROM cjis_audit_log
        WHERE event_type IN ('SQL_INJECTION_ATTEMPT', 'XSS_ATTEMPT')
          AND timestamp > CURRENT_TIMESTAMP - INTERVAL '1 hour'
      `);
      
      if (injectionResult.rows.length > 0) {
        for (const attempt of injectionResult.rows) {
          await this.triggerAlert('INJECTION_ATTEMPT_DETECTED', {
            type: attempt.event_type,
            source: attempt.ip_address,
            path: attempt.request_path,
            details: attempt.metadata
          });
        }
      }
    } catch (error) {
      console.error('Anomaly check failed:', error);
    }
  }

  /**
   * Check compliance status
   */
  async checkComplianceStatus() {
    try {
      const violations = [];
      
      // Check password policy compliance
      const weakPasswordResult = await pool.query(`
        SELECT COUNT(*) as count
        FROM users
        WHERE password_last_changed < CURRENT_TIMESTAMP - INTERVAL '90 days'
      `);
      
      if (parseInt(weakPasswordResult.rows[0].count) > 0) {
        violations.push({
          type: 'PASSWORD_POLICY',
          count: weakPasswordResult.rows[0].count,
          requirement: 'Passwords must be changed every 90 days'
        });
      }
      
      // Check for inactive sessions
      const inactiveResult = await pool.query(`
        SELECT COUNT(*) as count
        FROM user_sessions
        WHERE last_activity < CURRENT_TIMESTAMP - INTERVAL '30 minutes'
          AND is_active = true
      `);
      
      if (parseInt(inactiveResult.rows[0].count) > 0) {
        violations.push({
          type: 'SESSION_TIMEOUT',
          count: inactiveResult.rows[0].count,
          requirement: 'Sessions must timeout after 30 minutes'
        });
      }
      
      // Check audit log integrity
      const integrityResult = await auditLogger.verifyIntegrity(
        new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        new Date()
      );
      
      if (!integrityResult.verified) {
        violations.push({
          type: 'AUDIT_INTEGRITY',
          errors: integrityResult.errors,
          requirement: 'Audit logs must maintain integrity'
        });
      }
      
      if (violations.length > 0) {
        await this.triggerAlert('COMPLIANCE_VIOLATIONS_DETECTED', {
          violations,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Compliance check failed:', error);
    }
  }

  /**
   * Generate security metrics
   */
  async generateMetrics() {
    try {
      const metrics = {
        timestamp: new Date().toISOString(),
        period: '10_minutes',
        events: {
          total: this.metrics.totalEvents,
          security: this.metrics.securityEvents,
          alerts: this.metrics.alertsTriggered
        },
        topThreats: [],
        activeIncidents: [],
        systemHealth: 'normal'
      };
      
      // Get top threat types
      const threatResult = await pool.query(`
        SELECT event_type, COUNT(*) as count
        FROM cjis_audit_log
        WHERE timestamp > CURRENT_TIMESTAMP - INTERVAL '1 hour'
          AND access_result = 'denied'
        GROUP BY event_type
        ORDER BY count DESC
        LIMIT 5
      `);
      
      metrics.topThreats = threatResult.rows;
      
      // Get active incidents
      const incidentResult = await pool.query(`
        SELECT * FROM security_incidents
        WHERE status = 'open'
        ORDER BY created_at DESC
      `);
      
      metrics.activeIncidents = incidentResult.rows;
      
      // Determine system health
      if (metrics.activeIncidents.length > 5) {
        metrics.systemHealth = 'critical';
      } else if (metrics.activeIncidents.length > 2) {
        metrics.systemHealth = 'warning';
      }
      
      // Store metrics
      await pool.query(`
        INSERT INTO security_metrics (
          timestamp, metrics, system_health
        ) VALUES ($1, $2, $3)
      `, [
        new Date(),
        JSON.stringify(metrics),
        metrics.systemHealth
      ]);
      
      // Reset counters
      this.metrics = {
        totalEvents: 0,
        securityEvents: 0,
        alertsTriggered: 0,
        threatsDetected: 0
      };
      
      this.emit('metrics', metrics);
      
      return metrics;
    } catch (error) {
      console.error('Failed to generate metrics:', error);
    }
  }

  /**
   * Track event for threshold monitoring
   */
  async trackEvent(key, category) {
    if (!this.activeMonitors.has(key)) {
      this.activeMonitors.set(key, []);
    }
    
    const events = this.activeMonitors.get(key);
    events.push({
      timestamp: Date.now(),
      category
    });
    
    // Keep only recent events
    const cutoff = Date.now() - Math.max(...Object.values(this.timeWindows));
    this.activeMonitors.set(key, events.filter(e => e.timestamp > cutoff));
  }

  /**
   * Get event count within time window
   */
  getEventCount(key, timeWindow) {
    if (!this.activeMonitors.has(key)) return 0;
    
    const events = this.activeMonitors.get(key);
    const cutoff = Date.now() - timeWindow;
    
    return events.filter(e => e.timestamp > cutoff).length;
  }

  /**
   * Get recent events for a key
   */
  getRecentEvents(key, limit = 10) {
    if (!this.activeMonitors.has(key)) return [];
    
    const events = this.activeMonitors.get(key);
    return events.slice(-limit);
  }

  /**
   * Trigger security alert
   */
  async triggerAlert(alertType, details) {
    this.metrics.alertsTriggered++;
    
    const alert = {
      id: require('crypto').randomBytes(16).toString('hex'),
      type: alertType,
      severity: this.getAlertSeverity(alertType),
      timestamp: new Date().toISOString(),
      details,
      status: 'new'
    };
    
    // Store alert
    this.alertHistory.push(alert);
    if (this.alertHistory.length > 1000) {
      this.alertHistory.shift(); // Keep only recent 1000 alerts
    }
    
    // Log to audit system
    await auditLogger.logSecurityIncident(
      alertType,
      alert.severity,
      details
    );
    
    // Emit event for real-time notifications
    this.emit('alert', alert);
    
    // In production, send notifications
    await this.sendAlertNotifications(alert);
    
    console.error(`🚨 SECURITY ALERT [${alert.severity}]: ${alertType}`, details);
    
    return alert;
  }

  /**
   * Send alert notifications
   */
  async sendAlertNotifications(alert) {
    // In production, this would send:
    // - Email to security team
    // - SMS for critical alerts
    // - Integration with SIEM systems
    // - Webhook to monitoring systems
    
    if (alert.severity === 'CRITICAL') {
      // Immediate notification required
      console.error('CRITICAL ALERT - Immediate action required:', alert);
    }
  }

  /**
   * Get alert severity based on type
   */
  getAlertSeverity(alertType) {
    const criticalAlerts = [
      'BRUTE_FORCE_DETECTED',
      'SQL_INJECTION_ATTEMPT',
      'CRITICAL_SYSTEM_CHANGE',
      'AUDIT_INTEGRITY'
    ];
    
    const highAlerts = [
      'IMPOSSIBLE_TRAVEL_DETECTED',
      'EXCESSIVE_DATA_EXPORT',
      'INJECTION_ATTEMPT_DETECTED'
    ];
    
    if (criticalAlerts.includes(alertType)) return 'CRITICAL';
    if (highAlerts.includes(alertType)) return 'HIGH';
    
    return 'MEDIUM';
  }

  /**
   * Check if travel between locations is impossible
   */
  isImpossibleTravel(location1, location2) {
    if (!location1.location || !location2.location) return false;
    
    const timeDiff = Math.abs(location2.time - location1.time) / 1000 / 60; // minutes
    
    // Simplified check - in production use geo-distance calculation
    if (location1.location.country !== location2.location.country && timeDiff < 60) {
      return true; // Different countries within 1 hour
    }
    
    return false;
  }

  /**
   * Check if action is critical
   */
  isCriticalChange(action, resource) {
    const criticalActions = [
      'SYSTEM_CONFIG_CHANGED',
      'USER_DELETED',
      'ROLE_CHANGED',
      'PERMISSION_GRANTED'
    ];
    
    const criticalResources = [
      'system_config',
      'security_settings',
      'encryption_keys'
    ];
    
    return criticalActions.includes(action) || criticalResources.includes(resource);
  }

  /**
   * Load baseline metrics for comparison
   */
  async loadBaselineMetrics() {
    try {
      // Load average access rates
      const result = await pool.query(`
        SELECT 
          user_id,
          resource_type,
          COUNT(*) / 7 as daily_average
        FROM cjis_audit_log
        WHERE timestamp > CURRENT_TIMESTAMP - INTERVAL '7 days'
        GROUP BY user_id, resource_type
      `);
      
      this.baselineMetrics = new Map();
      for (const row of result.rows) {
        const key = `${row.user_id}_${row.resource_type}`;
        this.baselineMetrics.set(key, row.daily_average);
      }
    } catch (error) {
      console.error('Failed to load baseline metrics:', error);
    }
  }

  /**
   * Get baseline access rate for user/resource
   */
  async getBaselineAccessRate(userId, resourceType) {
    const key = `${userId}_${resourceType}`;
    return this.baselineMetrics.get(key) || 10; // Default baseline
  }

  /**
   * Initialize threat detection patterns
   */
  initializeThreatPatterns() {
    this.threatPatterns = {
      sqlInjection: /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)\b|--|\/\*|\*\/|xp_|sp_|0x)/i,
      xss: /(<script|javascript:|onerror=|onclick=|<iframe|<object|<embed)/i,
      pathTraversal: /(\.\.\/|\.\.\\|%2e%2e|0x2e0x2e)/i,
      commandInjection: /(\||;|&|`|\$\(|<\()/
    };
  }

  /**
   * Clean up old monitoring data
   */
  async cleanupOldData() {
    try {
      // Clean old alerts
      const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours
      this.alertHistory = this.alertHistory.filter(a => 
        new Date(a.timestamp).getTime() > cutoff
      );
      
      // Clean old monitor data
      for (const [key, events] of this.activeMonitors.entries()) {
        const filtered = events.filter(e => e.timestamp > cutoff);
        if (filtered.length === 0) {
          this.activeMonitors.delete(key);
        } else {
          this.activeMonitors.set(key, filtered);
        }
      }
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }
}

// Export singleton instance
const securityMonitor = new SecurityMonitor();
module.exports = securityMonitor;