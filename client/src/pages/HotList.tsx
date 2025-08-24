import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Switch,
  FormControlLabel,
  Alert,
  Divider,
  Grid,
  Snackbar
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Notifications as NotificationsIcon,
  NotificationImportant as AlertIcon,
  Clear as ClearIcon,
  History as HistoryIcon
} from '@mui/icons-material';
import apiService from '../services/api';
import { useAuth } from '../contexts/AuthContext';

// Hot List Alert Card Component
const HotListAlertCard: React.FC<{
  alert: HotListAlert;
  onMarkRead: (alert: HotListAlert) => void;
  onOpenPost: (postId: number) => void;
}> = ({ alert, onMarkRead, onOpenPost }) => {
  
  const highlightSearchTerm = (text: string, searchTerm: string) => {
    if (!text || !searchTerm) return text;
    
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <span key={index} style={{ backgroundColor: '#1D9BF0', color: 'white', padding: '2px 4px', borderRadius: '4px' }}>
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <Card
      sx={{
        mb: 2,
        backgroundColor: alert.is_read ? '#16181C' : 'rgba(29, 155, 240, 0.05)',
        border: `1px solid ${alert.is_read ? '#2F3336' : '#1D9BF0'}`,
        cursor: 'pointer',
        '&:hover': { 
          backgroundColor: alert.is_read ? 'rgba(29, 155, 240, 0.05)' : 'rgba(29, 155, 240, 0.1)',
          transform: 'translateY(-1px)',
          boxShadow: '0 4px 12px rgba(29, 155, 240, 0.15)'
        },
        transition: 'all 0.2s ease-in-out'
      }}
      onClick={() => onOpenPost(alert.post_id)}
    >
      <CardContent>
        {/* Alert Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <AlertIcon sx={{ color: alert.is_read ? '#71767B' : '#1D9BF0', fontSize: '16px' }} />
          <Chip
            label={`Hot List: "${alert.search_term}"`}
            size="small"
            sx={{ 
              backgroundColor: alert.is_read ? '#2F3336' : '#1D9BF0', 
              color: 'white',
              fontSize: '11px',
              height: '20px'
            }}
          />
          <Typography variant="caption" sx={{ color: '#71767B', ml: 'auto' }}>
            {formatDate(alert.created_at)}
          </Typography>
          {!alert.is_read && (
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#1D9BF0' }} />
          )}
        </Box>

        {/* Post Content */}
        <Box sx={{ ml: 0 }}>
          <Typography 
            variant="h6" 
            sx={{ 
              color: '#E7E9EA', 
              mb: 1,
              fontSize: '16px',
              fontWeight: 600,
              lineHeight: 1.3
            }}
          >
            {highlightSearchTerm(alert.post_title, alert.search_term)}
          </Typography>
          
          <Typography variant="body2" sx={{ color: '#71767B', mb: 1 }}>
            by {alert.author_name} • {formatDate(alert.wp_published_date)}
          </Typography>
          
          {alert.highlighted_content && (
            <Typography 
              variant="body2" 
              sx={{ 
                color: '#E7E9EA', 
                fontStyle: 'normal',
                backgroundColor: 'rgba(29, 155, 240, 0.1)',
                padding: 1.5,
                borderRadius: 1,
                border: '1px solid rgba(29, 155, 240, 0.2)',
                lineHeight: 1.4
              }}
            >
              {highlightSearchTerm(alert.highlighted_content, alert.search_term)}
            </Typography>
          )}
        </Box>

        {/* Action hint */}
        <Typography 
          variant="caption" 
          sx={{ 
            color: '#71767B', 
            mt: 1, 
            display: 'block',
            textAlign: 'right',
            fontSize: '10px'
          }}
        >
          Click to view full post
        </Typography>
      </CardContent>
    </Card>
  );
};

