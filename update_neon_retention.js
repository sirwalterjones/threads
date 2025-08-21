#!/usr/bin/env node

/**
 * Update retention dates for WordPress-ingested posts in Neon database
 * Sets retention_date to wp_published_date + 5 years (your retention policy)
 */

const { Pool } = require('pg');

// Neon database connection
const pool = new Pool({
  connectionString: 'postgres://neondb_owner:npg_mR0wniSkK8fH@ep-odd-scene-ad1oq0zb-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function updateRetentionDates() {
  try {
    console.log('🔗 Connecting to Neon database...');
    
    // Test connection
    const testResult = await pool.query('SELECT NOW() as current_time, version()');
    console.log('✅ Connected successfully');
    console.log(`📅 Database time: ${testResult.rows[0].current_time}`);
    console.log(`🐘 PostgreSQL version: ${testResult.rows[0].version.split(' ')[1]}`);
    
    console.log('\n🔍 Checking current retention dates for WordPress posts...\n');
    
    // First, let's see what we have currently
    const currentQuery = `
      SELECT 
        COUNT(*) as total_posts,
        COUNT(CASE WHEN retention_date = wp_published_date + INTERVAL '5 years' THEN 1 END) as correct_retention,
        MIN(wp_published_date) as oldest_post,
        MAX(wp_published_date) as newest_post,
        AVG(DATE_PART('year', AGE(retention_date, wp_published_date))) as avg_retention_years
      FROM posts 
      WHERE wp_post_id IS NOT NULL
    `;
    
    const currentResult = await pool.query(currentQuery);
    const status = currentResult.rows[0];
    
    if (parseInt(status.total_posts) === 0) {
      console.log('❌ No WordPress posts found in database');
      return;
    }
    
    console.log('📊 Current WordPress posts retention status:');
    console.log(`- Total WordPress posts: ${status.total_posts}`);
    console.log(`- Posts with correct 5-year retention: ${status.correct_retention}`);
    console.log(`- Posts needing update: ${parseInt(status.total_posts) - parseInt(status.correct_retention)}`);
    console.log(`- Average current retention years: ${parseFloat(status.avg_retention_years).toFixed(1)}`);
    console.log(`- Date range: ${new Date(status.oldest_post).toLocaleDateString()} to ${new Date(status.newest_post).toLocaleDateString()}`);
    
    // Get some examples of posts with incorrect retention
    const examplesQuery = `
      SELECT 
        id, title, wp_published_date, retention_date,
        DATE_PART('year', AGE(retention_date, wp_published_date)) as retention_years
      FROM posts 
      WHERE wp_post_id IS NOT NULL
        AND retention_date != wp_published_date + INTERVAL '5 years'
      ORDER BY wp_published_date DESC
      LIMIT 10
    `;
    
    const examplesResult = await pool.query(examplesQuery);
    
    if (examplesResult.rows.length > 0) {
      console.log('\n📋 Sample posts with incorrect retention (first 10):');
      console.log('ID\tTitle\t\t\t\tPublished\t\tCurrent Retention\tYears');
      console.log('─'.repeat(120));
      
      for (const row of examplesResult.rows) {
        const title = row.title.substring(0, 25).padEnd(25);
        const published = new Date(row.wp_published_date).toLocaleDateString();
        const retention = new Date(row.retention_date).toLocaleDateString();
        const yearsDiff = Math.round(parseFloat(row.retention_years) * 10) / 10;
        
        console.log(`${row.id}\t${title}\t${published}\t\t${retention}\t\t${yearsDiff}y`);
      }
    }
    
    const needsUpdate = parseInt(status.total_posts) - parseInt(status.correct_retention);
    
    if (needsUpdate === 0) {
      console.log('\n✅ All WordPress posts already have correct 5-year retention dates!');
      return;
    }
    
    console.log(`\n🎯 Will update ${needsUpdate} WordPress posts to 5-year retention policy`);
    console.log('⚠️  This will set retention_date = wp_published_date + 5 years');
    
    console.log('\n🚀 Updating retention dates...');
    
    // Update retention dates: wp_published_date + 5 years
    const updateQuery = `
      UPDATE posts 
      SET retention_date = wp_published_date + INTERVAL '5 years'
      WHERE wp_post_id IS NOT NULL
        AND retention_date != wp_published_date + INTERVAL '5 years'
      RETURNING id, title, wp_published_date, retention_date
    `;
    
    const updateResult = await pool.query(updateQuery);
    
    console.log(`✅ Updated ${updateResult.rowCount} posts\n`);
    
    // Show some examples of updated posts
    if (updateResult.rows.length > 0) {
      console.log('📊 Updated retention dates (first 10 examples):');
      console.log('ID\tTitle\t\t\t\tPublished\t\tNew Retention\t\tYears');
      console.log('─'.repeat(120));
      
      for (let i = 0; i < Math.min(10, updateResult.rows.length); i++) {
        const row = updateResult.rows[i];
        const title = row.title.substring(0, 25).padEnd(25);
        const published = new Date(row.wp_published_date).toLocaleDateString();
        const retention = new Date(row.retention_date).toLocaleDateString();
        const yearsDiff = Math.round((new Date(row.retention_date) - new Date(row.wp_published_date)) / (365.25 * 24 * 60 * 60 * 1000) * 10) / 10;
        
        console.log(`${row.id}\t${title}\t${published}\t\t${retention}\t\t${yearsDiff}y`);
      }
    }
    
    // Verify the update
    const verifyQuery = `
      SELECT 
        COUNT(*) as total_posts,
        COUNT(CASE WHEN retention_date = wp_published_date + INTERVAL '5 years' THEN 1 END) as correct_retention
      FROM posts 
      WHERE wp_post_id IS NOT NULL
    `;
    
    const verifyResult = await pool.query(verifyQuery);
    const verification = verifyResult.rows[0];
    const totalPosts = parseInt(verification.total_posts);
    const correctCount = parseInt(verification.correct_retention);
    
    console.log(`\n✅ Verification Results:`);
    console.log(`- Total WordPress posts: ${totalPosts}`);
    console.log(`- Posts with correct 5-year retention: ${correctCount}`);
    console.log(`- Success rate: ${totalPosts > 0 ? Math.round((correctCount / totalPosts) * 100) : 0}%`);
    
    if (correctCount === totalPosts) {
      console.log('🎉 All WordPress posts now have correct 5-year retention dates!');
    } else {
      console.log('⚠️  Some posts may not have been updated correctly');
    }
    
    // Show retention date distribution
    const distributionQuery = `
      SELECT 
        DATE_PART('year', wp_published_date) as publish_year,
        COUNT(*) as post_count,
        MIN(retention_date) as earliest_retention,
        MAX(retention_date) as latest_retention
      FROM posts 
      WHERE wp_post_id IS NOT NULL
      GROUP BY DATE_PART('year', wp_published_date)
      ORDER BY publish_year DESC
      LIMIT 10
    `;
    
    const distributionResult = await pool.query(distributionQuery);
    
    if (distributionResult.rows.length > 0) {
      console.log('\n📈 WordPress posts by publish year (with new retention dates):');
      console.log('Year\tPosts\tEarliest Retention\tLatest Retention');
      console.log('─'.repeat(80));
      
      for (const row of distributionResult.rows) {
        const year = row.publish_year;
        const count = row.post_count;
        const earliest = new Date(row.earliest_retention).toLocaleDateString();
        const latest = new Date(row.latest_retention).toLocaleDateString();
        
        console.log(`${year}\t${count}\t${earliest}\t\t${latest}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error updating retention dates:', error.message);
    throw error;
  } finally {
    await pool.end();
    console.log('\n🔌 Database connection closed');
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