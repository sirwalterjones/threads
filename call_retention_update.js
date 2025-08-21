#!/usr/bin/env node

/**
 * Call the retention update API endpoint
 */

const axios = require('axios');

const API_BASE = 'https://cso.vectoronline.us/api';
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123456';

async function updateRetentionDates() {
  try {
    console.log('🔐 Authenticating with API...');
    
    // Authenticate
    const authResponse = await axios.post(`${API_BASE}/auth/login`, {
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD
    });
    
    const token = authResponse.data.token;
    console.log('✅ Authentication successful');
    
    // Set up axios instance with auth
    const api = axios.create({
      baseURL: API_BASE,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📊 Getting current retention status...');
    
    // Check current status first
    const statusResponse = await api.get('/admin/wordpress-retention-status');
    const statusData = statusResponse.data;
    
    console.log('Current WordPress retention status:');
    console.log(`- Total WordPress posts: ${statusData.status.totalWordPressPosts}`);
    console.log(`- Posts with correct 5-year retention: ${statusData.status.correctRetention}`);
    console.log(`- Posts needing update: ${statusData.status.incorrectRetention}`);
    console.log(`- Average retention years: ${statusData.status.averageRetentionYears}`);
    console.log(`- Date range: ${new Date(statusData.status.oldestPost).toLocaleDateString()} to ${new Date(statusData.status.newestPost).toLocaleDateString()}`);
    
    if (statusData.status.incorrectRetention === 0) {
      console.log('✅ All WordPress posts already have correct 5-year retention dates!');
      return;
    }
    
    console.log('\nSample posts with incorrect retention:');
    statusData.incorrectExamples.forEach((post, i) => {
      const published = new Date(post.published).toLocaleDateString();
      const retention = new Date(post.currentRetention).toLocaleDateString();
      console.log(`${i + 1}. ${post.title}`);
      console.log(`   Published: ${published}, Current retention: ${retention} (${post.currentRetentionYears} years)`);
    });
    
    console.log('\n🚀 Updating retention dates to 5 years from published date...');
    
    // Perform the update
    const updateResponse = await api.post('/admin/update-wordpress-retention');
    const updateData = updateResponse.data;
    
    if (updateData.success) {
      console.log('\n🎉 Retention update completed successfully!');
      console.log(`- Posts updated: ${updateData.postsUpdated}`);
      console.log(`- Total WordPress posts: ${updateData.totalWordPressPosts}`);
      console.log(`- Posts with correct retention: ${updateData.correctRetention}`);
      console.log(`- Retention policy: ${updateData.retentionPolicy}`);
      
      if (updateData.examples.length > 0) {
        console.log('\nExamples of updated posts:');
        updateData.examples.forEach((post, i) => {
          const published = new Date(post.published).toLocaleDateString();
          const retention = new Date(post.newRetention).toLocaleDateString();
          console.log(`${i + 1}. ${post.title}`);
          console.log(`   Published: ${published} → Retention: ${retention}`);
        });
      }
    } else {
      console.error('❌ Update failed:', updateData.error);
    }
    
  } catch (error) {
    if (error.response) {
      console.error('❌ API Error:', error.response.status, error.response.data);
    } else {
      console.error('❌ Error:', error.message);
    }
    throw error;
  }
}

// Run the script
if (require.main === module) {
  updateRetentionDates().catch((error) => {
    console.error('Script failed:', error.message);
    process.exit(1);
  });
}

module.exports = { updateRetentionDates };