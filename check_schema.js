#!/usr/bin/env node

const { pool } = require('./server/config/database');

async function checkSchema() {
  try {
    console.log('🔍 Checking posts table schema...');
    
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'posts' 
      ORDER BY ordinal_position;
    `);
    
    console.log('📊 Posts table columns:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    console.log('\n🔍 Checking categories table schema...');
    
    const catResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'categories' 
      ORDER BY ordinal_position;
    `);
    
    console.log('📊 Categories table columns:');
    catResult.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
  } catch (error) {
    console.error('❌ Error checking schema:', error.message);
  }
  
  process.exit(0);
}

checkSchema();