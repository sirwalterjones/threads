const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgres://neondb_owner:npg_mR0wniSkK8fH@ep-odd-scene-ad1oq0zb-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function checkUser() {
  const client = await pool.connect();
  try {
    const user = await client.query('SELECT id, username FROM users WHERE username = $1', ['wrjones']);
    console.log('wrjones user:', user.rows[0]);
    
    const report = await client.query('SELECT agent_id, agent_name FROM intel_reports WHERE intel_number = $1', ['20254074']);
    console.log('Report 20254074:', report.rows[0]);
    
  } catch(e) {
    console.error(e);
  } finally {
    client.release();
    await pool.end();
  }
}

checkUser();
