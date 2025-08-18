const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken, authorizeRole, auditLog } = require('../middleware/auth');
const router = express.Router();

// Get categories (supports all or filtered)
router.get('/', 
  authenticateToken, 
  authorizeRole(['view', 'edit', 'admin']), 
  async (req, res) => {
    try {
      const { all } = req.query;

      const baseSelect = `
        SELECT 
          c.id, c.name, c.slug, c.post_count, c.created_at,
          p.name as parent_name,
          CASE WHEN EXISTS(SELECT 1 FROM categories child WHERE child.parent_id = c.id) 
               THEN 1 ELSE 0 END as has_children
        FROM categories c
        LEFT JOIN categories p ON c.parent_id = p.id
      `;

      const filteredWhere = `
        WHERE (
          (NOT EXISTS(SELECT 1 FROM categories child WHERE child.parent_id = c.id)) 
          OR (c.parent_id IS NULL AND c.post_count > 0 AND NOT EXISTS(SELECT 1 FROM categories child WHERE child.parent_id = c.id))
        )
        AND c.post_count > 0
      `;

      const orderBy = `ORDER BY COALESCE(p.name, c.name), c.name`;

      const sql = all ? `${baseSelect} ${orderBy}` : `${baseSelect} ${filteredWhere} ${orderBy}`;
      const result = await pool.query(sql);

      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ error: 'Failed to fetch categories' });
    }
  }
);

// Get category with posts count
router.get('/:id', 
  authenticateToken, 
  authorizeRole(['view', 'edit', 'admin']), 
  async (req, res) => {
    try {
      const { id } = req.params;
      
      const categoryResult = await pool.query(`
        SELECT 
          c.id, c.name, c.slug, c.post_count, c.created_at,
          p.name as parent_name
        FROM categories c
        LEFT JOIN categories p ON c.parent_id = p.id
        WHERE c.id = $1
      `, [id]);

      if (categoryResult.rows.length === 0) {
        return res.status(404).json({ error: 'Category not found' });
      }

      const category = categoryResult.rows[0];

      // Get actual post count
      const postCountResult = await pool.query(
        'SELECT COUNT(*) as actual_count FROM posts WHERE category_id = $1',
        [id]
      );

      category.actual_post_count = parseInt(postCountResult.rows[0].actual_count);

      res.json(category);
    } catch (error) {
      console.error('Error fetching category:', error);
      res.status(500).json({ error: 'Failed to fetch category' });
    }
  }
);

// Create new category
router.post('/', 
  authenticateToken, 
  authorizeRole(['edit', 'admin']), 
  auditLog('create_category', 'categories'),
  async (req, res) => {
    try {
      const { name, slug, parentId } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Category name is required' });
      }

      // Generate slug if not provided
      const categorySlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      // Check if slug already exists
      const existingCategory = await pool.query(
        'SELECT id FROM categories WHERE slug = $1',
        [categorySlug]
      );

      if (existingCategory.rows.length > 0) {
        return res.status(409).json({ error: 'Category slug already exists' });
      }

      // Validate parent category if provided
      if (parentId) {
        const parentResult = await pool.query(
          'SELECT id FROM categories WHERE id = $1',
          [parentId]
        );

        if (parentResult.rows.length === 0) {
          return res.status(400).json({ error: 'Parent category not found' });
        }
      }

      const result = await pool.query(`
        INSERT INTO categories (name, slug, parent_id)
        VALUES ($1, $2, $3)
        RETURNING *
      `, [name, categorySlug, parentId || null]);

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error creating category:', error);
      res.status(500).json({ error: 'Failed to create category' });
    }
  }
);

// Update category
router.put('/:id', 
  authenticateToken, 
  authorizeRole(['edit', 'admin']), 
  auditLog('update_category', 'categories'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { name, slug, parentId } = req.body;

      // Check if category exists
      const existingCategory = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);
      if (existingCategory.rows.length === 0) {
        return res.status(404).json({ error: 'Category not found' });
      }

      const updateFields = [];
      const queryParams = [];
      let paramIndex = 1;

      if (name) {
        updateFields.push(`name = $${paramIndex}`);
        queryParams.push(name);
        paramIndex++;
      }

      if (slug) {
        // Check if new slug conflicts with existing categories
        const slugCheck = await pool.query(
          'SELECT id FROM categories WHERE slug = $1 AND id != $2',
          [slug, id]
        );

        if (slugCheck.rows.length > 0) {
          return res.status(409).json({ error: 'Category slug already exists' });
        }

        updateFields.push(`slug = $${paramIndex}`);
        queryParams.push(slug);
        paramIndex++;
      }

      if (parentId !== undefined) {
        if (parentId && parseInt(parentId) === parseInt(id)) {
          return res.status(400).json({ error: 'Category cannot be its own parent' });
        }

        if (parentId) {
          const parentResult = await pool.query(
            'SELECT id FROM categories WHERE id = $1',
            [parentId]
          );

          if (parentResult.rows.length === 0) {
            return res.status(400).json({ error: 'Parent category not found' });
          }
        }

        updateFields.push(`parent_id = $${paramIndex}`);
        queryParams.push(parentId || null);
        paramIndex++;
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      updateFields.push(`updated_at = NOW()`);
      queryParams.push(id);

      const result = await pool.query(`
        UPDATE categories 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `, queryParams);

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating category:', error);
      res.status(500).json({ error: 'Failed to update category' });
    }
  }
);

// Delete category
router.delete('/:id', 
  authenticateToken, 
  authorizeRole(['admin']), 
  auditLog('delete_category', 'categories'),
  async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if category has posts
      const postCountResult = await pool.query(
        'SELECT COUNT(*) as count FROM posts WHERE category_id = $1',
        [id]
      );

      const postCount = parseInt(postCountResult.rows[0].count);
      
      if (postCount > 0) {
        return res.status(400).json({ 
          error: 'Cannot delete category with existing posts',
          postCount 
        });
      }

      // Check if category has child categories
      const childCountResult = await pool.query(
        'SELECT COUNT(*) as count FROM categories WHERE parent_id = $1',
        [id]
      );

      const childCount = parseInt(childCountResult.rows[0].count);
      
      if (childCount > 0) {
        return res.status(400).json({ 
          error: 'Cannot delete category with child categories',
          childCount 
        });
      }

      const result = await pool.query('DELETE FROM categories WHERE id = $1 RETURNING *', [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Category not found' });
      }

      res.json({ message: 'Category deleted successfully' });
    } catch (error) {
      console.error('Error deleting category:', error);
      res.status(500).json({ error: 'Failed to delete category' });
    }
  }
);

// Update post counts for all categories
router.post('/update-counts', 
  authenticateToken, 
  authorizeRole(['admin']), 
  async (req, res) => {
    try {
      await pool.query(`
        UPDATE categories 
        SET post_count = (
          SELECT COUNT(*) 
          FROM posts 
          WHERE posts.category_id = categories.id
        )
      `);

      const result = await pool.query('SELECT SUM(post_count) as total FROM categories');
      const totalUpdated = parseInt(result.rows[0].total || 0);

      res.json({ 
        message: 'Category post counts updated successfully',
        totalPosts: totalUpdated
      });
    } catch (error) {
      console.error('Error updating category counts:', error);
      res.status(500).json({ error: 'Failed to update category counts' });
    }
  }
);

module.exports = router;