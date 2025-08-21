const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken, authorizeRole, auditLog } = require('../middleware/auth');
const router = express.Router();

// Simple test endpoint - no auth required
router.get('/test', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, title, author_name FROM posts LIMIT 5');
    res.json({
      message: 'Test endpoint working',
      posts: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Test endpoint error:', error);
    res.status(500).json({ error: 'Test endpoint failed', details: error.message });
  }
});

// Get all posts with search and filtering (SQLite compatible)
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
        sortOrder = 'DESC',
        origin,
        mine
      } = req.query;

      const offset = (page - 1) * limit;
      let whereConditions = [];
      let queryParams = [];
      let paramIndex = 1;

      // Build search conditions (SQLite compatible)
      if (search) {
        whereConditions.push(`(title LIKE ? OR content LIKE ? OR excerpt LIKE ?)`);
        const searchTerm = `%${search}%`;
        queryParams.push(searchTerm, searchTerm, searchTerm);
        paramIndex += 3;
      }

      if (category) {
        whereConditions.push(`category_id = ?`);
        queryParams.push(category);
        paramIndex++;
      }

      if (author) {
        whereConditions.push(`author_name LIKE ?`);
        queryParams.push(`%${author}%`);
        paramIndex++;
      }

      // Origin filter
      if (origin === 'manual') {
        whereConditions.push(`p.wp_post_id IS NULL`);
      } else if (origin === 'wordpress') {
        whereConditions.push(`p.wp_post_id IS NOT NULL`);
      }

      // Only my items (by username)
      if (mine === 'true') {
        whereConditions.push(`p.author_name = ?`);
        queryParams.push(req.user.username);
        paramIndex++;
      }

      if (dateFrom) {
        whereConditions.push(`wp_published_date >= ?`);
        queryParams.push(dateFrom);
        paramIndex++;
      }

      if (dateTo) {
        whereConditions.push(`wp_published_date <= ?`);
        queryParams.push(dateTo);
        paramIndex++;
      }

      // Build the WHERE clause
      let whereClause = '';
      if (whereConditions.length > 0) {
        whereClause = `WHERE ${whereConditions.join(' AND ')}`;
      }
      // Temporarily disable hidden category filter to debug
      // if (whereConditions.length > 0) {
      //   whereConditions.push(`(c.is_hidden IS NULL OR c.is_hidden = false)`);
      //   whereClause = `WHERE ${whereConditions.join(' AND ')}`;
      // } else if (req.user.role !== 'admin') {
      //   whereClause = `WHERE (c.is_hidden IS NULL OR c.is_hidden = false)`;
      // }

      // Validate sort parameters
      const allowedSortFields = ['title', 'wp_published_date', 'author_name', 'ingested_at'];
      const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'wp_published_date';
      const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM posts p
        ${whereClause}
      `;
      
      const countResult = await pool.query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].total);

      // Get posts
      const postsQuery = `
        SELECT 
          p.id, p.wp_post_id, p.title, p.content, p.excerpt, p.author_name,
          p.wp_published_date, p.ingested_at, p.retention_date,
          p.featured_media_url, p.attachments,
          p.metadata
        FROM posts p
        ${whereClause}
        ORDER BY ${sortField} ${sortDirection}
        LIMIT ? OFFSET ?
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
      res.status(500).json({ error: 'Failed to fetch posts' });
    }
  }
);

