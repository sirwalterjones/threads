import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Container, 
  Paper, 
  Typography, 
  Box, 
  IconButton,
  Avatar,
  Chip,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Card,
  CardContent,
  CardMedia,
  CardActions,
  Tooltip,
  Badge,
  Divider,
  LinearProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  Share as ShareIcon,
  ChatBubbleOutline as CommentIcon,
  Loop as RepostIcon,
  BookmarkBorder as SaveIcon,
  Bookmark as SavedIcon,
  Person as PersonIcon,
  DirectionsCar as VehicleIcon,
  HomeWork as PropertyIcon,
  MoreVert as MoreIcon,
  Warning as WarningIcon,
  CheckCircle as ResolvedIcon,
  Cancel as CancelledIcon,
  Schedule as PendingIcon,
  AccessTime as ActiveIcon
} from '@mui/icons-material';
import Grid from '@mui/material/Grid';
import { BOLO, BOLOFilters, BOLOFeedResponse } from '../../types/bolo';
import boloApi from '../../services/boloApi';
import { useAuth } from '../../contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';

const BOLODashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [bolos, setBolos] = useState<BOLO[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
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
      setBolos(response.bolos);
      setTotal(response.total);
      setPage(response.page);
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

  const handleShare = async (bolo: BOLO) => {
    await boloApi.copyShareableLink(bolo);
    // Show success message
  };

  const handleRepost = async (bolo: BOLO) => {
    try {
      await boloApi.repostBOLO(bolo.id);
      loadBOLOs(); // Refresh feed
    } catch (error) {
      console.error('Error reposting BOLO:', error);
    }
  };

  const handleSave = async (bolo: BOLO) => {
    try {
      await boloApi.toggleSaveBOLO(bolo.id);
      loadBOLOs(); // Refresh to update save status
    } catch (error) {
      console.error('Error saving BOLO:', error);
    }
  };

  const getTypeIcon = (type: BOLO['type']) => {
    switch (type) {
      case 'person': return <PersonIcon />;
      case 'vehicle': return <VehicleIcon />;
      case 'property': return <PropertyIcon />;
      default: return <MoreIcon />;
    }
  };

  const getStatusIcon = (status: BOLO['status']) => {
    switch (status) {
      case 'pending': return <PendingIcon color="action" />;
      case 'active': return <ActiveIcon color="primary" />;
      case 'resolved': return <ResolvedIcon color="success" />;
      case 'cancelled': return <CancelledIcon color="error" />;
      default: return null;
    }
  };

  const getPriorityColor = (priority: BOLO['priority']) => {
    switch (priority) {
      case 'immediate': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'default';
      default: return 'default';
    }
  };

  const renderBOLOCard = (bolo: BOLO) => (
    <Card 
      key={bolo.id} 
      sx={{ 
        mb: 2, 
        cursor: 'pointer',
        '&:hover': { boxShadow: 4 }
      }}
      onClick={() => navigate(`/bolo/${bolo.id}`)}
    >
      {bolo.primary_image_url && (
        <CardMedia
          component="img"
          height="200"
          image={bolo.primary_image_url}
          alt={bolo.title}
          sx={{ objectFit: 'cover' }}
        />
      )}
      
      <CardContent>
        <Box display="flex" alignItems="center" mb={1}>
          <Avatar sx={{ bgcolor: 'primary.main', mr: 1 }}>
            {getTypeIcon(bolo.type)}
          </Avatar>
          <Box flexGrow={1}>
            <Typography variant="subtitle2" color="textSecondary">
              {bolo.agency_name} • {bolo.officer_name}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              {formatDistanceToNow(new Date(bolo.created_at), { addSuffix: true })}
            </Typography>
          </Box>
          <Box>
            {getStatusIcon(bolo.status)}
            <Chip 
              label={bolo.priority}
              size="small"
              color={getPriorityColor(bolo.priority) as any}
              sx={{ ml: 1 }}
            />
          </Box>
        </Box>

        <Typography variant="h6" gutterBottom>
          {bolo.title}
        </Typography>
        
        <Typography variant="body2" color="textSecondary" paragraph>
          {bolo.summary}
        </Typography>

        {bolo.subject_name && (
          <Typography variant="body2" gutterBottom>
            <strong>Subject:</strong> {bolo.subject_name}
          </Typography>
        )}

        {bolo.license_plate && (
          <Typography variant="body2" gutterBottom>
            <strong>License Plate:</strong> {bolo.license_plate}
          </Typography>
        )}

        {bolo.last_known_location && (
          <Typography variant="body2" gutterBottom>
            <strong>Last Known Location:</strong> {bolo.last_known_location}
          </Typography>
        )}

        {bolo.armed_dangerous && (
          <Box display="flex" alignItems="center" mt={1}>
            <WarningIcon color="error" fontSize="small" />
            <Typography variant="body2" color="error" sx={{ ml: 0.5 }}>
              Armed & Dangerous
            </Typography>
          </Box>
        )}
      </CardContent>

      <Divider />

      <CardActions sx={{ px: 2, py: 1 }}>
        <Box display="flex" alignItems="center" width="100%">
          <IconButton 
            size="small" 
            onClick={(e) => {
              e.stopPropagation();
              handleRepost(bolo);
            }}
            color={bolo.is_reposted ? 'primary' : 'default'}
          >
            <Badge badgeContent={bolo.repost_count} color="secondary">
              <RepostIcon />
            </Badge>
          </IconButton>

          <IconButton 
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/bolo/${bolo.id}#comments`);
            }}
          >
            <Badge badgeContent={bolo.comment_count} color="secondary">
              <CommentIcon />
            </Badge>
          </IconButton>

          <IconButton 
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              handleSave(bolo);
            }}
            color={bolo.is_saved ? 'primary' : 'default'}
          >
            {bolo.is_saved ? <SavedIcon /> : <SaveIcon />}
          </IconButton>

          <Box flexGrow={1} />

          <IconButton 
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              handleShare(bolo);
            }}
          >
            <ShareIcon />
          </IconButton>
        </Box>
      </CardActions>
    </Card>
  );

  return (
    <Container maxWidth="lg" sx={{ mt: 3 }}>
      <Grid container spacing={3}>
        {/* Header */}
        <Grid size={12}>
          <Paper sx={{ p: 2 }}>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Typography variant="h4" component="h1">
                BOLO Dashboard
              </Typography>
              <Box>
                <IconButton onClick={() => setShowFilters(!showFilters)}>
                  <FilterIcon />
                </IconButton>
                <IconButton onClick={loadBOLOs}>
                  <RefreshIcon />
                </IconButton>
                {canCreateBOLO && (
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => navigate('/bolo/create')}
                    sx={{ ml: 1 }}
                  >
                    Create BOLO
                  </Button>
                )}
              </Box>
            </Box>

            {/* Search Bar */}
            <Box mt={2}>
              <TextField
                fullWidth
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
                  endAdornment: (
                    <InputAdornment position="end">
                      <Button onClick={handleSearch}>Search</Button>
                    </InputAdornment>
                  )
                }}
              />
            </Box>

            {/* Filters */}
            {showFilters && (
              <Box mt={2} display="flex" gap={2} flexWrap="wrap">
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={filters.type || 'all'}
                    label="Type"
                    onChange={(e) => handleFilterChange('type', e.target.value === 'all' ? undefined : e.target.value)}
                  >
                    <MenuItem value="all">All Types</MenuItem>
                    <MenuItem value="person">Person</MenuItem>
                    <MenuItem value="vehicle">Vehicle</MenuItem>
                    <MenuItem value="property">Property</MenuItem>
                    <MenuItem value="other">Other</MenuItem>
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={filters.priority || 'all'}
                    label="Priority"
                    onChange={(e) => handleFilterChange('priority', e.target.value === 'all' ? undefined : e.target.value)}
                  >
                    <MenuItem value="all">All Priorities</MenuItem>
                    <MenuItem value="immediate">Immediate</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="low">Low</MenuItem>
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={filters.status || 'active'}
                    label="Status"
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                  >
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="pending">Pending</MenuItem>
                    <MenuItem value="resolved">Resolved</MenuItem>
                    <MenuItem value="cancelled">Cancelled</MenuItem>
                    <MenuItem value="expired">Expired</MenuItem>
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Sort By</InputLabel>
                  <Select
                    value={filters.sortBy || 'created_at'}
                    label="Sort By"
                    onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                  >
                    <MenuItem value="created_at">Date Created</MenuItem>
                    <MenuItem value="priority">Priority</MenuItem>
                    <MenuItem value="incident_date">Incident Date</MenuItem>
                    <MenuItem value="view_count">Views</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Main Content */}
        <Grid size={{ xs: 12, md: 8 }}>
          {loading ? (
            <LinearProgress />
          ) : (
            <>
              {bolos.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                  <Typography variant="h6" color="textSecondary">
                    No BOLOs found
                  </Typography>
                  {canCreateBOLO && (
                    <Button
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={() => navigate('/bolo/create')}
                      sx={{ mt: 2 }}
                    >
                      Create First BOLO
                    </Button>
                  )}
                </Paper>
              ) : (
                bolos.map(bolo => renderBOLOCard(bolo))
              )}

              {/* Load More */}
              {bolos.length < total && (
                <Box textAlign="center" mt={2}>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setFilters(prev => ({
                        ...prev,
                        offset: (prev.offset || 0) + (prev.limit || 20)
                      }));
                    }}
                  >
                    Load More ({bolos.length} of {total})
                  </Button>
                </Box>
              )}
            </>
          )}
        </Grid>

        {/* Sidebar */}
        <Grid size={{ xs: 12, md: 4 }}>
          {/* Quick Stats */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Quick Stats
            </Typography>
            <Box>
              <Typography variant="body2">
                <strong>Active BOLOs:</strong> {bolos.filter(b => b.status === 'active').length}
              </Typography>
              <Typography variant="body2">
                <strong>Immediate Priority:</strong> {bolos.filter(b => b.priority === 'immediate').length}
              </Typography>
              <Typography variant="body2">
                <strong>Total BOLOs:</strong> {total}
              </Typography>
            </Box>
          </Paper>

          {/* Recent Activity */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Recent Activity
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Activity feed coming soon...
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default BOLODashboard;