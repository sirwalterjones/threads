const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/intel-reports/')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'intel-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx|jpg|jpeg|png|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only documents and images are allowed'));
    }
  }
});

// Get all intel reports with filters
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      status = 'all', 
      classification, 
      expiration = 'all',
      search,
      page = 1,
      limit = 50,
      agent_id 
    } = req.query;

    let query = `
      SELECT 
        ir.*,
        u.username as agent_name,
        reviewer.username as reviewed_by_name,
        COUNT(DISTINCT irs.id) as subjects_count,
        COUNT(DISTINCT iro.id) as organizations_count,
        COUNT(DISTINCT irf.id) as files_count,
        CASE 
          WHEN ir.expires_at < NOW() THEN true 
          ELSE false 
        END as is_expired,
        CASE 
          WHEN ir.expires_at > NOW() THEN CEIL(EXTRACT(EPOCH FROM (ir.expires_at - NOW())) / 86400)
          ELSE 0
        END as days_until_expiration
      FROM intel_reports ir
      JOIN users u ON ir.agent_id = u.id
      LEFT JOIN users reviewer ON ir.reviewed_by = reviewer.id
      LEFT JOIN intel_report_subjects irs ON ir.id = irs.report_id
      LEFT JOIN intel_report_organizations iro ON ir.id = iro.report_id
      LEFT JOIN intel_report_files irf ON ir.id = irf.report_id
      WHERE 1=1
    `;

    const values = [];
    let valueIndex = 1;

    // Apply filters
    if (status !== 'all') {
      query += ` AND ir.status = $${valueIndex}`;
      values.push(status);
      valueIndex++;
    }

    if (classification) {
      query += ` AND ir.classification = $${valueIndex}`;
      values.push(classification);
      valueIndex++;
    }

    if (expiration === 'expired') {
      query += ` AND ir.expires_at < NOW()`;
    } else if (expiration === 'expiring_soon') {
      query += ` AND ir.expires_at > NOW() AND ir.expires_at <= NOW() + INTERVAL '7 days'`;
    }

    if (search) {
      query += ` AND (ir.subject ILIKE $${valueIndex} OR ir.intel_number ILIKE $${valueIndex})`;
      values.push(`%${search}%`);
      valueIndex++;
    }

    if (agent_id) {
      query += ` AND ir.agent_id = $${valueIndex}`;
      values.push(agent_id);
      valueIndex++;
    }

    query += `
      GROUP BY ir.id, u.username, reviewer.username
      ORDER BY ir.created_at DESC
      LIMIT $${valueIndex} OFFSET $${valueIndex + 1}
    `;
    
    values.push(limit);
    values.push((page - 1) * limit);

    const result = await pool.query(query, values);

    // Get total count
    let countQuery = `
      SELECT COUNT(DISTINCT ir.id) as total
      FROM intel_reports ir
      WHERE 1=1
    `;
    
    let countValues = [];
    let countValueIndex = 1;

    if (status !== 'all') {
      countQuery += ` AND ir.status = $${countValueIndex}`;
      countValues.push(status);
      countValueIndex++;
    }

    if (classification) {
      countQuery += ` AND ir.classification = $${countValueIndex}`;
      countValues.push(classification);
      countValueIndex++;
    }

    if (expiration === 'expired') {
      countQuery += ` AND ir.expires_at < NOW()`;
    } else if (expiration === 'expiring_soon') {
      countQuery += ` AND ir.expires_at > NOW() AND ir.expires_at <= NOW() + INTERVAL '7 days'`;
    }

    if (search) {
      countQuery += ` AND (ir.subject ILIKE $${countValueIndex} OR ir.intel_number ILIKE $${countValueIndex})`;
      countValues.push(`%${search}%`);
      countValueIndex++;
    }

    if (agent_id) {
      countQuery += ` AND ir.agent_id = $${countValueIndex}`;
      countValues.push(agent_id);
      countValueIndex++;
    }

    const countResult = await pool.query(countQuery, countValues);

    res.json({
      reports: result.rows,
      total: parseInt(countResult.rows[0].total),
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
    });
  } catch (error) {
    console.error('Error fetching intel reports:', error);
    res.status(500).json({ error: 'Failed to fetch intel reports' });
  }
});

