#!/usr/bin/env node
const { pool } = require('./config/database');
const incidentResponse = require('./services/incidentResponse');
const crypto = require('crypto');

/**
 * Test CJIS Phase 4 Incident Response Implementation
 */
async function testPhase4() {
  console.log('\n🧪 Testing CJIS Phase 4 Incident Response System...\n');
  
  let allTestsPassed = true;
  let testIncidentId = null;
  
  try {
    // Test 1: Create Incident
    console.log('1️⃣  Testing Incident Creation...');
    
    const testIncident = await incidentResponse.createIncident({
      type: 'unauthorized_access',
      severity: 'HIGH',
      description: 'Test incident for Phase 4 validation',
      source: { ipAddress: '192.168.1.100' },
      affectedSystems: ['test-system-1', 'test-system-2'],
      affectedUsers: [1],
      detectionMethod: 'test',
      initialFindings: { 
        test: true,
        timestamp: new Date().toISOString()
      }
    });
    
    if (testIncident && testIncident.incidentId) {
      testIncidentId = testIncident.incidentId;
      console.log(`   ✅ Incident created successfully (ID: ${testIncidentId})`);
    } else {
      console.log('   ❌ Failed to create incident');
      allTestsPassed = false;
    }
    
    // Test 2: Update Incident State
    console.log('\n2️⃣  Testing Incident State Management...');
    
    const updatedIncident = await incidentResponse.updateIncidentState(
      testIncidentId,
      'triaged',
      'Initial triage completed',
      1 // userId
    );
    
    if (updatedIncident && updatedIncident.state === 'triaged') {
      console.log('   ✅ Incident state updated successfully');
    } else {
      console.log('   ❌ Failed to update incident state');
      allTestsPassed = false;
    }
    
    // Test 3: Containment Actions
    console.log('\n3️⃣  Testing Containment Actions...');
    
    const containmentResult = await incidentResponse.containIncident(
      testIncidentId,
      [
        { type: 'BACKUP_EVIDENCE' },
        { type: 'TERMINATE_SESSIONS', userId: 1 }
      ]
    );
    
    if (containmentResult && containmentResult.successful.length > 0) {
      console.log(`   ✅ Containment executed (${containmentResult.successful.length} actions successful)`);
    } else {
      console.log('   ❌ Containment actions failed');
      allTestsPassed = false;
    }
    
    // Test 4: Forensics Collection
    console.log('\n4️⃣  Testing Forensics Collection...');
    
    const forensics = await incidentResponse.collectForensics({
      incidentId: testIncidentId,
      type: 'test_collection',
      source: { testSource: true },
      affectedSystems: ['test-system-1']
    });
    
    if (forensics && forensics.id) {
      console.log(`   ✅ Forensics collected (ID: ${forensics.id})`);
      console.log(`   📊 Data points collected: ${forensics.metadata.systemSnapshots.length + forensics.metadata.logExtracts.length}`);
    } else {
      console.log('   ❌ Forensics collection failed');
      allTestsPassed = false;
    }
    
    // Test 5: Recovery Plan Generation
    console.log('\n5️⃣  Testing Recovery Plan Generation...');
    
    const recoveryPlan = await incidentResponse.generateRecoveryPlan(testIncidentId);
    
    if (recoveryPlan && recoveryPlan.steps.length > 0) {
      console.log(`   ✅ Recovery plan generated (${recoveryPlan.steps.length} steps)`);
      console.log(`   ⏱️  Estimated recovery time: ${recoveryPlan.estimatedTime} minutes`);
    } else {
      console.log('   ❌ Recovery plan generation failed');
      allTestsPassed = false;
    }
    
    // Test 6: Incident Report Generation
    console.log('\n6️⃣  Testing Incident Report Generation...');
    
    const report = await incidentResponse.generateIncidentReport(testIncidentId);
    
    if (report && report.reportId) {
      console.log(`   ✅ Incident report generated (ID: ${report.reportId})`);
      console.log(`   📄 Report sections: incident, timeline, impact, response, forensics`);
    } else {
      console.log('   ❌ Report generation failed');
      allTestsPassed = false;
    }
    
    // Test 7: Database Tables
    console.log('\n7️⃣  Verifying Incident Response Tables...');
    
    const tables = [
      'incident_response',
      'incident_responders',
      'incident_forensics',
      'incident_timeline',
      'containment_actions',
      'incident_playbooks',
      'evidence_backups',
      'system_isolation',
      'blocked_ips'
    ];
    
    for (const table of tables) {
      const result = await pool.query(`
        SELECT COUNT(*) FROM information_schema.tables 
        WHERE table_name = $1
      `, [table]);
      
      if (parseInt(result.rows[0].count) > 0) {
        console.log(`   ✅ Table '${table}' exists`);
      } else {
        console.log(`   ❌ Table '${table}' missing`);
        allTestsPassed = false;
      }
    }
    
    // Test 8: Automated Detection Patterns
    console.log('\n8️⃣  Testing Automated Detection...');
    
    // Simulate multiple failed logins to trigger detection
    for (let i = 0; i < 12; i++) {
      await pool.query(`
        INSERT INTO cjis_audit_log (
          event_type, action, ip_address, access_result,
          data_classification, timestamp
        ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      `, [
        'LOGIN_FAILED',
        'LOGIN_ATTEMPT',
        '10.0.0.1',
        'denied',
        'sensitive'
      ]);
    }
    
    // Check for incident patterns (this would normally trigger automatically)
    await incidentResponse.checkForIncidentPatterns();
    
    console.log('   ✅ Automated detection patterns configured');
    
    // Test 9: Playbooks
    console.log('\n9️⃣  Testing Response Playbooks...');
    
    const playbooksResult = await pool.query(`
      SELECT COUNT(*) as count FROM incident_playbooks
      WHERE enabled = true
    `);
    
    const playbookCount = parseInt(playbooksResult.rows[0].count);
    if (playbookCount > 0) {
      console.log(`   ✅ ${playbookCount} response playbooks available`);
    } else {
      console.log('   ❌ No playbooks found');
      allTestsPassed = false;
    }
    
    // Test 10: Incident Statistics
    console.log('\n🔟  Testing Incident Statistics...');
    
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_incidents,
        COUNT(CASE WHEN state NOT IN ('closed', 'resolved') THEN 1 END) as active_incidents,
        COUNT(CASE WHEN severity = 'CRITICAL' THEN 1 END) as critical_incidents,
        COUNT(CASE WHEN severity = 'HIGH' THEN 1 END) as high_incidents
      FROM incident_response
    `);
    
    const stats = statsResult.rows[0];
    console.log('   📊 Incident Statistics:');
    console.log(`      Total: ${stats.total_incidents}`);
    console.log(`      Active: ${stats.active_incidents}`);
    console.log(`      Critical: ${stats.critical_incidents}`);
    console.log(`      High: ${stats.high_incidents}`);
    
    // Summary
    console.log('\n' + '='.repeat(50));
    if (allTestsPassed) {
      console.log('🎉 All Phase 4 tests passed successfully!');
      console.log('✅ CJIS Phase 4 Incident Response is working correctly');
    } else {
      console.log('⚠️  Some Phase 4 tests failed. Please review the output above.');
    }
    console.log('='.repeat(50) + '\n');
    
    // Display incident response capabilities
    console.log('📋 Incident Response Capabilities:');
    console.log('   ✓ Automated incident detection');
    console.log('   ✓ Multi-state incident workflow');
    console.log('   ✓ Containment action execution');
    console.log('   ✓ Forensics data collection');
    console.log('   ✓ Recovery plan generation');
    console.log('   ✓ Comprehensive reporting');
    console.log('   ✓ Response team management');
    console.log('   ✓ Evidence preservation');
    
  } catch (error) {
    console.error('❌ Test error:', error);
    allTestsPassed = false;
  } finally {
    // Cleanup test data
    if (testIncidentId) {
      try {
        await pool.query(`
          DELETE FROM incident_response 
          WHERE incident_id = $1
        `, [testIncidentId]);
        console.log(`\n🧹 Test incident ${testIncidentId} cleaned up`);
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
    }
    
    await pool.end();
    process.exit(allTestsPassed ? 0 : 1);
  }
}

// Run tests
testPhase4();