const { pool } = require('../config/database');

/**
 * CJIS v6.0 Compliant HTTPS/TLS Enforcement Middleware
 * Enforces secure communications for all Criminal Justice Information
 */
class HttpsEnforcement {
  constructor() {
    // CJIS requires TLS 1.2 or higher
    this.minimumTlsVersion = 'TLSv1.2';
    this.hstsMaxAge = 31536000; // 1 year in seconds
    this.allowedProtocols = ['https:', 'wss:'];
  }

  /**
   * Enforce HTTPS for all requests
   */
  enforceHttps() {
    return (req, res, next) => {
      // Check if request is already secure
      const isSecure = req.secure || 
                       req.headers['x-forwarded-proto'] === 'https' ||
                       req.protocol === 'https';

      // In production, redirect to HTTPS
      if (process.env.NODE_ENV === 'production' && !isSecure) {
        // Log security violation
        this.logSecurityViolation(req, 'HTTP_REQUEST_BLOCKED');
        
        // Redirect to HTTPS
        const secureUrl = `https://${req.headers.host}${req.url}`;
        return res.redirect(301, secureUrl);
      }

      // In development, warn but allow
      if (process.env.NODE_ENV === 'development' && !isSecure) {
        console.warn('⚠️  CJIS WARNING: Non-HTTPS request detected. HTTPS required in production.');
      }

      next();
    };
  }

  /**
   * Set security headers for CJIS compliance
   */
  setSecurityHeaders() {
    return (req, res, next) => {
      // HTTP Strict Transport Security (HSTS)
      res.setHeader(
        'Strict-Transport-Security',
        `max-age=${this.hstsMaxAge}; includeSubDomains; preload`
      );

      // Prevent clickjacking
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");

      // Prevent MIME type sniffing
      res.setHeader('X-Content-Type-Options', 'nosniff');

      // XSS Protection (for older browsers)
      res.setHeader('X-XSS-Protection', '1; mode=block');

      // Referrer Policy - don't leak sensitive URLs
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

      // Permissions Policy (formerly Feature Policy)
      res.setHeader(
        'Permissions-Policy',
        'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), accelerometer=(), gyroscope=()'
      );

      // Certificate Transparency
      res.setHeader('Expect-CT', 'max-age=86400, enforce');

      // DNS Prefetch Control
      res.setHeader('X-DNS-Prefetch-Control', 'off');

      // Download Options
      res.setHeader('X-Download-Options', 'noopen');

      // CJIS-specific security header
      res.setHeader('X-CJIS-Compliance', 'enforced');

      next();
    };
  }

  /**
   * Validate TLS version meets CJIS requirements
   */
  validateTlsVersion() {
    return (req, res, next) => {
      const tlsVersion = req.connection.encrypted ? 
                        req.connection.getCipher().version : 
                        req.headers['x-tls-version'];

      if (tlsVersion) {
        const versionNumber = parseFloat(tlsVersion.replace('TLSv', ''));
        const minimumVersion = parseFloat(this.minimumTlsVersion.replace('TLSv', ''));

        if (versionNumber < minimumVersion) {
          this.logSecurityViolation(req, 'TLS_VERSION_TOO_OLD', { 
            provided: tlsVersion, 
            required: this.minimumTlsVersion 
          });

          return res.status(426).json({
            error: 'Upgrade Required',
            message: `TLS ${minimumVersion} or higher is required for CJIS compliance`,
            current: tlsVersion,
            required: this.minimumTlsVersion
          });
        }
      }

      next();
    };
  }

  /**
   * Certificate pinning for enhanced security
   */
  certificatePinning() {
    return (req, res, next) => {
      // In production, implement certificate pinning
      if (process.env.NODE_ENV === 'production' && process.env.CERT_PINS) {
        const pins = process.env.CERT_PINS.split(',');
        const cert = req.connection.getPeerCertificate();

        if (cert && cert.fingerprint256) {
          const fingerprint = cert.fingerprint256.replace(/:/g, '').toLowerCase();
          
          if (!pins.includes(fingerprint)) {
            this.logSecurityViolation(req, 'CERTIFICATE_PINNING_FAILED', {
              fingerprint,
              expected: pins
            });

            return res.status(495).json({
              error: 'SSL Certificate Error',
              message: 'Certificate validation failed'
            });
          }
        }
      }

      next();
    };
  }

