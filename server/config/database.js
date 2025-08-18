require('dotenv').config();

// Use SQLite for local development, PostgreSQL for production
const USE_SQLITE = process.env.NODE_ENV !== 'production' || !process.env.DB_PASSWORD;

let pool, initializeDatabase;

if (USE_SQLITE) {
  console.log('Using SQLite for local development');
  const sqlite = require('./database-sqlite');
  pool = sqlite.pool;
  initializeDatabase = sqlite.initializeDatabase;
} else {
  console.log('Using PostgreSQL for production');
  const { Pool } = require('pg');
  
  pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'threads_intel',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
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