// Get authors list - MUST come before /:id route
router.get('/authors', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT author_name 
      FROM posts 
      WHERE author_name IS NOT NULL 
      ORDER BY author_name
    `);
    res.json(result.rows.map(row => row.author_name));
  } catch (error) {
    console.error('Error fetching authors:', error);
    res.status(500).json({ error: 'Failed to fetch authors' });
  }
});

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
          p.*, c.name as category_name, c.slug as category_slug
        FROM posts p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.id = ?
        ${req.user.role !== 'admin' ? 'AND (c.is_hidden IS NULL OR c.is_hidden = false)' : ''}
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
        retentionDays = process.env.DEFAULT_RETENTION_DAYS
      } = req.body;

      if (!title || !content) {
        return res.status(400).json({ error: 'Title and content are required' });
      }

      const retentionDate = new Date();
      retentionDate.setDate(retentionDate.getDate() + parseInt(retentionDays));

      // Resolve category: default to a category named 'Threads' if none provided
      let resolvedCategoryId = categoryId;
      if (!resolvedCategoryId) {
        const existing = await pool.query(
          "SELECT id FROM categories WHERE lower(name) = lower(?) OR lower(slug) = lower(?) LIMIT 1",
          ['Threads', 'threads']
        );
        if (existing.rows.length > 0) {
          resolvedCategoryId = existing.rows[0].id;
        } else {
          // Create Threads category
          await pool.query(
            "INSERT INTO categories (wp_category_id, name, slug, parent_id, post_count) VALUES (?, ?, ?, NULL, 0)",
            [null, 'Threads', 'threads']
          );
          const created = await pool.query(
            "SELECT id FROM categories WHERE lower(slug) = lower(?) LIMIT 1",
            ['threads']
          );
          resolvedCategoryId = created.rows[0].id;
        }
      }

      const summarize = (html) => {
        try {
          const text = String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          if (!text) return '';
          const max = 280;
          return text.length > max ? `${text.slice(0, max - 1)}…` : text;
        } catch { return ''; }
      };

      const result = await pool.query(`
        INSERT INTO posts (
          title, content, excerpt, category_id, author_name, 
          wp_published_date, retention_date, status
        )
        VALUES (?, ?, ?, ?, ?, NOW(), ?, 'publish')
      `, [title, content, summarize(content), resolvedCategoryId, req.user.username, retentionDate.toISOString().split('T')[0]]);

      // Get the created post
      const createdPost = await pool.query('SELECT * FROM posts WHERE id = ?', [result.lastID]);
      
      res.status(201).json(createdPost.rows[0]);
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
      const existingPost = await pool.query('SELECT * FROM posts WHERE id = ?', [id]);
      if (existingPost.rows.length === 0) {
        return res.status(404).json({ error: 'Post not found' });
      }

      const postRow = existingPost.rows[0];
      // Disallow editing WordPress-ingested items
      if (postRow.wp_post_id) {
        return res.status(403).json({ error: 'Cannot edit posts ingested from WordPress' });
      }

      // Allow: admin can edit any manual post; others only their own
      if (req.user.role !== 'admin' && postRow.author_name !== req.user.username) {
        return res.status(403).json({ error: 'You can only edit posts you created' });
      }

      const updateFields = [];
      const queryParams = [];

      if (title) {
        updateFields.push('title = ?');
        queryParams.push(title);
      }

      if (content) {
        updateFields.push('content = ?');
        queryParams.push(content);
      }

      if (excerpt) {
        updateFields.push('excerpt = ?');
        queryParams.push(excerpt);
      }

      if (categoryId) {
        updateFields.push('category_id = ?');
        queryParams.push(categoryId);
      }

      if (retentionDays) {
        const newRetentionDate = new Date();
        newRetentionDate.setDate(newRetentionDate.getDate() + parseInt(retentionDays));
        updateFields.push('retention_date = ?');
        queryParams.push(newRetentionDate.toISOString().split('T')[0]);
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      updateFields.push('wp_modified_date = NOW()');
      queryParams.push(id);

      await pool.query(`
        UPDATE posts 
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `, queryParams);

      const updatedPost = await pool.query('SELECT * FROM posts WHERE id = ?', [id]);
      res.json(updatedPost.rows[0]);
    } catch (error) {
      console.error('Error updating post:', error);
      res.status(500).json({ error: 'Failed to update post' });
    }
  }
);

// Delete post
router.delete('/:id', 
  authenticateToken, 
  authorizeRole(['edit', 'admin']), 
  auditLog('delete_post', 'posts'),
  async (req, res) => {
    try {
      const { id } = req.params;
      
      // Only allow deleting manual posts
      const toDelete = await pool.query('SELECT id, wp_post_id, author_name FROM posts WHERE id = ?', [id]);
      if (toDelete.rows.length === 0) {
        return res.status(404).json({ error: 'Post not found' });
      }
      if (toDelete.rows[0].wp_post_id) {
        return res.status(403).json({ error: 'Cannot delete posts ingested from WordPress' });
      }
      if (req.user.role !== 'admin' && toDelete.rows[0].author_name !== req.user.username) {
        return res.status(403).json({ error: 'You can only delete posts you created' });
      }

      const result = await pool.query('DELETE FROM posts WHERE id = ?', [id]);
      
      if (result.rowCount === 0) {
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