// Get single intel report with full details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get main report data
    const reportQuery = `
      SELECT 
        ir.*,
        u.username as agent_name,
        reviewer.username as reviewed_by_name,
        CASE 
          WHEN ir.expires_at < NOW() THEN true 
          ELSE false 
        END as is_expired,
        CASE 
          WHEN ir.expires_at > NOW() THEN CEIL(EXTRACT(EPOCH FROM (ir.expires_at - NOW())) / 86400)
          ELSE 0
        END as days_until_expiration
      FROM intel_reports ir
      JOIN users u ON ir.agent_id = u.id
      LEFT JOIN users reviewer ON ir.reviewed_by = reviewer.id
      WHERE ir.id = $1
    `;

    const reportResult = await pool.query(reportQuery, [id]);
    
    if (reportResult.rows.length === 0) {
      return res.status(404).json({ error: 'Intel report not found' });
    }

    const report = reportResult.rows[0];

    // Get subjects
    const subjectsQuery = `
      SELECT * FROM intel_report_subjects 
      WHERE report_id = $1 
      ORDER BY created_at
    `;
    const subjectsResult = await pool.query(subjectsQuery, [id]);

    // Get organizations
    const organizationsQuery = `
      SELECT * FROM intel_report_organizations 
      WHERE report_id = $1 
      ORDER BY created_at
    `;
    const organizationsResult = await pool.query(organizationsQuery, [id]);

    // Get source information
    const sourceQuery = `
      SELECT * FROM intel_report_sources 
      WHERE report_id = $1
    `;
    const sourceResult = await pool.query(sourceQuery, [id]);

    // Get files
    const filesQuery = `
      SELECT * FROM intel_report_files 
      WHERE report_id = $1 
      ORDER BY created_at
    `;
    const filesResult = await pool.query(filesQuery, [id]);

    res.json({
      ...report,
      subjects: subjectsResult.rows,
      organizations: organizationsResult.rows,
      source_info: sourceResult.rows[0] || null,
      files: filesResult.rows
    });
  } catch (error) {
    console.error('Error fetching intel report:', error);
    res.status(500).json({ error: 'Failed to fetch intel report' });
  }
});

