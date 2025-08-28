const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

/**
 * CJIS v6.0 Compliant Login Security Middleware
 * Implements account lockout, failed attempt tracking, and session management
 */
class LoginSecurity {
  constructor() {
    this.maxFailedAttempts = 5; // CJIS recommendation
    this.lockoutDuration = 30; // minutes
    this.sessionTimeout = 30; // minutes (CJIS maximum)
  }

  /**
   * Check if account is locked due to failed attempts
   * @param {number} userId - User ID to check
   * @returns {Promise<Object>} - Lock status and remaining time
   */
  async isAccountLocked(userId) {
    try {
      const result = await pool.query(`
        SELECT 
          failed_login_attempts,
          account_locked_until,
          CASE 
            WHEN account_locked_until IS NULL THEN false
            WHEN account_locked_until > CURRENT_TIMESTAMP THEN true
            ELSE false
          END as is_locked,
          CASE 
            WHEN account_locked_until > CURRENT_TIMESTAMP 
            THEN EXTRACT(EPOCH FROM (account_locked_until - CURRENT_TIMESTAMP))
            ELSE 0
          END as seconds_remaining
        FROM users 
        WHERE id = $1
      `, [userId]);

      if (result.rows.length === 0) {
        return { isLocked: false, attemptsRemaining: this.maxFailedAttempts };
      }

      const user = result.rows[0];
      return {
        isLocked: user.is_locked,
        secondsRemaining: Math.ceil(user.seconds_remaining),
        attemptsRemaining: Math.max(0, this.maxFailedAttempts - user.failed_login_attempts),
        failedAttempts: user.failed_login_attempts
      };
    } catch (error) {
      console.error('Error checking account lock status:', error);
      return { isLocked: false, attemptsRemaining: this.maxFailedAttempts };
    }
  }

