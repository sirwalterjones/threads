require('dotenv').config();

// Use PostgreSQL for production (Vercel), SQLite for local development only
const USE_SQLITE = process.env.NODE_ENV !== 'production' && !process.env.DB_PASSWORD && !process.env.VERCEL;

let pool, initializeDatabase;

if (USE_SQLITE) {
  console.log('Using SQLite for local development');
  const sqlite = require('./database-sqlite');
  pool = sqlite.pool;
  initializeDatabase = sqlite.initializeDatabase;
} else {
  console.log('Using PostgreSQL for production');
  const { Pool } = require('pg');
  
  // Try DATABASE_URL first, then individual env vars
  const connectionConfig = process.env.DATABASE_URL ? {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  } : {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'threads_intel',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  };

  pool = new Pool(connectionConfig);
  
  console.log('PostgreSQL connection config:', {
    usingDatabaseUrl: !!process.env.DATABASE_URL,
    hasHost: !!process.env.DB_HOST,
    hasPassword: !!process.env.DB_PASSWORD,
    nodeEnv: process.env.NODE_ENV
  });

  initializeDatabase = async () => {
    try {
      // Users table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(20) DEFAULT 'view' CHECK (role IN ('admin', 'edit', 'view')),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          last_login TIMESTAMP,
          is_active BOOLEAN DEFAULT true
        )
      `);

      // Categories table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS categories (
          id SERIAL PRIMARY KEY,
          wp_category_id INTEGER UNIQUE,
          name VARCHAR(200) NOT NULL,
          slug VARCHAR(200) NOT NULL,
          parent_id INTEGER REFERENCES categories(id),
          post_count INTEGER DEFAULT 0,
          is_hidden BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Posts table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS posts (
          id SERIAL PRIMARY KEY,
          wp_post_id INTEGER UNIQUE,
          title TEXT NOT NULL,
          content TEXT,
          excerpt TEXT,
          slug VARCHAR(200),
          status VARCHAR(20) DEFAULT 'publish',
          wp_author_id INTEGER,
          author_name VARCHAR(100),
          wp_published_date TIMESTAMP,
          wp_modified_date TIMESTAMP,
          ingested_at TIMESTAMP DEFAULT NOW(),
          retention_date DATE,
          category_id INTEGER REFERENCES categories(id),
          search_vector TSVECTOR,
          metadata JSONB
        )
      `);

      // Create full-text search index
      await pool.query(`
        CREATE INDEX IF NOT EXISTS posts_search_idx ON posts USING GIN(search_vector)
      `);

      // Create additional performance indexes
      await pool.query(`
        CREATE INDEX IF NOT EXISTS posts_title_idx ON posts USING GIN(to_tsvector('english', title))
      `);
      
      await pool.query(`
        CREATE INDEX IF NOT EXISTS posts_author_idx ON posts(author_name)
      `);
      
      await pool.query(`
        CREATE INDEX IF NOT EXISTS posts_date_idx ON posts(wp_published_date DESC)
      `);
      
      await pool.query(`
        CREATE INDEX IF NOT EXISTS posts_category_idx ON posts(category_id)
      `);

      // Create search vector trigger
      await pool.query(`
        CREATE OR REPLACE FUNCTION update_search_vector() RETURNS TRIGGER AS $$
        BEGIN
          NEW.search_vector := to_tsvector('english', COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.content, '') || ' ' || COALESCE(NEW.excerpt, ''));
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `);

      await pool.query(`
        DROP TRIGGER IF EXISTS posts_search_vector_trigger ON posts;
        CREATE TRIGGER posts_search_vector_trigger
        BEFORE INSERT OR UPDATE ON posts
        FOR EACH ROW EXECUTE FUNCTION update_search_vector();
      `);

      // Files table for storing uploads in database
      await pool.query(`
        CREATE TABLE IF NOT EXISTS files (
          id SERIAL PRIMARY KEY,
          filename VARCHAR(255) NOT NULL,
          original_name VARCHAR(255) NOT NULL,
          mime_type VARCHAR(100) NOT NULL,
          file_size INTEGER NOT NULL,
          file_data BYTEA NOT NULL,
          uploaded_by INTEGER REFERENCES users(id),
          uploaded_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Post attachments table to link files to posts
      await pool.query(`
        CREATE TABLE IF NOT EXISTS post_attachments (
          id SERIAL PRIMARY KEY,
          post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
          file_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(post_id, file_id)
        )
      `);

      // Audit log table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS audit_log (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          action VARCHAR(50) NOT NULL,
          table_name VARCHAR(50),
          record_id INTEGER,
          old_values JSONB,
          new_values JSONB,
          timestamp TIMESTAMP DEFAULT NOW(),
          ip_address INET
        )
      `);

      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  };
}

module.exports = { pool, initializeDatabase };