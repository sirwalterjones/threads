const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const validator = require('validator');
const router = express.Router();

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
        VALUES ($1, $2, $3, $4) RETURNING id, username, email, role, created_at
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

    // Find user in database (including session_duration_hours)
    const result = await pool.query(
      'SELECT id, username, email, password_hash, role, is_active, session_duration_hours FROM users WHERE username = $1',
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
            'SELECT id, username, email, password_hash, role, is_active, session_duration_hours FROM users WHERE username = $1',
            [username]
          );

          if (newResult.rows.length > 0 && password === 'admin123456') {
            const user = newResult.rows[0];
            const sessionHours = user.session_duration_hours || 24;
            const token = jwt.sign(
              { 
                userId: user.id, 
                username: user.username, 
                role: user.role 
              },
              process.env.JWT_SECRET,
              { expiresIn: `${sessionHours}h` }
            );

            return res.json({
              success: true,
              token,
              user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
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

    // Use user's session duration preference (default to 24 hours if not set)
    const sessionHours = user.session_duration_hours || 24;
    
    // Generate JWT token with configurable expiry
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: `${sessionHours}h` }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, role, created_at, last_login, session_duration_hours FROM users WHERE id = $1',
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
    const { email, currentPassword, newPassword, session_duration_hours } = req.body;
    const updateFields = [];
    const queryParams = [];

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

      updateFields.push('email = $' + (queryParams.length + 1));
      queryParams.push(email);
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
      
      updateFields.push('password_hash = $' + (queryParams.length + 1));
      queryParams.push(newPasswordHash);
    }
    
    // Session duration update
    if (session_duration_hours !== undefined) {
      // Validate session duration (1 hour to 30 days)
      const duration = parseInt(session_duration_hours);
      if (isNaN(duration) || duration < 1 || duration > 720) {
        return res.status(400).json({ error: 'Session duration must be between 1 and 720 hours' });
      }
      
      updateFields.push('session_duration_hours = $' + (queryParams.length + 1));
      queryParams.push(duration);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateFields.push('updated_at = NOW()');
    queryParams.push(req.user.id);

    await pool.query(`
      UPDATE users 
      SET ${updateFields.join(', ')}
      WHERE id = $${queryParams.length}
    `, queryParams);

    const result = await pool.query('SELECT id, username, email, role, updated_at FROM users WHERE id = $1', [req.user.id]);

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
        SELECT id, username, email, role, created_at, last_login, is_active
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

// Update user role or status (admin only)
router.put('/users/:id', 
  authenticateToken, 
  authorizeRole(['admin']), 
  async (req, res) => {
    try {
      const { id } = req.params;
      const { role, isActive } = req.body;

      if (parseInt(id) === req.user.id) {
        return res.status(400).json({ error: 'Cannot modify your own account' });
      }

      const updateFields = [];
      const queryParams = [];

      if (role) {
        const validRoles = ['admin', 'edit', 'view'];
        if (!validRoles.includes(role)) {
          return res.status(400).json({ error: 'Invalid role specified' });
        }
        
        updateFields.push('role = $' + (queryParams.length + 1));
        queryParams.push(role);
      }

      if (typeof isActive === 'boolean') {
        updateFields.push('is_active = $' + (queryParams.length + 1));
        queryParams.push(isActive ? 1 : 0);
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      updateFields.push('updated_at = NOW()');
      queryParams.push(id);

      await pool.query(`
        UPDATE users 
        SET ${updateFields.join(', ')}
        WHERE id = $${queryParams.length}
      `, queryParams);

      const result = await pool.query('SELECT id, username, email, role, is_active, updated_at FROM users WHERE id = $1', [id]);

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