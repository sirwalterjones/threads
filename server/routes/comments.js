const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticateToken, authorizeRole, auditLog } = require('../middleware/auth');
const TagService = require('../services/tagService');

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

      // Process @ mentions and create notifications
      const mentions = extractMentions(content);
      if (mentions.length > 0) {
        await createMentionNotifications(mentions, comment.id, postId, userId);
      }
      
      // Extract hashtags from comment and add them to the post
      const hashtags = extractHashtags(content);
      if (hashtags.length > 0) {
        // Get current post tags
        const postResult = await pool.query('SELECT tags FROM posts WHERE id = $1', [postId]);
        const currentTags = postResult.rows[0].tags || [];
        
        // Combine with new hashtags (avoiding duplicates)
        const allTags = [...new Set([...currentTags, ...hashtags])];
        
        // Update post with new tags
        await pool.query('UPDATE posts SET tags = $1 WHERE id = $2', [allTags, postId]);
        
        // Also update normalized tags tables
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const processedTags = TagService.processTags(hashtags);
          if (processedTags.length > 0) {
            const tagIds = await TagService.getOrCreateTags(processedTags, client);
            await TagService.associateTagsWithPost(postId, tagIds, client);
          }
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          console.error('Error updating normalized tags:', error);
        } finally {
          client.release();
        }
      }
      
      res.status(201).json({ comment });
    } catch (error) {
      console.error('Error creating comment:', error);
      res.status(500).json({ error: 'Failed to create comment' });
    }
  }
);

// Helper function to extract @ mentions from comment content
function extractMentions(content) {
  const mentionRegex = /@(\w+)/g;
  const mentions = [];
  let match;
  
  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push(match[1].toLowerCase());
  }
  
  return [...new Set(mentions)]; // Remove duplicates
}

// Helper function to extract hashtags from comment content
function extractHashtags(content) {
  const hashtagRegex = /#(\w+)/g;
  const hashtags = [];
  let match;
  
  while ((match = hashtagRegex.exec(content)) !== null) {
    hashtags.push('#' + match[1].toLowerCase());
  }
  
  return [...new Set(hashtags)]; // Remove duplicates
}

// Helper function to create notifications for @ mentions
async function createMentionNotifications(usernames, commentId, postId, fromUserId) {
  try {
    // Get user IDs for mentioned usernames
    const userResult = await pool.query(`
      SELECT id, username FROM users 
      WHERE LOWER(username) = ANY($1) AND id != $2
    `, [usernames, fromUserId]);

    // Create notifications for each mentioned user
    for (const user of userResult.rows) {
      await pool.query(`
        INSERT INTO notifications (user_id, type, title, message, data, related_post_id, related_comment_id, from_user_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        user.id,
        'mention',
        'You were mentioned in a comment',
        `@${user.username} was mentioned in a comment`,
        { commentId, postId },
        postId,
        commentId,
        fromUserId
      ]);
    }
  } catch (error) {
    console.error('Error creating mention notifications:', error);
  }
}

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
        SELECT user_id, post_id FROM comments WHERE id = $1
      `, [id]);
      
      if (commentCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Comment not found' });
      }
      
      const commentUserId = commentCheck.rows[0].user_id;
      const postId = commentCheck.rows[0].post_id;
      
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
      
      // Extract hashtags from updated comment and add them to the post
      const hashtags = extractHashtags(content);
      if (hashtags.length > 0) {
        // Get current post tags
        const postResult = await pool.query('SELECT tags FROM posts WHERE id = $1', [postId]);
        const currentTags = postResult.rows[0].tags || [];
        
        // Combine with new hashtags (avoiding duplicates)
        const allTags = [...new Set([...currentTags, ...hashtags])];
        
        // Update post with new tags
        await pool.query('UPDATE posts SET tags = $1 WHERE id = $2', [allTags, postId]);
        
        // Also update normalized tags tables
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const processedTags = TagService.processTags(hashtags);
          if (processedTags.length > 0) {
            const tagIds = await TagService.getOrCreateTags(processedTags, client);
            await TagService.associateTagsWithPost(postId, tagIds, client);
          }
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          console.error('Error updating normalized tags:', error);
        } finally {
          client.release();
        }
      }
      
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
        SELECT user_id, content, post_id FROM comments WHERE id = $1
      `, [id]);
      
      if (commentCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Comment not found' });
      }
      
      const { user_id: commentUserId, content, post_id: postId } = commentCheck.rows[0];
      if (commentUserId !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'You can only delete your own comments' });
      }
      
      // Extract hashtags from the comment that will be deleted
      const deletedTags = extractHashtags(content);
      console.log('Deleting comment with tags:', deletedTags);
      
      if (deletedTags.length > 0 && postId) {
        // Get current post tags
        const postResult = await pool.query('SELECT tags FROM posts WHERE id = $1', [postId]);
        
        if (postResult.rows.length > 0) {
          const currentTags = postResult.rows[0].tags || [];
          
          // Get all other comments for this post to check if tags are still used
          const otherCommentsResult = await pool.query(`
            SELECT content FROM comments 
            WHERE post_id = $1 AND id != $2
          `, [postId, id]);
          
          // Collect all hashtags from remaining comments
          const remainingTags = new Set();
          otherCommentsResult.rows.forEach(row => {
            const tags = extractHashtags(row.content);
            tags.forEach(tag => remainingTags.add(tag.toLowerCase()));
          });
          
          // Filter out tags that no longer exist in any remaining comment
          const updatedTags = currentTags.filter(tag => {
            const tagLower = tag.toLowerCase();
            // Check if this tag was in the deleted comment
            const wasInDeletedComment = deletedTags.some(dt => dt.toLowerCase() === tagLower);
            
            // If it wasn't in the deleted comment, keep it
            if (!wasInDeletedComment) {
              return true;
            }
            
            // If it was in the deleted comment, only keep it if it's still in other comments
            return remainingTags.has(tagLower);
          });
          
          // Update post tags if they changed
          if (updatedTags.length !== currentTags.length) {
            console.log('Current tags:', currentTags);
            console.log('Remaining tags from comments:', Array.from(remainingTags));
            console.log('Updated tags:', updatedTags);
            
            await pool.query(`
              UPDATE posts 
              SET tags = $1 
              WHERE id = $2
            `, [updatedTags.length > 0 ? updatedTags : null, postId]);
            
            // Also update normalized tags
            const client = await pool.connect();
            try {
              await client.query('BEGIN');
              
              // Remove tag associations that are no longer needed
              const tagsToRemove = currentTags.filter(tag => !updatedTags.includes(tag));
              if (tagsToRemove.length > 0) {
                await client.query(`
                  DELETE FROM post_tags 
                  WHERE post_id = $1 AND tag_id IN (
                    SELECT id FROM tags WHERE name = ANY($2)
                  )
                `, [postId, tagsToRemove.map(t => t.replace('#', '').toLowerCase())]);
              }
              
              await client.query('COMMIT');
            } catch (error) {
              await client.query('ROLLBACK');
              console.error('Error updating normalized tags:', error);
            } finally {
              client.release();
            }
          }
        }
      }
      
      // Delete the comment
      await pool.query('DELETE FROM comments WHERE id = $1', [id]);
      
      res.json({ message: 'Comment deleted successfully' });
    } catch (error) {
      console.error('Error deleting comment:', error);
      res.status(500).json({ error: 'Failed to delete comment' });
    }
  }
);

module.exports = router;
