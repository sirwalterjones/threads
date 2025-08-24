const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// Get all hot lists for the current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, search_term, is_active, exact_match, created_at, updated_at 
       FROM hot_lists 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json({ hotLists: result.rows });
  } catch (error) {
    console.error('Error fetching hot lists:', error);
    res.status(500).json({ error: 'Failed to fetch hot lists' });
  }
});

// Create a new hot list
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { searchTerm } = req.body;

    if (!searchTerm || searchTerm.trim().length === 0) {
      return res.status(400).json({ error: 'Search term is required' });
    }

    const { exactMatch = false } = req.body;
    
    const result = await pool.query(
      `INSERT INTO hot_lists (user_id, search_term, is_active, exact_match, created_at, updated_at)
       VALUES ($1, $2, true, $3, NOW(), NOW())
       RETURNING id, search_term, is_active, exact_match, created_at, updated_at`,
      [req.user.id, searchTerm.trim(), exactMatch]
    );

    res.status(201).json({ hotList: result.rows[0] });
  } catch (error) {
    console.error('Error creating hot list:', error);
    if (error.code === '23505') { // Duplicate key error
      res.status(409).json({ error: 'Hot list with this search term already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create hot list' });
    }
  }
});

// Update a hot list
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { searchTerm, isActive, exactMatch } = req.body;

    // Verify ownership
    const ownershipCheck = await pool.query(
      'SELECT user_id FROM hot_lists WHERE id = $1',
      [id]
    );

    if (ownershipCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Hot list not found' });
    }

    if (ownershipCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let updateFields = [];
    let updateValues = [];
    let paramCount = 1;

    if (searchTerm !== undefined) {
      if (!searchTerm || searchTerm.trim().length === 0) {
        return res.status(400).json({ error: 'Search term cannot be empty' });
      }
      updateFields.push(`search_term = $${paramCount++}`);
      updateValues.push(searchTerm.trim());
    }

    if (isActive !== undefined) {
      updateFields.push(`is_active = $${paramCount++}`);
      updateValues.push(isActive);
    }

    if (exactMatch !== undefined) {
      updateFields.push(`exact_match = $${paramCount++}`);
      updateValues.push(exactMatch);
    }

    updateFields.push(`updated_at = NOW()`);
    updateValues.push(id);

    const result = await pool.query(
      `UPDATE hot_lists 
       SET ${updateFields.join(', ')}
       WHERE id = $${paramCount}
       RETURNING id, search_term, is_active, exact_match, created_at, updated_at`,
      updateValues
    );

    res.json({ hotList: result.rows[0] });
  } catch (error) {
    console.error('Error updating hot list:', error);
    res.status(500).json({ error: 'Failed to update hot list' });
  }
});

// Delete a hot list
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const ownershipCheck = await pool.query(
      'SELECT user_id FROM hot_lists WHERE id = $1',
      [id]
    );

    if (ownershipCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Hot list not found' });
    }

    if (ownershipCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await pool.query('DELETE FROM hot_lists WHERE id = $1', [id]);
    res.json({ message: 'Hot list deleted successfully' });
  } catch (error) {
    console.error('Error deleting hot list:', error);
    res.status(500).json({ error: 'Failed to delete hot list' });
  }
});

// Get hot list alerts for the current user
router.get('/alerts', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE hl.user_id = $1';
    let params = [req.user.id];
    
    if (unreadOnly === 'true') {
      whereClause += ' AND hla.is_read = false';
    }

    const result = await pool.query(
      `SELECT 
        hla.id,
        hla.hot_list_id,
        hla.post_id,
        hla.is_read,
        hla.highlighted_content,
        hla.created_at,
        hl.search_term,
        p.title as post_title,
        p.author_name,
        p.wp_published_date
       FROM hot_list_alerts hla
       JOIN hot_lists hl ON hla.hot_list_id = hl.id
       JOIN posts p ON hla.post_id = p.id
       ${whereClause}
       ORDER BY hla.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total
       FROM hot_list_alerts hla
       JOIN hot_lists hl ON hla.hot_list_id = hl.id
       ${whereClause}`,
      params
    );

    res.json({
      alerts: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total)
      }
    });
  } catch (error) {
    console.error('Error fetching hot list alerts:', error);
    res.status(500).json({ error: 'Failed to fetch hot list alerts' });
  }
});

