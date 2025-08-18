const axios = require('axios');
const { pool } = require('../config/database');

class WordPressService {
  constructor() {
    // Normalize base URL to ensure it targets the WP REST v2 namespace
    const rawBase = (process.env.WORDPRESS_API_URL || '').replace(/\/$/, '');
    // If the provided base ends at /wp-json, append /wp/v2; otherwise use as-is
    this.baseUrl = rawBase.endsWith('/wp-json') ? `${rawBase}/wp/v2` : rawBase;
    this.retentionDays = process.env.DEFAULT_RETENTION_DAYS || 365;
    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: parseInt(process.env.WP_TIMEOUT_MS || '15000'),
      headers: {
        'User-Agent': process.env.WORDPRESS_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Safari/537.36',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        // Prefer site URL for Referer when available to avoid REST path mismatches
        'Referer': process.env.WORDPRESS_SITE_URL || this.baseUrl
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
    console.log('Ingesting categories from WordPress...');
    let totalCategories = 0;
    let page = 1;
    let hasMorePages = true;
    const allCategories = [];

    while (hasMorePages) {
      try {
        const response = await this.http.get(`/categories`, {
          params: {
            page,
            per_page: 100
          }
        });
        
        const categories = response.data;
        console.log(`Processing page ${page} with ${categories.length} categories`);

        for (const category of categories) {
          try {
            // Try to insert
            await pool.query(`
              INSERT INTO categories (wp_category_id, name, slug, parent_id, post_count)
              VALUES (?, ?, ?, NULL, ?)
            `, [
              category.id,
              category.name,
              category.slug,
              category.count
            ]);
          } catch (insertError) {
            // If it fails, try to update
            await pool.query(`
              UPDATE categories 
              SET name = ?, slug = ?, post_count = ?, updated_at = datetime('now')
              WHERE wp_category_id = ?
            `, [
              category.name,
              category.slug,
              category.count,
              category.id
            ]);
          }
          // Collect for parent mapping after all inserts/updates
          allCategories.push({ id: category.id, parent: category.parent });
        }

        totalCategories += categories.length;
        
        // Check if there are more pages
        const totalPages = parseInt(response.headers['x-wp-totalpages'] || 1);
        hasMorePages = page < totalPages;
        page++;

      } catch (error) {
        console.error(`Error ingesting categories page ${page}:`, error.response?.status || error.message);
        hasMorePages = false;
      }
    }

    console.log(`Ingested ${totalCategories} total categories`);
    
    // After ensuring all categories exist, map WordPress parent IDs to local category IDs
    console.log('Linking category parent relationships...');
    let linkedCount = 0;
    for (const { id: wpCategoryId, parent: wpParentId } of allCategories) {
      if (!wpParentId) continue;
      try {
        const parentResult = await pool.query(
          'SELECT id FROM categories WHERE wp_category_id = ?',
          [wpParentId]
        );
        if (parentResult.rows && parentResult.rows.length > 0) {
          const parentLocalId = parentResult.rows[0].id;
          await pool.query(
            `UPDATE categories 
             SET parent_id = ?, updated_at = datetime('now')
             WHERE wp_category_id = ?`,
            [parentLocalId, wpCategoryId]
          );
          linkedCount++;
        }
      } catch (e) {
        // Skip linking errors to avoid breaking ingestion
      }
    }
    console.log(`Linked parent relationships for ${linkedCount} categories`);
    return totalCategories;
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
            'SELECT id FROM categories WHERE wp_category_id = ?',
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

        // Extract featured media information
        let featuredMediaId = post.featured_media || null;
        let featuredMediaUrl = null;
        let attachments = [];

        // Get featured media URL if available
        if (post._embedded && post._embedded['wp:featuredmedia'] && post._embedded['wp:featuredmedia'][0]) {
          featuredMediaUrl = post._embedded['wp:featuredmedia'][0].source_url;
        }

        // Fetch actual media items attached to this post from WordPress
        try {
          const mediaResp = await this.http.get('/media', { params: { parent: post.id, per_page: 100 } });
          const mediaItems = Array.isArray(mediaResp.data) ? mediaResp.data : [];
          for (const media of mediaItems) {
            if (media && media.source_url) {
              attachments.push({
                url: media.source_url,
                mime_type: media.mime_type || null,
                title: media.title?.rendered || null
              });
            }
          }
        } catch (e) {
          // Ignore media fetch errors; fallback to content scraping below
        }

        // Fallback: extract attachments from content (images and common files)
        const foundUrls = new Set(attachments.map(a => (typeof a === 'string' ? a : a.url)));
        const imgRegex = /<img[^>]+src="([^">]+)"/g;
        let match;
        while ((match = imgRegex.exec(post.content.rendered)) !== null) {
          const url = match[1];
          if (!foundUrls.has(url)) {
            attachments.push({ url, mime_type: 'image/*', title: null });
            foundUrls.add(url);
          }
        }

