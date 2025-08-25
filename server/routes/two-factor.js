const express = require('express');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const { pool } = require('../config/database');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const router = express.Router();

// Generate TOTP secret and QR code for setup
router.post('/setup', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Check if user already has 2FA enabled
    const userResult = await pool.query(
      'SELECT totp_enabled FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (userResult.rows[0].totp_enabled) {
      return res.status(400).json({ error: '2FA is already enabled' });
    }
    
    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `Vector (${req.user.username})`,
      issuer: 'Vector Intelligence'
    });
    
    // Generate QR code
    const qrCodeDataURL = await qrcode.toDataURL(secret.otpauth_url);
    
    // Store secret temporarily (not yet enabled)
    await pool.query(
      'UPDATE users SET totp_secret = $1 WHERE id = $2',
      [secret.base32, userId]
    );
    
    res.json({
      secret: secret.base32,
      qrCode: qrCodeDataURL,
      manualEntryKey: secret.base32
    });
  } catch (error) {
    console.error('2FA setup error:', error);
    res.status(500).json({ error: 'Failed to setup 2FA' });
  }
});

// Verify and enable 2FA
router.post('/verify-setup', authenticateToken, async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user.id;
    
    if (!token) {
      return res.status(400).json({ error: 'Verification token required' });
    }
    
    // Get user's secret
    const userResult = await pool.query(
      'SELECT totp_secret, totp_enabled FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    if (!user.totp_secret) {
      return res.status(400).json({ error: 'No 2FA setup in progress' });
    }
    
    if (user.totp_enabled) {
      return res.status(400).json({ error: '2FA is already enabled' });
    }
    
    // Verify token
    const verified = speakeasy.totp.verify({
      secret: user.totp_secret,
      encoding: 'base32',
      token: token,
      window: 1
    });
    
    if (!verified) {
      return res.status(400).json({ error: 'Invalid verification token' });
    }
    
    // Generate backup codes
    const backupCodes = [];
    for (let i = 0; i < 10; i++) {
      backupCodes.push(Math.random().toString(36).substring(2, 12).toUpperCase());
    }
    
    // Enable 2FA and store backup codes
    await pool.query(
      'UPDATE users SET totp_enabled = true, totp_backup_codes = $1, force_2fa_setup = false WHERE id = $2',
      [backupCodes, userId]
    );
    
    res.json({
      success: true,
      message: '2FA enabled successfully',
      backupCodes: backupCodes
    });
  } catch (error) {
    console.error('2FA verification error:', error);
    res.status(500).json({ error: 'Failed to verify 2FA' });
  }
});

// Verify TOTP token for login
router.post('/verify', authenticateToken, async (req, res) => {
  try {
    const { token, isBackupCode } = req.body;
    const userId = req.user.id;
    
    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }
    
    // Get user's 2FA settings
    const userResult = await pool.query(
      'SELECT totp_secret, totp_enabled, totp_backup_codes FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    if (!user.totp_enabled) {
      return res.status(400).json({ error: '2FA is not enabled' });
    }
    
    let verified = false;
    
    if (isBackupCode) {
      // Verify backup code
      const backupCodes = user.totp_backup_codes || [];
      const codeIndex = backupCodes.indexOf(token.toUpperCase());
      
      if (codeIndex !== -1) {
        verified = true;
        // Remove used backup code
        backupCodes.splice(codeIndex, 1);
        await pool.query(
          'UPDATE users SET totp_backup_codes = $1 WHERE id = $2',
          [backupCodes, userId]
        );
      }
    } else {
      // Verify TOTP token
      verified = speakeasy.totp.verify({
        secret: user.totp_secret,
        encoding: 'base32',
        token: token,
        window: 1
      });
    }
    
    if (!verified) {
      return res.status(400).json({ error: 'Invalid token' });
    }
    
    res.json({
      success: true,
      message: '2FA verified successfully'
    });
  } catch (error) {
    console.error('2FA verification error:', error);
    res.status(500).json({ error: 'Failed to verify 2FA' });
  }
});

// Get 2FA status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const userResult = await pool.query(
      'SELECT totp_enabled, force_2fa_setup, totp_backup_codes FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    res.json({
      enabled: user.totp_enabled,
      required: user.force_2fa_setup,
      backupCodesRemaining: (user.totp_backup_codes || []).length
    });
  } catch (error) {
    console.error('2FA status error:', error);
    res.status(500).json({ error: 'Failed to get 2FA status' });
  }
});

// Disable 2FA (user)
router.post('/disable', authenticateToken, async (req, res) => {
  try {
    const { currentPassword } = req.body;
    const userId = req.user.id;
    
    if (!currentPassword) {
      return res.status(400).json({ error: 'Current password required' });
    }
    
    // Verify current password
    const bcrypt = require('bcryptjs');
    const userResult = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const passwordValid = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
    
    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    
    // Disable 2FA
    await pool.query(
      'UPDATE users SET totp_enabled = false, totp_secret = null, totp_backup_codes = null, force_2fa_setup = true WHERE id = $1',
      [userId]
    );
    
    res.json({
      success: true,
      message: '2FA disabled successfully'
    });
  } catch (error) {
    console.error('2FA disable error:', error);
    res.status(500).json({ error: 'Failed to disable 2FA' });
  }
});

// Admin: Reset user's 2FA (admin only)
router.post('/admin/reset/:userId', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    
    // Allow super admins to reset their own 2FA, but not regular admins
    if (parseInt(targetUserId) === req.user.id) {
      const userResult = await pool.query(
        'SELECT super_admin FROM users WHERE id = $1',
        [req.user.id]
      );
      
      if (userResult.rows.length === 0 || !userResult.rows[0].super_admin) {
        return res.status(400).json({ error: 'Regular admins cannot reset their own 2FA. Only super admins can.' });
      }
    }
    
    // Reset user's 2FA
    await pool.query(
      'UPDATE users SET totp_enabled = false, totp_secret = null, totp_backup_codes = null, force_2fa_setup = false WHERE id = $1',
      [targetUserId]
    );
    
    res.json({
      success: true,
      message: 'User 2FA reset successfully'
    });
  } catch (error) {
    console.error('Admin 2FA reset error:', error);
    res.status(500).json({ error: 'Failed to reset user 2FA' });
  }
 });

// Admin: Toggle 2FA requirement (admin only)
router.post('/admin/toggle-requirement/:userId', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const { required } = req.body;
    
    if (typeof required !== 'boolean') {
      return res.status(400).json({ error: 'Required parameter must be boolean' });
    }
    
    // Update 2FA requirement
    await pool.query(
      'UPDATE users SET force_2fa_setup = $1 WHERE id = $2',
      [required, targetUserId]
    );
    
    res.json({
      success: true,
      message: `2FA requirement ${required ? 'enabled' : 'disabled'} for user`
    });
  } catch (error) {
    console.error('Admin 2FA requirement toggle error:', error);
    res.status(500).json({ error: 'Failed to toggle 2FA requirement' });
  }
});

module.exports = router;