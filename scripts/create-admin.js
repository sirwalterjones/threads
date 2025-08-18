const { pool } = require('../server/config/database');
const bcrypt = require('bcryptjs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
};

const createAdminUser = async () => {
  try {
    console.log('🔧 Creating Admin User for Threads Intel\n');

    const username = await question('Enter admin username: ');
    const email = await question('Enter admin email: ');
    const password = await question('Enter admin password (min 8 chars): ');

    // Validation
    if (!username || username.length < 3) {
      throw new Error('Username must be at least 3 characters long');
    }

    if (!email || !email.includes('@')) {
      throw new Error('Please enter a valid email address');
    }

    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      throw new Error('User with this username or email already exists');
    }

    // Hash password
    console.log('\n🔐 Hashing password...');
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    console.log('👤 Creating admin user...');
    const result = await pool.query(`
      INSERT INTO users (username, email, password_hash, role)
      VALUES ($1, $2, $3, 'admin')
      RETURNING id, username, email, role, created_at
    `, [username, email, passwordHash]);

    const user = result.rows[0];

    console.log('\n✅ Admin user created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`👤 Username: ${user.username}`);
    console.log(`📧 Email: ${user.email}`);
    console.log(`🔑 Role: ${user.role.toUpperCase()}`);
    console.log(`📅 Created: ${new Date(user.created_at).toLocaleString()}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n🚀 You can now log in to Threads Intel with these credentials.');
    console.log('💡 Start the application with: npm run dev\n');

  } catch (error) {
    console.error('\n❌ Error creating admin user:', error.message);
    process.exit(1);
  } finally {
    rl.close();
    process.exit(0);
  }
};

// Initialize database and create admin user
const init = async () => {
  try {
    console.log('🔄 Initializing database...');
    const { initializeDatabase } = require('../server/config/database');
    await initializeDatabase();
    console.log('✅ Database initialized successfully\n');
    
    await createAdminUser();
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
  }
};

init();