// Mark hot list alert as read
router.put('/alerts/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership through hot_list
    const ownershipCheck = await pool.query(
      `SELECT hl.user_id 
       FROM hot_list_alerts hla
       JOIN hot_lists hl ON hla.hot_list_id = hl.id
       WHERE hla.id = $1`,
      [id]
    );

    if (ownershipCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    if (ownershipCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await pool.query(
      'UPDATE hot_list_alerts SET is_read = true WHERE id = $1',
      [id]
    );

    res.json({ message: 'Alert marked as read' });
  } catch (error) {
    console.error('Error marking alert as read:', error);
    res.status(500).json({ error: 'Failed to mark alert as read' });
  }
});

// Mark all hot list alerts as read for user
router.put('/alerts/read-all', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      `UPDATE hot_list_alerts SET is_read = true 
       WHERE hot_list_id IN (
         SELECT id FROM hot_lists WHERE user_id = $1
       )`,
      [req.user.id]
    );

    res.json({ message: 'All alerts marked as read' });
  } catch (error) {
    console.error('Error marking all alerts as read:', error);
    res.status(500).json({ error: 'Failed to mark all alerts as read' });
  }
});

// Get unread hot list alert count for user
router.get('/alerts/unread-count', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) as count
       FROM hot_list_alerts hla
       JOIN hot_lists hl ON hla.hot_list_id = hl.id
       WHERE hl.user_id = $1 AND hla.is_read = false`,
      [req.user.id]
    );

    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('Error getting unread alert count:', error);
    res.status(500).json({ error: 'Failed to get unread alert count' });
  }
});

// Check existing posts against a hot list search term
router.post('/check-existing', authenticateToken, async (req, res) => {
  try {
    const { searchTerm, hotListId } = req.body;

    if (!searchTerm || searchTerm.trim().length === 0) {
      return res.status(400).json({ error: 'Search term is required' });
    }

    // If hotListId is provided, verify ownership
    if (hotListId) {
      const ownershipCheck = await pool.query(
        'SELECT user_id FROM hot_lists WHERE id = $1',
        [hotListId]
      );

      if (ownershipCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Hot list not found' });
      }

      if (ownershipCheck.rows[0].user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    console.log(`🔍 Checking existing posts for search term: "${searchTerm}" by user: ${req.user.username}`);

    const searchTermLower = searchTerm.toLowerCase();
    
    // Check if this is an exact match search (for existing posts check)
    const { exactMatch = false } = req.body;
    
    let searchConditions = [];
    let searchParams = [];
    let paramCount = 1;
    
    if (exactMatch) {
      // Exact phrase search - look for the exact search term
      searchConditions.push(`LOWER(title || ' ' || COALESCE(content, '') || ' ' || COALESCE(excerpt, '')) LIKE $${paramCount}`);
      searchParams.push(`%${searchTermLower}%`);
      paramCount++;
    } else {
      // Word-based search - split search term into individual words
      const searchWords = searchTermLower.split(/\s+/).filter(word => word.length > 0);
      
      if (searchWords.length === 1) {
        // Single word search - use simple LIKE
        searchConditions.push(`LOWER(title || ' ' || COALESCE(content, '') || ' ' || COALESCE(excerpt, '')) LIKE $${paramCount}`);
        searchParams.push(`%${searchWords[0]}%`);
        paramCount++;
      } else {
        // Multiple word search - each word must be found somewhere in the content
        searchWords.forEach(word => {
          searchConditions.push(`LOWER(title || ' ' || COALESCE(content, '') || ' ' || COALESCE(excerpt, '')) LIKE $${paramCount}`);
          searchParams.push(`%${word}%`);
          paramCount++;
        });
      }
    }
    
    // Find all posts that match the search term(s)
    const matchingPostsResult = await pool.query(`
      SELECT id, title, content, excerpt, author_name, wp_published_date, ingested_at
      FROM posts
      WHERE ${searchConditions.join(' AND ')}
      ORDER BY wp_published_date DESC
      LIMIT 100
    `, searchParams);

    let alertsCreated = 0;

    if (hotListId && matchingPostsResult.rows.length > 0) {
      // Create alerts for existing posts
      for (const post of matchingPostsResult.rows) {
        // Check if we already have an alert for this combination
        const existingAlert = await pool.query(`
          SELECT id FROM hot_list_alerts
          WHERE hot_list_id = $1 AND post_id = $2
        `, [hotListId, post.id]);
        
        if (existingAlert.rows.length === 0) {
          const searchableContent = `${post.title} ${post.content || ''} ${post.excerpt || ''}`.toLowerCase();
          const highlightedContent = createHighlightedContent(searchableContent, searchTermLower, post.title);
          
          await pool.query(`
            INSERT INTO hot_list_alerts (hot_list_id, post_id, highlighted_content, created_at, is_read)
            VALUES ($1, $2, $3, NOW(), false)
          `, [hotListId, post.id, highlightedContent]);
          
          alertsCreated++;
        }
      }
    }

    res.json({
      message: `Found ${matchingPostsResult.rows.length} existing posts matching "${searchTerm}"`,
      matchingPosts: matchingPostsResult.rows.length,
      alertsCreated: alertsCreated,
      posts: matchingPostsResult.rows.slice(0, 10) // Return first 10 for preview
    });

  } catch (error) {
    console.error('Error checking existing posts:', error);
    res.status(500).json({ error: 'Failed to check existing posts' });
  }
});

// Clear all hot list alerts for user
router.delete('/alerts', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      DELETE FROM hot_list_alerts 
      WHERE hot_list_id IN (
        SELECT id FROM hot_lists WHERE user_id = $1
      )
    `, [req.user.id]);

    res.json({ 
      message: 'All hot list alerts cleared successfully',
      deletedCount: result.rowCount 
    });
  } catch (error) {
    console.error('Error clearing hot list alerts:', error);
    res.status(500).json({ error: 'Failed to clear hot list alerts' });
  }
});

