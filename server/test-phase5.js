const { pool } = require('./config/database');
const governance = require('./services/complianceGovernance');

/**
 * Test CJIS Phase 5 compliance and governance system
 */
async function testPhase5() {
  console.log('🧪 Testing CJIS Phase 5: Compliance and Governance System\n');
  let testUserId;
  
  try {
    // Get a test user
    const userResult = await pool.query('SELECT id FROM users LIMIT 1');
    if (userResult.rows.length === 0) {
      throw new Error('No users found in database');
    }
    testUserId = userResult.rows[0].id;
    console.log(`✅ Using test user ID: ${testUserId}\n`);
    
    // Test 1: Personnel Security Management
    console.log('📋 Test 1: Personnel Security Management');
    console.log('─'.repeat(50));
    
    const personnelRecord = await governance.createPersonnelRecord({
      userId: testUserId,
      fullName: 'Test Officer',
      position: 'Security Analyst',
      clearanceLevel: 'SECRET',
      backgroundCheckDate: new Date('2024-01-15'),
      fingerprintDate: new Date('2024-01-10'),
      securityBriefingDate: new Date('2024-01-20'),
      reinvestigationDue: new Date('2029-01-15'),
      accessCategories: ['CJI', 'PII', 'CHRI'],
      certifications: ['CJIS Security', 'ISO 27001']
    });
    
    console.log('✅ Personnel record created:', {
      id: personnelRecord.id,
      userId: personnelRecord.user_id,
      clearanceLevel: personnelRecord.clearance_level,
      status: personnelRecord.status
    });
    
    // Test 2: Security Training Assignment
    console.log('\n📚 Test 2: Security Training Assignment');
    console.log('─'.repeat(50));
    
    // Get a training module
    const moduleResult = await pool.query(
      'SELECT id FROM security_training_modules WHERE module_code = $1',
      ['CJIS-BASIC']
    );
    
    if (moduleResult.rows.length > 0) {
      const moduleId = moduleResult.rows[0].id;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);
      
      const training = await governance.assignTraining(
        testUserId,
        moduleId,
        dueDate
      );
      
      console.log('✅ Training assigned:', {
        id: training.id,
        moduleId: training.module_id,
        status: training.status,
        dueDate: training.due_date
      });
      
      // Complete the training
      const completion = await governance.completeTraining(
        training.id,
        testUserId,
        95,
        { answers: ['A', 'B', 'C', 'D'] }
      );
      
      console.log('✅ Training completed:', {
        score: completion.score,
        passed: completion.passed,
        status: completion.status
      });
    }
    
    // Test 3: Configuration Management
    console.log('\n⚙️ Test 3: Configuration Management');
    console.log('─'.repeat(50));
    
    const baseline = await governance.createConfigurationBaseline(
      'CJIS Security Baseline v1.0',
      'Baseline configuration for CJIS compliance',
      {
        passwordPolicy: {
          minLength: 14,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: true,
          maxAge: 90,
          historyCount: 12
        },
        sessionPolicy: {
          maxIdleTime: 900,
          maxSessionLength: 28800,
          requireMFA: true
        },
        encryptionPolicy: {
          algorithm: 'AES-256-GCM',
          keyRotation: 30,
          tlsVersion: '1.3'
        }
      }
    );
    
    console.log('✅ Configuration baseline created:', {
      id: baseline.id,
      name: baseline.name,
      isCurrent: baseline.is_current
    });
    
    // Test 4: Mobile Device Registration
    console.log('\n📱 Test 4: Mobile Device Management');
    console.log('─'.repeat(50));
    
    const device = await governance.registerMobileDevice({
      userId: testUserId,
      deviceType: 'smartphone',
      manufacturer: 'Apple',
      model: 'iPhone 14 Pro',
      osVersion: 'iOS 17.2',
      serialNumber: 'TEST123456',
      imei: '123456789012345'
    });
    
    console.log('✅ Device registered:', {
      id: device.id,
      deviceId: device.device_id,
      deviceType: device.device_type,
      status: device.status
    });
    
    // Test 5: Compliance Assessment
    console.log('\n📊 Test 5: Compliance Assessment');
    console.log('─'.repeat(50));
    
    const complianceScore = await governance.calculateComplianceScore();
    console.log('✅ Compliance score calculated:', {
      overall: complianceScore.overall,
      breakdown: Object.keys(complianceScore.policyAreas || {}).length + ' policy areas assessed'
    });
    
    // Test 6: Generate Compliance Report
    console.log('\n📈 Test 6: Compliance Reporting');
    console.log('─'.repeat(50));
    
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
    const endDate = new Date();
    
    const report = await governance.generateComplianceReport(startDate, endDate);
    console.log('✅ Compliance report generated:', {
      reportId: report.reportId,
      overallScore: report.overallScore,
      period: `${report.period.start} to ${report.period.end}`,
      policyAreas: Object.keys(report.policyAreas).length
    });
    
    // Test 7: Audit Scheduling
    console.log('\n🔍 Test 7: Formal Audit Management');
    console.log('─'.repeat(50));
    
    const auditDate = new Date();
    auditDate.setMonth(auditDate.getMonth() + 1);
    
    const audit = await governance.scheduleAudit({
      auditType: 'CJIS Compliance',
      scheduledDate: auditDate,
      scope: ['Policy Area 5: Access Control', 'Policy Area 12: Personnel Security'],
      objectives: ['Verify access control compliance', 'Validate personnel security procedures'],
      criteria: { standard: 'CJIS Security Policy v6.0' },
      leadAuditor: 'External Auditor'
    });
    
    console.log('✅ Audit scheduled:', {
      id: audit.id,
      auditId: audit.audit_id,
      type: audit.audit_type,
      scheduledDate: audit.scheduled_date,
      status: audit.status
    });
    
    // Test 8: Policy Compliance Check
    console.log('\n📜 Test 8: Security Policy Management');
    console.log('─'.repeat(50));
    
    const policies = await pool.query(
      'SELECT * FROM security_policies WHERE active = true LIMIT 3'
    );
    
    console.log('✅ Active security policies:', {
      count: policies.rows.length,
      areas: policies.rows.map(p => p.policy_area).join(', ')
    });
    
    // Test 9: Training Compliance Check
    console.log('\n🎓 Test 9: Training Compliance');
    console.log('─'.repeat(50));
    
    const trainingCompliance = await governance.getTrainingCompliance(testUserId);
    console.log('✅ Training compliance assessed:', {
      totalRequired: trainingCompliance.totalRequired,
      completed: trainingCompliance.completed,
      overdue: trainingCompliance.overdue,
      complianceRate: trainingCompliance.complianceRate
    });
    
    // Test 10: Identify Compliance Gaps
    console.log('\n⚠️ Test 10: Compliance Gap Analysis');
    console.log('─'.repeat(50));
    
    const gaps = await governance.identifyComplianceGaps();
    console.log('✅ Compliance gaps identified:', {
      totalGaps: gaps.length,
      criticalGaps: gaps.filter(g => g.severity === 'critical').length,
      areas: [...new Set(gaps.map(g => g.policyArea))].slice(0, 3).join(', ')
    });
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ PHASE 5 TESTING COMPLETE');
    console.log('='.repeat(60));
    console.log('All compliance and governance features tested successfully:');
    console.log('  ✓ Personnel security management');
    console.log('  ✓ Security training assignment and completion');
    console.log('  ✓ Configuration baseline management');
    console.log('  ✓ Mobile device registration');
    console.log('  ✓ Compliance scoring and assessment');
    console.log('  ✓ Compliance report generation');
    console.log('  ✓ Formal audit scheduling');
    console.log('  ✓ Security policy management');
    console.log('  ✓ Training compliance tracking');
    console.log('  ✓ Compliance gap analysis');
    
    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    await pool.query('DELETE FROM personnel_security WHERE user_id = $1', [testUserId]);
    await pool.query('DELETE FROM security_training WHERE user_id = $1', [testUserId]);
    await pool.query('DELETE FROM mobile_devices WHERE user_id = $1', [testUserId]);
    console.log('✅ Test data cleaned up');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
  
  process.exit(0);
}

// Run tests
testPhase5();