  /**
   * Content Security Policy for CJIS data protection
   */
  contentSecurityPolicy() {
    return (req, res, next) => {
      const cspDirectives = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Note: Remove unsafe-* in production
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self' data:",
        "connect-src 'self' https:",
        "media-src 'self'",
        "object-src 'none'",
        "frame-src 'none'",
        "worker-src 'self'",
        "form-action 'self'",
        "base-uri 'self'",
        "manifest-src 'self'",
        "upgrade-insecure-requests"
      ];

      res.setHeader('Content-Security-Policy', cspDirectives.join('; '));
      next();
    };
  }

  /**
   * Rate limiting for DDoS protection
   */
  rateLimiting() {
    const requestCounts = new Map();
    const windowMs = 60000; // 1 minute
    const maxRequests = 100;

    return (req, res, next) => {
      const ip = req.ip || req.headers['x-forwarded-for'];
      const now = Date.now();
      
      if (!requestCounts.has(ip)) {
        requestCounts.set(ip, { count: 1, resetTime: now + windowMs });
      } else {
        const record = requestCounts.get(ip);
        
        if (now > record.resetTime) {
          record.count = 1;
          record.resetTime = now + windowMs;
        } else {
          record.count++;
          
          if (record.count > maxRequests) {
            this.logSecurityViolation(req, 'RATE_LIMIT_EXCEEDED', {
              ip,
              count: record.count,
              limit: maxRequests
            });

            return res.status(429).json({
              error: 'Too Many Requests',
              message: 'Rate limit exceeded. Please try again later.',
              retryAfter: Math.ceil((record.resetTime - now) / 1000)
            });
          }
        }
      }

      // Clean up old entries
      if (requestCounts.size > 10000) {
        for (const [ip, record] of requestCounts) {
          if (now > record.resetTime) {
            requestCounts.delete(ip);
          }
        }
      }

      next();
    };
  }

  /**
   * Log security violations to CJIS audit log
   */
  async logSecurityViolation(req, violationType, details = {}) {
    try {
      const ipAddress = req.headers['x-forwarded-for'] ? 
        String(req.headers['x-forwarded-for']).split(',')[0].trim() : req.ip;

      await pool.query(`
        INSERT INTO cjis_audit_log (
          action, access_result, ip_address, user_agent,
          request_method, request_path, data_classification, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        violationType,
        'denied',
        ipAddress,
        req.headers['user-agent'] || 'Unknown',
        req.method,
        req.path,
        'sensitive',
        JSON.stringify({
          ...details,
          timestamp: new Date().toISOString(),
          protocol: req.protocol,
          secure: req.secure,
          headers: {
            'x-forwarded-proto': req.headers['x-forwarded-proto'],
            'x-forwarded-for': req.headers['x-forwarded-for']
          }
        })
      ]);
    } catch (error) {
      console.error('Failed to log security violation:', error);
    }
  }

  /**
   * Validate API requests have proper authentication
   */
  validateApiSecurity() {
    return (req, res, next) => {
      // Check for API routes
      if (req.path.startsWith('/api/')) {
        // Ensure authentication header exists
        const authHeader = req.headers['authorization'];
        
        if (!authHeader) {
          this.logSecurityViolation(req, 'API_AUTH_MISSING');
          
          return res.status(401).json({
            error: 'Authentication Required',
            message: 'API requests require authentication'
          });
        }

        // Validate bearer token format
        if (!authHeader.startsWith('Bearer ')) {
          this.logSecurityViolation(req, 'API_AUTH_INVALID_FORMAT');
          
          return res.status(401).json({
            error: 'Invalid Authentication',
            message: 'Invalid authorization header format'
          });
        }
      }

      next();
    };
  }

  /**
   * Create security report for compliance auditing
   */
  async generateSecurityReport() {
    try {
      const report = {
        timestamp: new Date().toISOString(),
        compliance: {
          cjis: true,
          tlsVersion: this.minimumTlsVersion,
          hstsEnabled: true,
          hstsMaxAge: this.hstsMaxAge
        },
        violations: {}
      };

      // Get recent security violations
      const violations = await pool.query(`
        SELECT 
          action as violation_type,
          COUNT(*) as count,
          MAX(timestamp) as last_occurrence
        FROM cjis_audit_log
        WHERE access_result = 'denied'
          AND timestamp > CURRENT_TIMESTAMP - INTERVAL '24 hours'
        GROUP BY action
        ORDER BY count DESC
      `);

      report.violations = violations.rows;

      // Get TLS statistics
      const tlsStats = await pool.query(`
        SELECT 
          metadata->>'tlsVersion' as version,
          COUNT(*) as count
        FROM cjis_audit_log
        WHERE metadata->>'tlsVersion' IS NOT NULL
          AND timestamp > CURRENT_TIMESTAMP - INTERVAL '24 hours'
        GROUP BY metadata->>'tlsVersion'
      `);

      report.tlsStatistics = tlsStats.rows;

      return report;
    } catch (error) {
      console.error('Failed to generate security report:', error);
      return { error: error.message };
    }
  }
}

// Export singleton instance
const httpsEnforcement = new HttpsEnforcement();
module.exports = httpsEnforcement;