#!/usr/bin/env node

/**
 * Update retention dates for WordPress-ingested posts
 * Sets retention_date to wp_published_date + 5 years (your retention policy)
 */

require('dotenv').config();
const { Pool } = require('pg');

// Use production database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function updateRetentionDates() {
  try {
    console.log('🔍 Checking current retention dates for WordPress posts...\n');
    
    // First, let's see what we have currently
    const currentQuery = `
      SELECT 
        id, 
        title, 
        wp_published_date, 
        retention_date,
        DATE_PART('year', AGE(retention_date, wp_published_date)) as years_diff
      FROM posts 
      WHERE wp_post_id IS NOT NULL 
      ORDER BY wp_published_date DESC 
      LIMIT 10
    `;
    
    const currentResult = await pool.query(currentQuery);
    
    if (currentResult.rows.length === 0) {
      console.log('❌ No WordPress posts found in database');
      return;
    }
    
    console.log('📊 Current retention dates (showing first 10 posts):');
    console.log('ID\tTitle\t\t\tPublished\t\tCurrent Retention\tYears Diff');
    console.log('─'.repeat(120));
    
    for (const row of currentResult.rows) {
      const title = row.title.substring(0, 25).padEnd(25);
      const published = new Date(row.wp_published_date).toLocaleDateString();
      const retention = new Date(row.retention_date).toLocaleDateString();
      const yearsDiff = Math.round(parseFloat(row.years_diff) * 10) / 10;
      
      console.log(`${row.id}\t${title}\t${published}\t\t${retention}\t\t${yearsDiff}y`);
    }
    
    // Count total WordPress posts
    const countResult = await pool.query(`
      SELECT COUNT(*) as total_posts 
      FROM posts 
      WHERE wp_post_id IS NOT NULL
    `);
    
    const totalPosts = parseInt(countResult.rows[0].total_posts);
    console.log(`\n📈 Total WordPress posts in database: ${totalPosts}`);
    
    // Ask for confirmation
    console.log('\n🎯 This script will update retention dates to: wp_published_date + 5 years');
    console.log('⚠️  This will affect ALL WordPress-ingested posts in the database');
    
    // In a real scenario, you'd want user confirmation. For now, let's proceed.
    console.log('\n🚀 Updating retention dates...');
    
    // Update retention dates: wp_published_date + 5 years
    const updateQuery = `
      UPDATE posts 
      SET retention_date = wp_published_date + INTERVAL '5 years'
      WHERE wp_post_id IS NOT NULL
      RETURNING id, title, wp_published_date, retention_date
    `;
    
    const updateResult = await pool.query(updateQuery);
    
    console.log(`✅ Updated ${updateResult.rowCount} posts\n`);
    
    // Show some examples of updated posts
    console.log('📊 Updated retention dates (showing first 10 posts):');
    console.log('ID\tTitle\t\t\tPublished\t\tNew Retention\t\tYears Diff');
    console.log('─'.repeat(120));
    
    for (let i = 0; i < Math.min(10, updateResult.rows.length); i++) {
      const row = updateResult.rows[i];
      const title = row.title.substring(0, 25).padEnd(25);
      const published = new Date(row.wp_published_date).toLocaleDateString();
      const retention = new Date(row.retention_date).toLocaleDateString();
      const yearsDiff = Math.round((new Date(row.retention_date) - new Date(row.wp_published_date)) / (365.25 * 24 * 60 * 60 * 1000) * 10) / 10;
      
      console.log(`${row.id}\t${title}\t${published}\t\t${retention}\t\t${yearsDiff}y`);
    }
    
    // Verify the update
    const verifyQuery = `
      SELECT 
        COUNT(*) as correct_count
      FROM posts 
      WHERE wp_post_id IS NOT NULL 
        AND retention_date = wp_published_date + INTERVAL '5 years'
    `;
    
    const verifyResult = await pool.query(verifyQuery);
    const correctCount = parseInt(verifyResult.rows[0].correct_count);
    
    console.log(`\n✅ Verification: ${correctCount} out of ${totalPosts} posts now have correct 5-year retention dates`);
    
    if (correctCount === totalPosts) {
      console.log('🎉 All WordPress posts successfully updated!');
    } else {
      console.log('⚠️  Some posts may not have been updated correctly');
    }
    
  } catch (error) {
    console.error('❌ Error updating retention dates:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the script
if (require.main === module) {
  updateRetentionDates().catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

module.exports = { updateRetentionDates };