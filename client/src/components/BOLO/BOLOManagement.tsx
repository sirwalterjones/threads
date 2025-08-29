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
  CheckCircle
} from '@mui/icons-material';
import { BOLO, BOLOFilters, BOLOFeedResponse } from '../../types/bolo';
import boloApi from '../../services/boloApi';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import BOLOCreateForm from './BOLOCreateForm';

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
        sortOrder: 'DESC'
      };
      
      const response: BOLOFeedResponse = await boloApi.getBOLOFeed(filters);
      // Filter to only show BOLOs created by current user or all for admin
      const myBolos = user?.role === 'admin' 
        ? response.bolos 
        : response.bolos.filter(b => b.created_by === user?.id);
      
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
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Case #</TableCell>
            <TableCell>Title</TableCell>
            <TableCell>Type</TableCell>
            <TableCell>Priority</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Created</TableCell>
            <TableCell>Views</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {boloList.map((bolo) => (
            <TableRow key={bolo.id}>
              <TableCell>{bolo.case_number}</TableCell>
              <TableCell>
                <Box display="flex" alignItems="center" gap={1}>
                  {bolo.armed_dangerous && (
                    <WarningIcon color="error" fontSize="small" />
                  )}
                  <Typography variant="body2">{bolo.title}</Typography>
                </Box>
              </TableCell>
              <TableCell>
                <Chip label={bolo.type} size="small" />
              </TableCell>
              <TableCell>
                <Chip 
                  label={bolo.priority} 
                  size="small" 
                  color={getPriorityColor(bolo.priority)}
                />
              </TableCell>
              <TableCell>
                <Box display="flex" alignItems="center" gap={0.5}>
                  {getStatusIcon(bolo.status)}
                  <Typography variant="body2">{bolo.status}</Typography>
                </Box>
              </TableCell>
              <TableCell>
                {format(new Date(bolo.created_at), 'MM/dd/yyyy')}
              </TableCell>
              <TableCell>{bolo.view_count}</TableCell>
              <TableCell align="right">
                <IconButton 
                  size="small" 
                  onClick={() => navigate(`/bolo/${bolo.id}`)}
                  title="View"
                >
                  <ViewIcon />
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
                  <EditIcon />
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
    <Container maxWidth="lg" sx={{ mt: 3, mb: 5 }}>
      <Paper sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" component="h1">
            BOLO Management
          </Typography>
          <Box display="flex" gap={2}>
            <Button
              variant="outlined"
              onClick={() => navigate('/bolo')}
            >
              View Feed
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setShowCreateForm(true)}
            >
              Create New BOLO
            </Button>
          </Box>
        </Box>

        {loading ? (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
              <Tab label={`Active (${getBolosByStatus('active').length})`} />
              <Tab label={`Pending (${getBolosByStatus('pending').length})`} />
              <Tab label={`Resolved (${getBolosByStatus('resolved').length})`} />
              <Tab label={`Cancelled (${getBolosByStatus('cancelled').length})`} />
              <Tab label={`Expired (${getBolosByStatus('expired').length})`} />
            </Tabs>

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
            <Box mt={4} p={2} bgcolor="background.default" borderRadius={1}>
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
      </Paper>

      {/* Status Change Dialog */}
      <Dialog open={statusDialogOpen} onClose={() => setStatusDialogOpen(false)}>
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
  );
};

export default BOLOManagement;