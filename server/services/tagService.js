const { pool } = require('../config/database');

class TagService {
  /**
   * Process and validate tags
   */
  static processTags(tags) {
    if (!tags || !Array.isArray(tags)) return [];
    
    return tags
      .map(tag => {
        // Ensure tag starts with # and is lowercase
        let processed = tag.trim().toLowerCase();
        if (!processed.startsWith('#')) {
          processed = '#' + processed;
        }
        // Remove invalid characters
        processed = processed.replace(/[^#a-z0-9_]/g, '');
        return processed;
      })
      .filter(tag => tag && tag !== '#' && tag.length <= 30)
      .slice(0, 10); // Max 10 tags per post
  }

  /**
   * Create or get tags and return their IDs
   */
  static async getOrCreateTags(tags, client = null) {
    const dbClient = client || await pool.connect();
    const tagIds = [];
    
    try {
      for (const tagName of tags) {
        const slug = tagName.replace('#', '');
        
        // Try to get existing tag
        let result = await dbClient.query(
          'SELECT id FROM tags WHERE name = $1',
          [tagName]
        );
        
        let tagId;
        if (result.rows.length === 0) {
          // Create new tag
          result = await dbClient.query(
            `INSERT INTO tags (name, slug, usage_count) 
             VALUES ($1, $2, 1) 
             RETURNING id`,
            [tagName, slug]
          );
          tagId = result.rows[0].id;
        } else {
          tagId = result.rows[0].id;
          // Increment usage count
          await dbClient.query(
            'UPDATE tags SET usage_count = usage_count + 1 WHERE id = $1',
            [tagId]
          );
        }
        
        tagIds.push(tagId);
      }
      
      return tagIds;
    } finally {
      if (!client) {
        dbClient.release();
      }
    }
  }

  /**
   * Associate tags with a post
   */
  static async associateTagsWithPost(postId, tagIds, client = null) {
    const dbClient = client || await pool.connect();
    
    try {
      // Remove existing associations
      await dbClient.query(
        'DELETE FROM post_tags WHERE post_id = $1',
        [postId]
      );
      
      // Add new associations
      for (const tagId of tagIds) {
        await dbClient.query(
          'INSERT INTO post_tags (post_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [postId, tagId]
        );
      }
      
      // Update tags array in posts table for quick access
      const tagsResult = await dbClient.query(
        `SELECT t.name 
         FROM tags t 
         JOIN post_tags pt ON t.id = pt.tag_id 
         WHERE pt.post_id = $1`,
        [postId]
      );
      
      const tagNames = tagsResult.rows.map(row => row.name);
      await dbClient.query(
        'UPDATE posts SET tags = $1 WHERE id = $2',
        [tagNames, postId]
      );
      
      return tagNames;
    } finally {
      if (!client) {
        dbClient.release();
      }
    }
  }

  /**
   * Get tags for a post
   */
  static async getPostTags(postId) {
    const result = await pool.query(
      `SELECT t.* 
       FROM tags t 
       JOIN post_tags pt ON t.id = pt.tag_id 
       WHERE pt.post_id = $1
       ORDER BY t.name`,
      [postId]
    );
    
    return result.rows.map(row => row.name);
  }

  /**
   * Get all tags with usage counts
   */
  static async getAllTags(limit = 50) {
    const result = await pool.query(
      `SELECT name, slug, usage_count 
       FROM tags 
       WHERE usage_count > 0
       ORDER BY usage_count DESC, name ASC 
       LIMIT $1`,
      [limit]
    );
    
    return result.rows;
  }

  /**
   * Get popular tags
   */
  static async getPopularTags(limit = 10) {
    const result = await pool.query(
      `SELECT name, slug, usage_count 
       FROM tags 
       WHERE usage_count > 0
       ORDER BY usage_count DESC 
       LIMIT $1`,
      [limit]
    );
    
    return result.rows;
  }

  /**
   * Search tags
   */
  static async searchTags(searchTerm, limit = 10) {
    const result = await pool.query(
      `SELECT name, slug, usage_count 
       FROM tags 
       WHERE name ILIKE $1 OR slug ILIKE $1
       ORDER BY usage_count DESC, name ASC 
       LIMIT $2`,
      [`%${searchTerm}%`, limit]
    );
    
    return result.rows;
  }

  /**
   * Get posts by tag
   */
  static async getPostsByTag(tagName, limit = 50, offset = 0) {
    const result = await pool.query(
      `SELECT p.*, 
              c.name as category_name, 
              c.slug as category_slug,
              COALESCE(p.tags, '{}') as tags
       FROM posts p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE $1 = ANY(p.tags)
       ORDER BY p.wp_modified_date DESC, p.wp_published_date DESC
       LIMIT $2 OFFSET $3`,
      [tagName, limit, offset]
    );
    
    return result.rows;
  }

  /**
   * Clean up unused tags
   */
  static async cleanupUnusedTags() {
    const result = await pool.query(
      `DELETE FROM tags 
       WHERE id NOT IN (SELECT DISTINCT tag_id FROM post_tags)
       RETURNING *`
    );
    
    return result.rows;
  }
}

module.exports = TagService;