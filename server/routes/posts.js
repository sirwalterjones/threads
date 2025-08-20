const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken, authorizeRole, auditLog } = require('../middleware/auth');
const router = express.Router();

// Get all posts with search and filtering
router.get('/', 
  authenticateToken, 
  authorizeRole(['view', 'edit', 'admin']), 
  auditLog('view_posts', 'posts'),
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        category,
        author,
        dateFrom,
        dateTo,
        sortBy = 'wp_published_date',
        sortOrder = 'DESC'
      } = req.query;

      const offset = (page - 1) * limit;
      let whereConditions = [];
      let queryParams = [];
      let paramIndex = 1;

      // Build search conditions
      if (search) {
        whereConditions.push(`search_vector @@ plainto_tsquery('english', $${paramIndex})`);
        queryParams.push(search);
        paramIndex++;
      }

      if (category) {
        whereConditions.push(`category_id = $${paramIndex}`);
        queryParams.push(category);
        paramIndex++;
      }

      if (author) {
        whereConditions.push(`author_name ILIKE $${paramIndex}`);
        queryParams.push(`%${author}%`);
        paramIndex++;
      }

      if (dateFrom) {
        whereConditions.push(`wp_published_date >= $${paramIndex}`);
        queryParams.push(dateFrom);
        paramIndex++;
      }

      if (dateTo) {
        whereConditions.push(`wp_published_date <= $${paramIndex}`);
        queryParams.push(dateTo);
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 ? 
        `WHERE ${whereConditions.join(' AND ')}` : '';

      // Validate sort parameters
      const allowedSortFields = ['title', 'wp_published_date', 'author_name', 'ingested_at'];
      const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'wp_published_date';
      const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM posts p
        LEFT JOIN categories c ON p.category_id = c.id
        ${whereClause}
      `;
      
      const countResult = await pool.query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].total);

      // Get posts with attachments
      const postsQuery = `
        SELECT 
          p.id, p.wp_post_id, p.title, p.excerpt, p.author_name,
          p.wp_published_date, p.ingested_at, p.retention_date, p.status,
          c.name as category_name, c.slug as category_slug,
          ${search ? "ts_rank(search_vector, plainto_tsquery('english', $1)) as rank," : ''}
          p.metadata,
          json_agg(
            json_build_object(
              'id', f.id,
              'filename', f.filename,
              'original_name', f.original_name,
              'mime_type', f.mime_type,
              'file_size', f.file_size,
              'uploaded_at', f.uploaded_at
            ) ORDER BY f.uploaded_at
          ) FILTER (WHERE f.id IS NOT NULL) as attachments
        FROM posts p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN post_attachments pa ON p.id = pa.post_id
        LEFT JOIN files f ON pa.file_id = f.id
        ${whereClause}
        GROUP BY p.id, c.name, c.slug
        ORDER BY ${search ? 'rank DESC,' : ''} ${sortField} ${sortDirection}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      queryParams.push(limit, offset);
      const postsResult = await pool.query(postsQuery, queryParams);

      res.json({
        posts: postsResult.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error fetching posts:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        queryParams: queryParams
      });
      res.status(500).json({ 
        error: 'Failed to fetch posts',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// Get single post
router.get('/:id', 
  authenticateToken, 
  authorizeRole(['view', 'edit', 'admin']), 
  auditLog('view_post', 'posts'),
  async (req, res) => {
    try {
      const { id } = req.params;
      
      const result = await pool.query(`
        SELECT 
          p.*, c.name as category_name, c.slug as category_slug,
          json_agg(
            json_build_object(
              'id', f.id,
              'filename', f.filename,
              'original_name', f.original_name,
              'mime_type', f.mime_type,
              'file_size', f.file_size,
              'uploaded_at', f.uploaded_at
            ) ORDER BY f.uploaded_at
          ) FILTER (WHERE f.id IS NOT NULL) as attachments
        FROM posts p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN post_attachments pa ON p.id = pa.post_id
        LEFT JOIN files f ON pa.file_id = f.id
        WHERE p.id = $1
        GROUP BY p.id, c.name, c.slug
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Post not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error fetching post:', error);
      res.status(500).json({ error: 'Failed to fetch post' });
    }
  }
);

// Create new post
router.post('/', 
  authenticateToken, 
  authorizeRole(['edit', 'admin']), 
  auditLog('create_post', 'posts'),
  async (req, res) => {
    try {
      const {
        title,
        content,
        excerpt,
        categoryId,
        retentionDays = process.env.DEFAULT_RETENTION_DAYS,
        attachments = []
      } = req.body;

      if (!title || !content) {
        return res.status(400).json({ error: 'Title and content are required' });
      }

      const retentionDate = new Date();
      retentionDate.setDate(retentionDate.getDate() + parseInt(retentionDays));

      // Start a transaction to ensure data consistency
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // If no category is specified, find or create a "Thread" category
        let finalCategoryId = categoryId;
        if (!categoryId) {
          // Try to find existing "Thread" category
          let threadCategory = await client.query(
            'SELECT id FROM categories WHERE LOWER(name) = LOWER($1)',
            ['Thread']
          );

          if (threadCategory.rows.length === 0) {
            // Create "Thread" category if it doesn't exist
            const newCategory = await client.query(`
              INSERT INTO categories (name, slug, post_count)
              VALUES ('Thread', 'thread', 0)
              RETURNING id
            `);
            finalCategoryId = newCategory.rows[0].id;
          } else {
            finalCategoryId = threadCategory.rows[0].id;
          }
        }

        // Create the post
        const postResult = await client.query(`
          INSERT INTO posts (
            title, content, excerpt, category_id, author_name, 
            wp_published_date, retention_date, status
          )
          VALUES ($1, $2, $3, $4, $5, NOW(), $6, 'publish')
          RETURNING *
        `, [title, content, excerpt, finalCategoryId, req.user.username, retentionDate]);

        const post = postResult.rows[0];

        // Create attachment relationships if any files were uploaded
        if (attachments && attachments.length > 0) {
          for (const fileId of attachments) {
            if (fileId) {
              // Verify the file exists and belongs to the current user
              const fileCheck = await client.query(
                'SELECT id FROM files WHERE id = $1 AND uploaded_by = $2',
                [fileId, req.user.id]
              );
              
              if (fileCheck.rows.length > 0) {
                await client.query(
                  'INSERT INTO post_attachments (post_id, file_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                  [post.id, fileId]
                );
              }
            }
          }
        }

        await client.query('COMMIT');
        res.status(201).json(post);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error creating post:', error);
      res.status(500).json({ error: 'Failed to create post' });
    }
  }
);

// Update post
router.put('/:id', 
  authenticateToken, 
  authorizeRole(['edit', 'admin']), 
  auditLog('update_post', 'posts'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { title, content, excerpt, categoryId, retentionDays } = req.body;

      // Check if post exists
      const existingPost = await pool.query('SELECT * FROM posts WHERE id = $1', [id]);
      if (existingPost.rows.length === 0) {
        return res.status(404).json({ error: 'Post not found' });
      }

      const updateFields = [];
      const queryParams = [];
      let paramIndex = 1;

      if (title) {
        updateFields.push(`title = $${paramIndex}`);
        queryParams.push(title);
        paramIndex++;
      }

      if (content) {
        updateFields.push(`content = $${paramIndex}`);
        queryParams.push(content);
        paramIndex++;
      }

      if (excerpt) {
        updateFields.push(`excerpt = $${paramIndex}`);
        queryParams.push(excerpt);
        paramIndex++;
      }

      if (categoryId) {
        updateFields.push(`category_id = $${paramIndex}`);
        queryParams.push(categoryId);
        paramIndex++;
      }

      if (retentionDays) {
        const newRetentionDate = new Date();
        newRetentionDate.setDate(newRetentionDate.getDate() + parseInt(retentionDays));
        updateFields.push(`retention_date = $${paramIndex}`);
        queryParams.push(newRetentionDate);
        paramIndex++;
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      updateFields.push(`wp_modified_date = NOW()`);
      queryParams.push(id);

      const result = await pool.query(`
        UPDATE posts 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `, queryParams);

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating post:', error);
      res.status(500).json({ error: 'Failed to update post' });
    }
  }
);

// Delete post
router.delete('/:id', 
  authenticateToken, 
  authorizeRole(['admin']), 
  auditLog('delete_post', 'posts'),
  async (req, res) => {
    try {
      const { id } = req.params;
      
      const result = await pool.query('DELETE FROM posts WHERE id = $1 RETURNING *', [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Post not found' });
      }

      res.json({ message: 'Post deleted successfully' });
    } catch (error) {
      console.error('Error deleting post:', error);
      res.status(500).json({ error: 'Failed to delete post' });
    }
  }
);

module.exports = router;