#!/bin/bash

# Test CJIS Features in Production
PROD_URL="https://cmansrms.us/api"

echo "🔍 Testing CJIS Security Features in Production"
echo "=============================================="

# 1. Check Security Metrics
echo -e "\n📊 Security Metrics:"
curl -s "$PROD_URL/security-dashboard/metrics" | jq '.'

# 2. Check Compliance Score
echo -e "\n📈 Compliance Score:"
curl -s "$PROD_URL/compliance-governance/compliance/score" | jq '.'

# 3. Check Incident Statistics
echo -e "\n🚨 Incident Statistics:"
curl -s "$PROD_URL/incident-response/statistics" | jq '.'

echo -e "\n✅ Production CJIS Test Complete"