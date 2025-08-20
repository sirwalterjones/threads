#!/usr/bin/env node

const axios = require('axios');

const VERCEL_API_BASE = 'https://threads-8qfennhvr-walter-jones-projects.vercel.app/api';

// You'll need to get a fresh token from the login endpoint
async function getAuthToken() {
  try {
    const response = await axios.post(`${VERCEL_API_BASE}/auth/login`, {
      username: 'admin',
      password: 'admin123456'
    });
    return response.data.token;
  } catch (error) {
    console.error('Failed to get auth token:', error.response?.data || error.message);
    throw error;
  }
}

async function testExistingEndpoint(token) {
  try {
    console.log('🔍 Testing existing WordPress ingestion endpoint...');
    
    const response = await axios.post(
      `${VERCEL_API_BASE}/admin/ingest-wordpress`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 seconds
      }
    );
    
    console.log('✅ Existing endpoint works!');
    console.log('Response:', response.data);
    return response.data;
    
  } catch (error) {
    console.error('❌ Existing endpoint failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testIncrementalEndpoint(token) {
  try {
    console.log('🔍 Testing incremental sync endpoint...');
    
    const response = await axios.post(
      `${VERCEL_API_BASE}/admin/ingest-wordpress-incremental`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );
    
    console.log('✅ Incremental endpoint works!');
    console.log('Response:', response.data);
    return response.data;
    
  } catch (error) {
    if (error.response?.status === 404) {
      console.log('⚠️  Incremental endpoint not yet deployed (404)');
      return null;
    }
    console.error('❌ Incremental endpoint failed:', error.response?.data || error.message);
    throw error;
  }
}

async function runProductionTest() {
  try {
    console.log('🚀 Testing WordPress sync in production...\n');
    
    // Get auth token
    console.log('Getting authentication token...');
    const token = await getAuthToken();
    console.log('✅ Authentication successful\n');
    
    // Test existing endpoint
    await testExistingEndpoint(token);
    console.log('');
    
    // Test incremental endpoint
    await testIncrementalEndpoint(token);
    
    console.log('\n🎉 Production test completed!');
    
  } catch (error) {
    console.error('\n❌ Production test failed:', error.message);
    process.exit(1);
  }
}

runProductionTest();