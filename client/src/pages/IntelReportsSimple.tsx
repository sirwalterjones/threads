import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  CardActions,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Badge,
  LinearProgress
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Security as SecurityIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  Assignment as AssignmentIcon,
  AccessTime as PendingIcon,
  Error as RejectedIcon,
  Verified as ApprovedIcon,
  Warning as WarningIcon,
  Add as AddIcon,
  FileDownload as ExportIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import IntelReportEditForm from '../components/IntelReport/IntelReportEditForm';

interface IntelReport {
  id: string;
  intelNumber: string;
  classification: string;
  date: string;
  agentName: string;
  agent_id?: number; // Add agent_id for permission checks
  caseNumber?: string;
  subject: string;
  criminalActivity: string;
  summary: string;
  status: 'pending' | 'approved' | 'rejected';
  corrected?: boolean;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewComments?: string;
  subjects: number; // Count
  organizations: number; // Count
  filesCount: number; // Count
  expiresAt?: string;
  isExpired?: boolean;
  daysUntilExpiration?: number;
  // Full data for details view
  subjectsData?: any[];
  organizationsData?: any[];
  sourcesData?: any[];
  reviews?: Array<{ id: number; reviewer_name: string; action: string; comments: string; created_at: string }>;
}

const IntelReportsSimple: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  
  const [reports, setReports] = useState<IntelReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<IntelReport | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<IntelReport | null>(null);
  const { user } = useAuth();

  const classificationColors: Record<string, string> = {
    'Sensitive': '#ff9800',
    'Narcotics Only': '#e91e63',
    'Classified': '#f44336',
    'Law Enforcement Only': '#3f51b5'
  };

  const statusIcons = {
    pending: <PendingIcon sx={{ color: '#ff9800' }} />,
    approved: <ApprovedIcon sx={{ color: '#4caf50' }} />,
    rejected: <RejectedIcon sx={{ color: '#f44336' }} />
  };

  // Load reports from API
  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          console.error('No authentication token found');
          setReports([]);
          return;
        }

        // Always fetch all reports so stats are accurate; filter client-side for view
        const response = await fetch(`/api/intel-reports?status=all`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // Transform the data to match the interface
        const transformedReports = (data.reports || []).map((report: any) => ({
          ...report,
          intelNumber: report.intel_number,
          agentName: report.agent_name || 'Unknown',
          agent_id: report.agent_id,
          corrected: !!report.corrected
        }));
        
        setReports(transformedReports);
      } catch (error) {
        console.error('Error fetching reports:', error);
        setReports([]);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [refreshTrigger]);

  const filteredReports = reports.filter(report => {
    if (statusFilter !== 'all' && report.status !== statusFilter) return false;
    if (searchTerm && !report.subject.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !report.intelNumber.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const pendingCount = reports.filter(r => r.status === 'pending').length;
  const expiredCount = reports.filter(r => r.isExpired).length;
  const expiringSoonCount = reports.filter(r => r.daysUntilExpiration && r.daysUntilExpiration <= 7 && !r.isExpired).length;

  const handleViewReport = async (report: IntelReport) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No authentication token found');
        setSelectedReport(report);
        return;
      }

      // Fetch the complete report data including subjects, organizations, and sources
      const response = await fetch(`/api/intel-reports/${report.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const payload = await response.json();
        const fullReport = payload.report || payload; // API returns { report }
        // Load review notes (corrections trail)
        let reviews: IntelReport['reviews'] = [];
        try {
          const notesResp = await fetch(`/api/intel-reports/${report.id}/reviews`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (notesResp.ok) {
            const notesData = await notesResp.json();
            reviews = notesData.reviews || [];
          }
        } catch (_) { /* ignore */ }

        // Merge the full data with the existing report
        const completeReport: IntelReport = {
          ...report,
          caseNumber: fullReport.case_number ?? report.caseNumber,
          criminalActivity: fullReport.criminal_activity ?? report.criminalActivity,
          summary: fullReport.summary ?? report.summary,
          subjectsData: fullReport.subjects || [],
          organizationsData: fullReport.organizations || [],
          sourcesData: fullReport.sources || [],
          reviews
        };
        setSelectedReport(completeReport);
      } else {
        // If we can't fetch full data, just show the basic report
        setSelectedReport(report);
      }
    } catch (error) {
      console.error('Error fetching full report data:', error);
      setSelectedReport(report);
    }
  };

  const handleEditReport = (report: IntelReport) => {
    setEditingReport(report);
    setEditModalOpen(true);
    setSelectedReport(null); // Close the view modal
  };

  const handleRefreshReports = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // Delete is only available in approval page

  const getClassificationChip = (classification: string) => (
    <Chip 
      label={classification}
      sx={{ 
        backgroundColor: classificationColors[classification] || '#gray',
        color: 'white',
        fontWeight: 'bold'
      }}
      size="small"
    />
  );

  const getStatusChip = (status: string) => (
    <Chip
      icon={statusIcons[status as keyof typeof statusIcons]}
      label={status.charAt(0).toUpperCase() + status.slice(1)}
      variant="outlined"
      size="small"
      sx={{
        color: '#E7E9EA',
        borderColor: status === 'pending' ? '#ff9800' : status === 'approved' ? '#4caf50' : '#f44336',
        '& .MuiChip-label': {
          color: '#E7E9EA !important'
        },
        '& .MuiChip-icon': {
          color: status === 'pending' ? '#ff9800' : status === 'approved' ? '#4caf50' : '#f44336'
        }
      }}
    />
  );

  const getExpirationChip = (report: IntelReport) => {
    if (report.isExpired) {
      return <Chip label="Expired" color="error" size="small" />;
    }
    if (report.daysUntilExpiration && report.daysUntilExpiration <= 30) {
      return (
        <Chip 
          label={`${report.daysUntilExpiration} days left`} 
          color="warning" 
          size="small"
          icon={<WarningIcon />}
        />
      );
    }
    if (report.daysUntilExpiration) {
      return (
        <Chip 
          label={`${Math.floor(report.daysUntilExpiration / 365)} years left`} 
          color="info" 
          size="small" 
        />
      );
    }
    return null;
  };

  return (
    <Box sx={{ 
      maxWidth: 1400, 
      mx: 'auto', 
      p: { xs: 2, md: 3 },
      backgroundColor: '#000000',
      minHeight: '100vh',
      color: '#E7E9EA'
    }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Badge badgeContent={pendingCount} color="warning">
            <SecurityIcon sx={{ fontSize: 40, color: '#1D9BF0' }} />
          </Badge>
          <Box>
            <Typography variant="h4" component="h1" sx={{ color: '#E7E9EA' }}>
              Intelligence Reports
            </Typography>
            <Typography variant="body2" sx={{ color: '#71767B' }}>
              Manage and review intelligence reports
            </Typography>
          </Box>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button 
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/intel-reports/new')}
            sx={{ 
              backgroundColor: '#1D9BF0',
              color: '#ffffff',
              '&:hover': { backgroundColor: '#1a8cd8' }
            }}
          >
            New Report
          </Button>
          <IconButton sx={{ color: '#1D9BF0' }} title="Refresh" onClick={handleRefreshReports}>
            <RefreshIcon />
          </IconButton>
          <IconButton sx={{ color: '#1D9BF0' }} title="Export Reports">
            <ExportIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Status Cards */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Card sx={{ 
          flex: '1 1 200px', 
          textAlign: 'center', 
          cursor: 'pointer',
          backgroundColor: '#1f1f1f',
          border: '1px solid #2F3336',
          '&:hover': { backgroundColor: '#2F3336' }
        }} 
              onClick={() => setStatusFilter('pending')}>
          <CardContent sx={{ py: 2 }}>
            <Typography variant="h4" sx={{ color: '#ff9800' }}>{pendingCount}</Typography>
            <Typography variant="body2" sx={{ color: '#71767B' }}>Pending</Typography>
          </CardContent>
        </Card>
        <Card sx={{ 
          flex: '1 1 200px', 
          textAlign: 'center', 
          cursor: 'pointer',
          backgroundColor: '#1f1f1f',
          border: '1px solid #2F3336',
          '&:hover': { backgroundColor: '#2F3336' }
        }}>
          <CardContent sx={{ py: 2 }}>
            <Typography variant="h4" sx={{ color: '#f44336' }}>{expiredCount}</Typography>
            <Typography variant="body2" sx={{ color: '#71767B' }}>Expired</Typography>
          </CardContent>
        </Card>
        <Card sx={{ 
          flex: '1 1 200px', 
          textAlign: 'center', 
          cursor: 'pointer',
          backgroundColor: '#1f1f1f',
          border: '1px solid #2F3336',
          '&:hover': { backgroundColor: '#2F3336' }
        }}>
          <CardContent sx={{ py: 2 }}>
            <Typography variant="h4" sx={{ color: '#ff9800' }}>{expiringSoonCount}</Typography>
            <Typography variant="body2" sx={{ color: '#71767B' }}>Expiring Soon</Typography>
          </CardContent>
        </Card>
        <Card sx={{ 
          flex: '1 1 200px', 
          textAlign: 'center', 
          cursor: 'pointer',
          backgroundColor: '#1f1f1f',
          border: '1px solid #2F3336',
          '&:hover': { backgroundColor: '#2F3336' }
        }}
              onClick={() => setStatusFilter('approved')}>
          <CardContent sx={{ py: 2 }}>
            <Typography variant="h4" sx={{ color: '#4caf50' }}>
              {reports.filter(r => r.status === 'approved').length}
            </Typography>
            <Typography variant="body2" sx={{ color: '#71767B' }}>Approved</Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Filters */}
      <Paper sx={{ 
        p: 2, 
        mb: 3, 
        backgroundColor: '#1f1f1f',
        border: '1px solid #2F3336',
        '& .MuiInputLabel-root': { 
          color: '#E7E9EA',
          '&.Mui-focused': { color: '#1D9BF0' },
          '&.MuiInputLabel-shrink': { color: '#E7E9EA' }
        }, 
        '& .MuiOutlinedInput-root': { 
          color: '#E7E9EA',
          backgroundColor: '#2a2a2a',
          '& .MuiInputBase-input': { 
            color: '#E7E9EA'
          },
          '& .MuiOutlinedInput-notchedOutline': { 
            borderColor: '#3a3a3a'
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#1D9BF0'
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#1D9BF0'
          }
        },
        '& .MuiSvgIcon-root': { color: '#E7E9EA' },
        '& .MuiMenuItem-root': { 
          color: '#E7E9EA', 
          backgroundColor: '#2a2a2a',
          '&:hover': { backgroundColor: '#3a3a3a' }
        }
      }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <Box sx={{ flex: '1 1 200px', minWidth: '200px' }}>
            <TextField
              fullWidth
              size="small"
              label="Search reports..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: '#2a2a2a',
                  '& .MuiInputBase-input': {
                    color: '#E7E9EA'
                  },
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#3a3a3a'
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#1D9BF0'
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#1D9BF0'
                  }
                },
                '& .MuiInputLabel-root': {
                  color: '#E7E9EA',
                  '&.Mui-focused': { color: '#1D9BF0' },
                  '&.MuiInputLabel-shrink': { color: '#E7E9EA' }
                }
              }}
            />
          </Box>
          <Box sx={{ flex: '1 1 150px', minWidth: '150px' }}>
            <FormControl fullWidth size="small" sx={{
              '& .MuiInputLabel-root': { 
                color: '#E7E9EA',
                '&.Mui-focused': { color: '#1D9BF0' }
              },
              '& .MuiOutlinedInput-root': { 
                backgroundColor: '#2a2a2a',
                '& .MuiSelect-select': { color: '#E7E9EA' },
                '& .MuiOutlinedInput-notchedOutline': { 
                  borderColor: '#3a3a3a'
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#1D9BF0'
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#1D9BF0'
                }
              },
              '& .MuiSvgIcon-root': { color: '#E7E9EA' }
            }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                label="Status"
                MenuProps={{
                  PaperProps: {
                    sx: {
                      backgroundColor: '#16181C',
                      border: '1px solid #2F3336',
                      '& .MuiMenuItem-root': {
                        color: '#E7E9EA',
                        backgroundColor: 'transparent',
                        '&:hover': { backgroundColor: '#1D2126' },
                        '&.Mui-selected': { 
                          backgroundColor: '#1D9BF0',
                          color: '#ffffff',
                          '&:hover': { backgroundColor: '#1a8cd8' }
                        }
                      }
                    }
                  }
                }}
              >
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="pending">Pending ({reports.filter(r => r.status === 'pending').length})</MenuItem>
                <MenuItem value="approved">Approved ({reports.filter(r => r.status === 'approved').length})</MenuItem>
                <MenuItem value="rejected">Rejected ({reports.filter(r => r.status === 'rejected').length})</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ flex: '1 1 200px' }}>
            <Typography variant="body2" sx={{ color: '#71767B' }}>
              Showing {filteredReports.length} of {reports.length} reports
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Reports List */}
      {loading ? (
        <Box>
          <LinearProgress sx={{ mb: 2 }} />
          <Typography sx={{ textAlign: 'center', color: '#E7E9EA' }}>Loading reports...</Typography>
        </Box>
      ) : filteredReports.length === 0 ? (
        <Paper sx={{ 
          p: 4, 
          textAlign: 'center', 
          backgroundColor: '#1f1f1f',
          border: '1px solid #2F3336'
        }}>
          <SecurityIcon sx={{ fontSize: 64, color: '#71767B', mb: 2 }} />
          <Typography variant="h6" sx={{ color: '#71767B' }}>
            No reports found
          </Typography>
          <Typography variant="body2" sx={{ color: '#71767B', mb: 2 }}>
            Try adjusting your filters or create a new report
          </Typography>
          <Button 
            variant="contained" 
            startIcon={<AddIcon />}
            onClick={() => navigate('/intel-reports/new')}
            sx={{ 
              backgroundColor: '#1D9BF0',
              color: '#ffffff',
              '&:hover': { backgroundColor: '#1a8cd8' }
            }}
          >
            Create New Report
          </Button>
        </Paper>
      ) : isMobile ? (
        <Box>
          {filteredReports.map((report) => (
            <Card key={report.id} sx={{ mb: 2, opacity: report.isExpired ? 0.6 : 1 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box>
                    <Typography variant="h6" component="div">
                      Intel #{report.intelNumber}
                    </Typography>
                    <Typography color="text.secondary" gutterBottom>
                      {report.agentName} • {new Date(report.date).toLocaleDateString()}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-end' }}>
                    {getClassificationChip(report.classification)}
                    {getStatusChip(report.status)}
                    {report.status === 'pending' && report.corrected && (
                      <Chip label="Corrected" size="small" sx={{ ml: 1 }} color="info" />
                    )}
                    {getExpirationChip(report)}
                  </Box>
                </Box>
                
                <Typography variant="body1" sx={{ fontWeight: 'bold', mb: 1 }}>
                  {report.subject}
                </Typography>
                
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {report.criminalActivity.substring(0, 100)}...
                </Typography>

                {report.isExpired && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    This report has expired and should be reviewed for archival.
                  </Alert>
                )}
              </CardContent>
              
              <CardActions>
                <Button 
                  size="small" 
                  onClick={() => handleViewReport(report)}
                  startIcon={<VisibilityIcon />}
                >
                  View Details
                </Button>
              </CardActions>
            </Card>
          ))}
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ 
          backgroundColor: '#1f1f1f',
          border: '1px solid #2F3336',
          '& .MuiTable-root': {
            backgroundColor: '#1f1f1f'
          },
          '& .MuiTableHead-root': {
            backgroundColor: '#2a2a2a',
            '& .MuiTableCell-root': {
              color: '#E7E9EA',
              borderBottom: '1px solid #2F3336',
              fontWeight: 'bold'
            }
          },
          '& .MuiTableBody-root': {
            backgroundColor: '#1f1f1f',
            '& .MuiTableRow-root': {
              backgroundColor: '#1f1f1f',
              '&:hover': {
                backgroundColor: '#2a2a2a'
              },
              '& .MuiTableCell-root': {
                color: '#E7E9EA',
                borderBottom: '1px solid #2F3336'
              }
            }
          }
        }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Intel #</TableCell>
                <TableCell>Classification</TableCell>
                <TableCell>Subject</TableCell>
                <TableCell>Agent</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Expiration</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredReports.map((report) => (
                <TableRow 
                  key={report.id} 
                  hover 
                  sx={{ opacity: report.isExpired ? 0.6 : 1 }}
                >
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      {report.intelNumber}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {getClassificationChip(report.classification)}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {report.subject.length > 40 
                        ? `${report.subject.substring(0, 40)}...` 
                        : report.subject}
                    </Typography>
                  </TableCell>
                  <TableCell>{report.agentName}</TableCell>
                  <TableCell>
                    {new Date(report.date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {getStatusChip(report.status)}
                    {report.status === 'pending' && report.corrected && (
                      <Chip label="Corrected" size="small" sx={{ ml: 1 }} color="info" />
                    )}
                  </TableCell>
                  <TableCell>
                    {getExpirationChip(report)}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title="View Details">
                        <IconButton 
                          size="small" 
                          onClick={() => handleViewReport(report)}
                          sx={{ color: '#1D9BF0' }}
                        >
                          <VisibilityIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}


      {/* Report Details Dialog */}
      <Dialog 
        open={!!selectedReport} 
        onClose={() => setSelectedReport(null)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            backgroundColor: '#1f1f1f',
            color: '#E7E9EA',
            border: '1px solid #2F3336'
          }
        }}
      >
        {selectedReport && (
          <>
            <DialogTitle sx={{ backgroundColor: '#1f1f1f', color: '#E7E9EA', borderBottom: '1px solid #2F3336' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" sx={{ color: '#E7E9EA' }}>
                  Intel Report #{selectedReport.intelNumber}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {getClassificationChip(selectedReport.classification)}
                  {getStatusChip(selectedReport.status)}
                  {getExpirationChip(selectedReport)}
                </Box>
              </Box>
            </DialogTitle>
            <DialogContent dividers sx={{ backgroundColor: '#1f1f1f', color: '#E7E9EA' }}>
              {selectedReport.isExpired && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  This report has expired on {new Date(selectedReport.expiresAt!).toLocaleDateString()}
                </Alert>
              )}
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">Agent:</Typography>
                <Typography variant="body1">{selectedReport.agentName}</Typography>
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">Date:</Typography>
                <Typography variant="body1">
                  {new Date(selectedReport.date).toLocaleDateString()}
                </Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">Subject:</Typography>
                <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                  {selectedReport.subject}
                </Typography>
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">Criminal Activity:</Typography>
                <Typography variant="body1">{selectedReport.criminalActivity}</Typography>
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">Summary:</Typography>
                <Typography variant="body1">{selectedReport.summary}</Typography>
              </Box>

              {/* Corrections Trail for all users */}
              {selectedReport.reviews && selectedReport.reviews.length > 0 && (
                <Box sx={{ mb: 3, mt: 1 }}>
                  <Typography variant="h6" sx={{ color: '#E7E9EA', mb: 2, textAlign: 'center' }}>
                    Corrections Trail
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#71767B', mb: 2, textAlign: 'left' }}>
                    Reviewer notes and actions are listed below. Address the latest rejection comments.
                  </Typography>
                  {selectedReport.reviews.map((note: any) => (
                    <Box key={note.id} sx={{ p: 2, mb: 2, borderRadius: 2, backgroundColor: '#121416', border: '1px solid #2F3336' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="subtitle1" sx={{ color: note.action === 'rejected' ? '#f44336' : note.action === 'approved' ? '#4caf50' : '#1D9BF0', fontWeight: 700 }}>
                          {note.action?.charAt(0).toUpperCase() + note.action?.slice(1)}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#A1A7AD' }}>
                          {(note.reviewer_name || 'Reviewer')} • {new Date(note.created_at).toLocaleString()}
                        </Typography>
                      </Box>
                      {note.comments && (
                        <Typography variant="body2" sx={{ color: '#E7E9EA', whiteSpace: 'pre-wrap' }}>
                          {note.comments}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Box>
              )}

              {/* Case Number */}
              {selectedReport.caseNumber && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">Case Number:</Typography>
                  <Typography variant="body1">{selectedReport.caseNumber}</Typography>
                </Box>
              )}

              {/* Subjects Section */}
              {selectedReport.subjectsData && selectedReport.subjectsData.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ color: '#E7E9EA', mb: 2, borderBottom: '1px solid #2F3336', pb: 1 }}>
                    Subjects ({selectedReport.subjectsData.length})
                  </Typography>
                  {selectedReport.subjectsData.map((subject: any, index: number) => (
                    <Paper key={index} sx={{ p: 2, mb: 2, backgroundColor: '#2a2a2a', border: '1px solid #3a3a3a' }}>
                      <Typography variant="subtitle2" sx={{ color: '#1D9BF0', mb: 1 }}>
                        Subject {index + 1}
                      </Typography>
                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                        <Box>
                          <Typography variant="body2" sx={{ color: '#71767B' }}>Name:</Typography>
                          <Typography variant="body1" sx={{ color: '#E7E9EA' }}>
                            {subject.first_name} {subject.middle_name} {subject.last_name}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" sx={{ color: '#71767B' }}>Date of Birth:</Typography>
                          <Typography variant="body1" sx={{ color: '#E7E9EA' }}>
                            {subject.date_of_birth}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" sx={{ color: '#71767B' }}>Race/Sex:</Typography>
                          <Typography variant="body1" sx={{ color: '#E7E9EA' }}>
                            {subject.race} / {subject.sex}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" sx={{ color: '#71767B' }}>Phone:</Typography>
                          <Typography variant="body1" sx={{ color: '#E7E9EA' }}>
                            {subject.phone}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" sx={{ color: '#71767B' }}>Address:</Typography>
                          <Typography variant="body1" sx={{ color: '#E7E9EA' }}>
                            {subject.address}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" sx={{ color: '#71767B' }}>License:</Typography>
                          <Typography variant="body1" sx={{ color: '#E7E9EA' }}>
                            {subject.license_number}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" sx={{ color: '#71767B' }}>SSN:</Typography>
                          <Typography variant="body1" sx={{ color: '#E7E9EA' }}>
                            {subject.social_security_number}
                          </Typography>
                        </Box>
                      </Box>
                    </Paper>
                  ))}
                </Box>
              )}

              {/* Organizations Section */}
              {selectedReport.organizationsData && selectedReport.organizationsData.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ color: '#E7E9EA', mb: 2, borderBottom: '1px solid #2F3336', pb: 1 }}>
                    Organizations ({selectedReport.organizationsData.length})
                  </Typography>
                  {selectedReport.organizationsData.map((org: any, index: number) => (
                    <Paper key={index} sx={{ p: 2, mb: 2, backgroundColor: '#2a2a2a', border: '1px solid #3a3a3a' }}>
                      <Typography variant="subtitle2" sx={{ color: '#1D9BF0', mb: 1 }}>
                        Organization {index + 1}
                      </Typography>
                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                        <Box>
                          <Typography variant="body2" sx={{ color: '#71767B' }}>Business Name:</Typography>
                          <Typography variant="body1" sx={{ color: '#E7E9EA' }}>
                            {org.business_name}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" sx={{ color: '#71767B' }}>Phone:</Typography>
                          <Typography variant="body1" sx={{ color: '#E7E9EA' }}>
                            {org.phone}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" sx={{ color: '#71767B' }}>Address:</Typography>
                          <Typography variant="body1" sx={{ color: '#E7E9EA' }}>
                            {org.address}
                          </Typography>
                        </Box>
                      </Box>
                    </Paper>
                  ))}
                </Box>
              )}

              {/* Source Information Section */}
              {selectedReport.sourcesData && selectedReport.sourcesData.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ color: '#E7E9EA', mb: 2, borderBottom: '1px solid #2F3336', pb: 1 }}>
                    Source Information
                  </Typography>
                  {selectedReport.sourcesData.map((source: any, index: number) => (
                    <Paper key={index} sx={{ p: 2, mb: 2, backgroundColor: '#2a2a2a', border: '1px solid #3a3a3a' }}>
                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                        <Box>
                          <Typography variant="body2" sx={{ color: '#71767B' }}>Source ID:</Typography>
                          <Typography variant="body1" sx={{ color: '#E7E9EA' }}>
                            {source.source_id}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" sx={{ color: '#71767B' }}>Source Type:</Typography>
                          <Typography variant="body1" sx={{ color: '#E7E9EA' }}>
                            {source.source}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" sx={{ color: '#71767B' }}>Rating:</Typography>
                          <Typography variant="body1" sx={{ color: '#E7E9EA' }}>
                            {source.rating}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" sx={{ color: '#71767B' }}>Reliability:</Typography>
                          <Typography variant="body1" sx={{ color: '#E7E9EA' }}>
                            {source.information_reliable}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" sx={{ color: '#71767B' }}>Contact Name:</Typography>
                          <Typography variant="body1" sx={{ color: '#E7E9EA' }}>
                            {source.first_name} {source.middle_name} {source.last_name}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" sx={{ color: '#71767B' }}>Phone:</Typography>
                          <Typography variant="body1" sx={{ color: '#E7E9EA' }}>
                            {source.phone}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" sx={{ color: '#71767B' }}>Address:</Typography>
                          <Typography variant="body1" sx={{ color: '#E7E9EA' }}>
                            {source.address}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" sx={{ color: '#71767B' }}>Flags:</Typography>
                          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                            {source.unknown_caller && (
                              <Chip label="Unknown Caller" size="small" color="warning" />
                            )}
                            {source.ci_cs && (
                              <Chip label="CI/CS" size="small" color="info" />
                            )}
                          </Box>
                        </Box>
                      </Box>
                    </Paper>
                  ))}
                </Box>
              )}

              {/* Review Information */}
              {selectedReport.reviewedBy && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="h6" sx={{ color: '#E7E9EA', mb: 2, borderBottom: '1px solid #2F3336', pb: 1 }}>
                    Review Information
                  </Typography>
                  <Paper sx={{ p: 2, backgroundColor: '#2a2a2a', border: '1px solid #3a3a3a' }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                      <Box>
                        <Typography variant="body2" sx={{ color: '#71767B' }}>Reviewed By:</Typography>
                        <Typography variant="body1" sx={{ color: '#E7E9EA' }}>
                          {selectedReport.reviewedBy}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" sx={{ color: '#71767B' }}>Review Date:</Typography>
                        <Typography variant="body1" sx={{ color: '#E7E9EA' }}>
                          {selectedReport.reviewedAt ? new Date(selectedReport.reviewedAt).toLocaleDateString() : 'N/A'}
                        </Typography>
                      </Box>
                      {selectedReport.reviewComments && (
                        <Box sx={{ gridColumn: '1 / -1' }}>
                          <Typography variant="body2" sx={{ color: '#71767B' }}>Comments:</Typography>
                          <Typography variant="body1" sx={{ color: '#E7E9EA' }}>
                            {selectedReport.reviewComments}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Paper>
                </Box>
              )}
            </DialogContent>
            <DialogActions sx={{ backgroundColor: '#1f1f1f', borderTop: '1px solid #2F3336' }}>
              {/* Edit button - only for authors and admins, and only if not approved */}
              {((user?.id === selectedReport.agent_id || user?.role === 'admin' || user?.super_admin) && 
                 selectedReport.status !== 'approved') && (
                <Button 
                  variant="outlined"
                  onClick={() => navigate(`/intel-reports/${selectedReport.id}/edit`)}
                  sx={{ 
                    borderColor: '#1D9BF0',
                    color: '#1D9BF0',
                    '&:hover': { 
                      borderColor: '#1a8cd8',
                      backgroundColor: 'rgba(29, 155, 240, 0.1)'
                    }
                  }}
                >
                  Edit Report
                </Button>
              )}
              <Button onClick={() => setSelectedReport(null)} sx={{ color: '#1D9BF0' }}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Delete dialog removed on this page; deletions happen on Approval page */}

      {/* Edit Report Modal */}
      {editModalOpen && editingReport && (
        <IntelReportEditForm
          report={editingReport}
          open={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          onSave={(updatedReport) => {
            // Update the local state with the edited report
            setReports(prev => prev.map(report => 
              report.id === updatedReport.id ? {
                ...report,
                ...updatedReport,
                // Ensure required fields are preserved
                submittedAt: report.submittedAt,
                subjects: report.subjects,
                organizations: report.organizations,
                filesCount: report.filesCount
              } : report
            ));
            setEditModalOpen(false);
            setEditingReport(null);
          }}
        />
      )}
    </Box>
  );
};

export default IntelReportsSimple;