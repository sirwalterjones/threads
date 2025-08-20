const axios = require('axios');
const { pool } = require('../config/database');

class WordPressService {
  constructor() {
    this.baseUrl = process.env.WORDPRESS_API_URL;
    this.retentionDays = process.env.DEFAULT_RETENTION_DAYS || 365;
    
    console.log('WordPress service config:', {
      baseUrl: this.baseUrl,
      hasApiUrl: !!process.env.WORDPRESS_API_URL,
      hasUsername: !!process.env.WORDPRESS_USERNAME,
      hasPassword: !!process.env.WORDPRESS_PASSWORD
    });
    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: parseInt(process.env.WP_TIMEOUT_MS || '60000'), // Increase to 60 seconds
      headers: {
        'User-Agent': process.env.WORDPRESS_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Safari/537.36',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    if (process.env.WORDPRESS_BASIC_USER && process.env.WORDPRESS_BASIC_PASS) {
      this.http.defaults.auth = {
        username: process.env.WORDPRESS_BASIC_USER,
        password: process.env.WORDPRESS_BASIC_PASS
      };
    }

    if (process.env.WORDPRESS_JWT_TOKEN) {
      this.http.defaults.headers.Authorization = `Bearer ${process.env.WORDPRESS_JWT_TOKEN}`;
    }
  }

  async ingestCategories() {
    try {
      console.log('Ingesting categories from WordPress...');
      let totalCategories = 0;
      let page = 1;
      let hasMorePages = true;
      const allCategories = [];

      while (hasMorePages) {
        const response = await this.http.get(`/categories`, {
          params: { per_page: 100, page }
        });
        const categories = response.data;

        for (const category of categories) {
          await pool.query(`
            INSERT INTO categories (wp_category_id, name, slug, parent_id, post_count)
            VALUES ($1, $2, $3, NULL, $4)
            ON CONFLICT (wp_category_id) 
            DO UPDATE SET 
              name = EXCLUDED.name,
              slug = EXCLUDED.slug,
              post_count = EXCLUDED.post_count,
              updated_at = NOW()
          `, [
            category.id,
            category.name,
            category.slug,
            category.count
          ]);
          allCategories.push({ id: category.id, parent: category.parent });
        }

        totalCategories += categories.length;
        const totalPages = parseInt(response.headers['x-wp-totalpages'] || 1);
        hasMorePages = page < totalPages;
        page++;
      }

      // After all categories exist, set parent relationships by mapping WP IDs to local IDs
      console.log('Linking category parent relationships...');
      let linkedCount = 0;
      for (const { id: wpCategoryId, parent: wpParentId } of allCategories) {
        if (!wpParentId) continue;
        const parentResult = await pool.query(
          'SELECT id FROM categories WHERE wp_category_id = $1',
          [wpParentId]
        );
        if (parentResult.rows.length > 0) {
          const parentLocalId = parentResult.rows[0].id;
          await pool.query(
            `UPDATE categories SET parent_id = $1, updated_at = NOW() WHERE wp_category_id = $2`,
            [parentLocalId, wpCategoryId]
          );
          linkedCount++;
        }
      }
      console.log(`Linked parent relationships for ${linkedCount} categories`);

      console.log(`Ingested ${totalCategories} categories`);
      return totalCategories;
    } catch (error) {
      console.error('Error ingesting categories:', error);
      throw error;
    }
  }

