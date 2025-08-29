const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database to ensure they still exist and are active
    const userResult = await pool.query(
      'SELECT id, username, email, role, is_active, super_admin FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
      return res.status(403).json({ error: 'Invalid or inactive user' });
    }

    req.user = userResult.rows[0];
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    // Return 401 for expired or invalid tokens so client knows to re-authenticate
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
    }
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

const authorizeRole = (requiredRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const userRole = req.user.role;
    const isSuperAdmin = req.user.super_admin === true;
    
    // Super admin bypasses all role restrictions
    if (isSuperAdmin) {
      console.log(`Super admin ${req.user.username} bypassing role check for:`, requiredRoles);
      return next();
    }
    
    // Define role hierarchy
    const roleHierarchy = {
      'admin': ['admin', 'edit', 'view'],
      'edit': ['edit', 'view'],
      'view': ['view']
    };

    const allowedRoles = roleHierarchy[userRole] || [];
    const hasPermission = requiredRoles.some(role => allowedRoles.includes(role));

    if (!hasPermission) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: requiredRoles,
        current: userRole
      });
    }

    next();
  };
};

// Super admin authorization middleware
const authorizeSuperAdmin = () => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (req.user.super_admin !== true) {
      return res.status(403).json({ 
        error: 'Super admin privileges required',
        current: req.user.role,
        hasSuperAdmin: req.user.super_admin
      });
    }

    console.log(`Super admin ${req.user.username} performing action:`, req.method, req.path);
    next();
  };
};

// Audit logging middleware (captures request/response metadata)
const auditLog = (action, tableName = null) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    const startedAt = Date.now();

    res.send = function sendWithAudit(data) {
      try {
        if (res.statusCode < 400 && req.user) {
          // Try to parse response body if JSON-like
          let responseSummary = null;
          try {
            const parsed = typeof data === 'string' ? JSON.parse(data) : data;
            if (parsed && typeof parsed === 'object') {
              // Keep only shallow keys to avoid huge payloads
              const keys = Object.keys(parsed).slice(0, 8);
              responseSummary = keys.reduce((acc, k) => {
                const v = parsed[k];
                acc[k] = typeof v === 'string' && v.length > 500 ? `${v.slice(0, 500)}…` : v;
                return acc;
              }, {});
            }
          } catch (_) {
            // ignore parse errors
          }

          const meta = {
            method: req.method,
            path: req.originalUrl,
            query: req.query,
            status: res.statusCode,
            durationMs: Date.now() - startedAt,
            userAgent: req.headers['user-agent'],
            referer: req.headers['referer'] || req.headers['referrer'] || null,
            ip: req.ip,
            forwardedFor: req.headers['x-forwarded-for'] || null,
          };

          const payload = req.method !== 'GET' ? req.body : null;

          pool.query(
            `INSERT INTO audit_log (user_id, action, table_name, record_id, old_values, new_values, ip_address)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              req.user.id,
              action,
              tableName,
              req.params.id || null,
              null, // old_values not captured generically
              JSON.stringify({ body: payload, meta, response: responseSummary }),
              (req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0].trim() : req.ip),
            ]
          ).catch((error) => {
            console.error('Audit log error:', error);
          });
        }
      } catch (e) {
        // never block response on audit failure
      }

      return originalSend.call(this, data);
    };

    next();
  };
};

module.exports = {
  authenticateToken,
  authorizeRole,
  authorizeSuperAdmin,
  auditLog
};