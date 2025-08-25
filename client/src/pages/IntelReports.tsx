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
  Card,
  CardContent,
  CardActions,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Fab,
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
  Refresh as RefreshIcon
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
  expiresAt?: string;
  isExpired?: boolean;
  daysUntilExpiration?: number;
}

const IntelReports: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [reports, setReports] = useState<IntelReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<IntelReport | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('approved');
  const [classificationFilter, setClassificationFilter] = useState<string>('all');
  const [expirationFilter, setExpirationFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

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

  // Mock data with expiration dates
  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const now = new Date();
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
            summary: 'Intelligence gathered indicates active drug trafficking operation involving multiple suspects.',
            status: 'approved',
            submittedAt: '2024-01-15T10:30:00Z',
            reviewedAt: '2024-01-15T14:20:00Z',
            reviewedBy: 'Supervisor Williams',
            subjects: 3,
            organizations: 1,
            filesCount: 5,
            expiresAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days from now
            daysUntilExpiration: 5
          },
          {
            id: '2',
            intelNumber: '2024-002',
            classification: 'Law Enforcement Only',
            date: '2024-01-10',
            agentName: 'Agent Johnson',
            subject: 'Financial fraud scheme',
            criminalActivity: 'Organized financial fraud targeting elderly victims',
            summary: 'Evidence suggests coordinated effort to defraud senior citizens through phone scams.',
            status: 'approved',
            submittedAt: '2024-01-10T14:20:00Z',
            reviewedAt: '2024-01-10T16:45:00Z',
            reviewedBy: 'Supervisor Williams',
            subjects: 2,
            organizations: 3,
            filesCount: 8,
            expiresAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
            daysUntilExpiration: 2
          },
          {
            id: '3',
            intelNumber: '2024-003',
            classification: 'Classified',
            date: '2024-01-05',
            agentName: 'Agent Brown',
            subject: 'Weapons trafficking',
            criminalActivity: 'Illegal firearms distribution network',
            summary: 'Intelligence on suspected weapons trafficking operation with interstate connections.',
            status: 'approved',
            submittedAt: '2024-01-05T09:15:00Z',
            reviewedAt: '2024-01-05T11:30:00Z',
            reviewedBy: 'Commander Davis',
            subjects: 1,
            organizations: 2,
            filesCount: 3,
            expiresAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(), // Already expired
            isExpired: true,
            daysUntilExpiration: 0
          },
          {
            id: '4',
            intelNumber: '2024-004',
            classification: 'Narcotics Only',
            date: '2024-01-20',
            agentName: 'Agent Davis',
            subject: 'Methamphetamine lab investigation',
            criminalActivity: 'Suspected meth lab operation in rural area',
            summary: 'Chemical purchases and suspicious activity indicate possible methamphetamine production facility.',
            status: 'pending',
            submittedAt: '2024-01-20T11:00:00Z',
            subjects: 2,
            organizations: 0,
            filesCount: 4
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
    if (statusFilter !== 'all' && report.status !== statusFilter) return false;
    if (classificationFilter !== 'all' && report.classification !== classificationFilter) return false;
    if (expirationFilter === 'expired' && !report.isExpired) return false;
    if (expirationFilter === 'expiring_soon' && (!report.daysUntilExpiration || report.daysUntilExpiration > 7)) return false;
    if (searchTerm && !report.subject.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !report.intelNumber.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const pendingCount = reports.filter(r => r.status === 'pending').length;
  const expiredCount = reports.filter(r => r.isExpired).length;
  const expiringSoonCount = reports.filter(r => r.daysUntilExpiration && r.daysUntilExpiration <= 7 && !r.isExpired).length;

  const handleViewReport = (report: IntelReport) => {
    setSelectedReport(report);
  };

  const handleExtendExpiration = async (reportId: string, days: number) => {
    try {
      // TODO: Implement API call to extend expiration
      const now = new Date();
      const newExpirationDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      
      setReports(prev => prev.map(report => {
        if (report.id === reportId) {
          return {
            ...report,
            expiresAt: newExpirationDate.toISOString(),
            isExpired: false,
            daysUntilExpiration: days
          };
        }
        return report;
      }));
    } catch (error) {
      console.error('Error extending expiration:', error);
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

  const getExpirationChip = (report: IntelReport) => {
    if (report.isExpired) {
      return <Chip label="Expired" color="error" size="small" />;
    }
    if (report.daysUntilExpiration && report.daysUntilExpiration <= 7) {
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
          label={`${report.daysUntilExpiration} days left`} 
          color="info" 
          size="small" 
        />
      );
    }
    return null;
  };

  const renderMobileCard = (report: IntelReport) => (
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
            {getExpirationChip(report)}
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
        {report.status === 'approved' && (
          <>
            <Button 
              size="small" 
              startIcon={<EditIcon />}
            >
              Edit
            </Button>
            {report.isExpired || (report.daysUntilExpiration && report.daysUntilExpiration <= 7) ? (
              <Button 
                size="small" 
                color="warning"
                onClick={() => handleExtendExpiration(report.id, 30)}
              >
                Extend 30d
              </Button>
            ) : null}
          </>
        )}
      </CardActions>
    </Card>
  );

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', p: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Badge badgeContent={pendingCount} color="warning">
            <SecurityIcon sx={{ fontSize: 40, color: 'primary.main' }} />
          </Badge>
          <Box>
            <Typography variant="h4" component="h1">
              Intelligence Reports
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage and review intelligence reports
            </Typography>
          </Box>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton color="primary" title="Refresh">
            <RefreshIcon />
          </IconButton>
          <IconButton color="primary" title="Export Reports">
            <ExportIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Status Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <Card sx={{ textAlign: 'center', cursor: 'pointer' }} 
                onClick={() => setStatusFilter('pending')}>
            <CardContent sx={{ py: 2 }}>
              <Typography variant="h4" color="warning.main">{pendingCount}</Typography>
              <Typography variant="body2" color="text.secondary">Pending</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ textAlign: 'center', cursor: 'pointer' }}
                onClick={() => setExpirationFilter('expired')}>
            <CardContent sx={{ py: 2 }}>
              <Typography variant="h4" color="error.main">{expiredCount}</Typography>
              <Typography variant="body2" color="text.secondary">Expired</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ textAlign: 'center', cursor: 'pointer' }}
                onClick={() => setExpirationFilter('expiring_soon')}>
            <CardContent sx={{ py: 2 }}>
              <Typography variant="h4" color="warning.main">{expiringSoonCount}</Typography>
              <Typography variant="body2" color="text.secondary">Expiring Soon</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ textAlign: 'center', cursor: 'pointer' }}
                onClick={() => setStatusFilter('approved')}>
            <CardContent sx={{ py: 2 }}>
              <Typography variant="h4" color="success.main">
                {reports.filter(r => r.status === 'approved').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">Approved</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              size="small"
              label="Search reports..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                label="Status"
              >
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="approved">Approved</MenuItem>
                <MenuItem value="rejected">Rejected</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Classification</InputLabel>
              <Select
                value={classificationFilter}
                onChange={(e) => setClassificationFilter(e.target.value)}
                label="Classification"
              >
                <MenuItem value="all">All Classifications</MenuItem>
                <MenuItem value="Sensitive">Sensitive</MenuItem>
                <MenuItem value="Narcotics Only">Narcotics Only</MenuItem>
                <MenuItem value="Classified">Classified</MenuItem>
                <MenuItem value="Law Enforcement Only">Law Enforcement Only</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Expiration</InputLabel>
              <Select
                value={expirationFilter}
                onChange={(e) => setExpirationFilter(e.target.value)}
                label="Expiration"
              >
                <MenuItem value="all">All Reports</MenuItem>
                <MenuItem value="expired">Expired</MenuItem>
                <MenuItem value="expiring_soon">Expiring Soon</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={12} md={3}>
            <Typography variant="body2" color="text.secondary">
              Showing {filteredReports.length} of {reports.length} reports
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Reports List */}
      {loading ? (
        <Box>
          <LinearProgress sx={{ mb: 2 }} />
          <Typography textAlign="center">Loading reports...</Typography>
        </Box>
      ) : filteredReports.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <SecurityIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            No reports found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Try adjusting your filters or create a new report
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />}>
            Create New Report
          </Button>
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
                <TableCell>Expiration</TableCell>
                <TableCell>Details</TableCell>
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
                  </TableCell>
                  <TableCell>
                    {getExpirationChip(report)}
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
                      {report.status === 'approved' && (
                        <>
                          <Tooltip title="Edit Report">
                            <IconButton size="small">
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          {(report.isExpired || (report.daysUntilExpiration && report.daysUntilExpiration <= 7)) && (
                            <Tooltip title="Extend Expiration">
                              <IconButton 
                                size="small" 
                                color="warning"
                                onClick={() => handleExtendExpiration(report.id, 30)}
                              >
                                <WarningIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="Delete Report">
                            <IconButton size="small" color="error">
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

      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="add"
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
        }}
      >
        <AddIcon />
      </Fab>

      {/* Report Details Dialog */}
      <Dialog 
        open={!!selectedReport} 
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
                  {getExpirationChip(selectedReport)}
                </Box>
              </Box>
            </DialogTitle>
            <DialogContent dividers>
              {selectedReport.isExpired && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  This report has expired on {new Date(selectedReport.expiresAt!).toLocaleDateString()}
                </Alert>
              )}
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
                {selectedReport.expiresAt && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">Expires:</Typography>
                    <Typography variant="body1">
                      {new Date(selectedReport.expiresAt).toLocaleDateString()}
                    </Typography>
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
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedReport(null)}>Close</Button>
              {selectedReport.status === 'approved' && (
                <>
                  <Button startIcon={<EditIcon />}>
                    Edit Report
                  </Button>
                  {(selectedReport.isExpired || (selectedReport.daysUntilExpiration && selectedReport.daysUntilExpiration <= 7)) && (
                    <Button 
                      color="warning"
                      onClick={() => handleExtendExpiration(selectedReport.id, 30)}
                    >
                      Extend 30 Days
                    </Button>
                  )}
                </>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default IntelReports;