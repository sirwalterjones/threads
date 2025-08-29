import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  Tabs,
  Tab,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  Select,
  MenuItem,
  CircularProgress,
  Alert
} from '@mui/material';
import Grid from '@mui/material/Grid';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Warning as WarningIcon,
  CheckCircle as ActiveIcon,
  Schedule as PendingIcon,
  Cancel as CancelIcon,
  Archive as ArchiveIcon,
  CheckCircle,
  Dashboard as DashboardIcon
} from '@mui/icons-material';
import { BOLO, BOLOFilters, BOLOFeedResponse } from '../../types/bolo';
import boloApi from '../../services/boloApi';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import BOLOCreateForm from './BOLOCreateForm';
import './BOLOManagement.css';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
};

const BOLOManagement: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [bolos, setBolos] = useState<BOLO[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedBolo, setSelectedBolo] = useState<BOLO | null>(null);
  const [newStatus, setNewStatus] = useState<BOLO['status']>('active');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const canManage = user?.role === 'admin' || user?.role === 'edit';

  useEffect(() => {
    if (canManage) {
      loadMyBOLOs();
    }
  }, [user]);

  const loadMyBOLOs = async () => {
    try {
      setLoading(true);
      const filters: BOLOFilters = {
        limit: 100,
        offset: 0,
        sortBy: 'created_at',
        sortOrder: 'DESC',
        status: undefined // Explicitly don't filter by status to get all BOLOs
      };
      
      const response: BOLOFeedResponse = await boloApi.getBOLOFeed(filters);
      console.log('Management: Loaded BOLOs from API:', response.bolos.length);
      console.log('Management: Current user:', user?.username, 'ID:', user?.id, 'Role:', user?.role);
      console.log('Management: BOLOs by status:', response.bolos.reduce((acc, b) => {
        acc[b.status] = (acc[b.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>));
      
      // For admins, show all BOLOs
      // For other users, show only their BOLOs
      const myBolos = user?.role === 'admin' 
        ? response.bolos 
        : response.bolos.filter(b => b.created_by === user?.id);
      
      console.log('Management: After filtering - showing', myBolos.length, 'BOLOs');
      console.log('Management: Detailed status breakdown:', {
        active: myBolos.filter(b => b.status === 'active').length,
        pending: myBolos.filter(b => b.status === 'pending').length,
        resolved: myBolos.filter(b => b.status === 'resolved').length,
        cancelled: myBolos.filter(b => b.status === 'cancelled').length,
        expired: myBolos.filter(b => b.status === 'expired').length
      });
      
      setBolos(myBolos);
    } catch (error) {
      console.error('Error loading BOLOs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async () => {
    if (!selectedBolo) return;
    try {
      await boloApi.updateBOLOStatus(selectedBolo.id, newStatus);
      setStatusDialogOpen(false);
      setSelectedBolo(null);
      loadMyBOLOs();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const getStatusIcon = (status: BOLO['status']) => {
    switch (status) {
      case 'active': return <ActiveIcon color="success" fontSize="small" />;
      case 'pending': return <PendingIcon color="warning" fontSize="small" />;
      case 'resolved': return <CheckCircle color="info" fontSize="small" />;
      case 'cancelled': return <CancelIcon color="error" fontSize="small" />;
      case 'expired': return <ArchiveIcon color="disabled" fontSize="small" />;
      default: return null;
    }
  };

  const getPriorityColor = (priority: BOLO['priority']): any => {
    switch (priority) {
      case 'immediate': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'default';
      default: return 'default';
    }
  };

  const getBolosByStatus = (status: BOLO['status']) => {
    return bolos.filter(b => b.status === status);
  };

  const renderBOLOTable = (boloList: BOLO[]) => (
    <TableContainer component={Paper} className="table-container" sx={{ backgroundColor: '#16181b', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
      <Table className="bolo-table">
        <TableHead sx={{ backgroundColor: '#1f2226' }}>
          <TableRow>
            <TableCell sx={{ color: '#a9b0b6', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Case #</TableCell>
            <TableCell sx={{ color: '#a9b0b6', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Title</TableCell>
            <TableCell sx={{ color: '#a9b0b6', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Type</TableCell>
            <TableCell sx={{ color: '#a9b0b6', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Priority</TableCell>
            <TableCell sx={{ color: '#a9b0b6', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Status</TableCell>
            <TableCell sx={{ color: '#a9b0b6', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Created</TableCell>
            <TableCell sx={{ color: '#a9b0b6', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Views</TableCell>
            <TableCell align="right" sx={{ color: '#a9b0b6', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {boloList.map((bolo) => (
            <TableRow key={bolo.id} sx={{ '&:hover': { backgroundColor: 'rgba(47,169,255,0.05)' } }}>
              <TableCell sx={{ color: '#2fa9ff', borderBottom: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }} onClick={() => navigate(`/bolo/${bolo.id}`)}>
                {bolo.case_number}
              </TableCell>
              <TableCell sx={{ color: '#ffffff', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <Box display="flex" alignItems="center" gap={1}>
                  {bolo.armed_dangerous && (
                    <WarningIcon color="error" fontSize="small" />
                  )}
                  <Typography variant="body2">{bolo.title}</Typography>
                </Box>
              </TableCell>
              <TableCell sx={{ color: '#ffffff', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <Chip label={bolo.type} size="small" sx={{ backgroundColor: 'rgba(47,169,255,0.2)', color: '#2fa9ff' }} />
              </TableCell>
              <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <Chip 
                  label={bolo.priority} 
                  size="small" 
                  className={`priority-${bolo.priority}`}
                  sx={{ 
                    backgroundColor: bolo.priority === 'immediate' ? 'rgba(255,71,87,0.2)' :
                                    bolo.priority === 'high' ? 'rgba(255,165,2,0.2)' :
                                    bolo.priority === 'medium' ? 'rgba(47,169,255,0.2)' : 'rgba(169,176,182,0.2)',
                    color: bolo.priority === 'immediate' ? '#ff4757' :
                           bolo.priority === 'high' ? '#ffa502' :
                           bolo.priority === 'medium' ? '#2fa9ff' : '#a9b0b6',
                    border: '1px solid',
                    borderColor: bolo.priority === 'immediate' ? '#ff4757' :
                                bolo.priority === 'high' ? '#ffa502' :
                                bolo.priority === 'medium' ? '#2fa9ff' : '#a9b0b6'
                  }}
                />
              </TableCell>
              <TableCell sx={{ color: '#ffffff', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <Box display="flex" alignItems="center" gap={0.5}>
                  {getStatusIcon(bolo.status)}
                  <Typography variant="body2">{bolo.status}</Typography>
                </Box>
              </TableCell>
              <TableCell sx={{ color: '#a9b0b6', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                {format(new Date(bolo.created_at), 'MM/dd/yyyy')}
              </TableCell>
              <TableCell sx={{ color: '#ffffff', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>{bolo.view_count}</TableCell>
              <TableCell align="right" sx={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <IconButton 
                  size="small" 
                  onClick={() => navigate(`/bolo/${bolo.id}`)}
                  title="View"
                >
                  <ViewIcon />
                </IconButton>
                <IconButton 
                  size="small" 
                  onClick={() => navigate(`/bolo/edit/${bolo.id}`)}
                  title="Edit BOLO"
                >
                  <EditIcon />
                </IconButton>
                <IconButton 
                  size="small" 
                  onClick={() => {
                    setSelectedBolo(bolo);
                    setNewStatus(bolo.status);
                    setStatusDialogOpen(true);
                  }}
                  title="Change Status"
                >
                  <DashboardIcon />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
          {boloList.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} align="center">
                <Typography variant="body2" color="textSecondary">
                  No BOLOs found
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );

  if (!canManage) {
    return (
      <Container maxWidth="lg" sx={{ mt: 3 }}>
        <Alert severity="warning">
          You don't have permission to manage BOLOs. Please contact an administrator.
        </Alert>
      </Container>
    );
  }

  if (showCreateForm) {
    return <BOLOCreateForm />;
  }

  return (
    <div className="bolo-management-page">
      <Container maxWidth="lg" className="management-container">
        <Paper className="management-header" sx={{ backgroundColor: '#16181b', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <div>
              <Typography variant="h4" component="h1" className="header-title" sx={{ color: '#ffffff' }}>
                BOLO Management
              </Typography>
              <Typography variant="body2" className="header-subtitle" sx={{ color: '#a9b0b6' }}>
                Manage and track your Be On the Lookout bulletins
              </Typography>
            </div>
            <Box display="flex" gap={2}>
              <Button
                variant="outlined"
                onClick={() => navigate('/bolo')}
                sx={{ 
                  borderColor: '#2fa9ff', 
                  color: '#2fa9ff',
                  '&:hover': { 
                    borderColor: '#2090e0', 
                    backgroundColor: 'rgba(47,169,255,0.1)' 
                  }
                }}
              >
                View Feed
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setShowCreateForm(true)}
                className="create-button"
                sx={{ 
                  backgroundColor: '#2fa9ff',
                  '&:hover': { backgroundColor: '#2090e0' }
                }}
              >
                Create New BOLO
              </Button>
            </Box>
          </Box>
        </Paper>

        {loading ? (
          <Box className="loading-container">
            <CircularProgress className="loading-spinner" sx={{ color: '#2fa9ff' }} />
          </Box>
        ) : (
          <>
            <Paper className="management-tabs" sx={{ backgroundColor: '#16181b', boxShadow: '0 4px 12px rgba(0,0,0,0.4)', mt: 3 }}>
              <Tabs 
                value={tabValue} 
                onChange={(e, v) => setTabValue(v)}
                sx={{
                  '& .MuiTab-root': { color: '#a9b0b6' },
                  '& .Mui-selected': { color: '#2fa9ff' },
                  '& .MuiTabs-indicator': { backgroundColor: '#2fa9ff' }
                }}
              >
                <Tab label={`Active (${getBolosByStatus('active').length})`} />
                <Tab label={`Pending (${getBolosByStatus('pending').length})`} />
                <Tab label={`Resolved (${getBolosByStatus('resolved').length})`} />
                <Tab label={`Cancelled (${getBolosByStatus('cancelled').length})`} />
                <Tab label={`Expired (${getBolosByStatus('expired').length})`} />
              </Tabs>
            </Paper>

            <TabPanel value={tabValue} index={0}>
              {renderBOLOTable(getBolosByStatus('active'))}
            </TabPanel>
            <TabPanel value={tabValue} index={1}>
              {renderBOLOTable(getBolosByStatus('pending'))}
            </TabPanel>
            <TabPanel value={tabValue} index={2}>
              {renderBOLOTable(getBolosByStatus('resolved'))}
            </TabPanel>
            <TabPanel value={tabValue} index={3}>
              {renderBOLOTable(getBolosByStatus('cancelled'))}
            </TabPanel>
            <TabPanel value={tabValue} index={4}>
              {renderBOLOTable(getBolosByStatus('expired'))}
            </TabPanel>

            {/* Statistics */}
            <Box mt={4} className="stats-row">
              <div className="stat-card">
                <div className="stat-label">Total BOLOs</div>
                <div className="stat-value">{bolos.length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Active</div>
                <div className="stat-value">{getBolosByStatus('active').length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Pending</div>
                <div className="stat-value">{getBolosByStatus('pending').length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Resolved</div>
                <div className="stat-value">{getBolosByStatus('resolved').length}</div>
              </div>
            </Box>
            {/* Old Statistics - Hidden */}
            <Box mt={4} p={2} bgcolor="background.default" borderRadius={1} sx={{ display: 'none' }}>
              <Typography variant="h6" gutterBottom>
                Statistics
              </Typography>
              <Grid container spacing={3}>
                <Grid size={{ xs: 6, md: 3 }}>
                  <Typography variant="body2" color="textSecondary">
                    Total BOLOs
                  </Typography>
                  <Typography variant="h5">{bolos.length}</Typography>
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                  <Typography variant="body2" color="textSecondary">
                    Total Views
                  </Typography>
                  <Typography variant="h5">
                    {bolos.reduce((sum, b) => sum + b.view_count, 0)}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                  <Typography variant="body2" color="textSecondary">
                    Total Reposts
                  </Typography>
                  <Typography variant="h5">
                    {bolos.reduce((sum, b) => sum + b.repost_count, 0)}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                  <Typography variant="body2" color="textSecondary">
                    Total Comments
                  </Typography>
                  <Typography variant="h5">
                    {bolos.reduce((sum, b) => sum + b.comment_count, 0)}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          </>
        )}

      {/* Status Change Dialog */}
      <Dialog 
        open={statusDialogOpen} 
        onClose={() => setStatusDialogOpen(false)}
        PaperProps={{
          sx: {
            backgroundColor: '#16181b',
            color: '#ffffff',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
          }
        }}
      >
        <DialogTitle>Update BOLO Status</DialogTitle>
        <DialogContent>
          <Typography variant="body2" gutterBottom>
            Case #{selectedBolo?.case_number}: {selectedBolo?.title}
          </Typography>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <Select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as BOLO['status'])}
            >
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="resolved">Resolved</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
              <MenuItem value="expired">Expired</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleStatusChange} variant="contained">Update</Button>
        </DialogActions>
      </Dialog>
      </Container>
    </div>
  );
};

export default BOLOManagement;