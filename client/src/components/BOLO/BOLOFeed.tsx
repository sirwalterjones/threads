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
  CircularProgress
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
  HomeWork as PropertyIcon
} from '@mui/icons-material';
import { BOLO, BOLOFilters, BOLOFeedResponse } from '../../types/bolo';
import boloApi from '../../services/boloApi';
import { useAuth } from '../../contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import './BOLOFeed.css';

const BOLOFeed: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [bolos, setBolos] = useState<BOLO[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<BOLOFilters>({
    status: 'active',
    sortBy: 'created_at',
    sortOrder: 'DESC',
    limit: 20,
    offset: 0
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const canCreateBOLO = user?.role === 'admin' || user?.role === 'edit';

  useEffect(() => {
    loadBOLOs();
  }, [filters]);

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
      loadBOLOs();
    } catch (error) {
      console.error('Error reposting:', error);
    }
  };

  const handleSave = async (e: React.MouseEvent, bolo: BOLO) => {
    e.stopPropagation();
    try {
      await boloApi.toggleSaveBOLO(bolo.id);
      loadBOLOs();
    } catch (error) {
      console.error('Error saving:', error);
    }
  };

  const handleComment = (e: React.MouseEvent, bolo: BOLO) => {
    e.stopPropagation();
    navigate(`/bolo/${bolo.id}#comments`);
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
        className="post-card" 
        role="article" 
        aria-labelledby={`post-title-${bolo.id}`}
        onClick={() => navigate(`/bolo/${bolo.id}`)}
      >
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
        
        <button 
          className="action more"
          aria-label="More options"
        >
          <MoreIcon fontSize="small" />
        </button>
      </footer>
    </section>
  );

  return (
    <Box className="bolo-feed-page">
      <Container maxWidth="lg">
        {/* Header Controls */}
        <Box className="feed-controls">
          <Typography variant="h4" className="feed-title">
            BOLO Feed
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
                onClick={() => navigate('/bolo/manage')}
                className="create-btn"
              >
                Create BOLO
              </Button>
            )}
          </Box>
        </Box>

        {/* Feed Content */}
        <Box className="feed-content">
          {loading && bolos.length === 0 ? (
            <Box className="loading-container">
              <CircularProgress />
            </Box>
          ) : bolos.length === 0 ? (
            <Box className="empty-state">
              <Typography variant="h6">No BOLOs found</Typography>
              <Typography variant="body2" color="textSecondary">
                Adjust your filters or create a new BOLO
              </Typography>
            </Box>
          ) : (
            <>
              {bolos.map(bolo => renderBOLOCard(bolo))}
              
              {/* Load More */}
              {!loading && bolos.length >= (filters.limit || 20) && (
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
      </Container>
    </Box>
  );
};

export default BOLOFeed;