// Manual trigger for hot list check (admin only)
router.post('/check-now', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    // Get the global cron service and trigger hot list check
    const cronService = global.cronService;
    if (cronService && typeof cronService.performHotListCheck === 'function') {
      console.log('🔥 Manual hot list check triggered by user:', req.user.username);
      await cronService.performHotListCheck();
      res.json({ message: 'Hot list check completed successfully' });
    } else {
      res.status(500).json({ error: 'Hot list check service not available' });
    }
  } catch (error) {
    console.error('Error in manual hot list check:', error);
    res.status(500).json({ error: 'Failed to perform hot list check' });
  }
});

// Helper function to create highlighted content
function createHighlightedContent(content, searchTerm, title) {
  const searchTermLower = searchTerm.toLowerCase();
  const contentLower = content.toLowerCase();
  
  // Split search term into individual words
  const searchWords = searchTermLower.split(/\s+/).filter(word => word.length > 0);
  
  if (searchWords.length === 1) {
    // Single word search
    const termIndex = contentLower.indexOf(searchWords[0]);
    if (termIndex === -1) return title;
    
    // Get context around the term (50 characters before and after)
    const start = Math.max(0, termIndex - 50);
    const end = Math.min(content.length, termIndex + searchWords[0].length + 50);
    
    let snippet = content.substring(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';
    
    return snippet;
  } else {
    // Multiple word search - find the first occurrence of any word
    let firstTermIndex = -1;
    let firstTerm = '';
    
    for (const word of searchWords) {
      const index = contentLower.indexOf(word);
      if (index !== -1 && (firstTermIndex === -1 || index < firstTermIndex)) {
        firstTermIndex = index;
        firstTerm = word;
      }
    }
    
    if (firstTermIndex === -1) return title;
    
    // Get context around the first found term (50 characters before and after)
    const start = Math.max(0, firstTermIndex - 50);
    const end = Math.min(content.length, firstTermIndex + firstTerm.length + 50);
    
    let snippet = content.substring(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';
    
    return snippet;
  }
}

module.exports = router;