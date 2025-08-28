import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Tabs,
  Tab,
  LinearProgress,
  Alert,
  AlertTitle,
  Paper,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Shield,
  Warning,
  CheckCircle,
  Group,
  Description,
  TrendingUp,
  Lock,
  Storage,
  Refresh,
  Security,
  ReportProblem,
  VerifiedUser
} from '@mui/icons-material';
import Grid from '@mui/material/GridLegacy';
import axios from 'axios';
import { API_BASE_URL } from '../services/api';

interface SecurityMetrics {
  events_today: number;
  active_users: number;
  failed_logins: number;
  active_sessions: number;
}

interface ComplianceScore {
  score: {
    overall: number;
    policyAreas: {
      [key: string]: {
        score: number;
        violations: number;
      };
    };
  };
}

interface IncidentStatistics {
  overall: {
    total_incidents: number;
    active_incidents: number;
    critical_incidents: number;
    avg_resolution_minutes: number;
  };
}

interface AuditLog {
  id: number;
  action: string;
  username?: string;
  data_classification: string;
  timestamp: string;
}

interface SecurityAlert {
  id: number;
  alert_type: string;
  severity: string;
  description: string;
  created_at: string;
}

const SecurityDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [complianceScore, setComplianceScore] = useState<ComplianceScore | null>(null);
  const [incidents, setIncidents] = useState<IncidentStatistics | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      setRefreshing(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.error('No authentication token found');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Setup axios config with token
      const config = {
        headers: {
          Authorization: `Bearer ${token}`
        }
      };

      // Fetch all dashboard data in parallel
      const [metricsRes, complianceRes, incidentsRes, auditRes, alertsRes] = await Promise.allSettled([
        axios.get(`${API_BASE_URL}/security-dashboard/metrics`, config),
        axios.get(`${API_BASE_URL}/compliance-governance/compliance/score`, config),
        axios.get(`${API_BASE_URL}/incident-response/statistics`, config),
        axios.get(`${API_BASE_URL}/security-dashboard/audit-logs?limit=10`, config),
        axios.get(`${API_BASE_URL}/security-dashboard/alerts`, config)
      ]);

      // Handle metrics response
      if (metricsRes.status === 'fulfilled') {
        setMetrics(metricsRes.value.data);
      } else if (metricsRes.status === 'rejected') {
        console.error('Failed to fetch metrics:', metricsRes.reason);
        // Set default metrics if API fails
        setMetrics({
          events_today: 0,
          active_users: 0,
          failed_logins: 0,
          active_sessions: 0
        });
      }

      // Handle compliance response
      if (complianceRes.status === 'fulfilled') {
        setComplianceScore(complianceRes.value.data);
      } else if (complianceRes.status === 'rejected') {
        console.error('Failed to fetch compliance score:', complianceRes.reason);
      }

      // Handle incidents response
      if (incidentsRes.status === 'fulfilled') {
        setIncidents(incidentsRes.value.data);
      } else if (incidentsRes.status === 'rejected') {
        console.error('Failed to fetch incidents:', incidentsRes.reason);
      }

      // Handle audit logs response
      if (auditRes.status === 'fulfilled') {
        if (auditRes.value.data?.logs) {
          setAuditLogs(auditRes.value.data.logs);
        }
      } else if (auditRes.status === 'rejected') {
        console.error('Failed to fetch audit logs:', auditRes.reason);
      }

      // Handle alerts response
      if (alertsRes.status === 'fulfilled') {
        if (alertsRes.value.data?.alerts) {
          setAlerts(alertsRes.value.data.alerts);
        }
      } else if (alertsRes.status === 'rejected') {
        console.error('Failed to fetch alerts:', alertsRes.reason);
      }

      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.error('Dashboard fetch error:', error);
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getComplianceColor = (score: number): "success" | "warning" | "error" => {
    if (score >= 90) return 'success';
    if (score >= 70) return 'warning';
    return 'error';
  };

  const getAlertSeverityColor = (severity: string): "error" | "warning" | "info" => {
    switch(severity) {
      case 'CRITICAL':
      case 'HIGH':
        return 'error';
      case 'MEDIUM':
        return 'warning';
      default:
        return 'info';
    }
  };

  const formatPolicyAreaName = (area: string): string => {
    return area
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  if (loading && !refreshing) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  const tabPanelIndex = activeTab;

  return (
    <Box sx={{ p: 3, backgroundColor: '#1a1a1a', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center" gap={2}>
            <Shield sx={{ fontSize: 40, color: '#fff' }} />
            <Typography variant="h4" sx={{ color: '#fff', fontWeight: 600 }}>
              CJIS Security Dashboard
            </Typography>
          </Box>
          <Tooltip title="Refresh Data">
            <IconButton onClick={fetchDashboardData} disabled={refreshing} sx={{ color: '#fff' }}>
              <Refresh sx={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            </IconButton>
          </Tooltip>
        </Box>
        <Typography variant="body2" sx={{ color: '#999' }}>
          Criminal Justice Information Services Security Policy v6.0 Compliance
        </Typography>
      </Box>

      {/* Key Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Compliance Score */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ backgroundColor: '#2d2d2d', border: '1px solid #444', boxShadow: 1 }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="body2" sx={{ color: '#999' }}>
                    Compliance Score
                  </Typography>
                  <Typography 
                    variant="h4" 
                    sx={{ 
                      color: complianceScore?.score?.overall 
                        ? complianceScore.score.overall >= 90 ? '#4caf50' 
                        : complianceScore.score.overall >= 70 ? '#ff9800' 
                        : '#f44336'
                        : '#fff',
                      fontWeight: 600 
                    }}
                  >
                    {complianceScore?.score?.overall || 0}%
                  </Typography>
                </Box>
                <VerifiedUser sx={{ fontSize: 40, color: '#4caf50', opacity: 0.7 }} />
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={complianceScore?.score?.overall || 0}
                sx={{ 
                  mt: 2,
                  backgroundColor: '#444',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: complianceScore?.score?.overall 
                      ? complianceScore.score.overall >= 90 ? '#4caf50' 
                      : complianceScore.score.overall >= 70 ? '#ff9800' 
                      : '#f44336'
                      : '#00d4ff'
                  }
                }}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Active Incidents */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ backgroundColor: '#2d2d2d', border: '1px solid #444', boxShadow: 1 }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="body2" sx={{ color: '#999' }}>
                    Active Incidents
                  </Typography>
                  <Typography variant="h4" sx={{ color: '#ffffff', fontWeight: 600 }}>
                    {incidents?.overall?.active_incidents || 0}
                  </Typography>
                  {incidents?.overall?.critical_incidents ? (
                    <Typography variant="caption" sx={{ color: '#f44336' }}>
                      {incidents.overall.critical_incidents} Critical
                    </Typography>
                  ) : null}
                </Box>
                <Warning sx={{ fontSize: 40, color: '#ff9800', opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Security Events Today */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ backgroundColor: '#2d2d2d', border: '1px solid #444', boxShadow: 1 }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="body2" sx={{ color: '#999' }}>
                    Events Today
                  </Typography>
                  <Typography variant="h4" sx={{ color: '#ffffff', fontWeight: 600 }}>
                    {metrics?.events_today || 0}
                  </Typography>
                </Box>
                <TrendingUp sx={{ fontSize: 40, color: '#2196f3', opacity: 0.7 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Active Users */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ backgroundColor: '#2d2d2d', border: '1px solid #444', boxShadow: 1 }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="body2" sx={{ color: '#999' }}>
                    Active Users
                  </Typography>
                  <Typography variant="h4" sx={{ color: '#ffffff', fontWeight: 600 }}>
                    {metrics?.active_users || 0}
                  </Typography>
                </Box>
                <Group sx={{ fontSize: 40, color: '#4caf50', opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Paper sx={{ backgroundColor: '#2d2d2d', border: '1px solid #444', mb: 3 }}>
        <Tabs 
          value={activeTab} 
          onChange={(_, newValue) => setActiveTab(newValue)}
          sx={{
            borderBottom: '1px solid #444',
            '& .MuiTab-root': {
              color: '#999',
              '&.Mui-selected': {
                color: '#fff',
              },
            },
            '& .MuiTabs-indicator': {
              backgroundColor: '#fff',
            },
          }}
        >
          <Tab label="Overview" />
          <Tab label="Incidents" />
          <Tab label="Audit Trail" />
          <Tab label="Compliance" />
        </Tabs>

        {/* Tab Content */}
        <Box sx={{ p: 3 }}>
          {/* Overview Tab */}
          {tabPanelIndex === 0 && (
            <Box>
              <Typography variant="h6" sx={{ color: '#fff', mb: 2 }}>
                Security Alerts
              </Typography>
              {alerts.length > 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {alerts.slice(0, 5).map((alert) => (
                    <Alert 
                      key={alert.id}
                      severity={getAlertSeverityColor(alert.severity)}
                      icon={<ReportProblem />}
                      sx={{ 
                        backgroundColor: '#2d2d2d',
                        border: '1px solid',
                        borderColor: alert.severity === 'CRITICAL' ? '#f44336' : 
                                    alert.severity === 'HIGH' ? '#ff9800' : '#2196f3',
                        '& .MuiAlert-icon': {
                          color: alert.severity === 'CRITICAL' ? '#f44336' : 
                                 alert.severity === 'HIGH' ? '#ff9800' : '#2196f3',
                        }
                      }}
                    >
                      <AlertTitle sx={{ color: '#fff' }}>
                        {alert.alert_type}
                      </AlertTitle>
                      <Typography variant="body2" sx={{ color: '#999' }}>
                        {alert.description}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#999', mt: 1, display: 'block' }}>
                        {new Date(alert.created_at).toLocaleString()}
                      </Typography>
                    </Alert>
                  ))}
                </Box>
              ) : (
                <Typography variant="body1" sx={{ color: '#999' }}>
                  No active security alerts
                </Typography>
              )}
            </Box>
          )}

          {/* Incidents Tab */}
          {tabPanelIndex === 1 && (
            <Box>
              <Typography variant="h6" sx={{ color: '#fff', mb: 2 }}>
                Incident Statistics
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={4}>
                  <Card sx={{ backgroundColor: '#2d2d2d', border: '1px solid #444' }}>
                    <CardContent>
                      <Typography variant="body2" sx={{ color: '#999' }}>
                        Total Incidents
                      </Typography>
                      <Typography variant="h5" sx={{ color: '#fff', fontWeight: 600 }}>
                        {incidents?.overall?.total_incidents || 0}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Card sx={{ backgroundColor: '#2d2d2d', border: '1px solid #444' }}>
                    <CardContent>
                      <Typography variant="body2" sx={{ color: '#999' }}>
                        Critical Incidents
                      </Typography>
                      <Typography variant="h5" sx={{ color: '#f44336', fontWeight: 600 }}>
                        {incidents?.overall?.critical_incidents || 0}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Card sx={{ backgroundColor: '#2d2d2d', border: '1px solid #444' }}>
                    <CardContent>
                      <Typography variant="body2" sx={{ color: '#999' }}>
                        Avg Resolution Time
                      </Typography>
                      <Typography variant="h5" sx={{ color: '#fff', fontWeight: 600 }}>
                        {Math.round(incidents?.overall?.avg_resolution_minutes || 0)} min
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Audit Trail Tab */}
          {tabPanelIndex === 2 && (
            <Box>
              <Typography variant="h6" sx={{ color: '#fff', mb: 2 }}>
                Recent Audit Logs
              </Typography>
              <TableContainer component={Paper} sx={{ backgroundColor: '#2d2d2d', border: '1px solid #444' }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: '#999', borderBottom: '1px solid #444' }}>
                        Action
                      </TableCell>
                      <TableCell sx={{ color: '#999', borderBottom: '1px solid #444' }}>
                        User
                      </TableCell>
                      <TableCell sx={{ color: '#999', borderBottom: '1px solid #444' }}>
                        Classification
                      </TableCell>
                      <TableCell sx={{ color: '#999', borderBottom: '1px solid #444' }}>
                        Time
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {auditLogs.length > 0 ? (
                      auditLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell sx={{ color: '#fff', borderBottom: '1px solid #444' }}>
                            {log.action}
                          </TableCell>
                          <TableCell sx={{ color: '#999', borderBottom: '1px solid #444' }}>
                            {log.username || 'System'}
                          </TableCell>
                          <TableCell sx={{ borderBottom: '1px solid #444' }}>
                            <Chip
                              label={log.data_classification}
                              size="small"
                              sx={{
                                backgroundColor: log.data_classification === 'cji' ? '#4d1f1f' : '#1f3a4d',
                                color: log.data_classification === 'cji' ? '#ff6b6b' : '#64b5f6',
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ color: '#999', borderBottom: '1px solid #444' }}>
                            {new Date(log.timestamp).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ color: '#666', borderBottom: 'none' }}>
                          No audit logs available
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Compliance Tab */}
          {tabPanelIndex === 3 && (
            <Box>
              <Typography variant="h6" sx={{ color: '#fff', mb: 2 }}>
                CJIS Policy Areas
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {complianceScore?.score?.policyAreas && Object.entries(complianceScore.score.policyAreas).map(([area, data]) => (
                  <Box key={area} sx={{ p: 2, backgroundColor: '#2d2d2d', border: '1px solid #444', borderRadius: 1 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="body1" sx={{ color: '#fff', textTransform: 'capitalize' }}>
                        {formatPolicyAreaName(area)}
                      </Typography>
                      <Box display="flex" alignItems="center" gap={2}>
                        <Box sx={{ width: 200 }}>
                          <LinearProgress 
                            variant="determinate" 
                            value={data.score}
                            sx={{ 
                              height: 8,
                              borderRadius: 4,
                              backgroundColor: '#444',
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 4,
                                backgroundColor: data.score >= 90 ? '#4caf50' : 
                                               data.score >= 70 ? '#ff9800' : '#f44336'
                              }
                            }}
                          />
                        </Box>
                        <Typography variant="body2" sx={{ color: '#fff', minWidth: 50 }}>
                          {data.score}%
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                ))}
                {!complianceScore?.score?.policyAreas && (
                  <Typography variant="body1" sx={{ color: '#999' }}>
                    No compliance data available
                  </Typography>
                )}
              </Box>
            </Box>
          )}
        </Box>
      </Paper>

      {/* Footer */}
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography variant="caption" sx={{ color: '#999' }}>
          CJIS Security Policy v6.0 Compliant • Last Updated: {new Date().toLocaleString()}
        </Typography>
      </Box>
    </Box>
  );
};

export default SecurityDashboard;