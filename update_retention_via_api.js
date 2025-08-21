#!/usr/bin/env node

/**
 * Update retention dates for WordPress-ingested posts via API
 * Sets retention_date to wp_published_date + 5 years (your retention policy)
 */

const axios = require('axios');

// Configuration
const API_BASE = 'https://cso.vectoronline.us/api';
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123456';

async function updateRetentionDatesViaAPI() {
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
    
    console.log('🔍 Checking current WordPress posts...');
    
    // Get all posts (we'll need to paginate through them)
    let page = 1;
    let allWordPressPosts = [];
    
    while (true) {
      const response = await api.get(`/posts?page=${page}&limit=100`);
      const posts = response.data.posts;
      
      if (posts.length === 0) break;
      
      // Filter for WordPress posts (have wp_post_id)
      const wpPosts = posts.filter(post => post.wp_post_id);
      allWordPressPosts = allWordPressPosts.concat(wpPosts);
      
      console.log(`📄 Found ${wpPosts.length} WordPress posts on page ${page}`);
      
      page++;
      if (page > 100) break; // Safety limit
    }
    
    console.log(`\n📊 Total WordPress posts found: ${allWordPressPosts.length}`);
    
    if (allWordPressPosts.length === 0) {
      console.log('❌ No WordPress posts found');
      return;
    }
    
    // Show current retention dates for first few posts
    console.log('\n📋 Current retention dates (first 10 posts):');
    console.log('ID\tTitle\t\t\t\tPublished Date\t\tCurrent Retention\tYears');
    console.log('─'.repeat(120));
    
    for (let i = 0; i < Math.min(10, allWordPressPosts.length); i++) {
      const post = allWordPressPosts[i];
      const title = post.title.substring(0, 25).padEnd(25);
      const published = new Date(post.wp_published_date).toLocaleDateString();
      const retention = new Date(post.retention_date).toLocaleDateString();
      
      // Calculate years difference
      const publishedDate = new Date(post.wp_published_date);
      const retentionDate = new Date(post.retention_date);
      const yearsDiff = Math.round((retentionDate - publishedDate) / (365.25 * 24 * 60 * 60 * 1000) * 10) / 10;
      
      console.log(`${post.id}\t${title}\t${published}\t\t${retention}\t\t${yearsDiff}y`);
    }
    
    console.log('\n🎯 This will update retention dates to: wp_published_date + 5 years');
    console.log(`⚠️  This will affect ${allWordPressPosts.length} WordPress posts`);
    console.log('\n🚀 Starting retention date updates...');
    
    // We need to create an API endpoint for bulk updating retention dates
    // For now, let's create a simple script that shows what needs to be done
    
    let updatedCount = 0;
    const updates = [];
    
    for (const post of allWordPressPosts) {
      const publishedDate = new Date(post.wp_published_date);
      const newRetentionDate = new Date(publishedDate);
      newRetentionDate.setFullYear(publishedDate.getFullYear() + 5);
      
      const currentRetentionDate = new Date(post.retention_date);
      
      // Only update if the retention date is different
      if (Math.abs(newRetentionDate.getTime() - currentRetentionDate.getTime()) > 24 * 60 * 60 * 1000) {
        updates.push({
          id: post.id,
          title: post.title.substring(0, 50),
          wp_published_date: post.wp_published_date,
          current_retention: post.retention_date,
          new_retention: newRetentionDate.toISOString().split('T')[0]
        });
        updatedCount++;
      }
    }
    
    console.log(`\n📈 Posts that need updating: ${updatedCount} out of ${allWordPressPosts.length}`);
    
    if (updates.length > 0) {
      console.log('\n📋 First 10 posts to be updated:');
      console.log('ID\tTitle\t\t\t\tPublished\t\tOld Retention\t\tNew Retention');
      console.log('─'.repeat(130));
      
      for (let i = 0; i < Math.min(10, updates.length); i++) {
        const update = updates[i];
        const title = update.title.padEnd(25);
        const published = new Date(update.wp_published_date).toLocaleDateString();
        const oldRetention = new Date(update.current_retention).toLocaleDateString();
        const newRetention = new Date(update.new_retention).toLocaleDateString();
        
        console.log(`${update.id}\t${title}\t${published}\t\t${oldRetention}\t\t${newRetention}`);
      }
      
      // Generate SQL for manual execution
      console.log('\n📝 SQL commands to update retention dates:');
      console.log('You can execute these SQL commands to update the retention dates:');
      console.log('\n```sql');
      
      for (const update of updates.slice(0, 5)) { // Show first 5 as examples
        console.log(`UPDATE posts SET retention_date = '${update.new_retention}' WHERE id = ${update.id}; -- ${update.title.substring(0, 30)}`);
      }
      
      if (updates.length > 5) {
        console.log(`-- ... and ${updates.length - 5} more posts`);
      }
      
      console.log('\n-- Or update all WordPress posts at once:');
      console.log(`UPDATE posts SET retention_date = wp_published_date + INTERVAL '5 years' WHERE wp_post_id IS NOT NULL;`);
      console.log('```');
      
      console.log(`\n✨ This SQL command will update ${updatedCount} WordPress posts to have 5-year retention periods based on their published date.`);
    } else {
      console.log('✅ All WordPress posts already have correct 5-year retention dates!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    throw error;
  }
}

// Run the script
if (require.main === module) {
  updateRetentionDatesViaAPI().catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

module.exports = { updateRetentionDatesViaAPI };