  /**
   * Record failed login attempt and potentially lock account
   * @param {number} userId - User ID
   * @param {string} ipAddress - Client IP address
   * @param {string} userAgent - Client user agent
   */
  async recordFailedAttempt(userId, ipAddress, userAgent) {
    try {
      const result = await pool.query(`
        UPDATE users 
        SET 
          failed_login_attempts = failed_login_attempts + 1,
          account_locked_until = CASE 
            WHEN failed_login_attempts + 1 >= $1 
            THEN CURRENT_TIMESTAMP + INTERVAL '${this.lockoutDuration} minutes'
            ELSE account_locked_until
          END
        WHERE id = $2
        RETURNING failed_login_attempts, account_locked_until
      `, [this.maxFailedAttempts, userId]);

      if (result.rows.length > 0) {
        const user = result.rows[0];
        
        // Log the failed attempt
        await pool.query(`
          INSERT INTO cjis_audit_log (
            user_id, action, access_result, ip_address, user_agent,
            data_classification, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          userId,
          'LOGIN_ATTEMPT',
          'failed',
          ipAddress,
          userAgent,
          'sensitive',
          JSON.stringify({
            reason: 'invalid_credentials',
            failed_attempts: user.failed_login_attempts,
            account_locked: user.account_locked_until !== null,
            timestamp: new Date().toISOString()
          })
        ]);

        // If account is now locked, create security incident
        if (user.failed_login_attempts >= this.maxFailedAttempts) {
          await this.createSecurityIncident(userId, 'ACCOUNT_LOCKOUT', {
            failed_attempts: user.failed_login_attempts,
            locked_until: user.account_locked_until,
            ip_address: ipAddress,
            user_agent: userAgent
          });
        }
      }
    } catch (error) {
      console.error('Error recording failed login attempt:', error);
    }
  }

  /**
   * Reset failed login attempts on successful login
   * @param {number} userId - User ID
   */
  async resetFailedAttempts(userId) {
    try {
      await pool.query(`
        UPDATE users 
        SET 
          failed_login_attempts = 0,
          account_locked_until = NULL,
          last_login = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [userId]);
    } catch (error) {
      console.error('Error resetting failed attempts:', error);
    }
  }

  /**
   * Create a security incident record
   * @param {number} userId - Affected user ID
   * @param {string} incidentType - Type of incident
   * @param {Object} metadata - Additional incident data
   */
  async createSecurityIncident(userId, incidentType, metadata) {
    try {
      await pool.query(`
        INSERT INTO security_incidents (
          incident_type, severity, title, description,
          affected_user_ids, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        incidentType,
        'medium',
        `Account lockout for user ID ${userId}`,
        `User account locked after ${this.maxFailedAttempts} failed login attempts`,
        [userId],
        metadata
      ]);
    } catch (error) {
      console.error('Error creating security incident:', error);
    }
  }

  /**
   * Create a new user session with CJIS tracking
   * @param {number} userId - User ID
   * @param {string} token - JWT token
   * @param {string} ipAddress - Client IP
   * @param {string} userAgent - Client user agent
   * @returns {Promise<Object>} - Session information
   */
  async createSession(userId, token, ipAddress, userAgent) {
    try {
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + this.sessionTimeout);

      const result = await pool.query(`
        INSERT INTO user_sessions (
          user_id, session_token, expires_at, ip_address, user_agent
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING id, expires_at
      `, [userId, token, expiresAt, ipAddress, userAgent]);

      return {
        sessionId: result.rows[0].id,
        expiresAt: result.rows[0].expires_at,
        timeoutMinutes: this.sessionTimeout
      };
    } catch (error) {
      console.error('Error creating user session:', error);
      return null;
    }
  }

  /**
   * Check if password has expired (CJIS requirement)
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} - True if password has expired
   */
  async isPasswordExpired(userId) {
    try {
      const result = await pool.query(`
        SELECT 
          COALESCE(last_password_change, created_at) as last_change,
          password_never_expires,
          CURRENT_TIMESTAMP - INTERVAL '365 days' as expiry_threshold
        FROM users 
        WHERE id = $1
      `, [userId]);

      if (result.rows.length === 0) {
        return true; // User not found, treat as expired
      }

      const user = result.rows[0];
      
      // Check if password never expires (for service accounts)
      if (user.password_never_expires) {
        return false;
      }

      // CJIS v6.0 allows 365-day expiration with advanced controls
      return new Date(user.last_change) < new Date(user.expiry_threshold);
    } catch (error) {
      console.error('Password expiry check failed:', error);
      return false; // Don't block on error
    }
  }

  /**
   * Express middleware for CJIS-compliant login handling
   */
  loginHandler() {
    return async (req, res, next) => {
      try {
        const { username, password } = req.body;
        const ipAddress = req.headers['x-forwarded-for'] ? 
          String(req.headers['x-forwarded-for']).split(',')[0].trim() : req.ip;
        const userAgent = req.headers['user-agent'] || 'Unknown';

        if (!username || !password) {
          return res.status(400).json({ 
            error: 'Username and password are required',
            code: 'MISSING_CREDENTIALS'
          });
        }

        // Find user with security fields
        const userResult = await pool.query(`
          SELECT 
            id, username, email, password_hash, role, is_active, super_admin,
            COALESCE(totp_enabled, false) as totp_enabled,
            COALESCE(force_2fa_setup, false) as force_2fa_setup,
            failed_login_attempts,
            account_locked_until
          FROM users 
          WHERE username = $1
        `, [username]);

        if (userResult.rows.length === 0) {
          // Log failed attempt for non-existent user
          await pool.query(`
            INSERT INTO cjis_audit_log (
              action, access_result, ip_address, user_agent,
              data_classification, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6)
          `, [
            'LOGIN_ATTEMPT',
            'failed',
            ipAddress,
            userAgent,
            'sensitive',
            JSON.stringify({
              username,
              reason: 'user_not_found',
              timestamp: new Date().toISOString()
            })
          ]);

          return res.status(401).json({ 
            error: 'Invalid credentials',
            code: 'INVALID_CREDENTIALS'
          });
        }

        const user = userResult.rows[0];

        // Check if account is active
        if (!user.is_active) {
          await pool.query(`
            INSERT INTO cjis_audit_log (
              user_id, action, access_result, ip_address, user_agent,
              data_classification, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            user.id,
            'LOGIN_ATTEMPT',
            'denied',
            ipAddress,
            userAgent,
            'sensitive',
            JSON.stringify({
              username,
              reason: 'account_inactive',
              timestamp: new Date().toISOString()
            })
          ]);

          return res.status(401).json({ 
            error: 'Account is deactivated',
            code: 'ACCOUNT_INACTIVE'
          });
        }

        // Check if account is locked
        const lockStatus = await this.isAccountLocked(user.id);
        if (lockStatus.isLocked) {
          return res.status(423).json({ 
            error: 'Account is temporarily locked due to failed login attempts',
            code: 'ACCOUNT_LOCKED',
            unlockIn: lockStatus.secondsRemaining,
            message: `Account will be unlocked in ${Math.ceil(lockStatus.secondsRemaining / 60)} minutes`
          });
        }

        // Verify password
        const passwordValid = await bcrypt.compare(password, user.password_hash);
        if (!passwordValid) {
          await this.recordFailedAttempt(user.id, ipAddress, userAgent);
          
          const updatedLockStatus = await this.isAccountLocked(user.id);
          const response = { 
            error: 'Invalid credentials',
            code: 'INVALID_CREDENTIALS'
          };

          // Provide lockout warning
          if (updatedLockStatus.attemptsRemaining <= 2) {
            response.warning = `Account will be locked after ${updatedLockStatus.attemptsRemaining} more failed attempts`;
          }

          if (updatedLockStatus.isLocked) {
            response.error = 'Account has been locked due to failed login attempts';
            response.code = 'ACCOUNT_LOCKED';
            response.unlockIn = updatedLockStatus.secondsRemaining;
          }

          return res.status(401).json(response);
        }

        // Check password expiry
        const passwordExpired = await this.isPasswordExpired(user.id);
        if (passwordExpired) {
          await pool.query(`
            INSERT INTO cjis_audit_log (
              user_id, action, access_result, ip_address, user_agent,
              data_classification, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            user.id,
            'LOGIN_ATTEMPT',
            'denied',
            ipAddress,
            userAgent,
            'sensitive',
            JSON.stringify({
              username,
              reason: 'password_expired',
              timestamp: new Date().toISOString()
            })
          ]);

          return res.status(401).json({
            error: 'Password has expired and must be changed',
            code: 'PASSWORD_EXPIRED',
            action_required: 'CHANGE_PASSWORD'
          });
        }

        // Reset failed attempts on successful login
        await this.resetFailedAttempts(user.id);

        // Generate JWT token
        const tokenPayload = { 
          userId: user.id, 
          username: user.username, 
          role: user.role 
        };
        const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { 
          expiresIn: `${this.sessionTimeout}m` 
        });

        // Create session record
        const session = await this.createSession(user.id, token, ipAddress, userAgent);

        // Log successful login
        await pool.query(`
          INSERT INTO cjis_audit_log (
            user_id, session_id, action, access_result, ip_address, user_agent,
            data_classification, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          user.id,
          session?.sessionId,
          'LOGIN_ATTEMPT',
          'granted',
          ipAddress,
          userAgent,
          'sensitive',
          JSON.stringify({
            username,
            session_expires: session?.expiresAt,
            requires_2fa: user.totp_enabled || user.force_2fa_setup,
            timestamp: new Date().toISOString()
          })
        ]);

        // Check if 2FA is required
        const requires2FA = user.force_2fa_setup || user.totp_enabled;
        
        const response = {
          success: true,
          token,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            super_admin: user.super_admin
          },
          session: {
            expiresAt: session?.expiresAt,
            timeoutMinutes: this.sessionTimeout
          }
        };

        if (requires2FA) {
          response.requires_2fa = true;
          response.totp_enabled = user.totp_enabled;
          response.force_2fa_setup = user.force_2fa_setup;
        }

        res.json(response);
      } catch (error) {
        console.error('Login handler error:', error);
        res.status(500).json({ 
          error: 'Authentication failed',
          code: 'INTERNAL_ERROR'
        });
      }
    };
  }
}

// Export singleton instance
const loginSecurity = new LoginSecurity();
module.exports = loginSecurity;