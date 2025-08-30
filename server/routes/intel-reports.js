const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticateToken, authorizeRole, auditLog } = require('../middleware/auth');
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
// Note: Audit logging removed from GET to reduce noise - only writes are audited
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
        (
          CASE WHEN EXISTS (
            SELECT 1 FROM intel_report_review_notes n 
            WHERE n.report_id = ir.id AND n.action = 'rejected'
          ) AND ir.status = 'pending' THEN true ELSE false END
        ) AS corrected,
        CASE 
          WHEN ir.expires_at < NOW() THEN true 
          ELSE false 
        END as "isExpired",
        CASE 
          WHEN ir.expires_at > NOW() THEN CEIL(EXTRACT(EPOCH FROM (ir.expires_at - NOW())) / 86400)
          ELSE 0
        END as "daysUntilExpiration",
        ir.expires_at as "expiresAt"
      FROM intel_reports ir
      LEFT JOIN users u ON ir.agent_id = u.id
      LEFT JOIN users reviewer ON ir.reviewed_by = reviewer.id
      LEFT JOIN intel_report_subjects irs ON ir.id = irs.report_id
      LEFT JOIN intel_report_organizations iro ON ir.id = iro.report_id
      LEFT JOIN intel_report_files irf ON ir.id = irf.report_id
      WHERE 1=1
    `;

    const values = [];
    let valueIndex = 1;

    // Apply classification-based visibility rules
    if (req.user.role !== 'admin') {
      // Non-admins can only see:
      // 1. Non-classified reports they created (any status)
      // 2. Non-classified reports that are pending, rejected, or approved (created by others)
      query += ` AND ir.classification != 'Classified' AND (
        ir.agent_id = $${valueIndex} OR 
        ir.status IN ('pending', 'rejected', 'approved')
      )`;
      values.push(req.user.id);
      valueIndex++;
    }

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

    // Add grouping and pagination
    query += ` GROUP BY ir.id, u.username, reviewer.username ORDER BY ir.created_at DESC`;

    if (limit && page) {
      const offset = (page - 1) * limit;
      query += ` LIMIT $${valueIndex} OFFSET $${valueIndex + 1}`;
      values.push(limit, offset);
    }

    const result = await pool.query(query, values);
    
    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(DISTINCT ir.id) as total
      FROM intel_reports ir
      LEFT JOIN users u ON ir.agent_id = u.id
      WHERE 1=1
    `;
    
    const countValues = [];
    let countIndex = 1;
    
    // Apply classification-based visibility rules to count query
    if (req.user.role !== 'admin') {
      countQuery += ` AND ir.classification != 'Classified' AND (
        ir.agent_id = $${countIndex} OR 
        ir.status IN ('pending', 'rejected', 'approved')
      )`;
      countValues.push(req.user.id);
      countIndex++;
    }

    if (status !== 'all') {
      countQuery += ` AND ir.status = $${countIndex}`;
      countValues.push(status);
      countIndex++;
    }
    
    if (classification) {
      countQuery += ` AND ir.classification = $${countIndex}`;
      countValues.push(classification);
      countIndex++;
    }
    
    if (expiration === 'expired') {
      countQuery += ` AND ir.expires_at < NOW()`;
    } else if (expiration === 'expiring_soon') {
      countQuery += ` AND ir.expires_at > NOW() AND ir.expires_at <= NOW() + INTERVAL '7 days'`;
    }
    
    if (search) {
      countQuery += ` AND (ir.subject ILIKE $${countIndex} OR ir.intel_number ILIKE $${countIndex})`;
      countValues.push(`%${search}%`);
      countIndex++;
    }
    
    if (agent_id) {
      countQuery += ` AND ir.agent_id = $${countIndex}`;
      countValues.push(agent_id);
      countIndex++;
    }
    
    const countResult = await pool.query(countQuery, countValues);
    const total = countResult.rows[0].total;

    res.json({
      reports: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching intel reports:', error);
    res.status(500).json({ error: 'Failed to fetch intel reports' });
  }
});

