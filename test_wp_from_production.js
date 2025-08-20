#!/usr/bin/env node

const axios = require('axios');

const VERCEL_API_BASE = 'https://threads-8qfennhvr-walter-jones-projects.vercel.app/api';

async function getAuthToken() {
  const response = await axios.post(`${VERCEL_API_BASE}/auth/login`, {
    username: 'admin',
    password: 'admin123456'
  });
  return response.data.token;
}

async function testWordPressConnection(token) {
  try {
    console.log('🔍 Testing WordPress connection from production...');
    
    const response = await axios.post(
      `${VERCEL_API_BASE}/admin/test-wordpress-connection`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );
    
    console.log('✅ WordPress connection test result:', response.data);
    
  } catch (error) {
    if (error.response?.status === 404) {
      console.log('⚠️  test-wordpress-connection endpoint not available');
      console.log('Let me try the regular sync and see what error we get...');
      
      // Try the regular endpoint to see the actual error
      try {
        const syncResponse = await axios.post(
          `${VERCEL_API_BASE}/admin/ingest-wordpress`,
          {},
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            timeout: 15000
          }
        );
        console.log('Unexpected success:', syncResponse.data);
      } catch (syncError) {
        console.log('❌ Sync error details:', syncError.response?.data || syncError.message);
      }
    } else {
      console.error('❌ Connection test failed:', error.response?.data || error.message);
    }
  }
}

async function main() {
  try {
    const token = await getAuthToken();
    await testWordPressConnection(token);
  } catch (error) {
    console.error('Failed:', error.message);
  }
}

main();