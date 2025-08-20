import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  TableContainer,
  Alert,
  Chip,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
  Pagination,
  IconButton,
  InputAdornment,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  AccessTime as TimeIcon,
  Warning as WarningIcon,
  Extension as ExtensionIcon,
  DeleteForever as PurgeIcon,
  Category as CategoryIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import apiService from '../services/api';
import { Post } from '../types';
import { format, addDays, differenceInDays, parseISO } from 'date-fns';

const PostExpiration: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<Post[]>([]);
  const [selectedPosts, setSelectedPosts] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [authorFilter, setAuthorFilter] = useState('');
  const [daysFilter, setDaysFilter] = useState('30'); // Show posts expiring in 30 days
  const [page, setPage] = useState(1);
  const [itemsPerPage] = useState(25);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [newRetentionDays, setNewRetentionDays] = useState(1825); // 5 years default

  useEffect(() => {
    loadExpiringPosts();
  }, [daysFilter]);

  useEffect(() => {
    filterPosts();
  }, [posts, searchQuery, categoryFilter, authorFilter]);

  const loadExpiringPosts = async () => {
    try {
      setLoading(true);
      const response = await apiService.getExpiringPosts({
        page: 1,
        limit: 1000,
        daysUntilExpiry: parseInt(daysFilter)
      });
      setPosts(response.posts || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to load expiring posts');
    } finally {
      setLoading(false);
    }
  };

  const filterPosts = () => {
    let filtered = posts;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(post =>
        post.title?.toLowerCase().includes(query) ||
        post.author_name?.toLowerCase().includes(query) ||
        post.category_name?.toLowerCase().includes(query) ||
        post.content?.toLowerCase().includes(query)
      );
    }

    if (categoryFilter) {
      filtered = filtered.filter(post => post.category_name === categoryFilter);
    }

    if (authorFilter) {
      filtered = filtered.filter(post => post.author_name === authorFilter);
    }

    setFilteredPosts(filtered);
    setPage(1);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('');
    setAuthorFilter('');
  };

  const getDaysUntilExpiry = (retentionDate: string) => {
    return differenceInDays(parseISO(retentionDate), new Date());
  };

  const getExpiryStatus = (daysUntil: number) => {
    if (daysUntil < 0) return { label: 'EXPIRED', color: 'error' as const };
    if (daysUntil <= 7) return { label: 'CRITICAL', color: 'error' as const };
    if (daysUntil <= 30) return { label: 'WARNING', color: 'warning' as const };
    return { label: 'NORMAL', color: 'success' as const };
  };

  const handleSelectPost = (postId: number) => {
    const newSelected = new Set(selectedPosts);
    if (newSelected.has(postId)) {
      newSelected.delete(postId);
    } else {
      newSelected.add(postId);
    }
    setSelectedPosts(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedPosts.size === paginatedPosts.length) {
      setSelectedPosts(new Set());
    } else {
      setSelectedPosts(new Set(paginatedPosts.map(p => p.id)));
    }
  };

  const handleBulkExtension = async () => {
    try {
      await apiService.bulkUpdateRetention(Array.from(selectedPosts), newRetentionDays);
      setBulkDialogOpen(false);
      setSelectedPosts(new Set());
      await loadExpiringPosts();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to update retention');
    }
  };

  const handleExtendSingle = async (postId: number, days: number) => {
    try {
      await apiService.updatePostRetention(postId, days);
      await loadExpiringPosts();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to update retention');
    }
  };

  const uniqueCategories = Array.from(new Set(posts.map(p => p.category_name).filter(Boolean)));
  const uniqueAuthors = Array.from(new Set(posts.map(p => p.author_name).filter(Boolean)));

  const paginatedPosts = filteredPosts.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  const totalPages = Math.ceil(filteredPosts.length / itemsPerPage);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <Typography>Loading expiring posts...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ color: '#1F2937', fontWeight: 600 }}>
          Post Expiration Management
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadExpiringPosts}
          >
            Refresh
          </Button>
          {selectedPosts.size > 0 && (
            <Button
              variant="contained"
              startIcon={<ExtensionIcon />}
              onClick={() => setBulkDialogOpen(true)}
              sx={{ backgroundColor: '#10B981', '&:hover': { backgroundColor: '#059669' } }}
            >
              Extend {selectedPosts.size} Posts
            </Button>
          )}
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <WarningIcon sx={{ color: '#DC2626', fontSize: 32 }} />
                <Box>
                  <Typography variant="h6" sx={{ color: '#DC2626', fontWeight: 600 }}>
                    {posts.filter(p => getDaysUntilExpiry(p.retention_date) <= 7).length}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#7F1D1D' }}>
                    Critical (&le;7 days)
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ backgroundColor: '#FFFBEB', border: '1px solid #FED7AA' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <TimeIcon sx={{ color: '#D97706', fontSize: 32 }} />
                <Box>
                  <Typography variant="h6" sx={{ color: '#D97706', fontWeight: 600 }}>
                    {posts.filter(p => {
                      const days = getDaysUntilExpiry(p.retention_date);
                      return days > 7 && days <= 30;
                    }).length}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#92400E' }}>
                    Warning (8-30 days)
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <CategoryIcon sx={{ color: '#16A34A', fontSize: 32 }} />
                <Box>
                  <Typography variant="h6" sx={{ color: '#16A34A', fontWeight: 600 }}>
                    {posts.filter(p => getDaysUntilExpiry(p.retention_date) > 30).length}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#15803D' }}>
                    Normal (&gt;30 days)
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <PurgeIcon sx={{ color: '#64748B', fontSize: 32 }} />
                <Box>
                  <Typography variant="h6" sx={{ color: '#64748B', fontWeight: 600 }}>
                    {posts.filter(p => getDaysUntilExpiry(p.retention_date) < 0).length}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#475569' }}>
                    Expired
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search and Filter Section */}
      <Card sx={{ mb: 3, backgroundColor: 'white', border: '1px solid #E5E7EB' }}>
        <CardContent>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                fullWidth
                variant="outlined"
                label="Search"
                placeholder="Search posts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: '#6B7280' }} />
                    </InputAdornment>
                  ),
                  endAdornment: searchQuery && (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setSearchQuery('')} size="small">
                        <ClearIcon />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Days Until Expiry</InputLabel>
                <Select
                  value={daysFilter}
                  onChange={(e) => setDaysFilter(e.target.value)}
                  label="Days Until Expiry"
                >
                  <MenuItem value="7">7 days</MenuItem>
                  <MenuItem value="30">30 days</MenuItem>
                  <MenuItem value="90">90 days</MenuItem>
                  <MenuItem value="365">1 year</MenuItem>
                  <MenuItem value="1825">5 years</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  label="Category"
                >
                  <MenuItem value="">All Categories</MenuItem>
                  {uniqueCategories.map(category => (
                    <MenuItem key={category} value={category}>{category}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Author</InputLabel>
                <Select
                  value={authorFilter}
                  onChange={(e) => setAuthorFilter(e.target.value)}
                  label="Author"
                >
                  <MenuItem value="">All Authors</MenuItem>
                  {uniqueAuthors.map(author => (
                    <MenuItem key={author} value={author}>{author}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <Button
                fullWidth
                variant="outlined"
                onClick={clearFilters}
                sx={{ height: '56px' }}
              >
                Clear Filters
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="body2" sx={{ color: '#6B7280' }}>
          Showing {paginatedPosts.length} of {filteredPosts.length} posts
          {filteredPosts.length !== posts.length && ` (filtered from ${posts.length} total)`}
        </Typography>
      </Box>

      <TableContainer component={Paper} sx={{ backgroundColor: 'white', border: '1px solid #E5E7EB' }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: '#F9FAFB' }}>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={selectedPosts.size === paginatedPosts.length && paginatedPosts.length > 0}
                  indeterminate={selectedPosts.size > 0 && selectedPosts.size < paginatedPosts.length}
                  onChange={handleSelectAll}
                />
              </TableCell>
              <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Title</TableCell>
              <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Author</TableCell>
              <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Category</TableCell>
              <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Created</TableCell>
              <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Expires</TableCell>
              <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedPosts.map((post) => {
              const daysUntil = getDaysUntilExpiry(post.retention_date);
              const status = getExpiryStatus(daysUntil);
              
              return (
                <TableRow 
                  key={post.id}
                  sx={{ 
                    '&:hover': { backgroundColor: '#F9FAFB' },
                    borderBottom: '1px solid #E5E7EB'
                  }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedPosts.has(post.id)}
                      onChange={() => handleSelectPost(post.id)}
                    />
                  </TableCell>
                  <TableCell sx={{ maxWidth: '300px' }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, color: '#1F2937' }}>
                      {post.title}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ color: '#6B7280' }}>{post.author_name}</TableCell>
                  <TableCell sx={{ color: '#6B7280' }}>
                    {post.category_name && (
                      <Chip size="small" label={post.category_name} variant="outlined" />
                    )}
                  </TableCell>
                  <TableCell sx={{ color: '#6B7280' }}>
                    {format(parseISO(post.wp_published_date), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell sx={{ color: '#6B7280' }}>
                    {format(parseISO(post.retention_date), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell>
                    <Chip 
                      size="small" 
                      label={`${status.label} (${daysUntil}d)`}
                      color={status.color}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title="Extend by 1 year">
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleExtendSingle(post.id, 365)}
                          sx={{ minWidth: 'auto', px: 1 }}
                        >
                          +1Y
                        </Button>
                      </Tooltip>
                      <Tooltip title="Extend by 5 years">
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => handleExtendSingle(post.id, 1825)}
                          sx={{ minWidth: 'auto', px: 1, backgroundColor: '#10B981' }}
                        >
                          +5Y
                        </Button>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, value) => setPage(value)}
            color="primary"
            showFirstButton
            showLastButton
          />
        </Box>
      )}

      {/* Bulk Extension Dialog */}
      <Dialog open={bulkDialogOpen} onClose={() => setBulkDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Bulk Extend Retention</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 3, color: '#6B7280' }}>
            Extend retention for {selectedPosts.size} selected posts
          </Typography>
          <TextField
            fullWidth
            type="number"
            label="Retention Days"
            value={newRetentionDays}
            onChange={(e) => setNewRetentionDays(parseInt(e.target.value))}
            helperText="Standard retention: 1825 days (5 years)"
            InputProps={{ inputProps: { min: 1, max: 7300 } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleBulkExtension}
            sx={{ backgroundColor: '#10B981', '&:hover': { backgroundColor: '#059669' } }}
          >
            Extend Retention
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PostExpiration;