  async ingestPosts(page = 1, perPage = 100) {
    try {
      console.log(`Ingesting posts from WordPress (page ${page})...`);
      const response = await this.http.get(`/posts`, {
        params: {
          page,
          per_page: perPage,
          _embed: true
        }
      });

      const posts = response.data;
      let ingestedCount = 0;

      for (const post of posts) {
        const retentionDate = new Date();
        retentionDate.setDate(retentionDate.getDate() + parseInt(this.retentionDays));

        // Get category ID from our local database
        let categoryId = null;
        if (post.categories && post.categories.length > 0) {
          const categoryResult = await pool.query(
            'SELECT id FROM categories WHERE wp_category_id = $1',
            [post.categories[0]]
          );
          if (categoryResult.rows.length > 0) {
            categoryId = categoryResult.rows[0].id;
          }
        }

        // Extract author name from embedded data
        let authorName = 'Unknown';
        if (post._embedded && post._embedded.author && post._embedded.author[0]) {
          authorName = post._embedded.author[0].name;
        }

        await pool.query(`
          INSERT INTO posts (
            wp_post_id, title, content, excerpt, slug, status,
            wp_author_id, author_name, wp_published_date, wp_modified_date,
            retention_date, category_id, metadata
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (wp_post_id)
          DO UPDATE SET
            title = EXCLUDED.title,
            content = EXCLUDED.content,
            excerpt = EXCLUDED.excerpt,
            wp_modified_date = EXCLUDED.wp_modified_date,
            category_id = EXCLUDED.category_id,
            metadata = EXCLUDED.metadata
        `, [
          post.id,
          post.title.rendered,
          post.content.rendered,
          post.excerpt.rendered,
          post.slug,
          post.status,
          post.author,
          authorName,
          new Date(post.date),
          new Date(post.modified),
          retentionDate,
          categoryId,
          JSON.stringify({
            featured_media: post.featured_media,
            tags: post.tags,
            sticky: post.sticky,
            format: post.format
          })
        ]);

        ingestedCount++;
      }

      console.log(`Ingested ${ingestedCount} posts from page ${page}`);
      
      // Check if there are more pages
      const totalPages = parseInt(response.headers['x-wp-totalpages'] || 1);
      if (page < totalPages) {
        await this.ingestPosts(page + 1, perPage);
      }

      return ingestedCount;
    } catch (error) {
      console.error(`Error ingesting posts (page ${page}):`, error);
      throw error;
    }
  }

