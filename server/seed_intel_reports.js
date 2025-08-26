/*
  Seed two comprehensive intel reports with full subjects, organizations, and sources
*/
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgres://neondb_owner:npg_mR0wniSkK8fH@ep-odd-scene-ad1oq0zb-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function seed() {
  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    async function insertReport(intelNum, subject, agentId = 4) {
      const reportRes = await client.query(
        `INSERT INTO intel_reports (
            intel_number, classification, date, agent_id, case_number,
            subject, criminal_activity, summary, status, expires_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9) RETURNING id`,
        [
          intelNum,
          'Sensitive',
          new Date().toISOString().slice(0, 10),
          agentId,
          'CASE-TEST-001',
          subject,
          'Observed suspicious activity near storage facility; potential narcotics trafficking.',
          'Full narrative describing surveillance operations and findings.',
          expiresAt,
        ]
      );
      const reportId = reportRes.rows[0].id;

      // Subject
      await client.query(
        `INSERT INTO intel_report_subjects (
          report_id, first_name, middle_name, last_name, address,
          date_of_birth, race, sex, phone, social_security_number, license_number
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          reportId,
          'John',
          'Q',
          'Public',
          '123 Test St, Canton, GA',
          '1985-04-12',
          'White',
          'M',
          '555-111-2222',
          '123-45-6789',
          'GA-1234567',
        ]
      );

      // Organization
      await client.query(
        `INSERT INTO intel_report_organizations (
          report_id, business_name, phone, address
        ) VALUES ($1,$2,$3,$4)`,
        [reportId, 'Test Org Inc', '555-333-4444', '456 Business Rd, Alpharetta, GA']
      );

      // Source
      await client.query(
        `INSERT INTO intel_report_sources (
          report_id, source_id, rating, source, information_reliable,
          unknown_caller, ci_cs, first_name, middle_name, last_name, phone, address
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          reportId,
          'SRC-100',
          'A - Always Reliable',
          'CI/CS',
          true,
          false,
          true,
          'Alice',
          'M',
          'Source',
          '555-777-8888',
          '789 Source Ave, Woodstock, GA',
        ]
      );

      return reportId;
    }

    const id1 = await insertReport('20259991', 'Test Report A');
    const id2 = await insertReport('20259992', 'Test Report B');

    const count = await client.query('SELECT COUNT(*) FROM intel_reports');
    console.log('Inserted report IDs:', id1, id2, 'Total reports:', count.rows[0].count);
  } catch (err) {
    console.error('Seed error:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();


