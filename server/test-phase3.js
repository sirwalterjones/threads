#!/usr/bin/env node
const { pool } = require('./config/database');
const auditLogger = require('./middleware/auditLogger');
const securityMonitor = require('./services/securityMonitor');
const crypto = require('crypto');

/**
 * Test CJIS Phase 3 Auditing & Monitoring Implementation
 */
async function testPhase3() {
  console.log('\n🧪 Testing CJIS Phase 3 Auditing & Monitoring...\n');
  
  let allTestsPassed = true;
  
  try {
    // Test 1: Audit Logging
    console.log('1️⃣  Testing Audit Logging System...');
    
    const testEvent = await auditLogger.logEvent({
      eventType: 'TEST_EVENT',
      action: 'PHASE3_TEST',
      userId: 1,
      username: 'testuser',
      resourceType: 'test_resource',
      resourceId: '123',
      dataClassification: 'sensitive',
      accessResult: 'granted',
      ipAddress: '127.0.0.1',
      metadata: {
        test: true,
        phase: 3
      }
    });
    
    if (testEvent && testEvent.id) {
      console.log(`   ✅ Audit event logged successfully (ID: ${testEvent.id})`);
    } else {
      console.log('   ❌ Failed to log audit event');
      allTestsPassed = false;
    }
    
    // Test 2: Integrity Verification
    console.log('\n2️⃣  Testing Audit Log Integrity...');
    
    const integrityResult = await auditLogger.verifyIntegrity();
    
    if (integrityResult.verified) {
      console.log(`   ✅ Integrity verified for ${integrityResult.totalRecords} records`);
    } else {
      console.log(`   ❌ Integrity check failed with ${integrityResult.errors.length} errors`);
      allTestsPassed = false;
    }
    
    // Test 3: Security Monitoring
    console.log('\n3️⃣  Testing Security Monitoring...');
    
    // Simulate failed login attempts
    for (let i = 0; i < 3; i++) {
      await securityMonitor.monitorAuthentication(
        'LOGIN_FAILED',
        null,
        'testuser',
        false,
        { ipAddress: '192.168.1.100' }
      );
    }
    
    // Check if alerts are generated
    if (securityMonitor.alertHistory.length > 0) {
      console.log(`   ✅ Security monitoring detected threats (${securityMonitor.alertHistory.length} alerts)`);
    } else {
      console.log('   ⚠️  No security alerts generated (may need more events)');
    }
    
    // Test 4: CJI Access Logging
    console.log('\n4️⃣  Testing CJI Access Logging...');
    
    const mockReq = {
      user: { id: 1, username: 'testuser' },
      ip: '127.0.0.1',
      method: 'GET',
      url: '/api/intel-reports/123',
      headers: { 'user-agent': 'Test Agent' },
      query: { includeMetadata: true }
    };
    
    const cjiEvent = await auditLogger.logCJIAccess(
      mockReq,
      'intel_report',
      '123',
      'VIEW'
    );
    
    if (cjiEvent && cjiEvent.id) {
      console.log('   ✅ CJI access logged successfully');
    } else {
      console.log('   ❌ Failed to log CJI access');
      allTestsPassed = false;
    }
    
    // Test 5: Security Incidents
    console.log('\n5️⃣  Testing Security Incident Tracking...');
    
    const incident = await auditLogger.logSecurityIncident(
      'TEST_SECURITY_INCIDENT',
      'MEDIUM',
      {
        description: 'Test security incident for Phase 3',
        source: '127.0.0.1',
        target: 'test_system'
      },
      mockReq
    );
    
    if (incident && incident.id) {
      console.log('   ✅ Security incident logged successfully');
      
      // Check if incident was created
      const incidentCheck = await pool.query(`
        SELECT COUNT(*) as count 
        FROM security_incidents 
        WHERE audit_log_id = $1
      `, [incident.id]);
      
      if (parseInt(incidentCheck.rows[0].count) > 0) {
        console.log('   ✅ Security incident record created');
      } else {
        console.log('   ❌ Security incident record not created');
        allTestsPassed = false;
      }
    } else {
      console.log('   ❌ Failed to log security incident');
      allTestsPassed = false;
    }
    
    // Test 6: Audit Report Generation
    console.log('\n6️⃣  Testing Audit Report Generation...');
    
    const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    const endDate = new Date();
    
    const report = await auditLogger.generateAuditReport(
      startDate.toISOString(),
      endDate.toISOString()
    );
    
    if (report && report.reportId) {
      console.log(`   ✅ Audit report generated (ID: ${report.reportId})`);
      console.log(`   📊 Report contains ${report.statistics.length} event types`);
      console.log(`   🔐 Integrity check: ${report.integrityCheck.verified ? 'PASSED' : 'FAILED'}`);
    } else {
      console.log('   ❌ Failed to generate audit report');
      allTestsPassed = false;
    }
    
    // Test 7: Real-time Metrics
    console.log('\n7️⃣  Testing Real-time Security Metrics...');
    
    const metrics = await securityMonitor.generateMetrics();
    
    if (metrics) {
      console.log('   ✅ Security metrics generated');
      console.log(`   📈 System Health: ${metrics.systemHealth}`);
      console.log(`   🚨 Active Incidents: ${metrics.activeIncidents.length}`);
      console.log(`   📊 Total Events: ${metrics.events.total}`);
    } else {
      console.log('   ❌ Failed to generate security metrics');
      allTestsPassed = false;
    }
    
    // Test 8: Database Tables
    console.log('\n8️⃣  Verifying Security Tables...');
    
    const tables = [
      'security_alerts',
      'security_incidents',
      'security_metrics',
      'threat_patterns',
      'compliance_tracking',
      'audit_reports',
      'monitoring_thresholds'
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
    
    // Test 9: Compliance Check
    console.log('\n9️⃣  Testing Compliance Monitoring...');
    
    await securityMonitor.checkComplianceStatus();
    
    const complianceResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM compliance_tracking
      WHERE check_date > CURRENT_TIMESTAMP - INTERVAL '1 minute'
    `);
    
    if (parseInt(complianceResult.rows[0].count) > 0) {
      console.log('   ✅ Compliance check performed');
    } else {
      console.log('   ⚠️  No recent compliance checks found');
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    if (allTestsPassed) {
      console.log('🎉 All Phase 3 tests passed successfully!');
      console.log('✅ CJIS Phase 3 Auditing & Monitoring is working correctly');
    } else {
      console.log('⚠️  Some Phase 3 tests failed. Please review the output above.');
    }
    console.log('='.repeat(50) + '\n');
    
    // Display summary statistics
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_audit_logs,
        COUNT(DISTINCT event_type) as event_types,
        COUNT(CASE WHEN data_classification = 'cji' THEN 1 END) as cji_events,
        COUNT(CASE WHEN integrity_hash IS NOT NULL THEN 1 END) as integrity_protected
      FROM cjis_audit_log
      WHERE timestamp > CURRENT_TIMESTAMP - INTERVAL '1 hour'
    `);
    
    console.log('📊 Audit Statistics (Last Hour):');
    console.table(statsResult.rows[0]);
    
  } catch (error) {
    console.error('❌ Test error:', error);
    allTestsPassed = false;
  } finally {
    await pool.end();
    process.exit(allTestsPassed ? 0 : 1);
  }
}

// Run tests
testPhase3();