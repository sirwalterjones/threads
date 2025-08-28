const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

/**
 * CJIS v6.0 Compliant Session Management Middleware
 * Implements 30-minute session timeout, concurrent session limits, and activity tracking
 */
class SessionManager {
  constructor() {
    this.sessionTimeout = 30; // minutes (CJIS maximum)
    this.maxConcurrentSessions = 3; // per user
    this.warningThreshold = 5; // minutes before expiry to show warning
  }

  /**
   * Validate and refresh session
   * @param {string} token - JWT token
   * @param {string} ipAddress - Client IP address
   * @param {string} userAgent - Client user agent
   * @returns {Promise<Object>} - Session validation result
   */
  async validateSession(token, ipAddress, userAgent) {
    try {
      // First verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Check if session exists in database
      const sessionResult = await pool.query(`
        SELECT 
          s.id, s.user_id, s.expires_at, s.last_activity, s.is_active,
          u.username, u.role, u.is_active as user_active, u.super_admin
        FROM user_sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.session_token = $1 AND s.is_active = true
      `, [token]);

      if (sessionResult.rows.length === 0) {
        return {
          valid: false,
          reason: 'SESSION_NOT_FOUND',
          message: 'Session not found or has been invalidated'
        };
      }

      const session = sessionResult.rows[0];

      // Check if user is still active
      if (!session.user_active) {
        await this.invalidateSession(token, 'USER_DEACTIVATED');
        return {
          valid: false,
          reason: 'USER_DEACTIVATED',
          message: 'User account has been deactivated'
        };
      }

      // Check if session has expired
      const now = new Date();
      const expiresAt = new Date(session.expires_at);
      
      if (now > expiresAt) {
        await this.invalidateSession(token, 'SESSION_EXPIRED');
        return {
          valid: false,
          reason: 'SESSION_EXPIRED',
          message: 'Session has expired'
        };
      }

      // Calculate time remaining
      const timeRemaining = Math.floor((expiresAt - now) / 60000); // minutes

      // Check if session needs activity warning
      const needsWarning = timeRemaining <= this.warningThreshold;

      // Update session activity
      const newExpiresAt = new Date();
      newExpiresAt.setMinutes(newExpiresAt.getMinutes() + this.sessionTimeout);

      await pool.query(`
        UPDATE user_sessions 
        SET 
          last_activity = CURRENT_TIMESTAMP,
          expires_at = $1,
          ip_address = $2,
          user_agent = $3
        WHERE id = $4
      `, [newExpiresAt, ipAddress, userAgent, session.id]);

      // Log session activity for CJIS audit
      await pool.query(`
        INSERT INTO cjis_audit_log (
          user_id, session_id, action, access_result, ip_address, user_agent,
          data_classification, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        session.user_id,
        session.id,
        'SESSION_ACTIVITY',
        'granted',
        ipAddress,
        userAgent,
        'sensitive',
        JSON.stringify({
          time_remaining_minutes: Math.floor((newExpiresAt - now) / 60000),
          session_extended: true,
          timestamp: new Date().toISOString()
        })
      ]);

      return {
        valid: true,
        user: {
          id: session.user_id,
          username: session.username,
          role: session.role,
          super_admin: session.super_admin
        },
        session: {
          id: session.id,
          expiresAt: newExpiresAt,
          timeRemainingMinutes: Math.floor((newExpiresAt - now) / 60000),
          needsWarning
        }
      };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        await this.invalidateSession(token, 'JWT_EXPIRED');
        return {
          valid: false,
          reason: 'SESSION_EXPIRED',
          message: 'Session has expired'
        };
      } else if (error.name === 'JsonWebTokenError') {
        return {
          valid: false,
          reason: 'INVALID_TOKEN',
          message: 'Invalid session token'
        };
      }

      console.error('Session validation error:', error);
      return {
        valid: false,
        reason: 'VALIDATION_ERROR',
        message: 'Session validation failed'
      };
    }
  }

  /**
   * Invalidate a session
   * @param {string} token - JWT token to invalidate
   * @param {string} reason - Reason for invalidation
   */
  async invalidateSession(token, reason = 'MANUAL_LOGOUT') {
    try {
      const result = await pool.query(`
        UPDATE user_sessions 
        SET is_active = false 
        WHERE session_token = $1
        RETURNING user_id, id
      `, [token]);

      if (result.rows.length > 0) {
        const session = result.rows[0];
        
        // Log session termination
        await pool.query(`
          INSERT INTO cjis_audit_log (
            user_id, session_id, action, access_result,
            data_classification, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          session.user_id,
          session.id,
          'SESSION_TERMINATED',
          'granted',
          'sensitive',
          JSON.stringify({
            reason,
            timestamp: new Date().toISOString()
          })
        ]);
      }
    } catch (error) {
      console.error('Error invalidating session:', error);
    }
  }

  /**
   * Check concurrent session limits for a user
   * @param {number} userId - User ID
   * @returns {Promise<Object>} - Session limit check result
   */
  async checkConcurrentSessions(userId) {
    try {
      const result = await pool.query(`
        SELECT COUNT(*) as active_sessions
        FROM user_sessions
        WHERE user_id = $1 AND is_active = true AND expires_at > CURRENT_TIMESTAMP
      `, [userId]);

      const activeSessionCount = parseInt(result.rows[0].active_sessions);
      
      return {
        activeSessionCount,
        maxAllowed: this.maxConcurrentSessions,
        limitExceeded: activeSessionCount >= this.maxConcurrentSessions
      };
    } catch (error) {
      console.error('Error checking concurrent sessions:', error);
      return {
        activeSessionCount: 0,
        maxAllowed: this.maxConcurrentSessions,
        limitExceeded: false
      };
    }
  }

  /**
   * Clean up expired sessions
   * @returns {Promise<number>} - Number of sessions cleaned up
   */
  async cleanupExpiredSessions() {
    try {
      const result = await pool.query(`
        UPDATE user_sessions 
        SET is_active = false 
        WHERE expires_at < CURRENT_TIMESTAMP AND is_active = true
        RETURNING COUNT(*) as cleaned_count
      `);

      const cleanedCount = result.rowCount || 0;
      
      if (cleanedCount > 0) {
        console.log(`Cleaned up ${cleanedCount} expired sessions`);
      }

      return cleanedCount;
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
      return 0;
    }
  }

  /**
   * Terminate oldest session when concurrent limit is exceeded
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} - Success status
   */
  async terminateOldestSession(userId) {
    try {
      const result = await pool.query(`
        UPDATE user_sessions 
        SET is_active = false
        WHERE id = (
          SELECT id FROM user_sessions
          WHERE user_id = $1 AND is_active = true
          ORDER BY last_activity ASC
          LIMIT 1
        )
        RETURNING id, session_token
      `, [userId]);

      if (result.rows.length > 0) {
        const terminatedSession = result.rows[0];
        
        // Log forced session termination
        await pool.query(`
          INSERT INTO cjis_audit_log (
            user_id, session_id, action, access_result,
            data_classification, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          userId,
          terminatedSession.id,
          'SESSION_TERMINATED',
          'granted',
          'sensitive',
          JSON.stringify({
            reason: 'CONCURRENT_LIMIT_EXCEEDED',
            forced: true,
            timestamp: new Date().toISOString()
          })
        ]);

        return true;
      }

      return false;
    } catch (error) {
      console.error('Error terminating oldest session:', error);
      return false;
    }
  }

  /**
   * Express middleware for session validation
   */
  validateSessionMiddleware() {
    return async (req, res, next) => {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];

      if (!token) {
        return res.status(401).json({ 
          error: 'Access token required',
          code: 'NO_TOKEN'
        });
      }

      const ipAddress = req.headers['x-forwarded-for'] ? 
        String(req.headers['x-forwarded-for']).split(',')[0].trim() : req.ip;
      const userAgent = req.headers['user-agent'] || 'Unknown';

      const validation = await this.validateSession(token, ipAddress, userAgent);

      if (!validation.valid) {
        return res.status(401).json({
          error: validation.message,
          code: validation.reason
        });
      }

      // Attach user and session info to request
      req.user = validation.user;
      req.session = validation.session;

      // Add session warning header if needed
      if (validation.session.needsWarning) {
        res.set('X-Session-Warning', `Session expires in ${validation.session.timeRemainingMinutes} minutes`);
      }

      next();
    };
  }

  /**
   * Express middleware for session timeout warnings
   */
  sessionWarningMiddleware() {
    return (req, res, next) => {
      const originalJson = res.json;
      
      res.json = function(data) {
        // Add session info to all responses
        if (req.session) {
          data.session_info = {
            expires_at: req.session.expiresAt,
            time_remaining_minutes: req.session.timeRemainingMinutes,
            needs_warning: req.session.needsWarning
          };
        }

        return originalJson.call(this, data);
      };

      next();
    };
  }
}

// Export singleton instance
const sessionManager = new SessionManager();

// Start cleanup interval (run every 5 minutes)
setInterval(() => {
  sessionManager.cleanupExpiredSessions().catch(console.error);
}, 5 * 60 * 1000);

module.exports = sessionManager;