// Create new intel report
router.post('/', authenticateToken, auditLog('create_intel_report', 'intel_reports'), upload.array('files'), async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // New reports are always created as pending; ignore any status in body

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
      source_info = '{}',
      sources = '[]'
    } = req.body;

    // Generate intel number if not provided
    const finalIntelNumber = intel_number || await generateIntelNumber();

    // Set expiration date (default: 5 years from now)
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 5);

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
      req.user.id,
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

    // Insert source information (supports single object or array of sources)
    let sourcesArray = [];
    try {
      sourcesArray = JSON.parse(sources);
      if (!Array.isArray(sourcesArray)) sourcesArray = [];
    } catch (_) {
      sourcesArray = [];
    }

    if (sourcesArray.length > 0) {
      for (const src of sourcesArray) {
        await client.query(`
          INSERT INTO intel_report_sources (
            report_id, source_id, rating, source, information_reliable,
            unknown_caller, ci_cs, first_name, middle_name, last_name, phone, address
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
          reportId, src.source_id, src.rating, src.source,
          src.information_reliable, src.unknown_caller, src.ci_cs,
          src.first_name, src.middle_name, src.last_name,
          src.phone, src.address
        ]);
      }
    } else {
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

// Update intel report
router.put('/:id', authenticateToken, auditLog('update_intel_report', 'intel_reports'), async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
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
      sources = '[]'
    } = req.body;

    // Check if user can edit this report
    const reportQuery = await client.query(
      'SELECT agent_id, status FROM intel_reports WHERE id = $1',
      [id]
    );

    if (reportQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Intel report not found' });
    }

    const report = reportQuery.rows[0];
    
    // Check permissions:
    // - User can edit if they are the author AND report is not approved
    // - Admin can edit any report
    // - Non-admins cannot edit classified reports after approval
    const isAuthor = report.agent_id === req.user.id;
    const isAdmin = req.user.role === 'admin' || req.user.super_admin;
    const isApproved = report.status === 'approved';
    
    // Get the current classification to check access
    const currentReportQuery = await client.query(
      'SELECT classification FROM intel_reports WHERE id = $1',
      [id]
    );
    const currentClassification = currentReportQuery.rows[0]?.classification;
    
    // Check if non-admin is trying to edit a classified report
    if (!isAdmin && currentClassification === 'Classified') {
      await client.query('ROLLBACK');
      return res.status(403).json({ 
        error: 'Access denied. Classified reports cannot be edited by non-admin users.' 
      });
    }
    
    if (!isAdmin && (!isAuthor || isApproved)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ 
        error: 'You can only edit your own reports before they are approved. Once approved, only admins can modify reports.' 
      });
    }

    // Update main report
    const updateQuery = `
      UPDATE intel_reports 
      SET intel_number = $1, classification = $2, date = $3, case_number = $4,
          subject = $5, criminal_activity = $6, summary = $7, updated_at = NOW()
      WHERE id = $8
      RETURNING *
    `;

    const updateResult = await client.query(updateQuery, [
      intel_number, classification, date, case_number,
      subject, criminal_activity, summary, id
    ]);

    // If a previously rejected report is being edited by anyone (author or admin), reset to pending for re-review
    if (report.status === 'rejected') {
      console.log('[intel-reports] Resetting rejected report to pending on edit', { id, byUser: req.user.id });
      await client.query(`
        UPDATE intel_reports 
        SET status = 'pending', reviewed_by = NULL, reviewed_at = NULL, review_comments = NULL, updated_at = NOW()
        WHERE id = $1
      `, [id]);
      // Log a review note for resubmission
      await client.query(`
        CREATE TABLE IF NOT EXISTS intel_report_review_notes (
          id SERIAL PRIMARY KEY,
          report_id INTEGER NOT NULL REFERENCES intel_reports(id) ON DELETE CASCADE,
          reviewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
          action VARCHAR(20) NOT NULL,
          comments TEXT,
          created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
        );
      `);
      await client.query(`
        INSERT INTO intel_report_review_notes (report_id, reviewer_id, action, comments)
        VALUES ($1, $2, 'comment', $3)
      `, [id, req.user.id, 'Resubmitted with corrections']);
    }

    // Delete existing related records
    await client.query('DELETE FROM intel_report_subjects WHERE report_id = $1', [id]);
    await client.query('DELETE FROM intel_report_organizations WHERE report_id = $1', [id]);
    await client.query('DELETE FROM intel_report_sources WHERE report_id = $1', [id]);

    // Insert updated subjects
    const subjectsData = JSON.parse(subjects);
    for (const subjectData of subjectsData) {
      await client.query(`
        INSERT INTO intel_report_subjects (
          report_id, first_name, middle_name, last_name, address,
          date_of_birth, race, sex, phone, social_security_number, license_number
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        id, subjectData.first_name, subjectData.middle_name, subjectData.last_name,
        subjectData.address, subjectData.date_of_birth, subjectData.race, subjectData.sex,
        subjectData.phone, subjectData.social_security_number, subjectData.license_number
      ]);
    }

    // Insert updated organizations
    const organizationsData = JSON.parse(organizations);
    for (const orgData of organizationsData) {
      await client.query(`
        INSERT INTO intel_report_organizations (
          report_id, business_name, phone, address
        ) VALUES ($1, $2, $3, $4)
      `, [id, orgData.business_name, orgData.phone, orgData.address]);
    }

    // Insert updated source information
    const sourcesData = JSON.parse(sources);
    for (const sourceData of sourcesData) {
      await client.query(`
        INSERT INTO intel_report_sources (
          report_id, source_id, rating, source, information_reliable,
          unknown_caller, ci_cs, first_name, middle_name, last_name, phone, address
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        id, sourceData.source_id, sourceData.rating, sourceData.source,
        sourceData.information_reliable, sourceData.unknown_caller, sourceData.ci_cs,
        sourceData.first_name, sourceData.middle_name, sourceData.last_name,
        sourceData.phone, sourceData.address
      ]);
    }

    await client.query('COMMIT');

    res.json({
      message: 'Intel report updated successfully',
      report: updateResult.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating intel report:', error);
    res.status(500).json({ error: 'Failed to update intel report' });
  } finally {
    client.release();
  }
});

// Update report status
router.patch('/:id/status', authenticateToken, authorizeRole(['admin', 'supervisor']), auditLog('review_intel_report', 'intel_reports'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { status, review_comments } = req.body;

    await client.query('BEGIN');

    // Update status and reviewer
    const query = `
      UPDATE intel_reports 
      SET status = $1, review_comments = $2, reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `;

    const result = await client.query(query, [status, review_comments || null, req.user.id, id]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Intel report not found' });
    }

    const report = result.rows[0];

    // Ensure review notes table exists (lightweight migration)
    await client.query(`
      CREATE TABLE IF NOT EXISTS intel_report_review_notes (
        id SERIAL PRIMARY KEY,
        report_id INTEGER NOT NULL REFERENCES intel_reports(id) ON DELETE CASCADE,
        reviewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(20) NOT NULL, -- 'approved' | 'rejected' | 'comment'
        comments TEXT,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
      );
    `);

    // Insert review trail entry
    await client.query(
      `INSERT INTO intel_report_review_notes (report_id, reviewer_id, action, comments)
       VALUES ($1, $2, $3, $4)`,
      [id, req.user.id, status, review_comments || null]
    );

    // If rejected, create a notification for the author to edit (do not fail status update if this fails)
    if (status === 'rejected') {
      try {
        await client.query(`
          INSERT INTO notifications (user_id, type, title, message, data, is_read, created_at)
          VALUES ($1, $2, $3, $4, $5, false, NOW())
        `, [
          report.agent_id,
          'intel_report_rejected',
          'Intel report rejected',
          'Your intel report was rejected. Tap to review and edit.',
          JSON.stringify({ kind: 'intel_report', report_id: report.id })
        ]);
      } catch (notifyErr) {
        console.error('Failed to create rejection notification:', notifyErr);
      }
    }

    await client.query('COMMIT');

    res.json({
      message: `Intel report status updated to ${status}`,
      report
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating intel report status:', error);
    res.status(500).json({ error: 'Failed to update intel report status' });
  } finally {
    client.release();
  }
});

// Get review trail for a report
router.get('/:id/reviews', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const notes = await pool.query(`
      SELECT n.*, u.username AS reviewer_name
      FROM intel_report_review_notes n
      LEFT JOIN users u ON n.reviewer_id = u.id
      WHERE n.report_id = $1
      ORDER BY n.created_at DESC
    `, [id]);
    res.json({ reviews: notes.rows });
  } catch (error) {
    console.error('Error fetching review notes:', error);
    res.status(500).json({ error: 'Failed to fetch review notes' });
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
router.delete('/:id', authenticateToken, authorizeRole(['admin']), auditLog('delete_intel_report', 'intel_reports'), async (req, res) => {
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

// Get a single intel report by ID (must be last to avoid conflicts)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('[intel-reports] Fetch single report', { id, userId: req.user?.id, role: req.user?.role, super: req.user?.super_admin });
    
    const query = `
      SELECT 
        ir.*,
        u.username as agent_name,
        reviewer.username as reviewed_by_name,
        json_agg(
          DISTINCT jsonb_build_object(
            'first_name', irs.first_name,
            'middle_name', irs.middle_name,
            'last_name', irs.last_name,
            'address', irs.address,
            'date_of_birth', irs.date_of_birth,
            'race', irs.race,
            'sex', irs.sex,
            'phone', irs.phone,
            'social_security_number', irs.social_security_number,
            'license_number', irs.license_number
          )
        ) FILTER (WHERE irs.id IS NOT NULL) as subjects,
        json_agg(
          DISTINCT jsonb_build_object(
            'business_name', iro.business_name,
            'phone', iro.phone,
            'address', iro.address
          )
        ) FILTER (WHERE iro.id IS NOT NULL) as organizations,
        json_agg(
          DISTINCT jsonb_build_object(
            'source_id', irsrc.source_id,
            'rating', irsrc.rating,
            'source', irsrc.source,
            'information_reliable', irsrc.information_reliable,
            'unknown_caller', irsrc.unknown_caller,
            'ci_cs', irsrc.ci_cs,
            'first_name', irsrc.first_name,
            'middle_name', irsrc.middle_name,
            'last_name', irsrc.last_name,
            'phone', irsrc.phone,
            'address', irsrc.address
          )
        ) FILTER (WHERE irsrc.id IS NOT NULL) as sources
      FROM intel_reports ir
      LEFT JOIN users u ON ir.agent_id = u.id
      LEFT JOIN users reviewer ON ir.reviewed_by = reviewer.id
      LEFT JOIN intel_report_subjects irs ON ir.id = irs.report_id
      LEFT JOIN intel_report_organizations iro ON ir.id = iro.report_id
      LEFT JOIN intel_report_sources irsrc ON ir.id = irsrc.report_id
      WHERE ir.id = $1
      GROUP BY ir.id, u.username, reviewer.username
    `;

    const result = await pool.query(query, [id]);
    console.log('[intel-reports] Query result count', result.rows.length);

    if (result.rows.length === 0) {
      console.warn('[intel-reports] Report not found', { id });
      return res.status(404).json({ error: 'Intel report not found' });
    }

    const report = result.rows[0];
    
    // Apply classification-based access control
    if (req.user.role !== 'admin') {
      // Non-admins can only view non-classified reports
      if (report.classification === 'Classified') {
        console.warn('[intel-reports] Access denied to classified report', { 
          reportId: id, 
          userId: req.user.id, 
          classification: report.classification, 
          status: report.status,
          isAuthor: report.agent_id === req.user.id 
        });
        return res.status(403).json({ 
          error: 'Access denied. This report is classified and requires admin privileges to view.' 
        });
      }
    }

    res.json({ report });
  } catch (error) {
    console.error('Error fetching intel report:', error);
    res.status(500).json({ error: 'Failed to fetch intel report' });
  }
});

// Search intel reports for system-wide search functionality
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { 
      search,
      page = 1,
      limit = 10
    } = req.query;

    if (!search || search.trim().length === 0) {
      return res.json({ reports: [], total: 0 });
    }

    const offset = (page - 1) * limit;
    const searchTerm = `%${search}%`;

    let query = `
      SELECT 
        ir.*,
        u.username as agent_name,
        'intel_report' as result_type
      FROM intel_reports ir
      LEFT JOIN users u ON ir.agent_id = u.id
      WHERE (
        ir.subject ILIKE $1 OR 
        ir.intel_number ILIKE $1 OR
        ir.summary ILIKE $1 OR
        ir.criminal_activity ILIKE $1
      )
    `;

    const values = [searchTerm];
    let valueIndex = 2;

    // Apply classification-based visibility rules
    if (req.user.role !== 'admin') {
      // Non-admins can only see non-classified approved reports
      query += ` AND ir.classification != 'Classified' AND ir.status = 'approved'`;
    } else {
      // Admins can see all approved reports
      query += ` AND ir.status = 'approved'`;
    }

    query += ` ORDER BY ir.created_at DESC LIMIT $${valueIndex} OFFSET $${valueIndex + 1}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM intel_reports ir
      WHERE (
        ir.subject ILIKE $1 OR 
        ir.intel_number ILIKE $1 OR
        ir.summary ILIKE $1 OR
        ir.criminal_activity ILIKE $1
      )
    `;

    if (req.user.role !== 'admin') {
      countQuery += ` AND ir.classification != 'Classified' AND ir.status = 'approved'`;
    } else {
      countQuery += ` AND ir.status = 'approved'`;
    }

    const countResult = await pool.query(countQuery, [searchTerm]);
    const total = countResult.rows[0].total;

    res.json({
      reports: result.rows,
      total: parseInt(total),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Error searching intel reports:', error);
    res.status(500).json({ error: 'Failed to search intel reports' });
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

// Get expiring intel reports
router.get('/expiring', authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      daysUntilExpiry = 30 
    } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Get Intel Reports and posts from Intel Report category that are expiring
    const query = `
      WITH all_intel AS (
        -- Get Intel Reports
        SELECT 
          ir.id,
          ir.intel_number as title,
          ir.report_narrative as content,
          u.username as author_name,
          ir.created_at,
          ir.expires_at as retention_date,
          'intel_report' as type,
          ir.classification as category_name
        FROM intel_reports ir
        LEFT JOIN users u ON ir.agent_id = u.id
        WHERE ir.expires_at IS NOT NULL
          AND ir.expires_at <= NOW() + INTERVAL '${parseInt(daysUntilExpiry)} days'
          AND ir.expires_at > NOW()
        
        UNION ALL
        
        -- Get posts from Intel Report category
        SELECT 
          p.id,
          p.title,
          p.content,
          p.author_name,
          p.ingested_at as created_at,
          p.retention_date,
          'post' as type,
          c.name as category_name
        FROM posts p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE c.name = 'Intel Report'
          AND p.retention_date IS NOT NULL
          AND p.retention_date <= NOW() + INTERVAL '${parseInt(daysUntilExpiry)} days'
          AND p.retention_date > NOW()
      )
      SELECT * FROM all_intel
      ORDER BY retention_date ASC
      LIMIT $1 OFFSET $2
    `;
    
    const countQuery = `
      WITH all_intel AS (
        SELECT ir.id FROM intel_reports ir
        WHERE ir.expires_at IS NOT NULL
          AND ir.expires_at <= NOW() + INTERVAL '${parseInt(daysUntilExpiry)} days'
          AND ir.expires_at > NOW()
        
        UNION ALL
        
        SELECT p.id FROM posts p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE c.name = 'Intel Report'
          AND p.retention_date IS NOT NULL
          AND p.retention_date <= NOW() + INTERVAL '${parseInt(daysUntilExpiry)} days'
          AND p.retention_date > NOW()
      )
      SELECT COUNT(*) as total FROM all_intel
    `;
    
    const [reportsResult, countResult] = await Promise.all([
      pool.query(query, [parseInt(limit), offset]),
      pool.query(countQuery)
    ]);
    
    res.json({
      reports: reportsResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(parseInt(countResult.rows[0].total) / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching expiring intel reports:', error);
    res.status(500).json({ error: 'Failed to fetch expiring intel reports' });
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