// Create new intel report
router.post('/', authenticateToken, upload.array('files'), async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const {
      intel_number,
      classification,
      date,
      case_number,
      subject,
      criminal_activity,
      summary,
      subjects = '[]',
      organizations = '[]',
      source_info = '{}'
    } = req.body;

    // Generate intel number if not provided
    const finalIntelNumber = intel_number || await generateIntelNumber();

    // Set expiration date (default: 90 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    // Insert main report
    const reportQuery = `
      INSERT INTO intel_reports (
        intel_number, classification, date, agent_id, case_number,
        subject, criminal_activity, summary, status, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9)
      RETURNING *
    `;

    const reportResult = await client.query(reportQuery, [
      finalIntelNumber,
      classification,
      date,
      req.user.userId,
      case_number,
      subject,
      criminal_activity,
      summary,
      expiresAt
    ]);

    const reportId = reportResult.rows[0].id;

    // Insert subjects
    const subjectsData = JSON.parse(subjects);
    for (const subjectData of subjectsData) {
      await client.query(`
        INSERT INTO intel_report_subjects (
          report_id, first_name, middle_name, last_name, address,
          date_of_birth, race, sex, phone, social_security_number, license_number
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        reportId, subjectData.first_name, subjectData.middle_name, subjectData.last_name,
        subjectData.address, subjectData.date_of_birth, subjectData.race, subjectData.sex,
        subjectData.phone, subjectData.social_security_number, subjectData.license_number
      ]);
    }

    // Insert organizations
    const organizationsData = JSON.parse(organizations);
    for (const orgData of organizationsData) {
      await client.query(`
        INSERT INTO intel_report_organizations (
          report_id, business_name, phone, address
        ) VALUES ($1, $2, $3, $4)
      `, [reportId, orgData.business_name, orgData.phone, orgData.address]);
    }

    // Insert source information
    const sourceData = JSON.parse(source_info);
    if (Object.keys(sourceData).length > 0) {
      await client.query(`
        INSERT INTO intel_report_sources (
          report_id, source_id, rating, source, information_reliable,
          unknown_caller, ci_cs, first_name, middle_name, last_name, phone, address
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        reportId, sourceData.source_id, sourceData.rating, sourceData.source,
        sourceData.information_reliable, sourceData.unknown_caller, sourceData.ci_cs,
        sourceData.first_name, sourceData.middle_name, sourceData.last_name,
        sourceData.phone, sourceData.address
      ]);
    }

    // Insert file records
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        await client.query(`
          INSERT INTO intel_report_files (
            report_id, filename, original_filename, file_path, file_size, mime_type
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          reportId, file.filename, file.originalname, file.path, file.size, file.mimetype
        ]);
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Intel report created successfully',
      report: reportResult.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating intel report:', error);
    res.status(500).json({ error: 'Failed to create intel report' });
  } finally {
    client.release();
  }
});

// Update intel report status (approve/reject)
router.patch('/:id/status', authenticateToken, authorizeRole(['admin', 'supervisor']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, review_comments } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be approved or rejected' });
    }

    const query = `
      UPDATE intel_reports 
      SET status = $1, reviewed_by = $2, reviewed_at = NOW(), review_comments = $3
      WHERE id = $4
      RETURNING *
    `;

    const result = await pool.query(query, [status, req.user.userId, review_comments, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Intel report not found' });
    }

    res.json({
      message: `Intel report ${status} successfully`,
      report: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating intel report status:', error);
    res.status(500).json({ error: 'Failed to update intel report status' });
  }
});

// Extend expiration date
router.patch('/:id/extend', authenticateToken, authorizeRole(['admin', 'supervisor']), async (req, res) => {
  try {
    const { id } = req.params;
    const { days = 30 } = req.body;

    const query = `
      UPDATE intel_reports 
      SET expires_at = expires_at + INTERVAL '${days} days',
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Intel report not found' });
    }

    res.json({
      message: `Intel report expiration extended by ${days} days`,
      report: result.rows[0]
    });
  } catch (error) {
    console.error('Error extending intel report expiration:', error);
    res.status(500).json({ error: 'Failed to extend intel report expiration' });
  }
});

// Delete intel report
router.delete('/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;

    // Delete related records first
    await client.query('DELETE FROM intel_report_files WHERE report_id = $1', [id]);
    await client.query('DELETE FROM intel_report_sources WHERE report_id = $1', [id]);
    await client.query('DELETE FROM intel_report_organizations WHERE report_id = $1', [id]);
    await client.query('DELETE FROM intel_report_subjects WHERE report_id = $1', [id]);
    
    // Delete main report
    const result = await client.query('DELETE FROM intel_reports WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Intel report not found' });
    }

    await client.query('COMMIT');

    res.json({ message: 'Intel report deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting intel report:', error);
    res.status(500).json({ error: 'Failed to delete intel report' });
  } finally {
    client.release();
  }
});

// Get reports statistics
router.get('/stats/overview', authenticateToken, async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_reports,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_reports,
        COUNT(*) FILTER (WHERE status = 'approved') as approved_reports,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected_reports,
        COUNT(*) FILTER (WHERE expires_at < NOW()) as expired_reports,
        COUNT(*) FILTER (WHERE expires_at > NOW() AND expires_at <= NOW() + INTERVAL '7 days') as expiring_soon_reports
      FROM intel_reports
    `);

    res.json(stats.rows[0]);
  } catch (error) {
    console.error('Error fetching intel reports stats:', error);
    res.status(500).json({ error: 'Failed to fetch intel reports stats' });
  }
});

// Helper function to generate intel number
async function generateIntelNumber() {
  const year = new Date().getFullYear();
  const result = await pool.query(
    'SELECT COUNT(*) + 1 as next_number FROM intel_reports WHERE intel_number LIKE $1',
    [`${year}-%`]
  );
  const nextNumber = result.rows[0].next_number.toString().padStart(3, '0');
  return `${year}-${nextNumber}`;
}

module.exports = router;