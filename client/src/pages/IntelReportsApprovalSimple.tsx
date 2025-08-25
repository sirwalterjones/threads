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
  Verified as ApprovedIcon
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

interface IntelReport {
  id: string;
  intelNumber: string;
  classification: string;
  date: string;
  agentName: string;
  caseNumber?: string;
  subject: string;
  criminalActivity: string;
  summary: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewComments?: string;
  subjects: number;
  organizations: number;
  filesCount: number;
}

const IntelReportsApprovalSimple: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [reports, setReports] = useState<IntelReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<IntelReport | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewComments, setReviewComments] = useState('');
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

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
        // TODO: Implement API call when backend is ready
        // const response = await apiService.getIntelReports({ status: 'pending' });
        // setReports(response.reports);
        
        // For now, start with empty array until backend is implemented
        setReports([]);
      } catch (error) {
        console.error('Error fetching reports:', error);
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

  const handleViewReport = (report: IntelReport) => {
    setSelectedReport(report);
  };

  const handleReviewAction = (action: 'approve' | 'reject') => {
    setReviewAction(action);
    setReviewDialogOpen(true);
  };

  const handleSubmitReview = async () => {
    if (!selectedReport || !reviewAction) return;

    try {
      // TODO: Implement API call to update report status
      const updatedReport = {
        ...selectedReport,
        status: reviewAction === 'approve' ? 'approved' as const : 'rejected' as const,
        reviewedAt: new Date().toISOString(),
        reviewedBy: 'Current User', // Replace with actual user
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
    />
  );

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', p: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
        <Badge badgeContent={pendingCount} color="warning">
          <SecurityIcon sx={{ fontSize: 40, color: 'primary.main' }} />
        </Badge>
        <Box>
          <Typography variant="h4" component="h1">
            Intelligence Reports Approval
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Review and approve submitted intelligence reports
          </Typography>
        </Box>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <Box sx={{ flex: '1 1 200px', minWidth: '200px' }}>
            <FormControl fullWidth size="small">
              <InputLabel>Status Filter</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                label="Status Filter"
              >
                <MenuItem value="all">All Reports</MenuItem>
                <MenuItem value="pending">Pending ({pendingCount})</MenuItem>
                <MenuItem value="approved">Approved</MenuItem>
                <MenuItem value="rejected">Rejected</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ flex: '1 1 200px' }}>
            <Typography variant="body2" color="text.secondary">
              Showing {filteredReports.length} of {reports.length} reports
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Reports List */}
      {loading ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography>Loading reports...</Typography>
        </Box>
      ) : filteredReports.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary">
            No reports found
          </Typography>
        </Paper>
      ) : isMobile ? (
        <Box>
          {filteredReports.map((report) => (
            <Card key={report.id} sx={{ mb: 2 }}>
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
                  </Box>
                </Box>
                
                <Typography variant="body1" sx={{ fontWeight: 'bold', mb: 1 }}>
                  {report.subject}
                </Typography>
                
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {report.criminalActivity.substring(0, 100)}...
                </Typography>
              </CardContent>
              
              <CardActions>
                <Button 
                  size="small" 
                  onClick={() => handleViewReport(report)}
                  startIcon={<VisibilityIcon />}
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
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Intel #</TableCell>
                <TableCell>Classification</TableCell>
                <TableCell>Subject</TableCell>
                <TableCell>Agent</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Status</TableCell>
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
      >
        {selectedReport && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">
                  Intel Report #{selectedReport.intelNumber}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {getClassificationChip(selectedReport.classification)}
                  {getStatusChip(selectedReport.status)}
                </Box>
              </Box>
            </DialogTitle>
            <DialogContent dividers>
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

              {selectedReport.caseNumber && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">Case #:</Typography>
                  <Typography variant="body1">{selectedReport.caseNumber}</Typography>
                </Box>
              )}
              
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

              {selectedReport.reviewComments && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">Review Comments:</Typography>
                    <Typography variant="body1">{selectedReport.reviewComments}</Typography>
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">Reviewed By:</Typography>
                    <Typography variant="body1">{selectedReport.reviewedBy}</Typography>
                  </Box>
                </>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedReport(null)}>Close</Button>
              {selectedReport.status === 'pending' && (
                <>
                  <Button 
                    color="error" 
                    onClick={() => handleReviewAction('reject')}
                    startIcon={<RejectIcon />}
                  >
                    Reject
                  </Button>
                  <Button 
                    color="success" 
                    variant="contained"
                    onClick={() => handleReviewAction('approve')}
                    startIcon={<ApproveIcon />}
                  >
                    Approve
                  </Button>
                </>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Review Action Dialog */}
      <Dialog open={reviewDialogOpen} onClose={() => setReviewDialogOpen(false)}>
        <DialogTitle>
          {reviewAction === 'approve' ? 'Approve Report' : 'Reject Report'}
        </DialogTitle>
        <DialogContent>
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
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReviewDialogOpen(false)}>Cancel</Button>
          <Button 
            color={reviewAction === 'approve' ? 'success' : 'error'}
            variant="contained"
            onClick={handleSubmitReview}
            disabled={reviewAction === 'reject' && !reviewComments.trim()}
          >
            {reviewAction === 'approve' ? 'Approve' : 'Reject'} Report
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default IntelReportsApprovalSimple;