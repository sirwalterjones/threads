const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticateToken, authorizeRole, auditLog } = require('../middleware/auth');

// Get comments for a post
router.get('/post/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    
    const result = await pool.query(`
      SELECT 
        c.id, c.content, c.created_at, c.updated_at, c.is_edited,
        u.username, u.role
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.post_id = $1
      ORDER BY c.created_at ASC
    `, [postId]);
    
    res.json({ comments: result.rows });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// Create a new comment
router.post('/', 
  authenticateToken, 
  authorizeRole(['view', 'edit', 'admin']),
  auditLog('create_comment', 'comments'),
  async (req, res) => {
    try {
      const { postId, content } = req.body;
      const userId = req.user.id;
      
      if (!content || !content.trim()) {
        return res.status(400).json({ error: 'Comment content is required' });
      }
      
      if (!postId) {
        return res.status(400).json({ error: 'Post ID is required' });
      }
      
      // Verify the post exists
      const postCheck = await pool.query('SELECT id FROM posts WHERE id = $1', [postId]);
      if (postCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Post not found' });
      }
      
      const result = await pool.query(`
        INSERT INTO comments (post_id, user_id, content)
        VALUES ($1, $2, $3)
        RETURNING id, content, created_at, updated_at, is_edited
      `, [postId, userId, content.trim()]);
      
      // Get user info for the response
      const userResult = await pool.query('SELECT username, role FROM users WHERE id = $1', [userId]);
      
      const comment = {
        ...result.rows[0],
        username: userResult.rows[0].username,
        role: userResult.rows[0].role
      };
      
      res.status(201).json({ comment });
    } catch (error) {
      console.error('Error creating comment:', error);
      res.status(500).json({ error: 'Failed to create comment' });
    }
  }
);

// Update a comment
router.put('/:id', 
  authenticateToken, 
  authorizeRole(['view', 'edit', 'admin']),
  auditLog('update_comment', 'comments'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { content } = req.body;
      const userId = req.user.id;
      
      if (!content || !content.trim()) {
        return res.status(400).json({ error: 'Comment content is required' });
      }
      
      // Check if comment exists and user owns it (or is admin)
      const commentCheck = await pool.query(`
        SELECT user_id FROM comments WHERE id = $1
      `, [id]);
      
      if (commentCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Comment not found' });
      }
      
      const commentUserId = commentCheck.rows[0].user_id;
      if (commentUserId !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'You can only edit your own comments' });
      }
      
      const result = await pool.query(`
        UPDATE comments 
        SET content = $1, updated_at = NOW(), is_edited = true
        WHERE id = $2
        RETURNING id, content, created_at, updated_at, is_edited
      `, [content.trim(), id]);
      
      // Get user info for the response
      const userResult = await pool.query('SELECT username, role FROM users WHERE id = $1', [commentUserId]);
      
      const comment = {
        ...result.rows[0],
        username: userResult.rows[0].username,
        role: userResult.rows[0].role
      };
      
      res.json({ comment });
    } catch (error) {
      console.error('Error updating comment:', error);
      res.status(500).json({ error: 'Failed to update comment' });
    }
  }
);

// Delete a comment
router.delete('/:id', 
  authenticateToken, 
  authorizeRole(['view', 'edit', 'admin']),
  auditLog('delete_comment', 'comments'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      // Check if comment exists and user owns it (or is admin)
      const commentCheck = await pool.query(`
        SELECT user_id FROM comments WHERE id = $1
      `, [id]);
      
      if (commentCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Comment not found' });
      }
      
      const commentUserId = commentCheck.rows[0].user_id;
      if (commentUserId !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'You can only delete your own comments' });
      }
      
      await pool.query('DELETE FROM comments WHERE id = $1', [id]);
      
      res.json({ message: 'Comment deleted successfully' });
    } catch (error) {
      console.error('Error deleting comment:', error);
      res.status(500).json({ error: 'Failed to delete comment' });
    }
  }
);

module.exports = router;
