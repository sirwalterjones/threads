const fs = require('fs');
const path = require('path');

// Read the current file
const filePath = path.join(__dirname, 'services', 'complianceGovernance.js');
let content = fs.readFileSync(filePath, 'utf8');

// Fix getTrainingCompliance method - add it after checkTrainingCompliance
const getTrainingComplianceMethod = `
  async getTrainingCompliance(userId) {
    try {
      const result = await pool.query(\`
        SELECT 
          COUNT(*) as total_required,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
          COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
          COUNT(CASE WHEN status = 'overdue' OR 
                (status != 'completed' AND due_date < CURRENT_TIMESTAMP) 
                THEN 1 END) as overdue
        FROM security_training
        WHERE user_id = $1
      \`, [userId]);
      
      const stats = result.rows[0];
      const totalRequired = parseInt(stats.total_required) || 0;
      const completed = parseInt(stats.completed) || 0;
      
      return {
        totalRequired,
        completed,
        inProgress: parseInt(stats.in_progress) || 0,
        overdue: parseInt(stats.overdue) || 0,
        complianceRate: totalRequired > 0 ? ((completed / totalRequired) * 100).toFixed(2) + '%' : '100%'
      };
    } catch (error) {
      console.error('Training compliance error:', error);
      throw error;
    }
  }`;

// Find and add getTrainingCompliance after checkTrainingCompliance
const checkTrainingIndex = content.indexOf('async checkTrainingCompliance(userId)');
if (checkTrainingIndex !== -1) {
  // Find the end of checkTrainingCompliance method
  let braceCount = 0;
  let inMethod = false;
  let endIndex = checkTrainingIndex;
  
  for (let i = checkTrainingIndex; i < content.length; i++) {
    if (content[i] === '{') {
      braceCount++;
      inMethod = true;
    } else if (content[i] === '}' && inMethod) {
      braceCount--;
      if (braceCount === 0) {
        endIndex = i + 1;
        break;
      }
    }
  }
  
  // Insert the new method after checkTrainingCompliance
  content = content.slice(0, endIndex) + '\n' + getTrainingComplianceMethod + '\n' + content.slice(endIndex);
}

// Fix updateClearanceLevel method
const updateClearanceLevelMethod = `
  async updateClearanceLevel(userId, newLevel, justification, approvedBy) {
    try {
      const result = await pool.query(\`
        UPDATE personnel_security
        SET 
          clearance_level = $1,
          clearance_granted_date = CURRENT_TIMESTAMP,
          clearance_history = COALESCE(clearance_history, '[]'::jsonb) || 
            jsonb_build_object(
              'previousLevel', clearance_level,
              'newLevel', $1,
              'changedAt', CURRENT_TIMESTAMP,
              'approvedBy', $2,
              'justification', $3
            ),
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $4
        RETURNING *
      \`, [newLevel, approvedBy, justification, userId]);
      
      if (result.rows.length === 0) {
        throw new Error('Personnel record not found');
      }
      
      return result.rows[0];
    } catch (error) {
      console.error('Clearance update error:', error);
      throw error;
    }
  }`;

// Find and add updateClearanceLevel if it doesn't exist
if (!content.includes('async updateClearanceLevel')) {
  // Add it after verifySecurityClearance
  const verifyClearanceIndex = content.indexOf('async verifySecurityClearance');
  if (verifyClearanceIndex !== -1) {
    let braceCount = 0;
    let inMethod = false;
    let endIndex = verifyClearanceIndex;
    
    for (let i = verifyClearanceIndex; i < content.length; i++) {
      if (content[i] === '{') {
        braceCount++;
        inMethod = true;
      } else if (content[i] === '}' && inMethod) {
        braceCount--;
        if (braceCount === 0) {
          endIndex = i + 1;
          break;
        }
      }
    }
    
    content = content.slice(0, endIndex) + '\n' + updateClearanceLevelMethod + '\n' + content.slice(endIndex);
  }
}

// Fix calculateComplianceScore to not reference 'active' column
content = content.replace(
  "WHERE active = true",
  "WHERE 1=1"
);

// Fix assessPolicyArea to not reference user_id in personnel_security check
content = content.replace(
  "COUNT(CASE WHEN ps.user_id IS NOT NULL THEN 1 END)",
  "COUNT(ps.id)"
);

// Fix other table references
content = content.replace(/training_assignments/g, 'security_training');
content = content.replace(/training_certificates/g, 'security_training');
content = content.replace(/security_training_records/g, 'security_training');
content = content.replace(/personnel_access_rights/g, 'personnel_security');

// Write the fixed content back
fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Fixed compliance governance service');
console.log('Updated methods:');
console.log('  - Added getTrainingCompliance()');
console.log('  - Added updateClearanceLevel()');
console.log('  - Fixed table references');
console.log('  - Fixed column references');