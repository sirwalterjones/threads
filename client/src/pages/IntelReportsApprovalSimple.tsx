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
  TextField,
  Alert,
  IconButton,
  Tooltip,
  Badge,
  Card,
  CardContent,
  CardActions,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Security as SecurityIcon,
  AccessTime as PendingIcon,
  Error as RejectedIcon,
  Verified as ApprovedIcon,
  Edit as EditIcon,
  Close as CloseIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useAuth } from '../contexts/AuthContext';
import IntelReportEditForm from '../components/IntelReport/IntelReportEditForm';
import apiService from '../services/api';
import auditService from '../services/auditService';

interface IntelReport {
  id: string;
  intelNumber: string;
  classification: string;
  date: string;
  agentName: string;
  agent_id?: number;
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
  subjects: number;
  organizations: number;
  filesCount: number;
  // Expiration fields
  expiresAt?: string;
  isExpired?: boolean;
  daysUntilExpiration?: number;
  // Full data for details view
  subjectsData?: any[];
  organizationsData?: any[];
  sourcesData?: any[];
  reviews?: Array<{ id: number; reviewer_name: string; action: string; comments: string; created_at: string }>;
}

const IntelReportsApprovalSimple: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user } = useAuth();
  
  const [reports, setReports] = useState<IntelReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<IntelReport | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewComments, setReviewComments] = useState('');
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<IntelReport | null>(null);

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

        // Fetch reports with selected status for approval view
        const response = await fetch(`/api/intel-reports?status=${statusFilter}`, {
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
          id: report.id,
          intelNumber: report.intel_number,
          classification: report.classification,
          date: report.date,
          agentName: report.agent_name || 'Unknown',
          agent_id: report.agent_id,
          caseNumber: report.case_number,
          subject: report.subject,
          criminalActivity: report.criminal_activity,
          summary: report.summary,
          status: report.status,
          corrected: !!report.corrected,
          submittedAt: report.created_at,
          reviewedAt: report.reviewed_at,
          reviewedBy: report.reviewed_by_name,
          reviewComments: report.review_comments,
          subjects: parseInt(report.subjects_count) || 0,
          organizations: parseInt(report.organizations_count) || 0,
          filesCount: parseInt(report.files_count) || 0,
          // Expiration fields (API now returns camelCase aliases)
          expiresAt: report.expiresAt || report.expiration_date,
          isExpired: report.isExpired ?? report.is_expired,
          daysUntilExpiration: report.daysUntilExpiration ?? report.days_until_expiration
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
  }, [statusFilter]);

  const filteredReports = reports.filter(report => {
    if (statusFilter === 'all') return true;
    return report.status === statusFilter;
  });

  const pendingCount = reports.filter(r => r.status === 'pending').length;
  const rejectedCount = reports.filter(r => r.status === 'rejected').length;
  const approvedCount = reports.filter(r => r.status === 'approved').length;

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

  const handleReviewAction = (action: 'approve' | 'reject') => {
    setReviewAction(action);
    setReviewDialogOpen(true);
  };

  const handleSubmitReview = async () => {
    if (!selectedReport || !reviewAction) return;

    try {
      // Use API service to update status (triggers review trail + notification)
      const result = await apiService.updateIntelReportStatus(
        selectedReport.id,
        reviewAction === 'approve' ? 'approved' : 'rejected',
        reviewComments
      );
      console.log('Report status updated:', result);

      // Track audit event
      await auditService.trackIntelReportApproval(
        selectedReport.id,
        reviewAction,
        reviewComments
      );

      // Update local state
      const updatedReport = {
        ...selectedReport,
        status: reviewAction === 'approve' ? 'approved' as const : 'rejected' as const,
        reviewedAt: new Date().toISOString(),
        reviewedBy: 'Current User',
        reviewComments
      };

      setReports(prev => prev.map(report => 
        report.id === selectedReport.id ? updatedReport as IntelReport : report
      ));

      setReviewDialogOpen(false);
      setSelectedReport(null);
      setReviewComments('');
      setReviewAction(null);
    } catch (error) {
      console.error('Error updating report:', error);
    }
  };

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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
        <Badge badgeContent={pendingCount} color="warning">
          <SecurityIcon sx={{ fontSize: 40, color: '#1D9BF0' }} />
        </Badge>
        <Box>
          <Typography variant="h4" component="h1" sx={{ color: '#E7E9EA' }}>
            Intelligence Reports Approval
          </Typography>
          <Typography variant="body2" sx={{ color: '#71767B' }}>
            Review and approve submitted intelligence reports
          </Typography>
        </Box>
      </Box>

      {/* Filters */}
      <Paper sx={{ 
        p: 2, 
        mb: 3, 
        backgroundColor: '#1f1f1f',
        border: '1px solid #2F3336',
        '& .MuiInputLabel-root': { 
          color: '#8B98A5',
          '&.Mui-focused': { color: '#1D9BF0' }
        }, 
        '& .MuiOutlinedInput-root': { 
          color: '#E7E9EA',
          backgroundColor: '#1A1A1A',
          '& .MuiOutlinedInput-notchedOutline': { 
            borderColor: '#2F3336',
            '&:hover': { borderColor: '#4A4A4A' }
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#1D9BF0'
          }
        },
        '& .MuiSvgIcon-root': { color: '#E7E9EA' }
      }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <Box sx={{ flex: '1 1 200px', minWidth: '200px' }}>
            <FormControl fullWidth size="small">
              <InputLabel>Status Filter</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                label="Status Filter"
                MenuProps={{
                  PaperProps: {
                    sx: {
                      backgroundColor: '#16181C',
                      border: '1px solid #2F3336',
                      '& .MuiMenuItem-root': {
                        color: '#E7E9EA',
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
                <MenuItem value="all">All Reports</MenuItem>
                <MenuItem value="pending">Pending ({pendingCount})</MenuItem>
                <MenuItem value="approved">Approved ({approvedCount})</MenuItem>
                <MenuItem value="rejected">Rejected ({rejectedCount})</MenuItem>
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
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography sx={{ color: '#E7E9EA' }}>Loading reports...</Typography>
        </Box>
      ) : filteredReports.length === 0 ? (
        <Paper sx={{ 
          p: 4, 
          textAlign: 'center', 
          backgroundColor: '#1f1f1f',
          border: '1px solid #2F3336'
        }}>
          <Typography variant="h6" sx={{ color: '#71767B' }}>
            No reports found
          </Typography>
        </Paper>
      ) : isMobile ? (
        <Box>
          {filteredReports.map((report) => (
            <Card key={report.id} sx={{ 
              mb: 2, 
              backgroundColor: '#1f1f1f',
              border: '1px solid #2F3336'
            }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box>
                    <Typography variant="h6" component="div" sx={{ color: '#E7E9EA' }}>
                      Intel #{report.intelNumber}
                    </Typography>
                    <Typography sx={{ color: '#71767B' }} gutterBottom>
                      {report.agentName} • {new Date(report.date).toLocaleDateString()}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-end' }}>
                    {getClassificationChip(report.classification)}
                    {getStatusChip(report.status)}
                  </Box>
                </Box>
                
                <Typography variant="body1" sx={{ fontWeight: 'bold', mb: 1, color: '#E7E9EA' }}>
                  {report.subject}
                </Typography>
                
                <Typography variant="body2" sx={{ color: '#71767B', mb: 2 }}>
                  {report.criminalActivity.substring(0, 100)}...
                </Typography>
              </CardContent>
              
              <CardActions sx={{ backgroundColor: '#1f1f1f' }}>
                <Button 
                  size="small" 
                  onClick={() => handleViewReport(report)}
                  startIcon={<VisibilityIcon />}
                  sx={{ color: '#1D9BF0' }}
                >
                  View Details
                </Button>
                {report.status === 'pending' && (
                  <>
                    <Button 
                      size="small" 
                      color="success"
                      onClick={() => {
                        setSelectedReport(report);
                        handleReviewAction('approve');
                      }}
                      startIcon={<ApproveIcon />}
                      sx={{ 
                        backgroundColor: '#4caf50',
                        color: '#ffffff',
                        '&:hover': { backgroundColor: '#45a049' }
                      }}
                    >
                      Approve
                    </Button>
                    <Button 
                      size="small" 
                      color="error"
                      onClick={() => {
                        setSelectedReport(report);
                        handleReviewAction('reject');
                      }}
                      startIcon={<RejectIcon />}
                      sx={{ 
                        backgroundColor: '#f44336',
                        color: '#ffffff',
                        '&:hover': { backgroundColor: '#da190b' }
                      }}
                    >
                      Reject
                    </Button>
                  </>
                )}
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
                <TableRow key={report.id} hover>
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
                        >
                          <VisibilityIcon />
                        </IconButton>
                      </Tooltip>
                      {report.status === 'pending' && (
                        <>
                          <Tooltip title="Approve">
                            <IconButton 
                              size="small" 
                              color="success"
                              onClick={() => {
                                setSelectedReport(report);
                                handleReviewAction('approve');
                              }}
                            >
                              <ApproveIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Reject">
                            <IconButton 
                              size="small" 
                              color="error"
                              onClick={() => {
                                setSelectedReport(report);
                                handleReviewAction('reject');
                              }}
                            >
                              <RejectIcon />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                      {(user?.role === 'admin' || user?.super_admin) && (
                        <>
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => handleEditReport(report)}>
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={async () => {
                                if (window.confirm('Delete this intel report? This cannot be undone.')) {
                                  try {
                                    await apiService.deleteIntelReport((report.id as unknown as string) || String(report.id));
                                    setReports(prev => prev.filter(r => r.id !== report.id));
                                  } catch (e) {
                                    console.error('Failed to delete report', e);
                                  }
                                }
                              }}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
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
        open={!!selectedReport && !reviewDialogOpen} 
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
                </Box>
              </Box>
            </DialogTitle>
            <DialogContent dividers sx={{ backgroundColor: '#1f1f1f', color: '#E7E9EA' }}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ color: '#71767B' }}>Agent:</Typography>
                <Typography variant="body1" sx={{ color: '#E7E9EA' }}>{selectedReport.agentName}</Typography>
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ color: '#71767B' }}>Date:</Typography>
                <Typography variant="body1" sx={{ color: '#E7E9EA' }}>
                  {new Date(selectedReport.date).toLocaleDateString()}
                </Typography>
              </Box>

              {selectedReport.caseNumber && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ color: '#71767B' }}>Case #:</Typography>
                  <Typography variant="body1" sx={{ color: '#E7E9EA' }}>{selectedReport.caseNumber}</Typography>
                </Box>
              )}
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ color: '#71767B' }}>Subject:</Typography>
                <Typography variant="body1" sx={{ fontWeight: 'bold', color: '#E7E9EA' }}>
                  {selectedReport.subject}
                </Typography>
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ color: '#71767B' }}>Criminal Activity:</Typography>
                <Typography variant="body1" sx={{ color: '#E7E9EA' }}>{selectedReport.criminalActivity}</Typography>
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ color: '#71767B' }}>Summary:</Typography>
                <Typography variant="body1" sx={{ color: '#E7E9EA' }}>{selectedReport.summary}</Typography>
              </Box>

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

              {/* Corrections Trail */}
              {selectedReport.reviews && selectedReport.reviews.length > 0 && (
                <Box sx={{ mb: 3, mt: 1 }}>
                  <Typography variant="h6" sx={{ color: '#E7E9EA', mb: 2, textAlign: 'center' }}>
                    Corrections Trail
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#71767B', mb: 2, textAlign: 'left' }}>
                    Reviewer notes and actions are listed below. Address the latest rejection comments.
                  </Typography>
                  {selectedReport.reviews.map((note) => (
                    <Box key={note.id} sx={{ p: 2, mb: 2, borderRadius: 2, backgroundColor: '#121416', border: '1px solid #2F3336' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="subtitle1" sx={{ color: note.action === 'rejected' ? '#f44336' : note.action === 'approved' ? '#4caf50' : '#1D9BF0', fontWeight: 700 }}>
                          {note.action.charAt(0).toUpperCase() + note.action.slice(1)}
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

              {/* Removed Review Comments/Reviewed By section per request */}
            </DialogContent>
            <DialogActions sx={{ backgroundColor: '#1f1f1f', borderTop: '1px solid #2F3336' }}>
              {/* Edit button - authors can edit until approved; admins can always edit */}
              {(((user?.id === selectedReport.agent_id) && selectedReport.status !== 'approved') || (user?.role === 'admin' || user?.super_admin)) && (
                <Button 
                  variant="outlined"
                  onClick={() => {
                    setSelectedReport(null);
                    window.location.href = `/intel-reports/${selectedReport.id}/edit`;
                  }}
                  startIcon={<EditIcon />}
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
              {/* Admins can change status anytime; authors only when pending via approval flow */}
              {((user?.role === 'admin' || user?.super_admin) || selectedReport.status === 'pending') && (
                <>
                  <Button 
                    color="error" 
                    onClick={() => handleReviewAction('reject')}
                    startIcon={<RejectIcon />}
                    sx={{ color: '#f44336' }}
                  >
                    Reject
                  </Button>
                  <Button 
                    color="success" 
                    variant="contained"
                    onClick={() => handleReviewAction('approve')}
                    startIcon={<ApproveIcon />}
                    sx={{ 
                      backgroundColor: '#4caf50',
                      color: '#ffffff',
                      '&:hover': { backgroundColor: '#45a049' }
                    }}
                  >
                    Approve
                  </Button>
                </>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>

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

      {/* Review Action Dialog */}
      <Dialog 
        open={reviewDialogOpen} 
        onClose={() => {
          setReviewDialogOpen(false);
          setSelectedReport(null); // return to table; prevent details dialog from reopening
        }}
        PaperProps={{
          sx: {
            backgroundColor: '#1f1f1f',
            color: '#E7E9EA',
            border: '1px solid #2F3336'
          }
        }}
      >
        <DialogTitle sx={{ backgroundColor: '#1f1f1f', color: '#E7E9EA', borderBottom: '1px solid #2F3336' }}>
          {reviewAction === 'approve' ? 'Approve Report' : 'Reject Report'}
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: '#1f1f1f', color: '#E7E9EA' }}>
          <Alert 
            severity={reviewAction === 'approve' ? 'success' : 'error'} 
            sx={{ mb: 2 }}
          >
            {reviewAction === 'approve' 
              ? 'This report will be approved and made available to authorized personnel.'
              : 'This report will be rejected and sent back for revision.'
            }
          </Alert>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Review Comments"
            value={reviewComments}
            onChange={(e) => setReviewComments(e.target.value)}
            placeholder={reviewAction === 'approve' 
              ? 'Optional: Add approval comments...'
              : 'Required: Explain why this report is being rejected...'
            }
            required={reviewAction === 'reject'}
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
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#1f1f1f', borderTop: '1px solid #2F3336' }}>
          <Button onClick={() => { setReviewDialogOpen(false); setSelectedReport(null); }} sx={{ color: '#1D9BF0' }}>Cancel</Button>
          <Button 
            color={reviewAction === 'approve' ? 'success' : 'error'}
            variant="contained"
            onClick={handleSubmitReview}
            disabled={reviewAction === 'reject' && !reviewComments.trim()}
            sx={{ 
              backgroundColor: reviewAction === 'approve' ? '#4caf50' : '#f44336',
              color: '#ffffff',
              '&:hover': { 
                backgroundColor: reviewAction === 'approve' ? '#45a049' : '#da190b' 
              }
            }}
          >
            {reviewAction === 'approve' ? 'Approve' : 'Reject'} Report
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default IntelReportsApprovalSimple;