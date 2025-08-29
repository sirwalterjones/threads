const { pool } = require('../config/database');

async function createBOLOTables() {
  const client = await pool.connect();
  
  try {
    console.log('Creating BOLO tables...');
    
    await client.query('BEGIN');
    
    // Create BOLO main table
    await client.query(`
      CREATE TABLE IF NOT EXISTS bolos (
        id SERIAL PRIMARY KEY,
        case_number VARCHAR(50) UNIQUE NOT NULL,
        priority VARCHAR(20) CHECK (priority IN ('immediate', 'high', 'medium', 'low')) DEFAULT 'medium',
        status VARCHAR(20) CHECK (status IN ('active', 'resolved', 'expired', 'cancelled')) DEFAULT 'active',
        type VARCHAR(20) CHECK (type IN ('person', 'vehicle', 'property', 'other')) NOT NULL,
        
        -- Subject Information
        subject_name VARCHAR(255),
        subject_aliases TEXT[],
        subject_description TEXT,
        date_of_birth DATE,
        age_range VARCHAR(50),
        height VARCHAR(20),
        weight VARCHAR(20),
        hair_color VARCHAR(50),
        eye_color VARCHAR(50),
        distinguishing_features TEXT,
        last_seen_wearing TEXT,
        armed_dangerous BOOLEAN DEFAULT FALSE,
        armed_dangerous_details TEXT,
        
        -- Vehicle Information (if applicable)
        vehicle_make VARCHAR(100),
        vehicle_model VARCHAR(100),
        vehicle_year INTEGER,
        vehicle_color VARCHAR(100),
        license_plate VARCHAR(50),
        vehicle_vin VARCHAR(50),
        vehicle_features TEXT,
        direction_of_travel VARCHAR(255),
        
        -- Incident Information
        incident_date TIMESTAMP,
        incident_location TEXT,
        last_known_location TEXT,
        jurisdiction VARCHAR(255),
        
        -- Content
        title VARCHAR(500) NOT NULL,
        summary TEXT NOT NULL,
        narrative TEXT,
        officer_safety_info TEXT,
        approach_instructions TEXT,
        
        -- Media
        primary_image_id INTEGER,
        
        -- Metadata
        created_by INTEGER REFERENCES users(id) NOT NULL,
        agency_id INTEGER,
        agency_name VARCHAR(255),
        officer_name VARCHAR(255),
        officer_badge VARCHAR(50),
        contact_info TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        
        -- Sharing
        public_share_token UUID DEFAULT gen_random_uuid(),
        is_public BOOLEAN DEFAULT FALSE,
        view_count INTEGER DEFAULT 0,
        
        -- Engagement
        repost_count INTEGER DEFAULT 0,
        comment_count INTEGER DEFAULT 0,
        save_count INTEGER DEFAULT 0,
        
        -- Search
        search_vector tsvector
      );
    `);
    
    console.log('Created bolos table');
    
    // Create BOLO media table
    await client.query(`
      CREATE TABLE IF NOT EXISTS bolo_media (
        id SERIAL PRIMARY KEY,
        bolo_id INTEGER REFERENCES bolos(id) ON DELETE CASCADE,
        type VARCHAR(20) CHECK (type IN ('image', 'video', 'document', 'audio')),
        filename VARCHAR(255),
        original_name VARCHAR(255),
        url TEXT,
        thumbnail_url TEXT,
        caption TEXT,
        mime_type VARCHAR(100),
        size BIGINT,
        width INTEGER,
        height INTEGER,
        duration INTEGER, -- for video/audio in seconds
        uploaded_by INTEGER REFERENCES users(id),
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_primary BOOLEAN DEFAULT FALSE,
        display_order INTEGER DEFAULT 0
      );
    `);
    
    console.log('Created bolo_media table');
    
    // Create BOLO reposts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS bolo_reposts (
        id SERIAL PRIMARY KEY,
        original_bolo_id INTEGER REFERENCES bolos(id) ON DELETE CASCADE,
        reposted_by INTEGER REFERENCES users(id),
        repost_message TEXT,
        agency_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(original_bolo_id, reposted_by)
      );
    `);
    
    console.log('Created bolo_reposts table');
    
    // Create BOLO comments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS bolo_comments (
        id SERIAL PRIMARY KEY,
        bolo_id INTEGER REFERENCES bolos(id) ON DELETE CASCADE,
        parent_id INTEGER REFERENCES bolo_comments(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id),
        username VARCHAR(255),
        agency_name VARCHAR(255),
        content TEXT NOT NULL,
        is_internal BOOLEAN DEFAULT FALSE,
        is_edited BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log('Created bolo_comments table');
    
    // Create BOLO activity table
    await client.query(`
      CREATE TABLE IF NOT EXISTS bolo_activity (
        id SERIAL PRIMARY KEY,
        bolo_id INTEGER REFERENCES bolos(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id),
        action VARCHAR(50) CHECK (action IN ('viewed', 'shared', 'reposted', 'commented', 'updated', 'saved', 'unsaved')),
        ip_address INET,
        user_agent TEXT,
        metadata JSONB,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log('Created bolo_activity table');
    
    // Create BOLO saves table (bookmarks)
    await client.query(`
      CREATE TABLE IF NOT EXISTS bolo_saves (
        id SERIAL PRIMARY KEY,
        bolo_id INTEGER REFERENCES bolos(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id),
        saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(bolo_id, user_id)
      );
    `);
    
    console.log('Created bolo_saves table');
    
    // Create BOLO notifications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS bolo_notifications (
        id SERIAL PRIMARY KEY,
        bolo_id INTEGER REFERENCES bolos(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id),
        type VARCHAR(50) CHECK (type IN ('new_bolo', 'comment', 'repost', 'update', 'expiring_soon')),
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        read_at TIMESTAMP
      );
    `);
    
    console.log('Created bolo_notifications table');
    
    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_bolos_status ON bolos(status);
      CREATE INDEX IF NOT EXISTS idx_bolos_type ON bolos(type);
      CREATE INDEX IF NOT EXISTS idx_bolos_priority ON bolos(priority);
      CREATE INDEX IF NOT EXISTS idx_bolos_created_at ON bolos(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_bolos_expires_at ON bolos(expires_at);
      CREATE INDEX IF NOT EXISTS idx_bolos_public_token ON bolos(public_share_token);
      CREATE INDEX IF NOT EXISTS idx_bolos_created_by ON bolos(created_by);
      CREATE INDEX IF NOT EXISTS idx_bolos_search ON bolos USING gin(search_vector);
      
      CREATE INDEX IF NOT EXISTS idx_bolo_media_bolo_id ON bolo_media(bolo_id);
      CREATE INDEX IF NOT EXISTS idx_bolo_comments_bolo_id ON bolo_comments(bolo_id);
      CREATE INDEX IF NOT EXISTS idx_bolo_activity_bolo_id ON bolo_activity(bolo_id);
      CREATE INDEX IF NOT EXISTS idx_bolo_activity_user_id ON bolo_activity(user_id);
      CREATE INDEX IF NOT EXISTS idx_bolo_saves_user_id ON bolo_saves(user_id);
      CREATE INDEX IF NOT EXISTS idx_bolo_notifications_user_id ON bolo_notifications(user_id, is_read);
    `);
    
    console.log('Created indexes');
    
    // Create trigger to update search vector
    await client.query(`
      CREATE OR REPLACE FUNCTION update_bolo_search_vector()
      RETURNS trigger AS $$
      BEGIN
        NEW.search_vector := 
          setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
          setweight(to_tsvector('english', COALESCE(NEW.summary, '')), 'B') ||
          setweight(to_tsvector('english', COALESCE(NEW.subject_name, '')), 'A') ||
          setweight(to_tsvector('english', COALESCE(NEW.narrative, '')), 'C') ||
          setweight(to_tsvector('english', COALESCE(NEW.license_plate, '')), 'A') ||
          setweight(to_tsvector('english', COALESCE(NEW.incident_location, '')), 'B');
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      
      DROP TRIGGER IF EXISTS update_bolo_search_vector_trigger ON bolos;
      CREATE TRIGGER update_bolo_search_vector_trigger
      BEFORE INSERT OR UPDATE ON bolos
      FOR EACH ROW
      EXECUTE FUNCTION update_bolo_search_vector();
    `);
    
    console.log('Created search vector trigger');
    
    // Create trigger to update updated_at timestamp
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
      
      DROP TRIGGER IF EXISTS update_bolos_updated_at ON bolos;
      CREATE TRIGGER update_bolos_updated_at BEFORE UPDATE ON bolos
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        
      DROP TRIGGER IF EXISTS update_bolo_comments_updated_at ON bolo_comments;
      CREATE TRIGGER update_bolo_comments_updated_at BEFORE UPDATE ON bolo_comments
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
    
    console.log('Created updated_at triggers');
    
    // Create function to generate case numbers
    await client.query(`
      CREATE OR REPLACE FUNCTION generate_bolo_case_number()
      RETURNS VARCHAR AS $$
      DECLARE
        year_part VARCHAR;
        sequential_part VARCHAR;
        next_seq INTEGER;
      BEGIN
        year_part := TO_CHAR(CURRENT_DATE, 'YYYY');
        
        SELECT COUNT(*) + 1 INTO next_seq
        FROM bolos
        WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE);
        
        sequential_part := LPAD(next_seq::VARCHAR, 4, '0');
        
        RETURN year_part || '-BOLO-' || sequential_part;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    console.log('Created case number generator function');
    
    await client.query('COMMIT');
    console.log('BOLO tables created successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating BOLO tables:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the migration
if (require.main === module) {
  createBOLOTables()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = createBOLOTables;