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
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import IntelReportFormSimple from '../components/IntelReport/IntelReportFormSimple';

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

const IntelReportsSimple: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [reports, setReports] = useState<IntelReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<IntelReport | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('approved');
  const [searchTerm, setSearchTerm] = useState('');
  const [createReportModalOpen, setCreateReportModalOpen] = useState(false);

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
        // const response = await apiService.getIntelReports({ status: statusFilter });
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
    if (statusFilter !== 'all' && report.status !== statusFilter) return false;
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

  return (
    <Box sx={{ 
      maxWidth: 1400, 
      mx: 'auto', 
      p: { xs: 2, md: 3 },
      backgroundColor: 'background.default',
      minHeight: '100vh'
    }}>
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
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Card sx={{ flex: '1 1 200px', textAlign: 'center', cursor: 'pointer' }} 
              onClick={() => setStatusFilter('pending')}>
          <CardContent sx={{ py: 2 }}>
            <Typography variant="h4" color="warning.main">{pendingCount}</Typography>
            <Typography variant="body2" color="text.secondary">Pending</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: '1 1 200px', textAlign: 'center', cursor: 'pointer' }}>
          <CardContent sx={{ py: 2 }}>
            <Typography variant="h4" color="error.main">{expiredCount}</Typography>
            <Typography variant="body2" color="text.secondary">Expired</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: '1 1 200px', textAlign: 'center', cursor: 'pointer' }}>
          <CardContent sx={{ py: 2 }}>
            <Typography variant="h4" color="warning.main">{expiringSoonCount}</Typography>
            <Typography variant="body2" color="text.secondary">Expiring Soon</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: '1 1 200px', textAlign: 'center', cursor: 'pointer' }}
              onClick={() => setStatusFilter('approved')}>
          <CardContent sx={{ py: 2 }}>
            <Typography variant="h4" color="success.main">
              {reports.filter(r => r.status === 'approved').length}
            </Typography>
            <Typography variant="body2" color="text.secondary">Approved</Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3, backgroundColor: 'background.paper' }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <Box sx={{ flex: '1 1 200px', minWidth: '200px' }}>
            <TextField
              fullWidth
              size="small"
              label="Search reports..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </Box>
          <Box sx={{ flex: '1 1 150px', minWidth: '150px' }}>
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
        <Box>
          <LinearProgress sx={{ mb: 2 }} />
          <Typography textAlign="center">Loading reports...</Typography>
        </Box>
      ) : filteredReports.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', backgroundColor: 'background.paper' }}>
          <SecurityIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            No reports found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Try adjusting your filters or create a new report
          </Typography>
          <Button 
            variant="contained" 
            startIcon={<AddIcon />}
            onClick={() => setCreateReportModalOpen(true)}
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
        <TableContainer component={Paper} sx={{ backgroundColor: 'background.paper' }}>
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
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create Report Modal */}
      <Dialog
        open={createReportModalOpen}
        onClose={() => setCreateReportModalOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: 'background.paper',
            maxHeight: '90vh',
            overflow: 'auto'
          }
        }}
      >
        <IntelReportFormSimple 
          isModal={true}
          onClose={() => setCreateReportModalOpen(false)}
        />
      </Dialog>

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
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedReport(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default IntelReportsSimple;