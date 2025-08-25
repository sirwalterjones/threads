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
  Snackbar,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Notifications as NotificationsIcon,
  NotificationImportant as AlertIcon,
  Clear as ClearIcon,
  History as HistoryIcon,
  TextFields as TextFieldsIcon
} from '@mui/icons-material';
import apiService from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import PostDetailModal from '../components/PostDetailModal';
import MediaGallery from '../components/MediaGallery';

// Helper functions for post cards
const stripHtmlTags = (html: string) => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
};

const extractImageUrls = (html?: string): string[] => {
  if (!html) return [];
  try {
    const div = document.createElement('div');
    div.innerHTML = html;
    const imgs = Array.from(div.querySelectorAll('img'));
    return imgs
      .map(img => {
        let src = (img.getAttribute('src') || '').trim();
        if (!src) src = (img.getAttribute('data-src') || '').trim();
        if (!src) {
          const srcset = (img.getAttribute('srcset') || '').trim();
          if (srcset) {
            src = srcset.split(',')[0].trim().split(' ')[0];
          }
        }
        return src;
      })
      .filter(src => !!src);
  } catch {
    return [];
  }
};

const resolveContentImageUrl = (rawUrl: string): string => {
  if (!rawUrl) return rawUrl;
  if (rawUrl.startsWith('/api/files/') || rawUrl.startsWith('/api/files/')) {
    return rawUrl;
  }
  const remoteBase = (process.env.REACT_APP_WP_SITE_URL || 'https://cmansrms.us').replace(/\/$/, '');
  let absolute = rawUrl;
  if (rawUrl.startsWith('/')) absolute = `${remoteBase}${rawUrl}`;
  else if (!rawUrl.startsWith('http')) absolute = `${remoteBase}/${rawUrl}`;
  return absolute;
};

