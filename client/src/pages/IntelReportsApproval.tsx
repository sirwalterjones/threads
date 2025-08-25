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
  Grid,
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
  Person as PersonIcon,
  Business as BusinessIcon,
  Assignment as AssignmentIcon,
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

const IntelReportsApproval: React.FC = () => {
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

  // Mock data - replace with actual API call
  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const mockReports: IntelReport[] = [
          {
            id: '1',
            intelNumber: '2024-001',
            classification: 'Sensitive',
            date: '2024-01-15',
            agentName: 'Agent Smith',
            caseNumber: 'CASE-2024-001',
            subject: 'Drug trafficking investigation',
            criminalActivity: 'Suspected narcotics distribution network operating in downtown area',
            summary: 'Intelligence gathered indicates active drug trafficking operation involving multiple suspects. Requires further investigation and surveillance.',
            status: 'pending',
            submittedAt: '2024-01-15T10:30:00Z',
            subjects: 3,
            organizations: 1,
            filesCount: 5
          },
          {
            id: '2',
            intelNumber: '2024-002',
            classification: 'Law Enforcement Only',
            date: '2024-01-16',
            agentName: 'Agent Johnson',
            subject: 'Financial fraud scheme',
            criminalActivity: 'Organized financial fraud targeting elderly victims',
            summary: 'Evidence suggests coordinated effort to defraud senior citizens through phone scams and identity theft.',
            status: 'approved',
            submittedAt: '2024-01-16T14:20:00Z',
            reviewedAt: '2024-01-16T16:45:00Z',
            reviewedBy: 'Supervisor Williams',
            reviewComments: 'Report approved. Strong evidence supporting investigation.',
            subjects: 2,
            organizations: 3,
            filesCount: 8
          },
          {
            id: '3',
            intelNumber: '2024-003',
            classification: 'Classified',
            date: '2024-01-17',
            agentName: 'Agent Brown',
            subject: 'Weapons trafficking',
            criminalActivity: 'Illegal firearms distribution network',
            summary: 'Intelligence on suspected weapons trafficking operation with interstate connections.',
            status: 'rejected',
            submittedAt: '2024-01-17T09:15:00Z',
            reviewedAt: '2024-01-17T11:30:00Z',
            reviewedBy: 'Commander Davis',
            reviewComments: 'Insufficient evidence. Requires additional investigation before approval.',
            subjects: 1,
            organizations: 2,
            filesCount: 3
          }
        ];
        
        setReports(mockReports);
      } catch (error) {
        console.error('Error fetching reports:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, []);

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
        status: reviewAction,
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

  const renderMobileCard = (report: IntelReport) => (
    <Card key={report.id} sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'between', alignItems: 'flex-start', mb: 2 }}>
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

        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <Chip 
            icon={<PersonIcon />} 
            label={`${report.subjects} subjects`} 
            size="small" 
            variant="outlined" 
          />
          <Chip 
            icon={<BusinessIcon />} 
            label={`${report.organizations} orgs`} 
            size="small" 
            variant="outlined" 
          />
          <Chip 
            icon={<AssignmentIcon />} 
            label={`${report.filesCount} files`} 
            size="small" 
            variant="outlined" 
          />
        </Box>
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
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
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
          </Grid>
          <Grid item xs={12} sm={6} md={9}>
            <Typography variant="body2" color="text.secondary">
              Showing {filteredReports.length} of {reports.length} reports
            </Typography>
          </Grid>
        </Grid>
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
          {filteredReports.map(renderMobileCard)}
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
                <TableCell>Details</TableCell>
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
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Chip 
                        label={`${report.subjects}S`} 
                        size="small" 
                        variant="outlined" 
                      />
                      <Chip 
                        label={`${report.organizations}O`} 
                        size="small" 
                        variant="outlined" 
                      />
                      <Chip 
                        label={`${report.filesCount}F`} 
                        size="small" 
                        variant="outlined" 
                      />
                    </Box>
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
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">Agent:</Typography>
                  <Typography variant="body1">{selectedReport.agentName}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">Date:</Typography>
                  <Typography variant="body1">
                    {new Date(selectedReport.date).toLocaleDateString()}
                  </Typography>
                </Grid>
                {selectedReport.caseNumber && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">Case #:</Typography>
                    <Typography variant="body1">{selectedReport.caseNumber}</Typography>
                  </Grid>
                )}
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">Subject:</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                    {selectedReport.subject}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">Criminal Activity:</Typography>
                  <Typography variant="body1">{selectedReport.criminalActivity}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">Summary:</Typography>
                  <Typography variant="body1">{selectedReport.summary}</Typography>
                </Grid>
                
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                </Grid>
                
                <Grid item xs={12} sm={4}>
                  <Typography variant="body2" color="text.secondary">Subjects:</Typography>
                  <Typography variant="body1">{selectedReport.subjects} person(s)</Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="body2" color="text.secondary">Organizations:</Typography>
                  <Typography variant="body1">{selectedReport.organizations} organization(s)</Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="body2" color="text.secondary">Files:</Typography>
                  <Typography variant="body1">{selectedReport.filesCount} file(s)</Typography>
                </Grid>

                {selectedReport.reviewComments && (
                  <>
                    <Grid item xs={12}>
                      <Divider sx={{ my: 2 }} />
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary">Review Comments:</Typography>
                      <Typography variant="body1">{selectedReport.reviewComments}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary">Reviewed By:</Typography>
                      <Typography variant="body1">{selectedReport.reviewedBy}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary">Reviewed At:</Typography>
                      <Typography variant="body1">
                        {selectedReport.reviewedAt ? 
                          new Date(selectedReport.reviewedAt).toLocaleString() : 'N/A'}
                      </Typography>
                    </Grid>
                  </>
                )}
              </Grid>
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

export default IntelReportsApproval;