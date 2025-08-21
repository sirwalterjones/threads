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
              post_count = EXCLUDED.post_count
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
            `UPDATE categories SET parent_id = $1 WHERE wp_category_id = $2`,
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
        )
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
            )
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

  async ingestDirectData(posts, categories) {
    let categoriesIngested = 0;
    let postsIngested = 0;
    const errors = [];
    
    try {
      console.log(`🔍 Starting direct data processing: ${posts.length} posts, ${categories.length} categories`);
      
      // Validate input data first
      if (!Array.isArray(posts)) {
        throw new Error('Posts data must be an array');
      }
      if (!Array.isArray(categories)) {
        throw new Error('Categories data must be an array');
      }
      
      console.log('✅ Input validation passed');
      
      // Process categories first with validation - handle parent relationships properly
      console.log('📂 Processing categories...');
      
      // First pass: Insert/update categories without parent relationships
      console.log('📂 First pass: Insert categories without parent relationships...');
      for (const [index, category] of categories.entries()) {
        try {
          // Validate required category fields
          if (!category.id || typeof category.id !== 'number') {
            throw new Error(`Category ${index}: Missing or invalid ID`);
          }
          if (!category.name || typeof category.name !== 'string') {
            throw new Error(`Category ${category.id}: Missing or invalid name`);
          }
          if (!category.slug || typeof category.slug !== 'string') {
            throw new Error(`Category ${category.id}: Missing or invalid slug`);
          }
          
          console.log(`📂 Processing category: ${category.id} - ${category.name}`);
          
          const result = await pool.query(`
            INSERT INTO categories (wp_category_id, name, slug, parent_id, post_count)
            VALUES ($1, $2, $3, NULL, $4)
            ON CONFLICT (wp_category_id)
            DO UPDATE SET
              name = EXCLUDED.name,
              slug = EXCLUDED.slug,
              post_count = EXCLUDED.post_count
            RETURNING id, wp_category_id
          `, [
            category.id,
            category.name.trim(),
            category.slug.trim(),
            parseInt(category.count) || 0
          ]);
          
          if (result.rowCount === 0) {
            throw new Error(`Category ${category.id}: Database insertion failed - no rows affected`);
          }
          
          console.log(`✅ Category processed: ${category.id} -> DB ID ${result.rows[0].id}`);
          categoriesIngested++;
        } catch (catError) {
          const errorMsg = `Category ${category.id}: ${catError.message}`;
          console.error(`❌ ${errorMsg}`);
          console.error('Category data:', JSON.stringify(category, null, 2));
          errors.push(errorMsg);
          // Don't throw here - continue processing other categories
        }
      }
      
      // Second pass: Update parent relationships now that all categories exist
      console.log('📂 Second pass: Setting up parent relationships...');
      let parentLinksSet = 0;
      for (const category of categories) {
        if (category.parent && category.parent !== 0) {
          try {
            console.log(`🔗 Setting parent ${category.parent} for category ${category.id}`);
            
            // Find the local ID of the parent category
            const parentResult = await pool.query(
              'SELECT id FROM categories WHERE wp_category_id = $1',
              [category.parent]
            );
            
            if (parentResult.rows.length > 0) {
              const parentLocalId = parentResult.rows[0].id;
              await pool.query(
                'UPDATE categories SET parent_id = $1 WHERE wp_category_id = $2',
                [parentLocalId, category.id]
              );
              parentLinksSet++;
              console.log(`✅ Parent relationship set: ${category.id} -> parent ${category.parent} (local ID ${parentLocalId})`);
            } else {
              console.warn(`⚠️ Parent category ${category.parent} not found for category ${category.id}`);
            }
          } catch (parentError) {
            const errorMsg = `Category ${category.id}: Parent relationship error - ${parentError.message}`;
            console.error(`❌ ${errorMsg}`);
            errors.push(errorMsg);
          }
        }
      }
      
      console.log(`📂 Parent relationships set: ${parentLinksSet}`);
      
      console.log(`📂 Categories processing complete: ${categoriesIngested}/${categories.length} processed`);
      
      // Process posts with validation
      console.log('📄 Processing posts...');
      for (const [index, post] of posts.entries()) {
        try {
          // Validate required post fields
          if (!post.id || typeof post.id !== 'number') {
            throw new Error(`Post ${index}: Missing or invalid ID`);
          }
          
          // Extract and validate title
          let title = '';
          if (post.title?.rendered) {
            title = post.title.rendered;
          } else if (typeof post.title === 'string') {
            title = post.title;
          } else {
            throw new Error(`Post ${post.id}: Missing or invalid title`);
          }
          
          // Extract and validate content
          let content = '';
          if (post.content?.rendered) {
            content = post.content.rendered;
          } else if (typeof post.content === 'string') {
            content = post.content;
          } else {
            console.warn(`Post ${post.id}: No content provided, using empty string`);
          }
          
          // Extract excerpt
          let excerpt = '';
          if (post.excerpt?.rendered) {
            excerpt = post.excerpt.rendered;
          } else if (typeof post.excerpt === 'string') {
            excerpt = post.excerpt;
          }
          
          // Validate other required fields
          if (!post.slug || typeof post.slug !== 'string') {
            throw new Error(`Post ${post.id}: Missing or invalid slug`);
          }
          if (!post.date) {
            throw new Error(`Post ${post.id}: Missing date`);
          }
          
          console.log(`📄 Processing post: ${post.id} - ${title.substring(0, 50)}...`);
          
          const retentionDate = new Date();
          retentionDate.setDate(retentionDate.getDate() + parseInt(this.retentionDays));

          // Get category ID from our local database
          let categoryId = null;
          if (post.categories && Array.isArray(post.categories) && post.categories.length > 0) {
            console.log(`🔍 Looking up category ${post.categories[0]} for post ${post.id}`);
            const categoryResult = await pool.query(
              'SELECT id FROM categories WHERE wp_category_id = $1',
              [post.categories[0]]
            );
            if (categoryResult.rows.length > 0) {
              categoryId = categoryResult.rows[0].id;
              console.log(`✅ Found category ID ${categoryId} for WP category ${post.categories[0]}`);
            } else {
              console.warn(`⚠️ Category ${post.categories[0]} not found in database`);
            }
          }

          // Validate and parse dates
          let publishedDate, modifiedDate;
          try {
            publishedDate = new Date(post.date);
            modifiedDate = new Date(post.modified || post.date);
            if (isNaN(publishedDate.getTime())) {
              throw new Error('Invalid published date');
            }
            if (isNaN(modifiedDate.getTime())) {
              throw new Error('Invalid modified date');
            }
          } catch (dateError) {
            throw new Error(`Post ${post.id}: Date parsing failed - ${dateError.message}`);
          }

          const result = await pool.query(`
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
            RETURNING id, wp_post_id
          `, [
            post.id,
            title.trim(),
            content,
            excerpt,
            post.slug.trim(),
            post.status || 'publish',
            post.author || 1,
            post.author_name || 'Unknown',
            publishedDate,
            modifiedDate,
            retentionDate,
            categoryId,
            JSON.stringify({
              featured_media: post.featured_media || 0,
              tags: post.tags || [],
              sticky: post.sticky || false,
              format: post.format || 'standard'
            })
          ]);

          if (result.rowCount === 0) {
            throw new Error(`Post ${post.id}: Database insertion failed - no rows affected`);
          }
          
          console.log(`✅ Post processed: ${post.id} -> DB ID ${result.rows[0].id}`);
          postsIngested++;
          
        } catch (postError) {
          const errorMsg = `Post ${post.id || index}: ${postError.message}`;
          console.error(`❌ ${errorMsg}`);
          console.error('Post data:', JSON.stringify(post, null, 2));
          console.error('Full error:', postError);
          errors.push(errorMsg);
          // Don't throw here - continue processing other posts
        }
      }
      
      console.log(`📄 Posts processing complete: ${postsIngested}/${posts.length} processed`);
      
      // Update category post counts
      if (postsIngested > 0) {
        console.log('🔄 Updating category post counts...');
        const updateResult = await pool.query(`
          UPDATE categories 
          SET post_count = (
            SELECT COUNT(*) FROM posts WHERE posts.category_id = categories.id
          )
        `);
        console.log(`✅ Updated post counts for ${updateResult.rowCount} categories`);
      }
      
      // Verify the data was actually inserted
      console.log('🔍 Verifying insertions...');
      const verifyResult = await pool.query('SELECT COUNT(*) as total FROM posts');
      const totalPosts = parseInt(verifyResult.rows[0].total);
      console.log(`📊 Total posts in database: ${totalPosts}`);
      
      const result = {
        categoriesIngested,
        postsIngested,
        totalPostsInDB: totalPosts,
        errors: errors.length > 0 ? errors : undefined,
        timestamp: new Date(),
        type: 'direct'
      };
      
      console.log(`🎉 Direct ingest complete: ${categoriesIngested} categories, ${postsIngested} posts processed`);
      
      if (errors.length > 0) {
        console.warn(`⚠️ ${errors.length} errors occurred during processing`);
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ Direct ingest failed:', error);
      console.error('❌ Stack trace:', error.stack);
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