// Hot List Alert Card Component - matches HomeSimple post cards exactly
const HotListAlertCard: React.FC<{
  alert: HotListAlert;
  post: any; // Full post data from API
  onMarkRead: (alert: HotListAlert) => void;
  onOpenPost: (postId: number) => void;
  highlightTerms: string[];
}> = ({ alert, post, onMarkRead, onOpenPost, highlightTerms }) => {
  
  const highlightText = (text: string) => {
    if (!text || !highlightTerms.length) return text;
    
    let result = text;
    highlightTerms.forEach(term => {
      if (term) {
        const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        result = result.replace(regex, (match) => 
          `<mark style="background-color: #EF4444; color: white; padding: 2px 4px; border-radius: 4px;">${match}</mark>`
        );
      }
    });
    
    return <span dangerouslySetInnerHTML={{ __html: result }} />;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const titleText = stripHtmlTags(post.title);
  const excerptText = stripHtmlTags(post.excerpt || '');
  const contentText = stripHtmlTags(post.content || '');

  return (
    <Card
      sx={{
        height: '100%',
        backgroundColor: alert.is_read ? '#16181C' : 'rgba(29, 155, 240, 0.05)',
        border: `1px solid ${alert.is_read ? '#2F3336' : '#1D9BF0'}`,
        borderRadius: 2,
        cursor: 'pointer',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        },
      }}
      onClick={() => {
        onOpenPost(alert.post_id);
        if (!alert.is_read) {
          onMarkRead(alert);
        }
      }}
    >
      <CardContent>
        {/* Hot List Alert Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <AlertIcon sx={{ color: alert.is_read ? '#71767B' : '#1D9BF0', fontSize: '16px' }} />
          <Chip
            label={`Hot List Alert: "${alert.search_term}"`}
            size="small"
            sx={{ 
              backgroundColor: alert.is_read ? '#2F3336' : '#1D9BF0', 
              color: 'white',
              fontSize: '11px',
              height: '20px'
            }}
          />
          {/* Exact Match Indicator */}
          {alert.exact_match !== undefined && (
            <Chip
              label={alert.exact_match ? 'Exact' : 'Words'}
              size="small"
              icon={alert.exact_match ? <SearchIcon /> : <TextFieldsIcon />}
              sx={{
                backgroundColor: alert.exact_match ? '#9C27B0' : '#FF9800',
                color: 'white',
                fontSize: '10px',
                height: '18px'
              }}
            />
          )}
          <Typography variant="caption" sx={{ color: '#71767B', ml: 'auto' }}>
            {formatDate(alert.created_at)}
          </Typography>
          {!alert.is_read && (
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#1D9BF0' }} />
          )}
        </Box>

        {/* Media Gallery - same as HomeSimple */}
        {post.attachments && post.attachments.length > 0 && (
          <MediaGallery attachments={post.attachments} maxHeight={180} />
        )}
        {(!post.attachments || post.attachments.length === 0) && (
          <>
            {(() => {
              const imageUrls = extractImageUrls(post.content).slice(0, 5);
              if (imageUrls.length === 0) return null;
              return (
                <Box sx={{ 
                  mb: 2, 
                  display: 'flex', 
                  gap: { xs: 0.5, sm: 1 }, 
                  overflowX: 'auto', 
                  pb: 1,
                  px: { xs: 0.5, sm: 0 }
                }}>
                  {imageUrls.map((url, idx) => (
                    <img
                      key={idx}
                      src={resolveContentImageUrl(url)}
                      alt={`Post image ${idx + 1}`}
                      style={{ 
                        width: window.innerWidth < 600 ? 120 : 160, 
                        height: window.innerWidth < 600 ? 90 : 120, 
                        objectFit: 'cover', 
                        borderRadius: '8px', 
                        flex: '0 0 auto' 
                      }}
                      onError={(e) => {
                        const img = e.currentTarget as HTMLImageElement;
                        if (url.includes('cmansrms.us') || url.includes('wordpress')) {
                          img.src = url.startsWith('http') ? url : `https://cmansrms.us${url.startsWith('/') ? url : `/${url}`}`;
                        } else {
                          img.style.display = 'none';
                        }
                      }}
                    />
                  ))}
                </Box>
              );
            })()}
          </>
        )}
        
        {/* Title with highlighting */}
        <Typography variant="h6" component="h2" gutterBottom sx={{ color: '#E7E9EA', fontSize: '1rem', mb: 1 }}>
          {highlightText(titleText)}
        </Typography>
        
        {/* Content/excerpt with highlighting */}
        {(() => {
          const raw = post.excerpt && post.excerpt.trim().length > 0 
            ? post.excerpt 
            : (post.content || '');
          const text = stripHtmlTags(raw);
          if (!text) return null;
          return (
            <Typography variant="body2" sx={{ color: '#6B7280', mb: 1, fontSize: '0.875rem' }}>
              {highlightText(text.substring(0, 450))}...
            </Typography>
          );
        })()}

        {/* Category and metadata */}
        <Box sx={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: { xs: 0.25, sm: 0.5 }, 
          mb: 1 
        }}>
          {post.category_name && (
            <Chip 
              size="small"
              label={post.category_name} 
              sx={{ 
                backgroundColor: '#1D9BF0', 
                color: 'white', 
                fontSize: '0.75rem',
                height: '20px'
              }}
            />
          )}
          <Chip 
            size="small"
            label={`by ${post.author_name}`}
            sx={{ 
              backgroundColor: '#2F3336', 
              color: '#71767B', 
              fontSize: '0.75rem',
              height: '20px'
            }}
          />
        </Box>

        {/* Date */}
        <Typography variant="body2" sx={{ color: '#71767B', fontSize: '0.75rem' }}>
          {formatDate(post.wp_published_date)}
        </Typography>
      </CardContent>
    </Card>
  );
};

interface HotList {
  id: number;
  search_term: string;
  is_active: boolean;
  exact_match: boolean;
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
  exact_match?: boolean; // Optional for backward compatibility
}

