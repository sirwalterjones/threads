#!/usr/bin/env node

const axios = require('axios');

const VERCEL_API_BASE = 'https://threads-dfv9qdtnn-walter-jones-projects.vercel.app/api';
const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoiYWRtaW4iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTU1NjUwMDQsImV4cCI6MTc1NTY1MTQwNH0.Y2oFC36ZqBh3uomWr91U7qo2GjwpRsY_F14tkYLlqOY';

console.log('🔧 Adding missing database columns for proper WordPress migration...\n');

async function addDatabaseColumns() {
  try {
    console.log('Adding featured_media_id and featured_media_url columns to posts table...');
    
    const response = await axios.post(
      `${VERCEL_API_BASE}/admin/maintenance`,
      { 
        action: 'add_media_columns'
      },
      {
        headers: {
          'Authorization': `Bearer ${JWT_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Database schema updated:', response.data);
    
  } catch (error) {
    console.error('❌ Error updating schema:', error.message);
    if (error.response?.data) {
      console.error('Response:', error.response.data);
    }
    
    // If the maintenance endpoint doesn't support this, we need to add it
    console.log('\n⚠️  Need to add schema update endpoint...');
  }
}

addDatabaseColumns();