        const linkRegex = /<a[^>]+href="([^">]+\.(?:jpg|jpeg|png|gif|bmp|pdf|doc|docx|txt|mp4|mov|webm|mp3|wav))"/gi;
        while ((match = linkRegex.exec(post.content.rendered)) !== null) {
          const url = match[1];
          if (!foundUrls.has(url)) {
            attachments.push({ url, mime_type: null, title: null });
            foundUrls.add(url);
          }
        }

        const makeExcerpt = (html) => {
          try {
            const text = String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            if (!text) return '';
            const max = 280;
            return text.length > max ? `${text.slice(0, max - 1)}…` : text;
          } catch { return ''; }
        };

        try {
          // Try to insert
          await pool.query(`
            INSERT INTO posts (
              wp_post_id, title, content, excerpt, slug, status,
              wp_author_id, author_name, wp_published_date, wp_modified_date,
              retention_date, category_id, featured_media_id, featured_media_url, 
              attachments, metadata
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            post.id,
            post.title.rendered,
            post.content.rendered,
            makeExcerpt(post.content.rendered || post.excerpt.rendered),
            post.slug,
            post.status,
            post.author,
            authorName,
            new Date(post.date).toISOString(),
            new Date(post.modified).toISOString(),
            retentionDate.toISOString().split('T')[0],
            categoryId,
            featuredMediaId,
            featuredMediaUrl,
            JSON.stringify(attachments),
            JSON.stringify({
              featured_media: post.featured_media,
              tags: post.tags,
              sticky: post.sticky,
              format: post.format
            })
          ]);
        } catch (insertError) {
          // If it fails, try to update
          await pool.query(`
            UPDATE posts SET
              title = ?, content = ?, excerpt = ?,
              wp_modified_date = ?, category_id = ?, featured_media_id = ?,
              featured_media_url = ?, attachments = ?, metadata = ?
            WHERE wp_post_id = ?
          `, [
            post.title.rendered,
            post.content.rendered,
            makeExcerpt(post.content.rendered || post.excerpt.rendered),
            new Date(post.modified).toISOString(),
            categoryId,
            featuredMediaId,
            featuredMediaUrl,
            JSON.stringify(attachments),
            JSON.stringify({
              featured_media: post.featured_media,
              tags: post.tags,
              sticky: post.sticky,
              format: post.format
            }),
            post.id
          ]);
        }

        ingestedCount++;
      }

      console.log(`Ingested ${ingestedCount} posts from page ${page}`);
      
      // Check if there are more pages
      const totalPages = parseInt(response.headers['x-wp-totalpages'] || 1);
      if (page < totalPages) { // Get ALL pages
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
      // Recalculate post counts per category after ingestion (SQLite)
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

  async purgeExpiredData() {
    try {
      console.log('Purging expired data...');
      
      const result = await pool.query(`
        DELETE FROM posts 
        WHERE retention_date < date('now')
      `);

      console.log(`Purged ${result.rowCount || 0} expired posts`);
      return result.rowCount || 0;
    } catch (error) {
      console.error('Error purging expired data:', error);
      throw error;
    }
  }
}

module.exports = WordPressService;