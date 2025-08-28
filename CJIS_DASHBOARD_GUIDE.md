# 🛡️ CJIS Security Dashboard Guide

## Overview
The Vector Intelligence Platform now includes full CJIS v6.0 compliance features. All security controls are implemented and operational.

## 🎯 How to Access CJIS Features

### 1. **Frontend Dashboard** (NEW!)
Navigate to: **`/security`** in your browser (Admin users only)

The Security Dashboard displays:
- **Compliance Score**: Overall CJIS compliance percentage
- **Active Incidents**: Real-time incident count and status
- **Security Events**: Today's security event count
- **Active Users**: Current active user sessions
- **Security Alerts**: Critical security notifications
- **Audit Logs**: Recent audit trail entries
- **Policy Area Compliance**: Individual scores for all 13 CJIS areas

### 2. **API Endpoints**
All CJIS features are accessible via REST API:

#### Security Dashboard APIs
```bash
GET /api/security-dashboard/metrics          # System metrics
GET /api/security-dashboard/audit-logs       # Audit trail
GET /api/security-dashboard/alerts           # Security alerts
GET /api/security-dashboard/incidents        # Security incidents
```

#### Incident Response APIs
```bash
GET /api/incident-response/incidents         # View incidents
POST /api/incident-response/incidents        # Create incident
GET /api/incident-response/statistics        # Incident stats
POST /api/incident-response/incidents/:id/contain  # Containment
POST /api/incident-response/incidents/:id/recover  # Recovery
```

#### Compliance & Governance APIs
```bash
GET /api/compliance-governance/compliance/score     # Compliance score
GET /api/compliance-governance/compliance/report    # Full report
GET /api/compliance-governance/personnel           # Personnel security
GET /api/compliance-governance/training/modules    # Training modules
GET /api/compliance-governance/devices            # Mobile devices
GET /api/compliance-governance/audits            # Formal audits
```

## 🔐 Security Features by Phase

### **Phase 1-2: Core Security**
- ✅ Multi-factor authentication (MFA)
- ✅ Advanced password policies (14+ chars, complexity)
- ✅ Session management (30-min timeout)
- ✅ AES-256-GCM encryption for all CJI data
- ✅ TLS 1.3 enforcement

### **Phase 3: Auditing & Monitoring**
- ✅ Comprehensive audit logging with integrity chains
- ✅ Real-time security monitoring
- ✅ Threat detection (brute force, impossible travel)
- ✅ Automated alerting system
- ✅ 7-year audit retention

### **Phase 4: Incident Response**
- ✅ Incident lifecycle management
- ✅ Automated containment actions
- ✅ Forensics collection
- ✅ Recovery planning
- ✅ Incident reporting

### **Phase 5: Compliance & Governance**
- ✅ Personnel security management
- ✅ Security awareness training
- ✅ Configuration baseline control
- ✅ Mobile device management
- ✅ Compliance scoring and reporting
- ✅ Formal audit support

## 📊 Key Metrics to Monitor

1. **Compliance Score** - Should be >90% for full compliance
2. **Active Incidents** - Monitor and respond quickly
3. **Failed Login Attempts** - Watch for brute force attacks
4. **Training Compliance** - Ensure all users complete required training
5. **Audit Log Integrity** - Verify hash chains are intact

## 🚀 Quick Start

### View Security Status
1. Login as admin user
2. Click "Security Dashboard" in sidebar
3. Review compliance score and alerts

### Respond to Incident
1. Go to Security Dashboard
2. Click on "Incidents" tab
3. Select incident and choose action (contain/recover)

### Check Compliance
1. Go to Security Dashboard
2. Click "Compliance" tab
3. Review policy area scores
4. Generate compliance report

## 🧪 Testing the System

Run the API test script:
```bash
chmod +x test-cjis-api.sh
./test-cjis-api.sh
```

Or manually check key endpoints:
```bash
# Check compliance score
curl http://localhost:5050/api/compliance-governance/compliance/score

# View security metrics
curl http://localhost:5050/api/security-dashboard/metrics

# Get audit logs
curl http://localhost:5050/api/security-dashboard/audit-logs?limit=5
```

## 📝 Database Tables

The CJIS implementation added 35+ security tables including:
- `cjis_audit_log` - Audit trail with integrity protection
- `security_incidents` - Security incident tracking
- `incident_response` - Incident management
- `personnel_security` - Personnel records
- `security_training` - Training assignments
- `mobile_devices` - Device management
- `compliance_reports` - Compliance documentation

## 🔔 Monitoring & Alerts

The system automatically monitors for:
- Failed login attempts (>5 = lockout)
- Impossible travel (geographic anomalies)
- Excessive data access
- Configuration changes
- Unauthorized access attempts
- Training expiration
- Compliance violations

## 📈 Compliance Reporting

Generate compliance reports via:
1. Dashboard UI - Click "Generate Report" button
2. API - `GET /api/compliance-governance/compliance/report`
3. Scheduled - Reports auto-generate monthly

Reports include:
- Overall compliance score
- Policy area assessments
- Security metrics
- Violation details
- Recommendations
- Executive summary

## ⚠️ Important Notes

1. **Admin Access Required**: Most CJIS features require admin role
2. **Audit Everything**: All CJI access is logged
3. **MFA Required**: Enable MFA for all users handling CJI
4. **Training Mandatory**: Users must complete security training
5. **Regular Reviews**: Check compliance weekly

## 🆘 Troubleshooting

### Dashboard Not Loading?
- Ensure you're logged in as admin
- Check browser console for errors
- Verify API is running: `curl http://localhost:5050/health`

### Low Compliance Score?
- Review each policy area in dashboard
- Check for expired training
- Ensure MFA is enabled for all users
- Verify audit logging is active

### Missing Data?
- Run migrations: `npm run migrate`
- Check database connection
- Verify environment variables

## 📚 Resources

- [CJIS Security Policy v6.0](https://www.fbi.gov/file-repository/cjis-security-policy)
- [CJIS Compliance Plan](./CJIS_COMPLIANCE_PLAN.md)
- [API Documentation](./docs/api.md)
- [Security Best Practices](./docs/security.md)

---

**Status**: ✅ FULLY OPERATIONAL - All CJIS v6.0 requirements implemented