const HotList: React.FC = () => {
  const { user } = useAuth();
  const [hotLists, setHotLists] = useState<HotList[]>([]);
  const [alerts, setAlerts] = useState<HotListAlert[]>([]);
  const [alertPosts, setAlertPosts] = useState<{[key: number]: any}>({});
  const [loading, setLoading] = useState(false);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHotList, setEditingHotList] = useState<HotList | null>(null);
  const [newSearchTerm, setNewSearchTerm] = useState('');
  const [exactMatch, setExactMatch] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  });
  const [activeTab, setActiveTab] = useState<'alerts' | 'manage'>('alerts');
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [existingPostsDialogOpen, setExistingPostsDialogOpen] = useState(false);
  const [existingPostsResults, setExistingPostsResults] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'search_term' | 'is_read'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

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
      
      // Fetch full post data for each alert
      const postIds = response.alerts.map((alert: HotListAlert) => alert.post_id);
      const uniquePostIds = postIds.filter((id, index) => postIds.indexOf(id) === index);
      
      const postPromises = uniquePostIds.map(async (postId) => {
        try {
          const postResponse = await apiService.getPost(postId);
          return { [postId]: postResponse };
        } catch (error) {
          console.error(`Error loading post ${postId}:`, error);
          return { [postId]: null };
        }
      });
      
      const postResults = await Promise.all(postPromises);
      const postsMap: {[key: number]: any} = {};
      postResults.forEach(result => {
        Object.assign(postsMap, result);
      });
      setAlertPosts(postsMap);
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

  const handlePostClick = (postId: number) => {
    setSelectedPostId(postId);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedPostId(null);
  };

  const handleCreateOrUpdate = async () => {
    if (!newSearchTerm.trim()) {
      showSnackbar('Search term cannot be empty', 'error');
      return;
    }

    try {
      let hotListId: number | undefined;
      
      if (editingHotList) {
        await apiService.updateHotList(editingHotList.id, { searchTerm: newSearchTerm.trim(), exactMatch });
        showSnackbar('Hot list updated successfully', 'success');
        hotListId = editingHotList.id;
      } else {
        const result = await apiService.createHotList(newSearchTerm.trim(), exactMatch);
        showSnackbar('Hot list created successfully', 'success');
        hotListId = result.hotList.id;
      }
      
      setDialogOpen(false);
      setNewSearchTerm('');
      setEditingHotList(null);
      loadHotLists();
      
      // Check for existing posts that match this search term
      if (hotListId) {
        handleCheckExistingPosts(newSearchTerm.trim(), hotListId, exactMatch);
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
      setAlertPosts({});
      setClearConfirmOpen(false);
      showSnackbar(`Cleared ${result.deletedCount} alerts successfully`, 'success');
    } catch (error) {
      console.error('Error clearing all alerts:', error);
      showSnackbar('Failed to clear all alerts', 'error');
      setClearConfirmOpen(false);
    }
  };

  // Sort alerts based on current sort settings
  const getSortedAlerts = () => {
    return [...alerts].sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'date':
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        case 'search_term':
          aValue = a.search_term.toLowerCase();
          bValue = b.search_term.toLowerCase();
          break;
        case 'is_read':
          aValue = a.is_read ? 1 : 0;
          bValue = b.is_read ? 1 : 0;
          break;
        default:
          return 0;
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  };

  const handleCheckExistingPosts = async (searchTerm: string, hotListId?: number, exactMatch: boolean = false) => {
    try {
      const result = await apiService.checkExistingPosts(searchTerm, hotListId, exactMatch);
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
      setExactMatch(hotList.exact_match);
    } else {
      setEditingHotList(null);
      setNewSearchTerm('');
      setExactMatch(false);
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
                    variant="outlined"
                    size="small"
                    onClick={handleMarkAllAlertsRead}
                    sx={{ 
                      borderColor: '#2F3336',
                      color: '#E7E9EA',
                      '&:hover': {
                        borderColor: '#1D9BF0',
                        backgroundColor: 'rgba(29, 155, 240, 0.1)'
                      }
                    }}
                  >
                    Mark All Read
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setClearConfirmOpen(true)}
                    sx={{ 
                      borderColor: '#2F3336',
                      color: '#E7E9EA',
                      '&:hover': {
                        borderColor: '#F91880',
                        backgroundColor: 'rgba(249, 24, 128, 0.1)'
                      }
                    }}
                    startIcon={<ClearIcon />}
                  >
                    Clear All
                  </Button>
                </Box>
              )}
            </Box>

            {/* Sorting Controls */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" sx={{ color: '#71767B' }}>Sort by:</Typography>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {[
                    { value: 'date', label: 'Date' },
                    { value: 'search_term', label: 'Search Term' },
                    { value: 'is_read', label: 'Read Status' }
                  ].map((option) => (
                    <Button
                      key={option.value}
                      size="small"
                      variant={sortBy === option.value ? 'contained' : 'outlined'}
                      onClick={() => setSortBy(option.value as any)}
                      sx={{
                        minWidth: 'auto',
                        px: 1.5,
                        py: 0.5,
                        fontSize: '0.75rem',
                        backgroundColor: sortBy === option.value ? '#1D9BF0' : 'transparent',
                        borderColor: '#2F3336',
                        color: sortBy === option.value ? 'white' : '#71767B',
                        '&:hover': {
                          backgroundColor: sortBy === option.value ? '#1A91DA' : 'rgba(29, 155, 240, 0.1)',
                        }
                      }}
                    >
                      {option.label}
                    </Button>
                  ))}
                </Box>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" sx={{ color: '#71767B' }}>Order:</Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  sx={{
                    minWidth: 'auto',
                    px: 1.5,
                    py: 0.5,
                    fontSize: '0.75rem',
                    borderColor: '#2F3336',
                    color: '#71767B',
                    '&:hover': {
                      backgroundColor: 'rgba(29, 155, 240, 0.1)',
                    }
                  }}
                >
                  {sortOrder === 'asc' ? '↑ Ascending' : '↓ Descending'}
                </Button>
              </Box>
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
                <Box sx={{ 
                  display: 'grid', 
                  gap: 2, 
                  gridTemplateColumns: { 
                    xs: '1fr', 
                    sm: 'repeat(2, 1fr)', 
                    md: 'repeat(4, 1fr)' 
                  } 
                }}>
                  {getSortedAlerts().map((alert) => {
                    const post = alertPosts[alert.post_id];
                    if (!post) {
                      return (
                        <Card key={alert.id} sx={{ height: '100%', backgroundColor: '#16181C', border: '1px solid #2F3336' }}>
                          <CardContent>
                            <Typography sx={{ color: '#71767B' }}>Loading post data...</Typography>
                          </CardContent>
                        </Card>
                      );
                    }
                    
                    return (
                      <HotListAlertCard
                        key={alert.id}
                        alert={alert}
                        post={post}
                        onMarkRead={handleMarkAlertRead}
                        onOpenPost={handlePostClick}
                        highlightTerms={[alert.search_term]}
                      />
                    );
                  })}
                </Box>
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
              Hot Lists automatically monitor new posts for your specified search terms. When a match is found, you'll receive a notification.
            </Alert>
            
            {/* Match Type Legend */}
            <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Typography variant="body2" sx={{ color: '#71767B' }}>Match Types:</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip
                  label="Exact Phrase"
                  size="small"
                  icon={<SearchIcon />}
                  sx={{
                    backgroundColor: '#2F3336',
                    color: '#E7E9EA',
                    fontSize: '11px',
                    border: '1px solid #4A4A4A'
                  }}
                />
                <Typography variant="caption" sx={{ color: '#71767B' }}>
                  Exact phrase matching
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip
                  label="Word Match"
                  size="small"
                  icon={<TextFieldsIcon />}
                  sx={{
                    backgroundColor: '#2F3336',
                    color: '#E7E9EA',
                    fontSize: '11px',
                    border: '1px solid #4A4A4A'
                  }}
                />
                <Typography variant="caption" sx={{ color: '#71767B' }}>
                  Word-based matching
                </Typography>
              </Box>
            </Box>

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
                      <TableCell sx={{ color: '#E7E9EA', fontWeight: 'bold', borderBottom: '1px solid #2F3336' }}>Match Type</TableCell>
                      <TableCell sx={{ color: '#E7E9EA', fontWeight: 'bold', borderBottom: '1px solid #2F3336' }}>Status</TableCell>
                      <TableCell sx={{ color: '#E7E9EA', fontWeight: 'bold', borderBottom: '1px solid #2F3336' }}>Created</TableCell>
                      <TableCell sx={{ color: '#E7E9EA', fontWeight: 'bold', borderBottom: '1px solid #2F3336' }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {hotLists.map((hotList) => (
                      <TableRow key={hotList.id} sx={{ '&:hover': { backgroundColor: 'rgba(29, 155, 240, 0.1)' } }}>
                        <TableCell sx={{ color: '#E7E9EA', borderBottom: '1px solid #2F3336' }}>{hotList.search_term}</TableCell>
                        <TableCell sx={{ color: '#E7E9EA', borderBottom: '1px solid #2F3336' }}>
                          <Tooltip 
                            title={hotList.exact_match 
                              ? "Only posts containing the exact phrase will trigger alerts" 
                              : "Posts containing any of the words will trigger alerts"
                            }
                            arrow
                          >
                            <Chip
                              label={hotList.exact_match ? 'Exact Phrase' : 'Word Match'}
                              size="small"
                              icon={hotList.exact_match ? <SearchIcon /> : <TextFieldsIcon />}
                              sx={{
                                backgroundColor: hotList.exact_match ? '#9C27B0' : '#FF9800',
                                color: 'white',
                                fontSize: '12px'
                              }}
                            />
                          </Tooltip>
                        </TableCell>
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
                            onClick={() => handleCheckExistingPosts(hotList.search_term, hotList.id, hotList.exact_match)}
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
            helperText={exactMatch 
              ? "Only posts containing the exact phrase will trigger alerts" 
              : "Posts containing any of the words will trigger alerts (word-based matching)"
            }
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
          
          {/* Exact Match Toggle */}
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={exactMatch}
                  onChange={(e) => setExactMatch(e.target.checked)}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: '#1D9BF0',
                      '&:hover': {
                        backgroundColor: 'rgba(29, 155, 240, 0.08)',
                      },
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: '#1D9BF0',
                    },
                  }}
                />
              }
              label={
                <Typography sx={{ color: '#E7E9EA', fontSize: '14px' }}>
                  Exact Match Only
                </Typography>
              }
            />
            <Typography variant="caption" sx={{ color: '#71767B', ml: 1 }}>
              When enabled, only posts containing the exact phrase will trigger alerts
            </Typography>
          </Box>
          
          {/* Current Mode Indicator */}
          <Box sx={{ mt: 2, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={exactMatch ? 'Exact Phrase Mode' : 'Word Match Mode'}
              size="small"
              icon={exactMatch ? <SearchIcon /> : <TextFieldsIcon />}
              sx={{
                backgroundColor: exactMatch ? '#9C27B0' : '#FF9800',
                color: 'white',
                fontSize: '12px'
              }}
            />
          </Box>
          
          {/* Info about when to use each mode */}
          <Alert 
            severity="info" 
            sx={{ 
              mt: 1,
              backgroundColor: exactMatch ? 'rgba(156, 39, 176, 0.1)' : 'rgba(255, 152, 0, 0.1)',
              border: `1px solid ${exactMatch ? 'rgba(156, 39, 176, 0.3)' : 'rgba(255, 152, 0, 0.3)'}`,
              color: '#E7E9EA',
              '& .MuiAlert-icon': {
                color: exactMatch ? '#9C27B0' : '#FF9800'
              }
            }}
          >
            <Typography variant="caption" sx={{ color: '#E7E9EA' }}>
              <strong>{exactMatch ? 'Exact Phrase Mode:' : 'Word Match Mode:'}</strong> {
                exactMatch 
                  ? 'Use this for specific phrases, names, or exact text you want to find. Great for finding specific incidents or people.'
                  : 'Use this for broader searches where you want to find posts containing any of the words. Great for finding related topics.'
              }
            </Typography>
          </Alert>
          
          {/* Simple example */}
          <Box sx={{ mt: 2, p: 2, backgroundColor: 'rgba(29, 155, 240, 0.05)', borderRadius: 1, border: '1px solid rgba(29, 155, 240, 0.2)' }}>
            <Typography variant="caption" sx={{ color: '#71767B' }}>
              <strong>Example:</strong> "{newSearchTerm.trim() || 'Meth Trafficking'}" will {exactMatch ? 'only match the exact phrase' : 'match posts containing any of these words'}.
            </Typography>
          </Box>

          

          


              
              <Typography variant="caption" sx={{ color: '#9C27B0', display: 'block', mt: 1 }}>
                
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
              
              {/* Search Mode Indicator */}
              <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip
                  label={exactMatch ? 'Exact Phrase Search' : 'Word-Based Search'}
                  size="small"
                  icon={exactMatch ? <SearchIcon /> : <TextFieldsIcon />}
                  sx={{
                    backgroundColor: exactMatch ? '#9C27B0' : '#FF9800',
                    color: 'white',
                    fontSize: '12px'
                  }}
                />
                <Typography variant="caption" sx={{ color: '#71767B' }}>
                  {exactMatch 
                    ? 'Only posts containing the exact phrase were searched' 
                    : 'Posts containing any of the words were searched'
                  }
                </Typography>
              </Box>
              
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

      {/* Post Detail Modal */}
      <PostDetailModal
        open={modalOpen}
        onClose={handleModalClose}
        postId={selectedPostId}
      />
    </Box>
  );
};

export default HotList;