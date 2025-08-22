const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
require('dotenv').config();

// Import database modules (PostgreSQL for production, SQLite for local)
const { initializeDatabase } = require('./config/database');
const WordPressService = require('./services/wordpressService');

// Import routes
const authRoutes = require('./routes/auth'); // Use full PostgreSQL version
const postsRoutes = require('./routes/posts'); // Use full PostgreSQL version
const categoriesRoutes = require('./routes/categories');
const mediaRoutes = require('./routes/media');
const adminRoutes = require('./routes/admin'); // Use full PostgreSQL version
const uploadsRoutes = require('./routes/uploads');
const filesRoutes = require('./routes/files');
const commentsRoutes = require('./routes/comments');
const notificationsRoutes = require('./routes/notifications');

const app = express();
// Ensure Express uses X-Forwarded-* headers on Vercel to get real client IP
app.set('trust proxy', true);
const PORT = process.env.PORT || 5050;

// Initialize WordPress service
const wpService = new WordPressService();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://cso.vectoronline.us', 'https://cso.vectoronline.us'] 
    : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'],
  credentials: true
}));

// Rate limiting with proper Vercel proxy handling
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use X-Forwarded-For if available, otherwise fall back to req.ip
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
  },
  skip: (req) => {
    // Skip rate limiting for health checks and static assets
    return req.path === '/health' || req.path.startsWith('/static/');
  }
});

// Apply rate limiting only in production and only to API routes
if (process.env.NODE_ENV === 'production') {
  app.use('/api', limiter);
}
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date(),
    version: '2.0.0',
    features: ['incremental-sync', 'auto-ingestion', 'direct-sync']
  });
});

// Simple test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API is working',
    env: process.env.NODE_ENV,
    hasJwtSecret: !!process.env.JWT_SECRET,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasDbPassword: !!process.env.DB_PASSWORD,
    isVercel: !!process.env.VERCEL,
    timestamp: new Date()
  });
});

// Database test endpoint - no auth required
app.get('/api/db-test', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    const result = await pool.query('SELECT id, title, author_name FROM posts LIMIT 5');
    res.json({
      message: 'Database connection working',
      posts: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({ error: 'Database test failed', details: error.message });
  }
});

// TEMP: Direct posts endpoint to bypass router issues
app.get('/api/posts-direct', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    const countQuery = `SELECT COUNT(*) as total FROM posts p`;
    const countResult = await pool.query(countQuery);
    const total = parseInt(countResult.rows[0].total);
    
    const postsQuery = `
      SELECT 
        p.id, p.wp_post_id, p.title, p.content, p.excerpt, p.author_name,
        p.wp_published_date, p.ingested_at, p.retention_date, p.status,
        p.metadata
      FROM posts p
      ORDER BY p.id DESC
      LIMIT $1 OFFSET $2
    `;
    
    const postsResult = await pool.query(postsQuery, [limit, offset]);
    
    res.json({
      posts: postsResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Direct posts error:', error);
    res.status(500).json({ error: 'Direct posts failed', details: error.message });
  }
});

// Get Vercel IP address
app.get('/api/my-ip', async (req, res) => {
  try {
    const axios = require('axios');
    const response = await axios.get('https://api.ipify.org?format=json', { timeout: 5000 });
    res.json({
      vercelIP: response.data.ip,
      headers: req.headers,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get IP',
      details: error.message 
    });
  }
});

// Serve client build if present
const clientBuildPath = path.join(__dirname, '../client/build');
app.use(express.static(clientBuildPath));

// Serve uploads statically (align with uploads route location at projectRoot/uploads)
const uploadsPath = path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsPath));

// Serve TinyMCE locally to satisfy CSP (no external CDN)
const tinymcePath = path.join(__dirname, '../client/node_modules/tinymce');
app.use('/tinymce', express.static(tinymcePath));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/comments', commentsRoutes);
app.use('/api/notifications', notificationsRoutes);

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request payload too large' });
  }
  
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// SPA fallback for non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  try {
    return res.sendFile(path.join(clientBuildPath, 'index.html'));
  } catch {
    return res.status(404).json({ error: 'Route not found' });
  }
});

// Scheduled tasks
if (process.env.NODE_ENV !== 'test') {
  // WordPress incremental sync every 2 minutes (efficient for new posts)
  cron.schedule('*/2 * * * *', async () => {
    console.log('Running scheduled WordPress incremental sync (every 2 minutes)...');
    try {
      const result = await wpService.performIncrementalSync();
      console.log(`Scheduled incremental sync completed: ${result.newPosts} new posts ingested`);
    } catch (error) {
      console.error('Scheduled incremental sync failed:', error);
    }
  });

  // Full WordPress sync every 6 hours (comprehensive backup)
  cron.schedule('0 */6 * * *', async () => {
    console.log('Running scheduled full WordPress sync (every 6 hours)...');
    try {
      const result = await wpService.performFullIngestion();
      console.log('Scheduled full WordPress sync completed');
    } catch (error) {
      console.error('Scheduled full WordPress sync failed:', error);
    }
  });

  // Weekly data purge on Sundays at 3 AM
  cron.schedule('0 3 * * 0', async () => {
    console.log('Running scheduled data purge...');
    try {
      const purgedCount = await wpService.purgeExpiredData();
      console.log(`Scheduled data purge completed: ${purgedCount} items removed`);
    } catch (error) {
      console.error('Scheduled data purge failed:', error);
    }
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Create admin user if it doesn't exist
const createAdminUser = async () => {
  try {
    const bcrypt = require('bcryptjs');
    const { pool } = require('./config/database');
    
    const username = 'admin';
    const email = 'admin@threads.local';
    const password = 'admin123456';

    // Check if admin user exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length === 0) {
      console.log('Creating default admin user...');
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      await pool.query(`
        INSERT INTO users (username, email, password_hash, role)
        VALUES ($1, $2, $3, 'admin')
      `, [username, email, passwordHash]);

      console.log('✅ Admin user created successfully!');
      console.log(`Username: ${username}, Password: ${password}`);
    } else {
      console.log('Admin user already exists');
    }
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
};

// Start server
const startServer = async () => {
  try {
    console.log('Starting server initialization...');
    console.log('Environment variables check:', {
      NODE_ENV: process.env.NODE_ENV,
      hasJwtSecret: !!process.env.JWT_SECRET,
      hasDbPassword: !!process.env.DB_PASSWORD,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      isVercel: !!process.env.VERCEL
    });

    // Initialize database
    try {
      console.log('Initializing database...');
      await initializeDatabase();
      console.log('Database initialized successfully');

      // Create admin user if needed
      console.log('Creating admin user...');
      await createAdminUser();
      console.log('Admin user creation completed');
    } catch (dbError) {
      console.error('Database initialization failed:', dbError);
      // Don't crash the entire app, just log the error
    }

    // Start the server (only in local development)
    if (!process.env.VERCEL && process.env.NODE_ENV !== 'production') {
      app.listen(PORT, () => {
        console.log(`Threads Intel API server running on port ${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`WordPress API: ${process.env.WORDPRESS_API_URL}`);
      });
    } else {
      console.log('App ready for serverless environment');
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    if (!process.env.VERCEL) {
      process.exit(1);
    }
  }
};

startServer();

module.exports = app;// Force deployment Wed Aug 20 18:26:01 EDT 2025
// Force deployment Wed Aug 20 19:42:36 EDT 2025
// Force deployment Wed Aug 20 21:00:33 EDT 2025