  async performFullIngestion() {
    try {
      console.log('Starting full WordPress data ingestion...');
      
      const categoriesCount = await this.ingestCategories();
      const postsCount = await this.ingestPosts();
      // Recalculate post counts per category after ingestion
      await pool.query(`
        UPDATE categories 
        SET post_count = (
          SELECT COUNT(*) FROM posts WHERE posts.category_id = categories.id
        ),
        updated_at = NOW()
      `);
      
      console.log(`Ingestion complete: ${categoriesCount} categories, ${postsCount} posts`);
      
      return {
        categories: categoriesCount,
        posts: postsCount,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Full ingestion failed:', error);
      throw error;
    }
  }

  async getLastSyncTimestamp() {
    try {
      // First check if posts table exists and has data
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'posts'
        );
      `);
      
      if (!tableCheck.rows[0].exists) {
        console.log('Posts table does not exist, using epoch date');
        return new Date(0);
      }
      
      const result = await pool.query(`
        SELECT MAX(wp_modified_date) as last_modified
        FROM posts 
        WHERE wp_modified_date IS NOT NULL
      `);
      
      const lastModified = result.rows[0]?.last_modified;
      if (!lastModified) {
        console.log('No posts with wp_modified_date found, using date from 7 days ago');
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return sevenDaysAgo;
      }
      
      console.log('Last sync timestamp found:', lastModified);
      return lastModified;
    } catch (error) {
      console.error('Error getting last sync timestamp:', error);
      console.log('Falling back to 7 days ago');
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return sevenDaysAgo;
    }
  }

  async ingestNewPosts(page = 1, perPage = 100, afterDate = null) {
    try {
      console.log(`Ingesting new/updated posts from WordPress (page ${page})...`);
      
      const params = {
        page,
        per_page: perPage,
        _embed: true,
        orderby: 'modified',
        order: 'desc'
      };

      // Only fetch posts modified after the last sync
      if (afterDate) {
        params.modified_after = afterDate.toISOString();
      }

      const response = await this.http.get(`/posts`, { params });
      const posts = response.data;
      let ingestedCount = 0;

      if (posts.length === 0) {
        console.log('No new posts to ingest');
        return 0;
      }

      for (const post of posts) {
        const retentionDate = new Date();
        retentionDate.setDate(retentionDate.getDate() + parseInt(this.retentionDays));

        // Get category ID from our local database
        let categoryId = null;
        if (post.categories && post.categories.length > 0) {
          const categoryResult = await pool.query(
            'SELECT id FROM categories WHERE wp_category_id = $1',
            [post.categories[0]]
          );
          if (categoryResult.rows.length > 0) {
            categoryId = categoryResult.rows[0].id;
          }
        }

        // Extract author name from embedded data
        let authorName = 'Unknown';
        if (post._embedded && post._embedded.author && post._embedded.author[0]) {
          authorName = post._embedded.author[0].name;
        }

        await pool.query(`
          INSERT INTO posts (
            wp_post_id, title, content, excerpt, slug, status,
            wp_author_id, author_name, wp_published_date, wp_modified_date,
            retention_date, category_id, metadata
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (wp_post_id)
          DO UPDATE SET
            title = EXCLUDED.title,
            content = EXCLUDED.content,
            excerpt = EXCLUDED.excerpt,
            wp_modified_date = EXCLUDED.wp_modified_date,
            category_id = EXCLUDED.category_id,
            metadata = EXCLUDED.metadata,
            updated_at = NOW()
        `, [
          post.id,
          post.title.rendered,
          post.content.rendered,
          post.excerpt.rendered,
          post.slug,
          post.status,
          post.author,
          authorName,
          new Date(post.date),
          new Date(post.modified),
          retentionDate,
          categoryId,
          JSON.stringify({
            featured_media: post.featured_media,
            tags: post.tags,
            sticky: post.sticky,
            format: post.format
          })
        ]);

        ingestedCount++;
      }

      console.log(`Ingested ${ingestedCount} new/updated posts from page ${page}`);
      
      // Check if there are more pages of new content
      const totalPages = parseInt(response.headers['x-wp-totalpages'] || 1);
      if (page < totalPages && posts.length === perPage) {
        const additionalCount = await this.ingestNewPosts(page + 1, perPage, afterDate);
        return ingestedCount + additionalCount;
      }

      return ingestedCount;
    } catch (error) {
      console.error(`Error ingesting new posts (page ${page}):`, error);
      throw error;
    }
  }

  async performIncrementalSync() {
    try {
      console.log('Starting incremental WordPress sync...');
      
      // Get timestamp of last modified post in our database
      const lastSyncTime = await this.getLastSyncTimestamp();
      console.log('Last sync timestamp:', lastSyncTime);

      // Fetch new categories first (quick)
      let categoriesCount = 0;
      try {
        categoriesCount = await this.ingestCategories();
        console.log(`Categories sync completed: ${categoriesCount} categories`);
      } catch (catError) {
        console.error('Categories sync failed, continuing with posts:', catError.message);
      }
      
      // Fetch only new/updated posts
      let newPostsCount = 0;
      try {
        newPostsCount = await this.ingestNewPosts(1, 100, lastSyncTime);
        console.log(`Posts sync completed: ${newPostsCount} new/updated posts`);
      } catch (postsError) {
        console.error('Posts sync failed:', postsError.message);
        throw postsError; // This is critical, so we throw
      }
      
      // Update category post counts if we got new posts
      if (newPostsCount > 0) {
        try {
          await pool.query(`
            UPDATE categories 
            SET post_count = (
              SELECT COUNT(*) FROM posts WHERE posts.category_id = categories.id
            ),
            updated_at = NOW()
          `);
          console.log('Category post counts updated');
        } catch (updateError) {
          console.error('Failed to update category counts:', updateError.message);
          // Not critical, continue
        }
      }
      
      console.log(`Incremental sync complete: ${categoriesCount} categories checked, ${newPostsCount} new/updated posts`);
      
      return {
        categories: categoriesCount,
        newPosts: newPostsCount,
        timestamp: new Date(),
        type: 'incremental',
        lastSyncTime: lastSyncTime
      };
    } catch (error) {
      console.error('Incremental sync failed:', error);
      console.error('Stack trace:', error.stack);
      throw error;
    }
  }

  async purgeExpiredData() {
    try {
      console.log('Purging expired data...');
      
      const result = await pool.query(`
        DELETE FROM posts 
        WHERE retention_date < NOW()
        RETURNING id, title
      `);

      console.log(`Purged ${result.rowCount} expired posts`);
      return result.rowCount;
    } catch (error) {
      console.error('Error purging expired data:', error);
      throw error;
    }
  }
}

module.exports = WordPressService;