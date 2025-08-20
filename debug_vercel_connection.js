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

async function testNetworkDiagnostics(token) {
  try {
    console.log('🔍 Testing network diagnostics from Vercel...');
    
    // Create a simple endpoint test
    const response = await axios.post(
      `${VERCEL_API_BASE}/test`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );
    
    console.log('✅ Basic Vercel connectivity:', response.data);
    
    // Let's also check if we can get more details about the WordPress connection issue
    console.log('\nTesting minimal WordPress sync with detailed error...');
    
    try {
      const syncResponse = await axios.post(
        `${VERCEL_API_BASE}/admin/ingest-wordpress`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 20000
        }
      );
      console.log('✅ Unexpected success:', syncResponse.data);
    } catch (syncError) {
      const errorData = syncError.response?.data;
      console.log('❌ Detailed sync error:');
      console.log('  Status:', syncError.response?.status);
      console.log('  Error:', errorData?.error);
      console.log('  Details:', errorData?.details);
      
      if (errorData?.details?.includes('ETIMEDOUT')) {
        console.log('\n🔍 This is definitely a timeout issue.');
        console.log('Possibilities:');
        console.log('1. WordPress server is behind a firewall that blocks Vercel');
        console.log('2. WordPress server is responding slowly');
        console.log('3. Different IP routes from Vercel vs your local machine');
      }
    }
    
  } catch (error) {
    console.error('❌ Network diagnostics failed:', error.message);
  }
}

async function main() {
  try {
    const token = await getAuthToken();
    console.log('✅ Auth successful, running diagnostics...\n');
    await testNetworkDiagnostics(token);
  } catch (error) {
    console.error('Failed:', error.message);
  }
}

main();