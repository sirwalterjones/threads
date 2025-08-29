const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { authenticateToken, authorizeRole, auditLog } = require('../middleware/auth');
const passwordPolicy = require('../middleware/passwordPolicy');
const loginSecurity = require('../middleware/loginSecurity');
const sessionManager = require('../middleware/sessionManager');
const validator = require('validator');
const router = express.Router();

// Debug endpoint to check database connection
router.get('/debug', async (req, res) => {
  try {
    console.log('Debug endpoint hit');
    console.log('Environment check:', {
      NODE_ENV: process.env.NODE_ENV,
      hasJwtSecret: !!process.env.JWT_SECRET,
      hasDbHost: !!process.env.DB_HOST,
      hasDbPassword: !!process.env.DB_PASSWORD,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      poolAvailable: !!pool
    });
    
    if (!pool) {
      return res.status(500).json({ error: 'Database pool not available' });
    }
    
    const result = await pool.query('SELECT NOW() as current_time');
    console.log('Database query successful:', result.rows[0]);
    
    // Check if users table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'users'
      );
    `);
    
    res.json({
      success: true,
      database_time: result.rows[0].current_time,
      users_table_exists: tableCheck.rows[0].exists,
      environment: process.env.NODE_ENV
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({ 
      error: 'Debug failed', 
      message: error.message,
      stack: error.stack 
    });
  }
});

// Register new user (admin only)
router.post('/register', 
  authenticateToken, 
  authorizeRole(['admin']), 
  passwordPolicy.validatePassword(),
  auditLog('create_user', 'users'),
  async (req, res) => {
    try {
      const { username, email, password, role = 'view', modules } = req.body;

      // Validation
      if (!username || !email || !password) {
        return res.status(400).json({ error: 'Username, email, and password are required' });
      }

      if (!validator.isEmail(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long' });
      }

      const validRoles = ['admin', 'edit', 'view'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role specified' });
      }

      // Check if user already exists
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE username = $1 OR email = $2',
        [username, email]
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({ error: 'Username or email already exists' });
      }

      // Hash password
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);
      
      // Default modules if not provided
      const userModules = modules || {
        search: true,
        hotlist: true,
        bolo: true,
        intel: true
      };

      // Create user with CJIS password security fields and modules
      const result = await pool.query(`
        INSERT INTO users (username, email, password_hash, role, last_password_change, password_strength_score, modules)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6)
        RETURNING id, username, email, role, created_at, modules
      `, [username, email, passwordHash, role, req.passwordValidation?.strength?.score || 0, JSON.stringify(userModules)]);

      const user = result.rows[0];

      // Store password in history for CJIS compliance
      await passwordPolicy.storePasswordHistory(user.id, passwordHash);
      
      res.status(201).json({
        message: 'User created successfully',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          createdAt: user.created_at
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

// CJIS v6.0 Compliant Login
router.post('/login', auditLog('login_attempt'), loginSecurity.loginHandler());

// Get users for @ mention suggestions
router.get('/users/mentions', authenticateToken, async (req, res) => {
  try {
    const { search } = req.query;
    let query = 'SELECT id, username, role, super_admin FROM users WHERE is_active = true';
    let params = [];
    
    if (search) {
      query += ' AND LOWER(username) LIKE LOWER($1)';
      params.push(`%${search}%`);
    }
    
    query += ' ORDER BY username LIMIT 20';
    
    const result = await pool.query(query, params);
    res.json({ users: result.rows });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, role, created_at, last_login, super_admin FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { email, currentPassword, newPassword } = req.body;
    const updateFields = [];
    const queryParams = [];
    let paramIndex = 1;

    // Email update
    if (email) {
      if (!validator.isEmail(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      // Check if email already exists for another user
      const emailCheck = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, req.user.id]
      );

      if (emailCheck.rows.length > 0) {
        return res.status(409).json({ error: 'Email already in use' });
      }

      updateFields.push(`email = $${paramIndex}`);
      queryParams.push(email);
      paramIndex++;
    }

    // Password update
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password required for password change' });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters long' });
      }

      // Verify current password
      const userResult = await pool.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [req.user.id]
      );

      const currentPasswordValid = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
      
      if (!currentPasswordValid) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      // Hash new password
      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
      
      updateFields.push(`password_hash = $${paramIndex}`);
      queryParams.push(newPasswordHash);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateFields.push(`updated_at = NOW()`);
    queryParams.push(req.user.id);

    const result = await pool.query(`
      UPDATE users 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, username, email, role, updated_at, super_admin
    `, queryParams);

    res.json({
      message: 'Profile updated successfully',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get all users (admin only)
router.get('/users', 
  authenticateToken, 
  authorizeRole(['admin']), 
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT id, username, email, role, created_at, last_login, is_active, super_admin, modules
        FROM users
        ORDER BY created_at DESC
      `);

      res.json(result.rows);
    } catch (error) {
      console.error('Users fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  }
);

// Delete user (admin only)
router.delete('/users/:id',
  authenticateToken,
  authorizeRole(['admin']),
  auditLog('delete_user', 'users'),
  async (req, res) => {
    try {
      const { id } = req.params;
      
      // Prevent deleting your own account
      if (parseInt(id) === req.user.id) {
        return res.status(400).json({ error: 'Cannot delete your own account' });
      }
      
      // Check if user exists and is not a super admin
      const userCheck = await pool.query(
        'SELECT id, username, super_admin FROM users WHERE id = $1',
        [id]
      );
      
      if (userCheck.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      if (userCheck.rows[0].super_admin) {
        return res.status(403).json({ error: 'Cannot delete super admin accounts' });
      }
      
      // Start a transaction to handle cascading deletes
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        // Delete related records first to avoid foreign key constraints
        // Check if tables exist before deleting
        
        // Delete audit logs
        const auditLogExists = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'audit_log'
          );
        `);
        if (auditLogExists.rows[0].exists) {
          await client.query('DELETE FROM audit_log WHERE user_id = $1', [id]);
        }
        
        const cjisAuditExists = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'cjis_audit_log'
          );
        `);
        if (cjisAuditExists.rows[0].exists) {
          await client.query('DELETE FROM cjis_audit_log WHERE user_id = $1', [id]);
        }
        
        // Delete user sessions
        const sessionsExists = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'user_sessions'
          );
        `);
        if (sessionsExists.rows[0].exists) {
          await client.query('DELETE FROM user_sessions WHERE user_id = $1', [id]);
        }
        
        // Get admin user ID to reassign content
        const adminUser = await client.query(
          'SELECT id FROM users WHERE username = $1 LIMIT 1',
          ['admin']
        );
        const adminId = adminUser.rows[0]?.id || 1; // Fallback to ID 1 if admin user not found
        
        // Reassign posts to admin
        await client.query('UPDATE posts SET user_id = $1 WHERE user_id = $2', [adminId, id]);
        
        // Reassign BOLOs to admin
        const bolosExists = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'bolos'
          );
        `);
        if (bolosExists.rows[0].exists) {
          await client.query('UPDATE bolos SET created_by = $1 WHERE created_by = $2', [adminId, id]);
        }
        
        // Reassign intel reports to admin
        const intelExists = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'intel_reports'
          );
        `);
        if (intelExists.rows[0].exists) {
          await client.query('UPDATE intel_reports SET created_by = $1 WHERE created_by = $2', [adminId, id]);
        }
        
        // Delete user follows
        await client.query('DELETE FROM user_follows WHERE user_id = $1', [id]);
        
        // Delete comments (or reassign if you prefer)
        await client.query('DELETE FROM comments WHERE user_id = $1', [id]);
        
        // Delete notifications
        await client.query('DELETE FROM notifications WHERE user_id = $1 OR from_user_id = $1', [id]);
        
        // Check if search_history table exists before deleting
        const searchHistoryExists = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'search_history'
          );
        `);
        if (searchHistoryExists.rows[0].exists) {
          await client.query('DELETE FROM search_history WHERE user_id = $1', [id]);
        }
        
        // Delete hot list alerts
        const hotListExists = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'hot_list_alerts'
          );
        `);
        if (hotListExists.rows[0].exists) {
          await client.query('DELETE FROM hot_list_alerts WHERE user_id = $1', [id]);
        }
        
        // Now delete the user
        await client.query('DELETE FROM users WHERE id = $1', [id]);
        
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      
      res.json({
        message: 'User deleted successfully',
        username: userCheck.rows[0].username
      });
    } catch (error) {
      console.error('User deletion error:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  }
);

// Update user (admin only)
router.put('/users/:id', 
  authenticateToken, 
  authorizeRole(['admin']), 
  async (req, res) => {
    try {
      const { id } = req.params;
      const { role, isActive, username, email, password, modules } = req.body;
      
      if (parseInt(id) === req.user.id) {
        return res.status(400).json({ error: 'Cannot modify your own account' });
      }
      
      const updateFields = [];
      const queryParams = [];
      let paramIndex = 1;
      
      // Username update
      if (username) {
        if (username.length < 3) {
          return res.status(400).json({ error: 'Username must be at least 3 characters long' });
        }
        
        // Check if username already exists for another user
        const usernameCheck = await pool.query(
          'SELECT id FROM users WHERE username = $1 AND id != $2',
          [username, id]
        );
        
        if (usernameCheck.rows.length > 0) {
          return res.status(409).json({ error: 'Username already in use' });
        }
        
        updateFields.push(`username = $${paramIndex}`);
        queryParams.push(username);
        paramIndex++;
      }
      
      // Email update
      if (email) {
        if (!validator.isEmail(email)) {
          return res.status(400).json({ error: 'Invalid email format' });
        }
        
        // Check if email already exists for another user
        const emailCheck = await pool.query(
          'SELECT id FROM users WHERE email = $1 AND id != $2',
          [email, id]
        );
        
        if (emailCheck.rows.length > 0) {
          return res.status(409).json({ error: 'Email already in use' });
        }
        
        updateFields.push(`email = $${paramIndex}`);
        queryParams.push(email);
        paramIndex++;
      }
      
      // Password update
      if (password) {
        if (password.length < 8) {
          return res.status(400).json({ error: 'Password must be at least 8 characters long' });
        }
        
        // Hash new password
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        
        updateFields.push(`password_hash = $${paramIndex}`);
        queryParams.push(passwordHash);
        paramIndex++;
      }
      
      // Role update
      if (role) {
        const validRoles = ['admin', 'edit', 'view'];
        if (!validRoles.includes(role)) {
          return res.status(400).json({ error: 'Invalid role specified' });
        }
        
        updateFields.push(`role = $${paramIndex}`);
        queryParams.push(role);
        paramIndex++;
      }
      
      // Active status update
      if (typeof isActive === 'boolean') {
        updateFields.push(`is_active = $${paramIndex}`);
        queryParams.push(isActive);
        paramIndex++;
      }
      
      // Modules update
      if (modules) {
        updateFields.push(`modules = $${paramIndex}`);
        queryParams.push(JSON.stringify(modules));
        paramIndex++;
      }
      
      if (updateFields.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }
      
      updateFields.push(`updated_at = NOW()`);
      queryParams.push(id);
      
      const result = await pool.query(`
        UPDATE users 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, username, email, role, is_active, updated_at, modules
      `, queryParams);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json({
        message: 'User updated successfully',
        user: result.rows[0]
      });
    } catch (error) {
      console.error('User update error:', error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  }
);

module.exports = router;