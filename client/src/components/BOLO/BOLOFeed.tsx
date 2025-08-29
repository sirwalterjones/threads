import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  IconButton,
  Button,
  Avatar,
  TextField,
  InputAdornment,
  FormControl,
  Select,
  MenuItem,
  Chip,
  CircularProgress,
  Tabs,
  Tab,
  Snackbar,
  Alert,
  Menu,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
  Loop as RepostIcon,
  ChatBubbleOutline as CommentIcon,
  BookmarkBorder as SaveIcon,
  Bookmark as SavedIcon,
  MoreHoriz as MoreIcon,
  Verified as VerifiedIcon,
  Warning as WarningIcon,
  DirectionsCar as VehicleIcon,
  Person as PersonIcon,
  HomeWork as PropertyIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Share as ShareIcon,
  Visibility as ViewIcon
} from '@mui/icons-material';
import { BOLO, BOLOFilters, BOLOFeedResponse } from '../../types/bolo';
import boloApi from '../../services/boloApi';
import { useAuth } from '../../contexts/AuthContext';
import { formatDistanceToNow, format } from 'date-fns';
import './BOLOFeed.css';

const BOLOFeed: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [bolos, setBolos] = useState<BOLO[]>([]);
  const [savedBolos, setSavedBolos] = useState<BOLO[]>([]);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0); // 0 = All, 1 = Saved
  const [filters, setFilters] = useState<BOLOFilters>({
    // Don't filter by status to show all BOLOs including resolved
    sortBy: 'created_at',
    sortOrder: 'DESC',
    limit: 20,
    offset: 0
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedBolo, setSelectedBolo] = useState<BOLO | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const canCreateBOLO = user?.role === 'admin' || user?.role === 'edit';

  useEffect(() => {
    if (tabValue === 0) {
      loadBOLOs();
    } else {
      loadSavedBOLOs();
    }
  }, [filters, tabValue]);

  const loadBOLOs = async () => {
    try {
      setLoading(true);
      const response: BOLOFeedResponse = await boloApi.getBOLOFeed(filters);
      if (filters.offset === 0) {
        setBolos(response.bolos);
      } else {
        setBolos(prev => [...prev, ...response.bolos]);
      }
    } catch (error) {
      console.error('Error loading BOLOs:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSavedBOLOs = async () => {
    try {
      setLoading(true);
      const saved = await boloApi.getSavedBOLOs();
      setSavedBolos(saved);
    } catch (error) {
      console.error('Error loading saved BOLOs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setFilters(prev => ({
      ...prev,
      search: searchTerm,
      offset: 0
    }));
  };

  const handleFilterChange = (key: keyof BOLOFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      offset: 0
    }));
  };

  const handleRepost = async (e: React.MouseEvent, bolo: BOLO) => {
    e.stopPropagation();
    try {
      await boloApi.repostBOLO(bolo.id);
      // Update the BOLO in the list
      const updateBolo = (boloList: BOLO[]) => 
        boloList.map(b => b.id === bolo.id ? { ...b, is_reposted: true, repost_count: b.repost_count + 1 } : b);
      
      if (tabValue === 0) {
        setBolos(updateBolo);
      } else {
        setSavedBolos(updateBolo);
      }
      setSnackbar({ open: true, message: 'BOLO reposted successfully', severity: 'success' });
    } catch (error: any) {
      console.error('Error reposting:', error);
      setSnackbar({ 
        open: true, 
        message: error.message === 'Already reposted this BOLO' ? 'You have already reposted this BOLO' : 'Failed to repost', 
        severity: 'error' 
      });
    }
  };

  const handleSave = async (e: React.MouseEvent, bolo: BOLO) => {
    e.stopPropagation();
    try {
      const saved = await boloApi.toggleSaveBOLO(bolo.id);
      // Update the BOLO in the list
      const updateBolo = (boloList: BOLO[]) => 
        boloList.map(b => b.id === bolo.id ? { ...b, is_saved: saved } : b);
      
      setBolos(updateBolo);
      
      if (saved) {
        // If saved, refresh saved list
        loadSavedBOLOs();
        setSnackbar({ open: true, message: 'BOLO saved to your dashboard', severity: 'success' });
      } else {
        // If unsaved, remove from saved list
        setSavedBolos(prev => prev.filter(b => b.id !== bolo.id));
        setSnackbar({ open: true, message: 'BOLO removed from saved items', severity: 'success' });
      }
    } catch (error) {
      console.error('Error saving:', error);
      setSnackbar({ open: true, message: 'Failed to save BOLO', severity: 'error' });
    }
  };

  const handleComment = (e: React.MouseEvent, bolo: BOLO) => {
    e.stopPropagation();
    navigate(`/bolo/${bolo.id}#comments`);
  };

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>, bolo: BOLO) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
    setSelectedBolo(bolo);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleEdit = () => {
    if (selectedBolo) {
      navigate(`/bolo/${selectedBolo.id}`);
    }
    handleMenuClose();
  };

  const handleDelete = async () => {
    if (!selectedBolo) return;
    
    try {
      // You would need to add a deleteBOLO method to boloApi
      // await boloApi.deleteBOLO(selectedBolo.id);
      setSnackbar({ open: true, message: 'Delete functionality not yet implemented', severity: 'error' });
      setDeleteDialogOpen(false);
      handleMenuClose();
      // Reload BOLOs after deletion
      // loadBOLOs();
    } catch (error) {
      console.error('Error deleting BOLO:', error);
      setSnackbar({ open: true, message: 'Failed to delete BOLO', severity: 'error' });
    }
  };

  const handleShare = () => {
    if (selectedBolo?.public_share_token) {
      const link = boloApi.getShareableLink(selectedBolo);
      navigator.clipboard.writeText(link);
      setSnackbar({ open: true, message: 'Share link copied to clipboard', severity: 'success' });
    }
    handleMenuClose();
  };

  const canEditBolo = (bolo: BOLO) => {
    return user && (user.role === 'admin' || (user.role === 'edit' && bolo.created_by === user.id));
  };

  const getTypeIcon = (type: BOLO['type']) => {
    switch (type) {
      case 'person': return <PersonIcon />;
      case 'vehicle': return <VehicleIcon />;
      case 'property': return <PropertyIcon />;
      default: return null;
    }
  };

  const getPriorityColor = (priority: BOLO['priority']) => {
    switch (priority) {
      case 'immediate': return '#ff4757';
      case 'high': return '#ffa502';
      case 'medium': return '#3742fa';
      case 'low': return '#747d8c';
      default: return '#747d8c';
    }
  };

  const getStatusLabel = (bolo: BOLO) => {
    const labels = [];
    
    if (bolo.status === 'active') {
      labels.push('Be on the lookout');
    } else {
      labels.push(bolo.status.charAt(0).toUpperCase() + bolo.status.slice(1));
    }
    
    if (bolo.type) {
      labels.push(bolo.type.charAt(0).toUpperCase() + bolo.type.slice(1));
    }
    
    labels.push(formatDistanceToNow(new Date(bolo.created_at), { addSuffix: false }));
    
    return labels.join(' • ');
  };

  const renderBOLOCard = (bolo: BOLO) => (
    <section key={bolo.id} className="bolo-feed-item">
      {/* Organization Header */}
      <header className="feed-header">
        <div className="org">
          <Avatar className="org-logo" sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
            {bolo.agency_name?.[0] || 'B'}
          </Avatar>
          <div className="org-info">
            <div className="org-name">
              {bolo.agency_name}
              <VerifiedIcon className="verified" />
            </div>
            <div className="org-sub">{bolo.officer_name}</div>
          </div>
        </div>
        {bolo.armed_dangerous && (
          <Chip
            icon={<WarningIcon />}
            label="Armed & Dangerous"
            color="error"
            size="small"
            className="danger-chip"
          />
        )}
      </header>

      {/* Post Card */}
      <article 
        className={`post-card ${bolo.status !== 'active' && bolo.status !== 'pending' ? 'status-overlay' : ''}`}
        role="article" 
        aria-labelledby={`post-title-${bolo.id}`}
        onClick={() => navigate(`/bolo/${bolo.id}`)}
      >
        {/* Status Banner for resolved/cancelled/expired BOLOs */}
        {(bolo.status === 'resolved' || bolo.status === 'cancelled' || bolo.status === 'expired') && (
          <div className={`status-banner status-banner-${bolo.status}`}>
            <Chip
              label={bolo.status.toUpperCase()}
              size="small"
              className={`status-chip status-chip-${bolo.status}`}
              icon={bolo.status === 'resolved' ? <VerifiedIcon /> : <WarningIcon />}
            />
          </div>
        )}
        <div className="card-grid">
          <div className="card-content">
            <div className="priority-indicator" style={{ backgroundColor: getPriorityColor(bolo.priority) }} />
            <h3 id={`post-title-${bolo.id}`} className="post-title">
              {bolo.title}
            </h3>
            <p className="post-excerpt">{bolo.summary}</p>
            
            {/* Key Details */}
            <div className="key-details">
              {bolo.subject_name && (
                <div className="detail-item">
                  <span className="detail-label">Subject:</span>
                  <span className="detail-value">{bolo.subject_name}</span>
                </div>
              )}
              {bolo.license_plate && (
                <div className="detail-item">
                  <span className="detail-label">License:</span>
                  <span className="detail-value">{bolo.license_plate}</span>
                </div>
              )}
              {bolo.last_known_location && (
                <div className="detail-item">
                  <span className="detail-label">Last Known:</span>
                  <span className="detail-value">{bolo.last_known_location}</span>
                </div>
              )}
            </div>
          </div>

          {bolo.primary_thumbnail_url && (
            <figure className="card-thumb" aria-hidden="true">
              <img src={bolo.primary_thumbnail_url} alt="" />
            </figure>
          )}
        </div>

        {/* Author Pill */}
        <div className="author-pill" aria-label="Case information">
          <div className="case-icon">
            {getTypeIcon(bolo.type)}
          </div>
          <div className="author-meta">
            <div className="author-name">
              Case #{bolo.case_number}
              <span className="dept">{bolo.jurisdiction || bolo.agency_name}</span>
            </div>
            <div className="status">
              <span className={`status-dot ${bolo.status}`} aria-hidden="true"></span>
              <span className="status-text">{getStatusLabel(bolo)}</span>
            </div>
            <div className="timestamp">
              <span className="created-time">
                {format(new Date(bolo.created_at), 'MMM d, h:mm a')}
              </span>
              {bolo.incident_date && (
                <span className="incident-time">
                  Incident: {format(new Date(bolo.incident_date), 'MMM d, yyyy')}
                </span>
              )}
            </div>
          </div>
        </div>
      </article>

      {/* Action Footer */}
      <footer className="post-actions" role="group" aria-label="Post actions">
        <button 
          className={`action repost ${bolo.is_reposted ? 'active' : ''}`}
          onClick={(e) => handleRepost(e, bolo)}
          aria-label="Repost"
        >
          <RepostIcon fontSize="small" />
          {bolo.repost_count > 0 && <span>{bolo.repost_count}</span>}
        </button>
        
        <button 
          className="action comment"
          onClick={(e) => handleComment(e, bolo)}
          aria-label="Comments"
        >
          <CommentIcon fontSize="small" />
          {bolo.comment_count > 0 && <span>{bolo.comment_count}</span>}
        </button>
        
        <button 
          className={`action save ${bolo.is_saved ? 'active' : ''}`}
          onClick={(e) => handleSave(e, bolo)}
          aria-label="Save"
        >
          {bolo.is_saved ? <SavedIcon fontSize="small" /> : <SaveIcon fontSize="small" />}
        </button>
        
        <IconButton 
          className="action more"
          aria-label="More options"
          onClick={(e) => handleMenuOpen(e, bolo)}
          size="small"
        >
          <MoreIcon fontSize="small" />
        </IconButton>
      </footer>
    </section>
  );

  const displayBolos = tabValue === 0 ? bolos : savedBolos;

  return (
    <Box className="bolo-feed-page" sx={{ backgroundColor: '#000000', minHeight: '100vh' }}>
      <Container maxWidth="lg">
        {/* Header Controls */}
        <Box className="feed-controls">
          <Typography variant="h4" className="feed-title">
            {tabValue === 0 ? 'BOLO Feed' : 'Saved BOLOs'}
          </Typography>
          
          <Box className="feed-actions">
            {/* Search */}
            <TextField
              className="feed-search"
              placeholder="Search BOLOs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              size="small"
            />

            {/* Filters */}
            <Box className="feed-filters">
              <FormControl size="small" className="filter-select">
                <Select
                  value={filters.type || 'all'}
                  onChange={(e) => handleFilterChange('type', e.target.value === 'all' ? undefined : e.target.value)}
                  displayEmpty
                >
                  <MenuItem value="all">All Types</MenuItem>
                  <MenuItem value="person">Person</MenuItem>
                  <MenuItem value="vehicle">Vehicle</MenuItem>
                  <MenuItem value="property">Property</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" className="filter-select">
                <Select
                  value={filters.priority || 'all'}
                  onChange={(e) => handleFilterChange('priority', e.target.value === 'all' ? undefined : e.target.value)}
                  displayEmpty
                >
                  <MenuItem value="all">All Priorities</MenuItem>
                  <MenuItem value="immediate">Immediate</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="low">Low</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" className="filter-select">
                <Select
                  value={filters.status || 'active'}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  displayEmpty
                >
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="resolved">Resolved</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                  <MenuItem value="expired">Expired</MenuItem>
                </Select>
              </FormControl>
            </Box>

            {/* Action Buttons */}
            <IconButton onClick={loadBOLOs} className="icon-action">
              <RefreshIcon />
            </IconButton>
            
            {canCreateBOLO && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => navigate('/bolo/new')}
                className="create-btn"
              >
                Create BOLO
              </Button>
            )}
          </Box>
        </Box>

        {/* Tabs */}
        <Tabs 
          value={tabValue} 
          onChange={(e, newValue) => setTabValue(newValue)}
          sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="All BOLOs" />
          <Tab label="Saved BOLOs" />
        </Tabs>

        {/* Feed Content */}
        <Box className="feed-content">
          {loading && displayBolos.length === 0 ? (
            <Box className="loading-container">
              <CircularProgress />
            </Box>
          ) : displayBolos.length === 0 ? (
            <Box className="empty-state">
              <Typography variant="h6">
                {tabValue === 0 ? 'No BOLOs found' : 'No saved BOLOs'}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {tabValue === 0 ? 'Adjust your filters or create a new BOLO' : 'Save BOLOs to see them here'}
              </Typography>
            </Box>
          ) : (
            <>
              {displayBolos.map(bolo => renderBOLOCard(bolo))}
              
              {/* Load More - only for all BOLOs tab */}
              {tabValue === 0 && !loading && bolos.length >= (filters.limit || 20) && (
                <Box className="load-more">
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setFilters(prev => ({
                        ...prev,
                        offset: (prev.offset || 0) + (prev.limit || 20)
                      }));
                    }}
                  >
                    Load More
                  </Button>
                </Box>
              )}
            </>
          )}
        </Box>

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
            {snackbar.message}
          </Alert>
        </Snackbar>

        {/* More Options Menu */}
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={handleMenuClose}
          PaperProps={{
            sx: {
              backgroundColor: 'background.paper',
              minWidth: 180
            }
          }}
        >
          <MenuItem onClick={() => { navigate(`/bolo/${selectedBolo?.id}`); handleMenuClose(); }}>
            <ListItemIcon><ViewIcon fontSize="small" /></ListItemIcon>
            <ListItemText>View Details</ListItemText>
          </MenuItem>
          
          {selectedBolo && canEditBolo(selectedBolo) && (
            <MenuItem onClick={handleEdit}>
              <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Edit</ListItemText>
            </MenuItem>
          )}
          
          <MenuItem onClick={handleShare}>
            <ListItemIcon><ShareIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Share</ListItemText>
          </MenuItem>
          
          {selectedBolo && canEditBolo(selectedBolo) && (
            <MenuItem onClick={() => { setDeleteDialogOpen(true); handleMenuClose(); }} sx={{ color: 'error.main' }}>
              <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
              <ListItemText>Delete</ListItemText>
            </MenuItem>
          )}
        </Menu>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
        >
          <DialogTitle>Delete BOLO</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to delete this BOLO? This action cannot be undone.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleDelete} color="error" variant="contained">Delete</Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
};

export default BOLOFeed;