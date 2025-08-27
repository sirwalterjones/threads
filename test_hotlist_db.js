const { pool } = require('./server/config/database');

async function testHotlistTables() {
  try {
    console.log('Testing hotlist database tables...');
    
    // Check if hot_lists table exists
    try {
      const hotListsResult = await pool.query('SELECT COUNT(*) FROM hot_lists');
      console.log('✅ hot_lists table exists, count:', hotListsResult.rows[0].count);
    } catch (error) {
      console.log('❌ hot_lists table error:', error.message);
    }
    
    // Check if hot_list_alerts table exists
    try {
      const alertsResult = await pool.query('SELECT COUNT(*) FROM hot_list_alerts');
      console.log('✅ hot_list_alerts table exists, count:', alertsResult.rows[0].count);
    } catch (error) {
      console.log('❌ hot_list_alerts table error:', error.message);
    }
    
    // Check if posts table exists
    try {
      const postsResult = await pool.query('SELECT COUNT(*) FROM posts');
      console.log('✅ posts table exists, count:', postsResult.rows[0].count);
    } catch (error) {
      console.log('❌ posts table error:', error.message);
    }
    
    // Check if intel_reports table exists
    try {
      const intelResult = await pool.query('SELECT COUNT(*) FROM intel_reports');
      console.log('✅ intel_reports table exists, count:', intelResult.rows[0].count);
    } catch (error) {
      console.log('❌ intel_reports table error:', error.message);
    }
    
    // Check if users table exists
    try {
      const usersResult = await pool.query('SELECT COUNT(*) FROM users');
      console.log('✅ users table exists, count:', usersResult.rows[0].count);
    } catch (error) {
      console.log('❌ users table error:', error.message);
    }
    
    // Test the specific query that's failing
    try {
      console.log('\nTesting the failing query...');
      const testResult = await pool.query(`
        SELECT 
          hla.id,
          hla.hot_list_id,
          hla.post_id,
          hla.intel_report_id,
          hla.is_read,
          hla.highlighted_content,
          hla.created_at,
          hl.search_term,
          COALESCE(p.title, ir.subject) as title,
          COALESCE(p.author_name, u.username) as author_name,
          COALESCE(p.wp_published_date, ir.created_at) as published_date,
          CASE 
            WHEN hla.post_id IS NOT NULL THEN 'post'
            WHEN hla.intel_report_id IS NOT NULL THEN 'intel_report'
          END as content_type,
          ir.intel_number,
          ir.classification
         FROM hot_list_alerts hla
         JOIN hot_lists hl ON hla.hot_list_id = hl.id
         LEFT JOIN posts p ON hla.post_id = p.id
         LEFT JOIN intel_reports ir ON hla.intel_report_id = ir.id
         LEFT JOIN users u ON ir.agent_id = u.id
         WHERE hl.user_id = 1
         LIMIT 1
      `);
      console.log('✅ Query executed successfully, rows:', testResult.rows.length);
    } catch (error) {
      console.log('❌ Query failed:', error.message);
      console.log('Error details:', {
        code: error.code,
        detail: error.detail,
        hint: error.hint
      });
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await pool.end();
  }
}

testHotlistTables();
