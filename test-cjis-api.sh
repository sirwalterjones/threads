#!/bin/bash

# CJIS API Testing Script
# Run this to verify all CJIS features are working

API_URL="http://localhost:5050/api"
TOKEN="your-jwt-token-here" # You'll need to login first to get this

echo "🔍 Testing CJIS Security Features"
echo "================================="

# 1. Check Security Metrics
echo -e "\n📊 Security Metrics:"
curl -s "$API_URL/security-dashboard/metrics" | jq '.'

# 2. Check Compliance Score
echo -e "\n📈 Compliance Score:"
curl -s "$API_URL/compliance-governance/compliance/score" | jq '.'

# 3. Check Audit Logs (last 5)
echo -e "\n📝 Recent Audit Logs:"
curl -s "$API_URL/security-dashboard/audit-logs?limit=5" | jq '.logs[] | {action: .action, timestamp: .timestamp}'

# 4. Check Active Incidents
echo -e "\n🚨 Active Incidents:"
curl -s "$API_URL/incident-response/statistics" | jq '.'

# 5. Check Training Modules
echo -e "\n📚 Training Modules:"
curl -s "$API_URL/compliance-governance/training/modules" | jq '.modules[] | {name: .module_name, category: .category}'

echo -e "\n✅ CJIS API Test Complete"