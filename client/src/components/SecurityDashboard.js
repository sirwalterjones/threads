import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Shield, AlertTriangle, CheckCircle, Users, 
  FileText, Activity, Lock, Database 
} from 'lucide-react';

const SecurityDashboard = () => {
  const [metrics, setMetrics] = useState(null);
  const [complianceScore, setComplianceScore] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const [metricsRes, complianceRes, incidentsRes, auditRes, alertsRes] = await Promise.all([
        axios.get('/api/security-dashboard/metrics', config),
        axios.get('/api/compliance-governance/compliance/score', config),
        axios.get('/api/incident-response/statistics', config),
        axios.get('/api/security-dashboard/audit-logs?limit=10', config),
        axios.get('/api/security-dashboard/alerts', config)
      ]);

      setMetrics(metricsRes.data);
      setComplianceScore(complianceRes.data);
      setIncidents(incidentsRes.data);
      setAuditLogs(auditRes.data.logs || []);
      setAlerts(alertsRes.data.alerts || []);
      setLoading(false);
    } catch (error) {
      console.error('Dashboard fetch error:', error);
      setLoading(false);
    }
  };

  const getComplianceColor = (score) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getAlertSeverityColor = (severity) => {
    switch(severity) {
      case 'CRITICAL': return 'bg-red-100 text-red-800';
      case 'HIGH': return 'bg-orange-100 text-orange-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Shield className="h-8 w-8 text-blue-600" />
          CJIS Security Dashboard
        </h1>
        <p className="text-gray-600 mt-2">
          Criminal Justice Information Services Security Policy v6.0 Compliance
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {/* Compliance Score */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Compliance Score</p>
              <p className={`text-3xl font-bold ${getComplianceColor(complianceScore?.score?.overall || 0)}`}>
                {complianceScore?.score?.overall || 0}%
              </p>
            </div>
            <CheckCircle className="h-10 w-10 text-gray-400" />
          </div>
        </div>

        {/* Active Incidents */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Incidents</p>
              <p className="text-3xl font-bold text-gray-900">
                {incidents?.overall?.active_incidents || 0}
              </p>
            </div>
            <AlertTriangle className="h-10 w-10 text-yellow-500" />
          </div>
        </div>

        {/* Security Events Today */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Events Today</p>
              <p className="text-3xl font-bold text-gray-900">
                {metrics?.events_today || 0}
              </p>
            </div>
            <Activity className="h-10 w-10 text-blue-500" />
          </div>
        </div>

        {/* Active Users */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Users</p>
              <p className="text-3xl font-bold text-gray-900">
                {metrics?.active_users || 0}
              </p>
            </div>
            <Users className="h-10 w-10 text-green-500" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {['overview', 'incidents', 'audit', 'compliance'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2 px-1 border-b-2 font-medium text-sm capitalize ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow">
        {activeTab === 'overview' && (
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4">Security Alerts</h2>
            {alerts.length > 0 ? (
              <div className="space-y-3">
                {alerts.slice(0, 5).map((alert, idx) => (
                  <div key={idx} className="border-l-4 border-red-500 pl-4 py-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className={`inline-block px-2 py-1 text-xs rounded ${getAlertSeverityColor(alert.severity)}`}>
                          {alert.severity}
                        </span>
                        <p className="font-medium mt-1">{alert.alert_type}</p>
                        <p className="text-sm text-gray-600">{alert.description}</p>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(alert.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No active security alerts</p>
            )}
          </div>
        )}

        {activeTab === 'incidents' && (
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4">Incident Statistics</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-50 p-4 rounded">
                <p className="text-sm text-gray-600">Total Incidents</p>
                <p className="text-2xl font-bold">{incidents?.overall?.total_incidents || 0}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded">
                <p className="text-sm text-gray-600">Critical</p>
                <p className="text-2xl font-bold text-red-600">
                  {incidents?.overall?.critical_incidents || 0}
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded">
                <p className="text-sm text-gray-600">Avg Resolution</p>
                <p className="text-2xl font-bold">
                  {Math.round(incidents?.overall?.avg_resolution_minutes || 0)} min
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4">Recent Audit Logs</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Classification</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {auditLogs.map((log, idx) => (
                    <tr key={idx}>
                      <td className="px-6 py-4 text-sm text-gray-900">{log.action}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{log.username || 'System'}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-1 text-xs rounded ${
                          log.data_classification === 'cji' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {log.data_classification}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'compliance' && (
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4">CJIS Policy Areas</h2>
            <div className="space-y-3">
              {complianceScore?.score?.policyAreas && Object.entries(complianceScore.score.policyAreas).map(([area, data]) => (
                <div key={area} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <span className="text-sm font-medium capitalize">{area.replace(/_/g, ' ')}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          data.score >= 90 ? 'bg-green-500' : 
                          data.score >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${data.score}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-12">{data.score}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-sm text-gray-500">
        CJIS Security Policy v6.0 Compliant • Last Updated: {new Date().toLocaleString()}
      </div>
    </div>
  );
};

export default SecurityDashboard;