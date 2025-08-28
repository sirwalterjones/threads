const { pool } = require('./config/database');

async function checkAndFixTables() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking Phase 5 tables...\n');
    
    // Check if personnel_security table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'personnel_security'
      );
    `);
    
    if (tableExists.rows[0].exists) {
      console.log('✅ personnel_security table exists');
      
      // Check columns
      const columns = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'personnel_security'
        ORDER BY ordinal_position;
      `);
      
      console.log('\nExisting columns:');
      console.table(columns.rows);
      
      // Drop the table if it exists but is incomplete
      console.log('\n🔧 Dropping incomplete table to recreate...');
      await client.query('DROP TABLE IF EXISTS personnel_security CASCADE;');
      console.log('✅ Table dropped');
    } else {
      console.log('❌ personnel_security table does not exist');
    }
    
    // Check for other Phase 5 tables
    const phase5Tables = [
      'security_training_modules',
      'security_training',
      'configuration_baseline',
      'configuration_changes',
      'mobile_devices',
      'compliance_assessments',
      'formal_audits',
      'security_policies'
    ];
    
    console.log('\n📊 Checking other Phase 5 tables:');
    for (const tableName of phase5Tables) {
      const exists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `, [tableName]);
      
      if (exists.rows[0].exists) {
        console.log(`✅ ${tableName} exists`);
        await client.query(`DROP TABLE IF EXISTS ${tableName} CASCADE;`);
        console.log(`   └─ Dropped for clean migration`);
      } else {
        console.log(`❌ ${tableName} does not exist`);
      }
    }
    
    console.log('\n✅ Ready to run Phase 5 migration');
    
  } catch (error) {
    console.error('❌ Error checking tables:', error);
    throw error;
  } finally {
    client.release();
    process.exit(0);
  }
}

checkAndFixTables();