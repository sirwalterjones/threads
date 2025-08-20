#!/usr/bin/env node

const axios = require('axios');

const VERCEL_API_BASE = 'https://threads-8qfennhvr-walter-jones-projects.vercel.app/api';
const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoiYWRtaW4iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTU1NjUwMDQsImV4cCI6MTc1NTY1MTQwNH0.Y2oFC36ZqBh3uomWr91U7qo2GjwpRsY_F14tkYLlqOY';

console.log('📥 Starting full WordPress data ingestion to production...\n');

async function ingestWordPressData() {
  try {
    console.log('🚀 Triggering WordPress data ingestion...');
    console.log('This may take several minutes for 20,000+ posts...\n');
    
    const response = await axios.post(
      `${VERCEL_API_BASE}/admin/ingest-wordpress`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${JWT_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 600000 // 10 minutes timeout
      }
    );
    
    console.log('✅ WordPress ingestion completed!');
    console.log('Response:', response.data);
    
    return response.data;
    
  } catch (error) {
    console.error('❌ Error during WordPress ingestion:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

async function checkPostIngestionStatus() {
  try {
    console.log('\\n📊 Checking ingestion results...');
    
    const dashboardResponse = await axios.get(`${VERCEL_API_BASE}/admin/dashboard`, {
      headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
    });
    
    const stats = dashboardResponse.data;
    console.log(`\\n✅ Final stats:`);
    console.log(`   📝 Total posts: ${stats.counts.totalPosts}`);
    console.log(`   📁 Total categories: ${stats.counts.totalCategories}`);
    
    if (stats.topCategories && stats.topCategories.length > 0) {
      console.log('\\n   📈 Top categories after ingestion:');
      stats.topCategories.forEach(cat => {
        console.log(`   - ${cat.name}: ${cat.post_count} posts`);
      });
    }
    
    return stats;
    
  } catch (error) {
    console.error('❌ Error checking ingestion status:', error.message);
  }
}

async function reapplyCategories() {
  try {
    console.log('\\n🔄 Re-applying WordPress categories to ingested posts...');
    
    const response = await axios.post(
      `${VERCEL_API_BASE}/admin/assign-posts-categories`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${JWT_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 300000 // 5 minutes
      }
    );
    
    console.log('✅ Category assignments completed!');
    console.log('Assignment results:', response.data);
    
    return response.data;
    
  } catch (error) {
    console.error('❌ Error re-applying categories:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

async function main() {
  try {
    // Step 1: Ingest all WordPress data
    const ingestionResult = await ingestWordPressData();
    
    // Step 2: Check what we got
    const status = await checkPostIngestionStatus();
    
    // Step 3: Re-apply categories now that posts are available
    if (status && status.counts.totalPosts > 3) {
      const categoryResult = await reapplyCategories();
      
      // Step 4: Final status check
      await checkPostIngestionStatus();
      
      console.log('\\n' + '🎉'.repeat(15));
      console.log('SUCCESS: Full WordPress migration complete!');
      console.log('🎉'.repeat(15));
      console.log('\\n🔗 Check your live system: https://threads-8qfennhvr-walter-jones-projects.vercel.app');
    } else {
      console.log('\\n⚠️  Ingestion may not have completed successfully');
      console.log('Check the server logs for more details');
    }
    
  } catch (error) {
    console.error('\\n❌ FULL MIGRATION FAILED:', error.message);
    process.exit(1);
  }
}

main();