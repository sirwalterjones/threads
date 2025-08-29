const { pool } = require('../config/database');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class BOLOService {
  /**
   * Create a new BOLO
   */
  async createBOLO(boloData, userId, files = []) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Generate case number
      const caseResult = await client.query('SELECT generate_bolo_case_number() as case_number');
      const caseNumber = caseResult.rows[0].case_number;
      
      // Get user info
      const userResult = await client.query(
        'SELECT username, role FROM users WHERE id = $1',
        [userId]
      );
      const user = userResult.rows[0];
      
      // Process subject_aliases to ensure it's an array
      let subjectAliases = null;
      if (boloData.subject_aliases) {
        if (Array.isArray(boloData.subject_aliases)) {
          subjectAliases = boloData.subject_aliases;
        } else if (typeof boloData.subject_aliases === 'string') {
          // Split by comma, newline, or semicolon and trim each alias
          subjectAliases = boloData.subject_aliases
            .split(/[,\n;]/)
            .map(alias => alias.trim())
            .filter(alias => alias.length > 0);
        }
      }
      
      // Insert BOLO
      const boloResult = await client.query(`
        INSERT INTO bolos (
          case_number, type, priority, status,
          subject_name, subject_aliases, subject_description,
          date_of_birth, age_range, height, weight,
          hair_color, eye_color, distinguishing_features,
          last_seen_wearing, armed_dangerous, armed_dangerous_details,
          vehicle_make, vehicle_model, vehicle_year, vehicle_color,
          license_plate, vehicle_vin, vehicle_features, direction_of_travel,
          incident_date, incident_location, last_known_location, jurisdiction,
          title, summary, narrative, officer_safety_info, approach_instructions,
          created_by, agency_name, officer_name, contact_info,
          expires_at, is_public
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
          $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
          $31, $32, $33, $34, $35, $36, $37, $38, $39, $40
        ) RETURNING *
      `, [
        caseNumber,
        boloData.type,
        boloData.priority || 'medium',
        'active',
        boloData.subject_name,
        subjectAliases,
        boloData.subject_description,
        boloData.date_of_birth,
        boloData.age_range,
        boloData.height,
        boloData.weight,
        boloData.hair_color,
        boloData.eye_color,
        boloData.distinguishing_features,
        boloData.last_seen_wearing,
        boloData.armed_dangerous || false,
        boloData.armed_dangerous_details,
        boloData.vehicle_make,
        boloData.vehicle_model,
        boloData.vehicle_year,
        boloData.vehicle_color,
        boloData.license_plate,
        boloData.vehicle_vin,
        boloData.vehicle_features,
        boloData.direction_of_travel,
        boloData.incident_date,
        boloData.incident_location,
        boloData.last_known_location,
        boloData.jurisdiction,
        boloData.title,
        boloData.summary,
        boloData.narrative,
        boloData.officer_safety_info,
        boloData.approach_instructions,
        userId,
        boloData.agency_name || 'Cherokee Sheriff\'s Office',
        user.username,
        boloData.contact_info,
        boloData.expires_at,
        boloData.is_public || false
      ]);
      
      const bolo = boloResult.rows[0];
      
      // Process uploaded files
      let primaryMediaId = null;
      if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          
          // In production with memory storage, file.buffer contains the file data
          // For now, we'll store metadata only and handle file storage later
          const filename = file.filename || `bolo-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
          
          // TODO: In production, upload file.buffer to cloud storage (S3, Cloudinary, etc.)
          // For now, we'll use a placeholder URL in production
          const fileUrl = process.env.NODE_ENV === 'production' 
            ? `https://via.placeholder.com/400x300.png?text=BOLO+Image` // Placeholder for production
            : `/uploads/bolo/${filename}`;
          
          const mediaResult = await client.query(`
            INSERT INTO bolo_media (
              bolo_id, type, filename, original_name, url, thumbnail_url,
              mime_type, size, uploaded_by, is_primary, display_order
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id
          `, [
            bolo.id,
            this.getMediaType(file.mimetype),
            filename,
            file.originalname,
            fileUrl,
            fileUrl, // Use same URL for thumbnail for now
            file.mimetype,
            file.size,
            userId,
            i === 0, // First file is primary
            i
          ]);
          
          // Store the first media ID as primary
          if (i === 0) {
            primaryMediaId = mediaResult.rows[0].id;
          }
          
          // Update primary image reference if first image
          if (i === 0 && this.getMediaType(file.mimetype) === 'image') {
            await client.query(
              'UPDATE bolos SET primary_image_id = $1 WHERE id = $2',
              [mediaResult.rows[0].id, bolo.id]
            );
          }
        }
      }
      
      // Log activity
      await client.query(`
        INSERT INTO bolo_activity (bolo_id, user_id, action, metadata)
        VALUES ($1, $2, 'created', $3)
      `, [bolo.id, userId, { case_number: caseNumber }]);
      
      await client.query('COMMIT');
      
      return bolo;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Get BOLO feed with filters
   */
  async getBOLOFeed(userId, filters = {}) {
    const {
      type,
      priority,
      status = 'active',
      search,
      limit = 20,
      offset = 0,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = filters;
    
    let query = `
      SELECT 
        b.*,
        u.username as creator_username,
        COALESCE(m.url, '') as primary_image_url,
        COALESCE(m.thumbnail_url, '') as primary_thumbnail_url,
        EXISTS(SELECT 1 FROM bolo_saves WHERE bolo_id = b.id AND user_id = $1) as is_saved,
        EXISTS(SELECT 1 FROM bolo_reposts WHERE original_bolo_id = b.id AND reposted_by = $1) as is_reposted
      FROM bolos b
      LEFT JOIN users u ON b.created_by = u.id
      LEFT JOIN bolo_media m ON b.primary_image_id = m.id
      WHERE 1=1
    `;
    
    const params = [userId];
    let paramIndex = 2;
    
    // Add filters
    if (status) {
      query += ` AND b.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    if (type) {
      query += ` AND b.type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }
    
    if (priority) {
      query += ` AND b.priority = $${paramIndex}`;
      params.push(priority);
      paramIndex++;
    }
    
    if (search) {
      query += ` AND b.search_vector @@ plainto_tsquery('english', $${paramIndex})`;
      params.push(search);
      paramIndex++;
    }
    
    // Add sorting
    const validSortColumns = ['created_at', 'priority', 'incident_date', 'view_count'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const sortDirection = sortOrder === 'ASC' ? 'ASC' : 'DESC';
    
    query += ` ORDER BY b.${sortColumn} ${sortDirection}`;
    
    // Add pagination
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM bolos b
      WHERE 1=1
    `;
    
    const countParams = [];
    paramIndex = 1;
    
    if (status) {
      countQuery += ` AND b.status = $${paramIndex}`;
      countParams.push(status);
      paramIndex++;
    }
    
    if (type) {
      countQuery += ` AND b.type = $${paramIndex}`;
      countParams.push(type);
      paramIndex++;
    }
    
    if (priority) {
      countQuery += ` AND b.priority = $${paramIndex}`;
      countParams.push(priority);
      paramIndex++;
    }
    
    if (search) {
      countQuery += ` AND b.search_vector @@ plainto_tsquery('english', $${paramIndex})`;
      countParams.push(search);
    }
    
    const countResult = await pool.query(countQuery, countParams);
    
    return {
      bolos: result.rows,
      total: parseInt(countResult.rows[0].total),
      page: Math.floor(offset / limit) + 1,
      pages: Math.ceil(countResult.rows[0].total / limit)
    };
  }
  
  /**
   * Get single BOLO by ID
   */
  async getBOLOById(boloId, userId = null, isPublic = false) {
    const client = await pool.connect();
    
    try {
      // Get BOLO with media
      const boloResult = await client.query(`
        SELECT 
          b.*,
          u.username as creator_username,
          COALESCE(
            json_agg(
              json_build_object(
                'id', m.id,
                'type', m.type,
                'url', m.url,
                'thumbnail_url', m.thumbnail_url,
                'caption', m.caption,
                'mime_type', m.mime_type,
                'is_primary', m.is_primary
              ) ORDER BY m.display_order
            ) FILTER (WHERE m.id IS NOT NULL),
            '[]'
          ) as media,
          ${userId ? `EXISTS(SELECT 1 FROM bolo_saves WHERE bolo_id = b.id AND user_id = ${userId}) as is_saved,
                     EXISTS(SELECT 1 FROM bolo_reposts WHERE original_bolo_id = b.id AND reposted_by = ${userId}) as is_reposted` 
                   : 'false as is_saved, false as is_reposted'}
        FROM bolos b
        LEFT JOIN users u ON b.created_by = u.id
        LEFT JOIN bolo_media m ON b.id = m.bolo_id
        WHERE b.id = $1 ${isPublic ? 'AND b.is_public = true' : ''}
        GROUP BY b.id, u.username
      `, [boloId]);
      
      if (boloResult.rows.length === 0) {
        return null;
      }
      
      const bolo = boloResult.rows[0];
      
      // Increment view count
      await client.query(
        'UPDATE bolos SET view_count = view_count + 1 WHERE id = $1',
        [boloId]
      );
      
      // Log view activity if user is logged in
      if (userId) {
        await client.query(`
          INSERT INTO bolo_activity (bolo_id, user_id, action)
          VALUES ($1, $2, 'viewed')
          ON CONFLICT DO NOTHING
        `, [boloId, userId]);
      }
      
      // Get comments
      const commentsResult = await client.query(`
        SELECT 
          c.*,
          u.username,
          u.role as user_role
        FROM bolo_comments c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.bolo_id = $1
          AND (c.is_internal = false OR $2 = true)
        ORDER BY c.created_at DESC
      `, [boloId, !isPublic]);
      
      bolo.comments = commentsResult.rows;
      
      return bolo;
      
    } finally {
      client.release();
    }
  }
  
  /**
   * Get BOLO by public token
   */
  async getBOLOByPublicToken(token) {
    const result = await pool.query(
      'SELECT id FROM bolos WHERE public_share_token = $1 AND is_public = true AND status = $2',
      [token, 'active']
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.getBOLOById(result.rows[0].id, null, true);
  }
  
  /**
   * Update BOLO
   */
  async updateBOLO(boloId, updates, userId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check ownership or admin
      const ownerCheck = await client.query(
        'SELECT created_by FROM bolos WHERE id = $1',
        [boloId]
      );
      
      if (ownerCheck.rows.length === 0) {
        throw new Error('BOLO not found');
      }
      
      const userCheck = await client.query(
        'SELECT role FROM users WHERE id = $1',
        [userId]
      );
      
      const isOwner = ownerCheck.rows[0].created_by === userId;
      const isAdmin = userCheck.rows[0].role === 'admin';
      
      if (!isOwner && !isAdmin) {
        throw new Error('Unauthorized to update this BOLO');
      }
      
      // Build update query
      const updateFields = [];
      const values = [];
      let paramIndex = 1;
      
      // Status can only be: pending, active, cancelled
      if (updates.status && !['pending', 'active', 'cancelled'].includes(updates.status)) {
        throw new Error('Invalid status. Must be: pending, active, or cancelled');
      }
      
      const allowedFields = [
        'priority', 'status', 'subject_description', 'last_known_location',
        'narrative', 'officer_safety_info', 'is_public', 'expires_at'
      ];
      
      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          updateFields.push(`${field} = $${paramIndex}`);
          values.push(updates[field]);
          paramIndex++;
        }
      }
      
      if (updateFields.length > 0) {
        values.push(boloId);
        const updateQuery = `
          UPDATE bolos 
          SET ${updateFields.join(', ')}
          WHERE id = $${paramIndex}
          RETURNING *
        `;
        
        const result = await client.query(updateQuery, values);
        
        // Log activity
        await client.query(`
          INSERT INTO bolo_activity (bolo_id, user_id, action, metadata)
          VALUES ($1, $2, 'updated', $3)
        `, [boloId, userId, { fields: Object.keys(updates) }]);
        
        await client.query('COMMIT');
        
        return result.rows[0];
      }
      
      await client.query('COMMIT');
      return ownerCheck.rows[0];
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Repost BOLO
   */
  async repostBOLO(boloId, userId, message = '') {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if already reposted
      const existingRepost = await client.query(
        'SELECT id FROM bolo_reposts WHERE original_bolo_id = $1 AND reposted_by = $2',
        [boloId, userId]
      );
      
      if (existingRepost.rows.length > 0) {
        throw new Error('Already reposted this BOLO');
      }
      
      // Get user info
      const userResult = await client.query(
        'SELECT username FROM users WHERE id = $1',
        [userId]
      );
      
      // Create repost
      await client.query(`
        INSERT INTO bolo_reposts (original_bolo_id, reposted_by, repost_message, agency_name)
        VALUES ($1, $2, $3, $4)
      `, [boloId, userId, message, 'Cherokee Sheriff\'s Office']);
      
      // Update repost count
      await client.query(
        'UPDATE bolos SET repost_count = repost_count + 1 WHERE id = $1',
        [boloId]
      );
      
      // Log activity
      await client.query(`
        INSERT INTO bolo_activity (bolo_id, user_id, action)
        VALUES ($1, $2, 'reposted')
      `, [boloId, userId]);
      
      // Create notification for original poster
      const boloResult = await client.query(
        'SELECT created_by, title FROM bolos WHERE id = $1',
        [boloId]
      );
      
      if (boloResult.rows[0].created_by !== userId) {
        await client.query(`
          INSERT INTO bolo_notifications (bolo_id, user_id, type)
          VALUES ($1, $2, 'repost')
        `, [boloId, boloResult.rows[0].created_by]);
      }
      
      await client.query('COMMIT');
      
      return { success: true, message: 'BOLO reposted successfully' };
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Add comment to BOLO
   */
  async addComment(boloId, userId, content, isInternal = false) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get user info
      const userResult = await client.query(
        'SELECT username FROM users WHERE id = $1',
        [userId]
      );
      
      // Insert comment
      const commentResult = await client.query(`
        INSERT INTO bolo_comments (bolo_id, user_id, username, content, is_internal, agency_name)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [
        boloId,
        userId,
        userResult.rows[0].username,
        content,
        isInternal,
        'Cherokee Sheriff\'s Office'
      ]);
      
      // Update comment count
      await client.query(
        'UPDATE bolos SET comment_count = comment_count + 1 WHERE id = $1',
        [boloId]
      );
      
      // Log activity
      await client.query(`
        INSERT INTO bolo_activity (bolo_id, user_id, action)
        VALUES ($1, $2, 'commented')
      `, [boloId, userId]);
      
      // Create notification for original poster
      const boloResult = await client.query(
        'SELECT created_by FROM bolos WHERE id = $1',
        [boloId]
      );
      
      if (boloResult.rows[0].created_by !== userId) {
        await client.query(`
          INSERT INTO bolo_notifications (bolo_id, user_id, type)
          VALUES ($1, $2, 'comment')
        `, [boloId, boloResult.rows[0].created_by]);
      }
      
      await client.query('COMMIT');
      
      return commentResult.rows[0];
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Save/Unsave BOLO
   */
  async toggleSaveBOLO(boloId, userId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if already saved
      const existingSave = await client.query(
        'SELECT id FROM bolo_saves WHERE bolo_id = $1 AND user_id = $2',
        [boloId, userId]
      );
      
      let action;
      if (existingSave.rows.length > 0) {
        // Unsave
        await client.query(
          'DELETE FROM bolo_saves WHERE bolo_id = $1 AND user_id = $2',
          [boloId, userId]
        );
        
        await client.query(
          'UPDATE bolos SET save_count = GREATEST(save_count - 1, 0) WHERE id = $1',
          [boloId]
        );
        
        action = 'unsaved';
      } else {
        // Save
        await client.query(
          'INSERT INTO bolo_saves (bolo_id, user_id) VALUES ($1, $2)',
          [boloId, userId]
        );
        
        await client.query(
          'UPDATE bolos SET save_count = save_count + 1 WHERE id = $1',
          [boloId]
        );
        
        action = 'saved';
      }
      
      // Log activity
      await client.query(`
        INSERT INTO bolo_activity (bolo_id, user_id, action)
        VALUES ($1, $2, $3)
      `, [boloId, userId, action]);
      
      await client.query('COMMIT');
      
      return { saved: action === 'saved' };
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Get user's saved BOLOs
   */
  async getSavedBOLOs(userId, limit = 20, offset = 0) {
    const result = await pool.query(`
      SELECT 
        b.*,
        u.username as creator_username,
        COALESCE(m.url, '') as primary_image_url,
        COALESCE(m.thumbnail_url, '') as primary_thumbnail_url,
        true as is_saved,
        EXISTS(SELECT 1 FROM bolo_reposts WHERE original_bolo_id = b.id AND reposted_by = $1) as is_reposted,
        s.saved_at
      FROM bolo_saves s
      JOIN bolos b ON s.bolo_id = b.id
      LEFT JOIN users u ON b.created_by = u.id
      LEFT JOIN bolo_media m ON b.primary_image_id = m.id
      WHERE s.user_id = $1
      ORDER BY s.saved_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);
    
    return result.rows;
  }
  
  /**
   * Helper function to determine media type
   */
  getMediaType(mimetype) {
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype.startsWith('video/')) return 'video';
    if (mimetype.startsWith('audio/')) return 'audio';
    return 'document';
  }
}

module.exports = new BOLOService();