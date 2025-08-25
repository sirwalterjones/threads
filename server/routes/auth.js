const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
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
  async (req, res) => {
    try {
      const { username, email, password, role = 'view' } = req.body;

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

      // Create user
      const result = await pool.query(`
        INSERT INTO users (username, email, password_hash, role)
        VALUES ($1, $2, $3, $4)
        RETURNING id, username, email, role, created_at
      `, [username, email, passwordHash, role]);

      const user = result.rows[0];
      
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

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Debug logging
    console.log('Login attempt:', {
      username: username,
      hasPool: !!pool,
      nodeEnv: process.env.NODE_ENV,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      hasDbPassword: !!process.env.DB_PASSWORD
    });

    // Find user
    const result = await pool.query(
      'SELECT id, username, email, password_hash, role, is_active, super_admin, totp_enabled, force_2fa_setup FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      // If admin user doesn't exist, create it
      if (username === 'admin') {
        try {
          const bcrypt = require('bcryptjs');
          const saltRounds = 12;
          const passwordHash = await bcrypt.hash('admin123456', saltRounds);

          await pool.query(`
            INSERT INTO users (username, email, password_hash, role)
            VALUES ($1, $2, $3, $4)
          `, ['admin', 'admin@threads.local', passwordHash, 'admin']);

          // Try login again
          const newResult = await pool.query(
            'SELECT id, username, email, password_hash, role, is_active, super_admin, totp_enabled, force_2fa_setup FROM users WHERE username = $1',
            [username]
          );

          if (newResult.rows.length > 0 && password === 'admin123456') {
            const user = newResult.rows[0];
            const token = jwt.sign(
              { 
                userId: user.id, 
                username: user.username, 
                role: user.role 
              },
              process.env.JWT_SECRET,
              { expiresIn: '24h' }
            );

            return res.json({
              success: true,
              token,
              user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                super_admin: user.super_admin
              }
            });
          }
        } catch (createError) {
          console.error('Error creating admin user:', createError);
        }
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    
    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await pool.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Check if 2FA is required
    const requires2FA = user.force_2fa_setup || user.totp_enabled;

    res.json({
      message: 'Login successful',
      token,
      requires2FA,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        super_admin: user.super_admin
      }
    });
  } catch (error) {
    console.error('Login error details:', {
      message: error.message,
      stack: error.stack,
      username: req.body.username,
      hasJwtSecret: !!process.env.JWT_SECRET,
      dbConnected: !!pool
    });
    res.status(500).json({ 
      error: 'Login failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

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
        SELECT id, username, email, role, created_at, last_login, is_active, super_admin
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

// Update user (admin only)
router.put('/users/:id', 
  authenticateToken, 
  authorizeRole(['admin']), 
  async (req, res) => {
    try {
      const { id } = req.params;
      const { role, isActive, username, email, password } = req.body;
      
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
      
      if (updateFields.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }
      
      updateFields.push(`updated_at = NOW()`);
      queryParams.push(id);
      
      const result = await pool.query(`
        UPDATE users 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, username, email, role, is_active, updated_at
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