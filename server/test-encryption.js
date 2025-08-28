#!/usr/bin/env node
const encryptionService = require('./utils/encryption');
const keyManagement = require('./utils/keyManagement');
const { pool } = require('./config/database');
const crypto = require('crypto');

/**
 * Test CJIS Phase 2 Encryption Implementation
 */
async function testEncryption() {
  console.log('\n🧪 Testing CJIS Phase 2 Encryption Implementation...\n');
  
  let allTestsPassed = true;
  
  try {
    // Test 1: Encryption Service
    console.log('1️⃣  Testing AES-256-GCM Encryption...');
    const testData = 'Sensitive Criminal Justice Information';
    const encrypted = encryptionService.encrypt(
      testData, 
      encryptionService.dataClassification.CJI,
      'test_context'
    );
    
    const decrypted = encryptionService.decrypt(encrypted, 'test_context');
    
    if (decrypted === testData) {
      console.log('   ✅ Encryption/Decryption working correctly');
    } else {
      console.log('   ❌ Encryption/Decryption failed');
      allTestsPassed = false;
    }
    
    // Test 2: Hash for Search
    console.log('\n2️⃣  Testing Search Hash...');
    const email = 'test@example.com';
    const hash1 = encryptionService.hashForSearch(email);
    const hash2 = encryptionService.hashForSearch(email);
    
    if (hash1 === hash2) {
      console.log('   ✅ Search hash is consistent');
    } else {
      console.log('   ❌ Search hash inconsistency');
      allTestsPassed = false;
    }
    
    // Test 3: Key Management
    console.log('\n3️⃣  Testing Key Management System...');
    await keyManagement.initialize();
    
    const keyId = 'test_key_' + Date.now();
    const keyMetadata = keyManagement.generateKey(keyId, 'test_encryption');
    
    if (keyMetadata && keyMetadata.id === keyId) {
      console.log('   ✅ Key generation successful');
      
      // Test key retrieval
      const retrievedKey = await keyManagement.getKey(keyId);
      if (retrievedKey) {
        console.log('   ✅ Key retrieval successful');
      } else {
        console.log('   ❌ Key retrieval failed');
        allTestsPassed = false;
      }
    } else {
      console.log('   ❌ Key generation failed');
      allTestsPassed = false;
    }
    
    // Test 4: Database Encryption
    console.log('\n4️⃣  Testing Database Column Encryption...');
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(email_encrypted) as encrypted_emails,
        COUNT(email_hash) as email_hashes
      FROM users
    `);
    
    const stats = result.rows[0];
    console.log(`   📊 Users: ${stats.total_users}, Encrypted: ${stats.encrypted_emails}, Hashes: ${stats.email_hashes}`);
    
    if (stats.encrypted_emails > 0) {
      console.log('   ✅ Database encryption working');
    } else {
      console.log('   ⚠️  No encrypted data found in database');
    }
    
    // Test 5: File Encryption
    console.log('\n5️⃣  Testing File Encryption...');
    const fileContent = Buffer.from('This is a test file for CJIS compliance');
    const encryptedFile = encryptionService.encryptFile(
      fileContent,
      'test-file.txt',
      'text/plain'
    );
    
    if (encryptedFile.data && encryptedFile.metadata && encryptedFile.checksum) {
      console.log('   ✅ File encryption working');
      
      // Test file decryption
      const decryptedFile = encryptionService.decryptFile(encryptedFile);
      if (decryptedFile.data.equals(fileContent)) {
        console.log('   ✅ File decryption working');
      } else {
        console.log('   ❌ File decryption failed');
        allTestsPassed = false;
      }
    } else {
      console.log('   ❌ File encryption failed');
      allTestsPassed = false;
    }
    
    // Test 6: Integrity Verification
    console.log('\n6️⃣  Testing Data Integrity...');
    const integrityData = 'Important data';
    const signature = encryptionService.generateIntegritySignature(integrityData);
    const isValid = encryptionService.verifyIntegrity(integrityData, signature);
    
    if (isValid) {
      console.log('   ✅ Integrity verification working');
      
      // Test tampered data
      const tamperedValid = encryptionService.verifyIntegrity(integrityData + ' tampered', signature);
      if (!tamperedValid) {
        console.log('   ✅ Tamper detection working');
      } else {
        console.log('   ❌ Failed to detect tampering');
        allTestsPassed = false;
      }
    } else {
      console.log('   ❌ Integrity verification failed');
      allTestsPassed = false;
    }
    
    // Test 7: Security Headers
    console.log('\n7️⃣  Testing Security Headers (Manual Check Required)...');
    console.log('   ℹ️  Security headers are enforced at runtime');
    console.log('   ℹ️  Test by making HTTPS requests to the API');
    console.log('   ℹ️  Headers enforced:');
    console.log('      - Strict-Transport-Security');
    console.log('      - X-Frame-Options: DENY');
    console.log('      - X-Content-Type-Options: nosniff');
    console.log('      - Content-Security-Policy');
    
    // Summary
    console.log('\n' + '='.repeat(50));
    if (allTestsPassed) {
      console.log('🎉 All encryption tests passed successfully!');
      console.log('✅ CJIS Phase 2 implementation is working correctly');
    } else {
      console.log('⚠️  Some tests failed. Please review the output above.');
    }
    console.log('='.repeat(50) + '\n');
    
  } catch (error) {
    console.error('❌ Test error:', error);
    allTestsPassed = false;
  } finally {
    await pool.end();
    process.exit(allTestsPassed ? 0 : 1);
  }
}

// Run tests
testEncryption();