interface HotList {
  id: number;
  search_term: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface HotListAlert {
  id: number;
  hot_list_id: number;
  post_id: number;
  is_read: boolean;
  highlighted_content: string;
  created_at: string;
  search_term: string;
  post_title: string;
  author_name: string;
  wp_published_date: string;
}

const HotList: React.FC = () => {
  const { user } = useAuth();
  const [hotLists, setHotLists] = useState<HotList[]>([]);
  const [alerts, setAlerts] = useState<HotListAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHotList, setEditingHotList] = useState<HotList | null>(null);
  const [newSearchTerm, setNewSearchTerm] = useState('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  });
  const [activeTab, setActiveTab] = useState<'alerts' | 'manage'>('alerts');
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [existingPostsDialogOpen, setExistingPostsDialogOpen] = useState(false);
  const [existingPostsResults, setExistingPostsResults] = useState<any>(null);

  useEffect(() => {
    if (user) {
      loadHotLists();
      loadAlerts();
    }
  }, [user]);

  const loadHotLists = async () => {
    try {
      setLoading(true);
      const response = await apiService.getHotLists();
      setHotLists(response.hotLists);
    } catch (error) {
      console.error('Error loading hot lists:', error);
      showSnackbar('Failed to load hot lists', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadAlerts = async () => {
    try {
      setAlertsLoading(true);
      const response = await apiService.getHotListAlerts({ limit: 50 });
      setAlerts(response.alerts);
    } catch (error) {
      console.error('Error loading hot list alerts:', error);
      showSnackbar('Failed to load alerts', 'error');
    } finally {
      setAlertsLoading(false);
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCreateOrUpdate = async () => {
    if (!newSearchTerm.trim()) {
      showSnackbar('Search term cannot be empty', 'error');
      return;
    }

    try {
      let hotListId: number | undefined;
      
      if (editingHotList) {
        await apiService.updateHotList(editingHotList.id, { searchTerm: newSearchTerm.trim() });
        showSnackbar('Hot list updated successfully', 'success');
        hotListId = editingHotList.id;
      } else {
        const result = await apiService.createHotList(newSearchTerm.trim());
        showSnackbar('Hot list created successfully', 'success');
        hotListId = result.hotList.id;
      }
      
      setDialogOpen(false);
      setNewSearchTerm('');
      setEditingHotList(null);
      loadHotLists();
      
      // Check for existing posts that match this search term
      if (hotListId) {
        handleCheckExistingPosts(newSearchTerm.trim(), hotListId);
      }
    } catch (error: any) {
      console.error('Error saving hot list:', error);
      if (error.response?.status === 409) {
        showSnackbar('A hot list with this search term already exists', 'error');
      } else {
        showSnackbar(`Failed to ${editingHotList ? 'update' : 'create'} hot list`, 'error');
      }
    }
  };

  const handleToggleActive = async (hotList: HotList) => {
    try {
      await apiService.updateHotList(hotList.id, { isActive: !hotList.is_active });
      showSnackbar(`Hot list ${!hotList.is_active ? 'activated' : 'deactivated'}`, 'success');
      loadHotLists();
    } catch (error) {
      console.error('Error toggling hot list:', error);
      showSnackbar('Failed to update hot list', 'error');
    }
  };

  const handleDelete = async (hotList: HotList) => {
    if (!window.confirm(`Are you sure you want to delete the hot list "${hotList.search_term}"?`)) {
      return;
    }

    try {
      await apiService.deleteHotList(hotList.id);
      showSnackbar('Hot list deleted successfully', 'success');
      loadHotLists();
    } catch (error) {
      console.error('Error deleting hot list:', error);
      showSnackbar('Failed to delete hot list', 'error');
    }
  };

  const handleMarkAlertRead = async (alert: HotListAlert) => {
    if (alert.is_read) return;

    try {
      await apiService.markHotListAlertRead(alert.id);
      setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, is_read: true } : a));
      showSnackbar('Alert marked as read', 'success');
    } catch (error) {
      console.error('Error marking alert as read:', error);
      showSnackbar('Failed to mark alert as read', 'error');
    }
  };

  const handleMarkAllAlertsRead = async () => {
    try {
      await apiService.markAllHotListAlertsRead();
      setAlerts(prev => prev.map(a => ({ ...a, is_read: true })));
      showSnackbar('All alerts marked as read', 'success');
    } catch (error) {
      console.error('Error marking all alerts as read:', error);
      showSnackbar('Failed to mark all alerts as read', 'error');
    }
  };

  const handleClearAllAlerts = async () => {
    try {
      const result = await apiService.clearAllHotListAlerts();
      setAlerts([]);
      setClearConfirmOpen(false);
      showSnackbar(`Cleared ${result.deletedCount} alerts successfully`, 'success');
    } catch (error) {
      console.error('Error clearing all alerts:', error);
      showSnackbar('Failed to clear all alerts', 'error');
    }
  };

  const handleCheckExistingPosts = async (searchTerm: string, hotListId?: number) => {
    try {
      const result = await apiService.checkExistingPosts(searchTerm, hotListId);
      setExistingPostsResults(result);
      setExistingPostsDialogOpen(true);
      
      if (result.alertsCreated > 0) {
        loadAlerts(); // Refresh alerts to show new ones
        showSnackbar(`Found ${result.matchingPosts} existing posts, created ${result.alertsCreated} new alerts`, 'success');
      }
    } catch (error) {
      console.error('Error checking existing posts:', error);
      showSnackbar('Failed to check existing posts', 'error');
    }
  };

  const openEditDialog = (hotList?: HotList) => {
    if (hotList) {
      setEditingHotList(hotList);
      setNewSearchTerm(hotList.search_term);
    } else {
      setEditingHotList(null);
      setNewSearchTerm('');
    }
    setDialogOpen(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const unreadAlertsCount = alerts.filter(alert => !alert.is_read).length;

  if (!user) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert 
          severity="warning"
          sx={{
            backgroundColor: 'rgba(255, 193, 7, 0.1)',
            border: '1px solid rgba(255, 193, 7, 0.3)',
            color: '#E7E9EA',
            '& .MuiAlert-icon': {
              color: '#FFC107'
            }
          }}
        >
          Please log in to view hot lists.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h4" sx={{ color: '#E7E9EA' }}>
          🔥 Hot List
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant={activeTab === 'alerts' ? 'contained' : 'outlined'}
            onClick={() => setActiveTab('alerts')}
            startIcon={<NotificationsIcon />}
            sx={{
              backgroundColor: activeTab === 'alerts' 
                ? (unreadAlertsCount > 0 ? '#FFC107' : '#1D9BF0') 
                : 'transparent',
              borderColor: unreadAlertsCount > 0 ? '#FFC107' : '#1D9BF0',
              color: activeTab === 'alerts' 
                ? (unreadAlertsCount > 0 ? '#000' : 'white')
                : (unreadAlertsCount > 0 ? '#FFC107' : '#1D9BF0'),
              '&:hover': {
                backgroundColor: activeTab === 'alerts' 
                  ? (unreadAlertsCount > 0 ? '#FFB300' : '#1A91DA')
                  : (unreadAlertsCount > 0 ? 'rgba(255, 193, 7, 0.1)' : 'rgba(29, 155, 240, 0.1)'),
              }
            }}
          >
            Alerts ({unreadAlertsCount})
          </Button>
          <Button
            variant={activeTab === 'manage' ? 'contained' : 'outlined'}
            onClick={() => setActiveTab('manage')}
            startIcon={<SearchIcon />}
            sx={{
              backgroundColor: activeTab === 'manage' ? '#1D9BF0' : 'transparent',
              borderColor: '#1D9BF0',
              color: activeTab === 'manage' ? 'white' : '#1D9BF0',
              '&:hover': {
                backgroundColor: activeTab === 'manage' ? '#1A91DA' : 'rgba(29, 155, 240, 0.1)',
              }
            }}
          >
            Manage ({hotLists.length})
          </Button>
        </Box>
      </Box>

      {activeTab === 'alerts' && (
        <Card sx={{ backgroundColor: '#16181C', border: '1px solid #2F3336' }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ color: '#E7E9EA' }}>
                Hot List Alerts
              </Typography>
              {unreadAlertsCount > 0 && (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    onClick={handleMarkAllAlertsRead}
                    sx={{ color: '#1D9BF0' }}
                  >
                    Mark All Read
                  </Button>
                  <Button
                    size="small"
                    onClick={() => setClearConfirmOpen(true)}
                    sx={{ color: '#F91880' }}
                    startIcon={<ClearIcon />}
                  >
                    Clear All
                  </Button>
                </Box>
              )}
            </Box>

            {alertsLoading ? (
              <Typography sx={{ color: '#71767B', textAlign: 'center', py: 4 }}>
                Loading alerts...
              </Typography>
            ) : alerts.length === 0 ? (
              <Alert 
                severity="info"
                sx={{
                  backgroundColor: 'rgba(29, 155, 240, 0.1)',
                  border: '1px solid rgba(29, 155, 240, 0.3)',
                  color: '#E7E9EA',
                  '& .MuiAlert-icon': {
                    color: '#1D9BF0'
                  }
                }}
              >
                No alerts yet. When new posts match your hot list search terms, they will appear here.
              </Alert>
            ) : (
              <Box>
                {alerts.map((alert) => (
                  <HotListAlertCard
                    key={alert.id}
                    alert={alert}
                    onMarkRead={handleMarkAlertRead}
                    onOpenPost={(postId) => {
                      // Open post details modal
                      const event = new CustomEvent('open-post-modal', { detail: { postId } });
                      window.dispatchEvent(event);
                      handleMarkAlertRead(alert);
                    }}
                  />
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'manage' && (
        <Card sx={{ backgroundColor: '#16181C', border: '1px solid #2F3336' }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ color: '#E7E9EA' }}>
                Search Terms
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => openEditDialog()}
                sx={{ backgroundColor: '#1D9BF0', '&:hover': { backgroundColor: '#1A91DA' } }}
              >
                Add Hot List
              </Button>
            </Box>

            <Alert 
              severity="info" 
              sx={{ 
                mb: 2,
                backgroundColor: 'rgba(29, 155, 240, 0.1)',
                border: '1px solid rgba(29, 155, 240, 0.3)',
                color: '#E7E9EA',
                '& .MuiAlert-icon': {
                  color: '#1D9BF0'
                }
              }}
            >
              Hot Lists automatically monitor new posts for your specified search terms. When a match is found, 
              you'll receive a notification and the alert will appear in your alerts tab.
            </Alert>

            {loading ? (
              <Typography sx={{ color: '#71767B', textAlign: 'center', py: 4 }}>
                Loading hot lists...
              </Typography>
            ) : hotLists.length === 0 ? (
              <Alert 
                severity="info"
                sx={{
                  backgroundColor: 'rgba(29, 155, 240, 0.1)',
                  border: '1px solid rgba(29, 155, 240, 0.3)',
                  color: '#E7E9EA',
                  '& .MuiAlert-icon': {
                    color: '#1D9BF0'
                  }
                }}
              >
                No hot lists created yet. Click "Add Hot List" to create your first search term monitor.
              </Alert>
            ) : (
              <TableContainer component={Paper} sx={{ backgroundColor: '#16181C', border: '1px solid #2F3336' }}>
                <Table>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#1A1C20' }}>
                      <TableCell sx={{ color: '#E7E9EA', fontWeight: 'bold', borderBottom: '1px solid #2F3336' }}>Search Term</TableCell>
                      <TableCell sx={{ color: '#E7E9EA', fontWeight: 'bold', borderBottom: '1px solid #2F3336' }}>Status</TableCell>
                      <TableCell sx={{ color: '#E7E9EA', fontWeight: 'bold', borderBottom: '1px solid #2F3336' }}>Created</TableCell>
                      <TableCell sx={{ color: '#E7E9EA', fontWeight: 'bold', borderBottom: '1px solid #2F3336' }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {hotLists.map((hotList) => (
                      <TableRow key={hotList.id} sx={{ '&:hover': { backgroundColor: 'rgba(29, 155, 240, 0.1)' } }}>
                        <TableCell sx={{ color: '#E7E9EA', borderBottom: '1px solid #2F3336' }}>{hotList.search_term}</TableCell>
                        <TableCell sx={{ borderBottom: '1px solid #2F3336' }}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={hotList.is_active}
                                onChange={() => handleToggleActive(hotList)}
                                size="small"
                                sx={{
                                  '& .MuiSwitch-switchBase.Mui-checked': {
                                    color: '#1D9BF0',
                                  },
                                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                    backgroundColor: '#1D9BF0',
                                  },
                                  '& .MuiSwitch-track': {
                                    backgroundColor: '#2F3336',
                                  },
                                }}
                              />
                            }
                            label={
                              <Chip
                                label={hotList.is_active ? 'Active' : 'Inactive'}
                                color={hotList.is_active ? 'success' : 'default'}
                                size="small"
                                sx={{
                                  backgroundColor: hotList.is_active ? '#00D084' : '#2F3336',
                                  color: hotList.is_active ? 'white' : '#71767B'
                                }}
                              />
                            }
                          />
                        </TableCell>
                        <TableCell sx={{ color: '#71767B', borderBottom: '1px solid #2F3336' }}>
                          {formatDate(hotList.created_at)}
                        </TableCell>
                        <TableCell sx={{ borderBottom: '1px solid #2F3336' }}>
                          <IconButton
                            size="small"
                            onClick={() => handleCheckExistingPosts(hotList.search_term, hotList.id)}
                            sx={{ color: '#9C27B0', mr: 1 }}
                            title="Check existing posts"
                          >
                            <HistoryIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => openEditDialog(hotList)}
                            sx={{ color: '#1D9BF0', mr: 1 }}
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(hotList)}
                            sx={{ color: '#F91880' }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog 
        open={dialogOpen} 
        onClose={() => setDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#16181C',
            border: '1px solid #2F3336',
            color: '#E7E9EA'
          }
        }}
      >
        <DialogTitle sx={{ color: '#E7E9EA' }}>
          {editingHotList ? 'Edit Hot List' : 'Create New Hot List'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Search Term"
            fullWidth
            variant="outlined"
            value={newSearchTerm}
            onChange={(e) => setNewSearchTerm(e.target.value)}
            placeholder="Enter the term you want to monitor..."
            helperText="This term will be searched in post titles, content, and excerpts"
            sx={{
              '& .MuiOutlinedInput-root': {
                color: '#E7E9EA',
                backgroundColor: 'rgba(29, 155, 240, 0.05)',
                '& fieldset': {
                  borderColor: '#2F3336',
                },
                '&:hover fieldset': {
                  borderColor: '#1D9BF0',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#1D9BF0',
                },
              },
              '& .MuiInputLabel-root': {
                color: '#71767B',
                '&.Mui-focused': {
                  color: '#1D9BF0',
                },
              },
              '& .MuiFormHelperText-root': {
                color: '#71767B',
              },
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} sx={{ color: '#71767B' }}>Cancel</Button>
          <Button onClick={handleCreateOrUpdate} variant="contained" sx={{ backgroundColor: '#1D9BF0', '&:hover': { backgroundColor: '#1A91DA' } }}>
            {editingHotList ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Clear All Alerts Confirmation Dialog */}
      <Dialog 
        open={clearConfirmOpen} 
        onClose={() => setClearConfirmOpen(false)}
        PaperProps={{
          sx: {
            backgroundColor: '#16181C',
            border: '1px solid #2F3336',
            color: '#E7E9EA'
          }
        }}
      >
        <DialogTitle sx={{ color: '#E7E9EA' }}>Clear All Hot List Alerts?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: '#71767B' }}>
            This will permanently delete all your hot list alerts. This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearConfirmOpen(false)} sx={{ color: '#71767B' }}>Cancel</Button>
          <Button 
            onClick={handleClearAllAlerts} 
            variant="contained"
            sx={{ 
              backgroundColor: '#F91880', 
              color: 'white',
              '&:hover': { backgroundColor: '#D60E5A' }
            }}
          >
            Clear All
          </Button>
        </DialogActions>
      </Dialog>

      {/* Existing Posts Results Dialog */}
      <Dialog 
        open={existingPostsDialogOpen} 
        onClose={() => setExistingPostsDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#16181C',
            border: '1px solid #2F3336',
            color: '#E7E9EA'
          }
        }}
      >
        <DialogTitle sx={{ color: '#E7E9EA' }}>Existing Posts Check Results</DialogTitle>
        <DialogContent>
          {existingPostsResults && (
            <Box>
              <Alert 
                severity="info" 
                sx={{ 
                  mb: 2,
                  backgroundColor: 'rgba(29, 155, 240, 0.1)',
                  border: '1px solid rgba(29, 155, 240, 0.3)',
                  color: '#E7E9EA',
                  '& .MuiAlert-icon': {
                    color: '#1D9BF0'
                  }
                }}
              >
                Found {existingPostsResults.matchingPosts} existing posts matching your search term.
                {existingPostsResults.alertsCreated > 0 && 
                  ` Created ${existingPostsResults.alertsCreated} new alerts.`
                }
              </Alert>
              
              {existingPostsResults.posts && existingPostsResults.posts.length > 0 && (
                <Box>
                  <Typography variant="h6" sx={{ color: '#E7E9EA', mb: 2 }}>Sample Matching Posts:</Typography>
                  {existingPostsResults.posts.map((post: any) => (
                    <Card key={post.id} sx={{ mb: 1, backgroundColor: '#16181C', border: '1px solid #2F3336' }}>
                      <CardContent sx={{ py: 1 }}>
                        <Typography variant="body2" sx={{ color: '#E7E9EA', fontWeight: 600 }}>
                          {post.title}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#71767B' }}>
                          by {post.author_name} • {formatDate(post.wp_published_date)}
                        </Typography>
                      </CardContent>
                    </Card>
                  ))}
                  {existingPostsResults.matchingPosts > existingPostsResults.posts.length && (
                    <Typography variant="caption" sx={{ color: '#71767B' }}>
                      ...and {existingPostsResults.matchingPosts - existingPostsResults.posts.length} more posts
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExistingPostsDialogOpen(false)} sx={{ color: '#1D9BF0' }}>Close</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ 
            width: '100%',
            backgroundColor: snackbar.severity === 'success' 
              ? 'rgba(0, 208, 132, 0.15)' 
              : 'rgba(249, 24, 128, 0.15)',
            border: `1px solid ${snackbar.severity === 'success' 
              ? 'rgba(0, 208, 132, 0.5)' 
              : 'rgba(249, 24, 128, 0.5)'}`,
            color: '#E7E9EA',
            '& .MuiAlert-icon': {
              color: snackbar.severity === 'success' ? '#00D084' : '#F91880'
            },
            '& .MuiAlert-action': {
              color: '#E7E9EA'
            }
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default HotList;