const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken, authorizeRole, authorizeSuperAdmin, auditLog } = require('../middleware/auth');
const router = express.Router();

console.log('Posts router loaded successfully');

// Debug endpoint to check database content - no auth required
router.get('/debug', async (req, res) => {
  try {
    console.log('Debug endpoint called - checking database content...');
    
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    // Test the same query as the main posts endpoint
    const postsQuery = `
      SELECT 
        p.id, p.wp_post_id, p.title, p.content, p.excerpt, p.author_name,
        p.wp_published_date, p.ingested_at, p.retention_date, p.status,
        p.metadata
      FROM posts p
      ORDER BY p.id DESC
      LIMIT $1 OFFSET $2
    `;
    
    const postsResult = await pool.query(postsQuery, [limit, offset]);
    
    res.json({
      posts: postsResult.rows,
      count: postsResult.rows.length,
      message: 'Debug posts query successful',
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({ 
      error: 'Debug endpoint failed', 
      details: error.message,
      stack: error.stack
    });
  }
});

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

// No auth posts endpoint for debugging
router.get('/no-auth', async (req, res) => {
  try {
    console.log('No-auth endpoint called');
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    // Test the EXACT same query as the main posts endpoint
    const countQuery = `
      SELECT COUNT(*) as total
      FROM posts p
    `;
    
    const countResult = await pool.query(countQuery);
    const total = parseInt(countResult.rows[0].total);
    
    const postsQuery = `
      SELECT 
        p.id, p.wp_post_id, p.title, p.content, p.excerpt, p.author_name,
        p.wp_published_date, p.ingested_at, p.retention_date, p.status,
        p.metadata
      FROM posts p
      ORDER BY p.id DESC
      LIMIT $1 OFFSET $2
    `;
    
    const postsResult = await pool.query(postsQuery, [limit, offset]);
    
    res.json({
      posts: postsResult.rows,
      count: postsResult.rows.length,
      total,
      message: 'No auth test successful - same query as main endpoint'
    });
  } catch (error) {
    console.error('No auth posts error:', error);
    res.status(500).json({ error: 'No auth posts failed', details: error.message });
  }
});

// Get all posts with search and filtering
router.get('/',
  authenticateToken,
  async (req, res) => {
    try {
      console.log('Posts route called with user:', req.user); // Debug
      console.log('Query params:', req.query); // Debug
      
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

      const offset = (parseInt(page) - 1) * parseInt(limit);
      let whereConditions = [];
      let queryParams = [];
      let paramIndex = 1;

      // Advanced search with relevance ranking
      let searchCondition = '';
      let searchRankSelect = '';
      let searchOrderBy = '';
      
      if (search) {
        const searchTerm = search.trim();
        
        // Determine if this is a phrase search (quoted) or word search
        const isPhrase = searchTerm.startsWith('"') && searchTerm.endsWith('"');
        const cleanSearch = isPhrase ? searchTerm.slice(1, -1) : searchTerm;
        
        // Create appropriate tsquery based on search type
        const tsqueryFunc = isPhrase ? 'phraseto_tsquery' : 'plainto_tsquery';
        
        // Build search condition with multiple fields and fallback
        searchCondition = `(
          p.search_vector @@ ${tsqueryFunc}('english', $${paramIndex}) OR
          p.title ILIKE $${paramIndex + 1} OR 
          p.content ILIKE $${paramIndex + 1} OR
          p.excerpt ILIKE $${paramIndex + 1} OR
          p.author_name ILIKE $${paramIndex + 1}
        )`;
        
        // Add relevance scoring - weighted by field importance
        searchRankSelect = `, (
          COALESCE(ts_rank_cd(p.search_vector, ${tsqueryFunc}('english', $${paramIndex}), 32), 0) * 3.0 +
          CASE WHEN p.title ILIKE $${paramIndex + 1} THEN 2.5 ELSE 0 END +
          CASE WHEN p.excerpt ILIKE $${paramIndex + 1} THEN 2.0 ELSE 0 END +
          CASE WHEN p.content ILIKE $${paramIndex + 1} THEN 1.0 ELSE 0 END +
          CASE WHEN p.author_name ILIKE $${paramIndex + 1} THEN 1.5 ELSE 0 END
        ) as search_rank`;
        
        whereConditions.push(searchCondition);
        queryParams.push(cleanSearch); // For tsquery
        queryParams.push(`%${cleanSearch}%`); // For ILIKE fallback
        paramIndex += 2;
        
        // Override sort order when searching - most relevant first
        searchOrderBy = 'search_rank DESC, ';
      }

      if (category) {
        whereConditions.push(`c.name ILIKE $${paramIndex}`);
        queryParams.push(`%${category}%`);
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

      // Handle origin filter
      if (origin === 'wordpress') {
        whereConditions.push(`wp_post_id IS NOT NULL`);
      } else if (origin === 'manual') {
        whereConditions.push(`wp_post_id IS NULL`);
      }

      // Handle mine filter - only show current user's posts
      if (mine === 'true' && req.user) {
        // Show only posts created by the current user
        whereConditions.push(`p.author_name = $${queryParams.length + 1}`);
        queryParams.push(req.user.username);
      }

      // Build the WHERE clause
      let whereClause = '';
      if (whereConditions.length > 0) {
        whereClause = `WHERE ${whereConditions.join(' AND ')}`;
      }

      // Validate sort parameters
      const allowedSortFields = ['title', 'wp_published_date', 'author_name', 'ingested_at'];
      const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'wp_published_date';
      const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      // Build the main query with proper filtering
      const countQuery = `
        SELECT COUNT(*) as total
        FROM posts p
        LEFT JOIN categories c ON p.category_id = c.id
        ${whereClause}
      `;
      
      const countResult = await pool.query(countQuery, queryParams);
      const postsTotal = parseInt(countResult.rows[0].total);

      // Build the posts query with proper filtering and relevance ranking
      const postsQuery = `
        SELECT 
          p.id, p.wp_post_id, p.title, p.content, p.excerpt, p.author_name,
          p.wp_published_date, p.ingested_at, p.retention_date, p.status,
          p.metadata, p.category_id, c.name as category_name, c.slug as category_slug,
          'post' as result_type,
          COALESCE(
            (SELECT json_agg(
              json_build_object(
                'id', f.id,
                'filename', f.filename,
                'original_name', f.original_name,
                'mime_type', f.mime_type,
                'file_size', f.file_size,
                'uploaded_at', f.uploaded_at
              )
            ) FROM post_attachments pa 
             JOIN files f ON pa.file_id = f.id 
             WHERE pa.post_id = p.id), 
            '[]'::json
          ) as attachments,
          COALESCE(
            (SELECT COUNT(*) FROM comments WHERE post_id = p.id),
            0
          ) as comment_count
          ${searchRankSelect}
        FROM posts p
        LEFT JOIN categories c ON p.category_id = c.id
        ${whereClause}
        ORDER BY ${searchOrderBy}p.${sortField} ${sortDirection}, p.id DESC
        LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
      `;

    const postsResult = await pool.query(postsQuery, [...queryParams, parseInt(limit), parseInt(offset)]);

    // If there's a search term, also get intel reports for unified results
    let intelReports = [];
    let intelTotal = 0;
    if (search) {
      try {
        const searchTerm = search.trim();
        const isPhrase = searchTerm.startsWith('"') && searchTerm.endsWith('"');
        const cleanSearch = isPhrase ? searchTerm.slice(1, -1) : searchTerm;
        const intelSearchTerm = `%${cleanSearch}%`;
        
        let intelQuery = `
          SELECT 
            ir.id, ir.intel_number, ir.subject as title, ir.summary as content,
            ir.criminal_activity as excerpt, ir.agent_id, u.username as agent_name,
            ir.created_at as wp_published_date, ir.created_at as ingested_at,
            ir.classification, ir.status, 'intel_report' as result_type,
            '[]'::json as attachments, 0 as comment_count,
            NULL as wp_post_id, NULL as retention_date, NULL as metadata,
            NULL as category_id, NULL as category_name, NULL as category_slug,
            (
              CASE WHEN ir.subject ILIKE $1 THEN 3.0 ELSE 0 END +
              CASE WHEN ir.intel_number ILIKE $1 THEN 2.5 ELSE 0 END +
              CASE WHEN ir.summary ILIKE $1 THEN 2.0 ELSE 0 END +
              CASE WHEN ir.criminal_activity ILIKE $1 THEN 1.5 ELSE 0 END
            ) as search_rank
          FROM intel_reports ir
          LEFT JOIN users u ON ir.agent_id = u.id
          WHERE ir.status = 'approved' AND (
            ir.subject ILIKE $1 OR 
            ir.intel_number ILIKE $1 OR
            ir.summary ILIKE $1 OR
            ir.criminal_activity ILIKE $1
          )
        `;

        // Apply classification-based visibility rules
        if (req.user.role !== 'admin') {
          intelQuery += ` AND ir.classification != 'Classified'`;
        }

        intelQuery += ` ORDER BY search_rank DESC, ir.created_at DESC LIMIT 5`;

        const intelResult = await pool.query(intelQuery, [intelSearchTerm]);
        intelReports = intelResult.rows;

        // Get intel reports count
        let intelCountQuery = `
          SELECT COUNT(*) as total
          FROM intel_reports ir
          WHERE ir.status = 'approved' AND (
            ir.subject ILIKE $1 OR 
            ir.intel_number ILIKE $1 OR
            ir.summary ILIKE $1 OR
            ir.criminal_activity ILIKE $1
          )
        `;

        if (req.user.role !== 'admin') {
          intelCountQuery += ` AND ir.classification != 'Classified'`;
        }

        const intelCountResult = await pool.query(intelCountQuery, [intelSearchTerm]);
        intelTotal = parseInt(intelCountResult.rows[0].total);
      } catch (intelError) {
        console.error('Error fetching intel reports in search:', intelError);
      }
    }

    // Combine results
    const allResults = [...postsResult.rows, ...intelReports];
    const total = postsTotal + intelTotal;

      res.json({
        posts: allResults,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        },
        intel_reports_count: intelTotal
      });
    } catch (error) {
      console.error('Error fetching posts:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        queryParams: queryParams || 'undefined'
      });
      res.status(500).json({ 
        error: 'Failed to fetch posts',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// Get all authors with post counts
router.get('/authors',
  authenticateToken,
  authorizeRole(['view', 'edit', 'admin']),
  async (req, res) => {
    try {
      const query = `
        SELECT 
          author_name,
          COUNT(*) as post_count,
          COUNT(CASE WHEN wp_post_id IS NOT NULL THEN 1 END) as wordpress_posts,
          COUNT(CASE WHEN wp_post_id IS NULL THEN 1 END) as manual_posts
        FROM posts 
        WHERE author_name IS NOT NULL AND author_name != ''
        GROUP BY author_name 
        ORDER BY post_count DESC
      `;
      
      const result = await pool.query(query);
      
      res.json({
        authors: result.rows.map(row => ({
          name: row.author_name,
          totalPosts: parseInt(row.post_count),
          wordpressPosts: parseInt(row.wordpress_posts),
          manualPosts: parseInt(row.manual_posts)
        }))
      });
      
    } catch (error) {
      console.error('Error fetching authors:', error);
      res.status(500).json({
        error: 'Failed to fetch authors',
        details: error.message
      });
    }
  }
);

// Get user's followed posts - SIMPLIFIED VERSION
router.get('/following', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    console.log('=== FOLLOWING ENDPOINT START ===');
    console.log('User ID:', userId, 'Page:', page, 'Limit:', limit);

    // First, let's see what columns actually exist in the posts table
    const schemaQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'posts' 
      ORDER BY ordinal_position
    `;
    
    const schemaResult = await pool.query(schemaQuery);
    console.log('Available columns in posts table:', schemaResult.rows.map(r => r.column_name));

    // Return the EXACT same data structure as the search page for consistent card rendering
    const query = `
      SELECT 
        p.id, p.wp_post_id, p.title, p.content, p.excerpt, p.author_name,
        p.wp_published_date, p.ingested_at, p.retention_date, p.status,
        p.metadata, p.category_id, c.name as category_name, c.slug as category_slug,
        COALESCE(
          (SELECT json_agg(
            json_build_object(
              'id', f.id,
              'filename', f.filename,
              'original_name', f.original_name,
              'mime_type', f.mime_type,
              'file_size', f.file_size,
              'uploaded_at', f.uploaded_at
            )
          ) FROM post_attachments pa 
           JOIN files f ON pa.file_id = f.id 
           WHERE pa.post_id = p.id), 
          '[]'::json
        ) as attachments,
        COALESCE(
          (SELECT COUNT(*) FROM comments WHERE post_id = p.id),
          0
        ) as comment_count,
        uf.created_at as followed_at
      FROM user_follows uf
      JOIN posts p ON uf.post_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE uf.user_id = $1
      ORDER BY uf.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    console.log('Executing query with params:', [userId, limit, offset]);
    const result = await pool.query(query, [userId, limit, offset]);
    console.log('Query result rows:', result.rows.length);
    
    const posts = result.rows;
    const totalCount = posts.length; // Simple count for now

    console.log('Sending response with', posts.length, 'posts');
    res.json({
      posts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
    console.log('=== FOLLOWING ENDPOINT SUCCESS ===');
    
  } catch (error) {
    console.error('=== FOLLOWING ENDPOINT ERROR ===');
    console.error('Error fetching followed posts:', error);
    res.status(500).json({ error: 'Failed to fetch followed posts: ' + error.message });
  }
});

// Check if user is following specific posts (bulk check)
router.post('/follow-status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { postIds } = req.body;

    if (!Array.isArray(postIds) || postIds.length === 0) {
      return res.json({ follows: {} });
    }

    const placeholders = postIds.map((_, index) => `$${index + 2}`).join(',');
    const query = `
      SELECT post_id 
      FROM user_follows 
      WHERE user_id = $1 AND post_id IN (${placeholders})
    `;

    const result = await pool.query(query, [userId, ...postIds]);
    
    // Create a map of postId -> boolean
    const follows = {};
    postIds.forEach(id => follows[id] = false);
    result.rows.forEach(row => follows[row.post_id] = true);

    res.json({ follows });
  } catch (error) {
    console.error('Error checking follow status:', error);
    res.status(500).json({ error: 'Failed to check follow status' });
  }
});

// Follow a post - REAL VERSION
router.post('/:id/follow', authenticateToken, async (req, res) => {
  console.log('=== REAL FOLLOW ENDPOINT START ===');
  console.log('Request params:', req.params);
  console.log('User:', req.user ? { id: req.user.id, username: req.user.username } : 'NO USER');
  
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log('Checking if post exists...');
    const postCheck = await pool.query('SELECT id FROM posts WHERE id = $1', [id]);
    console.log('Post check completed, rows found:', postCheck.rows.length);
    
    if (postCheck.rows.length === 0) {
      console.log('Post not found, returning 404');
      return res.status(404).json({ error: 'Post not found' });
    }

    // Insert follow relationship
    console.log('Inserting follow relationship...');
    const followResult = await pool.query(`
      INSERT INTO user_follows (user_id, post_id) 
      VALUES ($1, $2) 
      ON CONFLICT (user_id, post_id) DO NOTHING
      RETURNING *
    `, [userId, id]);
    console.log('Follow insert completed, rows:', followResult.rowCount);

    // Send success response
    console.log('Sending success response');
    res.json({ 
      message: 'Post followed successfully',
      following: true,
      debug: { postId: id, userId, inserted: followResult.rowCount > 0 }
    });
    console.log('=== REAL FOLLOW ENDPOINT SUCCESS ===');
    
  } catch (error) {
    console.error('=== REAL FOLLOW ENDPOINT ERROR ===');
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to follow post: ' + error.message });
  } finally {
    console.log('=== REAL FOLLOW ENDPOINT END ===');
  }
});

// Unfollow a post
router.delete('/:id/follow', authenticateToken, auditLog('unfollow_post', 'posts'), async (req, res) => {
  console.log('=== UNFOLLOW ENDPOINT START ===');
  console.log('Request params:', req.params);
  console.log('User:', req.user ? { id: req.user.id, username: req.user.username } : 'NO USER');
  
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log('Attempting to unfollow post:', id, 'for user:', userId);

    const result = await pool.query(
      'DELETE FROM user_follows WHERE user_id = $1 AND post_id = $2 RETURNING *',
      [userId, id]
    );

    console.log('Unfollow result:', result.rows.length, 'rows affected');

    res.json({ 
      message: result.rows.length > 0 ? 'Post unfollowed successfully' : 'Post was not being followed',
      following: false 
    });
    console.log('=== UNFOLLOW ENDPOINT SUCCESS ===');
    
  } catch (error) {
    console.error('=== UNFOLLOW ENDPOINT ERROR ===');
    console.error('Error unfollowing post:', error);
    res.status(500).json({ error: 'Failed to unfollow post: ' + error.message });
  }
});

// Delete a post (Super Admin only)
router.delete('/:id', 
  authenticateToken, 
  authorizeSuperAdmin(), 
  auditLog('delete_post', 'posts'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const username = req.user.username;

      console.log(`Super admin ${username} (ID: ${userId}) attempting to delete post: ${id}`);

      // Get post details before deletion for audit purposes
      const postResult = await pool.query(
        'SELECT id, title, wp_post_id, author_name FROM posts WHERE id = $1',
        [id]
      );

      if (postResult.rows.length === 0) {
        return res.status(404).json({ error: 'Post not found' });
      }

      const post = postResult.rows[0];
      console.log(`Deleting post: "${post.title}" (ID: ${post.id}, WP ID: ${post.wp_post_id})`);

      // Start a transaction to ensure data consistency
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');

        // Delete related records first (foreign key constraints)
        console.log('Deleting related records...');
        
        // Delete post attachments
        await client.query(
          'DELETE FROM post_attachments WHERE post_id = $1',
          [id]
        );
        
        // Delete user follows
        await client.query(
          'DELETE FROM user_follows WHERE post_id = $1',
          [id]
        );
        
        // Delete comments
        await client.query(
          'DELETE FROM comments WHERE post_id = $1',
          [id]
        );
        
        // Finally delete the post
        const deleteResult = await client.query(
          'DELETE FROM posts WHERE id = $1 RETURNING id, title',
          [id]
        );

        await client.query('COMMIT');
        
        console.log(`Post "${post.title}" deleted successfully by super admin ${username}`);
        
        res.json({
          message: 'Post deleted successfully',
          deletedPost: {
            id: post.id,
            title: post.title,
            wpPostId: post.wp_post_id
          },
          deletedBy: username,
          timestamp: new Date()
        });

      } catch (transactionError) {
        await client.query('ROLLBACK');
        throw transactionError;
      } finally {
        client.release();
      }

    } catch (error) {
      console.error('Error deleting post:', error);
      res.status(500).json({ 
        error: 'Failed to delete post', 
        details: error.message 
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
        ${req.user.role !== 'admin' ? 'AND (c.is_hidden IS NULL OR c.is_hidden = false)' : ''}
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
        
        // Trigger hot list check for the newly created manual post
        if (global.cronService && typeof global.cronService.performHotListCheck === 'function') {
          setImmediate(async () => {
            try {
              console.log(`🔥 Triggering hot list check for manual post: "${post.title}" (ID: ${post.id})`);
              await global.cronService.performHotListCheck();
            } catch (error) {
              console.error('Error in hot list check trigger for manual post:', error);
            }
          });
        }
        
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
      console.log('Update post route called with:', { id: req.params.id, body: req.body, user: req.user });
      
      const { id } = req.params;
      const { title, content, excerpt, categoryId, retentionDays, attachments } = req.body;
      
      console.log('Parsed request data:', {
        id,
        title,
        content: content ? `${content.substring(0, 100)}...` : null,
        excerpt: excerpt ? `${excerpt.substring(0, 100)}...` : null,
        categoryId,
        categoryIdType: typeof categoryId,
        retentionDays,
        attachments: attachments ? `${attachments.length} items` : null
      });

      // Check if post exists
      console.log('Checking if post exists with ID:', id);
      const existingPost = await pool.query('SELECT * FROM posts WHERE id = $1', [id]);
      console.log('Existing post query result:', { rowCount: existingPost.rows.length, post: existingPost.rows[0] });
      
      if (existingPost.rows.length === 0) {
        console.log('Post not found, returning 404');
        return res.status(404).json({ error: 'Post not found' });
      }

      // Use standard pool.query with proper error handling
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

      if (categoryId !== undefined && categoryId !== null && categoryId !== '') {
        // Convert categoryId to integer if it's a valid number
        const categoryIdNum = parseInt(categoryId);
        if (isNaN(categoryIdNum)) {
          console.log('Invalid categoryId:', categoryId, 'type:', typeof categoryId);
          return res.status(400).json({ error: 'Invalid category ID format' });
        }
        
        console.log('Setting category_id to:', categoryIdNum);
        updateFields.push(`category_id = $${paramIndex}`);
        queryParams.push(categoryIdNum);
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

      // Update the post
      const result = await pool.query(`
        UPDATE posts 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `, queryParams);

      // Handle attachments if provided
      if (attachments !== undefined) {
        // Remove existing attachments
        await pool.query('DELETE FROM post_attachments WHERE post_id = $1', [id]);
        
        // Add new attachments if any
        if (attachments && attachments.length > 0) {
          for (const fileId of attachments) {
            if (fileId) {
              // Verify the file exists and belongs to the current user
              const fileCheck = await pool.query(
                'SELECT id FROM files WHERE id = $1 AND uploaded_by = $2',
                [fileId, req.user.id]
              );
              
              if (fileCheck.rows.length > 0) {
                await pool.query(
                  'INSERT INTO post_attachments (post_id, file_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                  [id, fileId]
                );
              }
            }
          }
        }
      }
      
      // Return the updated post
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