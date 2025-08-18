const { pool, initializeDatabase } = require('./server/config/database');
const bcrypt = require('bcryptjs');

const createAdminUser = async () => {
  try {
    console.log('🔧 Creating Admin User for Threads Intel\n');

    // Initialize database first
    console.log('🔄 Initializing database...');
    await initializeDatabase();
    console.log('✅ Database initialized successfully\n');

    // Hardcoded admin credentials for ease of setup
    const username = 'admin';
    const email = 'admin@threads.local';
    const password = 'admin123456';

    console.log(`Creating admin user: ${username}`);

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      console.log('❌ User with this username or email already exists');
      process.exit(1);
    }

    // Hash password
    console.log('🔐 Hashing password...');
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    console.log('👤 Creating admin user...');
    const result = await pool.query(`
      INSERT INTO users (username, email, password_hash, role)
      VALUES (?, ?, ?, 'admin')
    `, [username, email, passwordHash]);

    // Get the created user
    const userResult = await pool.query(
      'SELECT id, username, email, role, created_at FROM users WHERE id = ?',
      [result.lastID]
    );
    
    const user = userResult.rows[0];

    console.log('\n✅ Admin user created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`👤 Username: ${user.username}`);
    console.log(`📧 Email: ${user.email}`);
    console.log(`🔑 Role: ${user.role.toUpperCase()}`);
    console.log(`📅 Created: ${new Date(user.created_at).toLocaleString()}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n🚀 You can now log in to Threads Intel with these credentials:');
    console.log(`   Username: ${username}`);
    console.log(`   Password: ${password}`);
    console.log('\n💡 Access the application at: http://localhost:3000\n');

  } catch (error) {
    console.error('\n❌ Error creating admin user:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
};

createAdminUser();