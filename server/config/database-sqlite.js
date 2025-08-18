const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const dbPath = path.join(__dirname, '../../data/threads_intel.db');

// Ensure data directory exists
const fs = require('fs');
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Create database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
  }
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

const initializeDatabase = async () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT DEFAULT 'view' CHECK (role IN ('admin', 'edit', 'view')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_login DATETIME,
          is_active BOOLEAN DEFAULT 1
        )
      `);

      // Categories table
      db.run(`
        CREATE TABLE IF NOT EXISTS categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          wp_category_id INTEGER UNIQUE,
          name TEXT NOT NULL,
          slug TEXT NOT NULL,
          parent_id INTEGER REFERENCES categories(id),
          post_count INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Posts table
      db.run(`
        CREATE TABLE IF NOT EXISTS posts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          wp_post_id INTEGER UNIQUE,
          title TEXT NOT NULL,
          content TEXT,
          excerpt TEXT,
          slug TEXT,
          status TEXT DEFAULT 'publish',
          wp_author_id INTEGER,
          author_name TEXT,
          wp_published_date DATETIME,
          wp_modified_date DATETIME,
          ingested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          retention_date DATE,
          category_id INTEGER REFERENCES categories(id),
          featured_media_id INTEGER,
          featured_media_url TEXT,
          attachments TEXT,
          metadata TEXT
        )
      `);

      // Ensure media columns exist for existing databases
      db.all(`PRAGMA table_info(posts);`, [], (err, rows) => {
        if (err) return;
        const columnNames = (rows || []).map(r => r.name);
        const addColumn = (name, type) => {
          db.run(`ALTER TABLE posts ADD COLUMN ${name} ${type};`);
        };
        if (!columnNames.includes('featured_media_id')) addColumn('featured_media_id', 'INTEGER');
        if (!columnNames.includes('featured_media_url')) addColumn('featured_media_url', 'TEXT');
        if (!columnNames.includes('attachments')) addColumn('attachments', 'TEXT');
      });

      // Audit log table
      db.run(`
        CREATE TABLE IF NOT EXISTS audit_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER REFERENCES users(id),
          action TEXT NOT NULL,
          table_name TEXT,
          record_id INTEGER,
          old_values TEXT,
          new_values TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          ip_address TEXT
        )
      `, (err) => {
        if (err) {
          console.error('Database initialization error:', err);
          reject(err);
        } else {
          console.log('Database initialized successfully');
          resolve();
        }
      });
    });
  });
};

// SQLite query wrapper to match PostgreSQL pool interface
const pool = {
  query: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      // Convert PostgreSQL style $1, $2 to SQLite style ?
      const sqliteSql = sql.replace(/\$(\d+)/g, '?');
      
      if (sql.toLowerCase().includes('select')) {
        db.all(sqliteSql, params, (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve({ rows: rows || [] });
          }
        });
      } else {
        db.run(sqliteSql, params, function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ 
              rows: [], 
              rowCount: this.changes,
              lastID: this.lastID 
            });
          }
        });
      }
    });
  }
};

module.exports = { pool, initializeDatabase, db };