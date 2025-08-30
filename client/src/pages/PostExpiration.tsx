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
  const [posts, setPosts] = useState<any[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<any[]>([]);
  const [selectedPosts, setSelectedPosts] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [authorFilter, setAuthorFilter] = useState('');
  const [daysFilter, setDaysFilter] = useState('30'); // Show intel reports expiring in 30 days
  const [page, setPage] = useState(1);
  const [itemsPerPage] = useState(25);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [newRetentionDays, setNewRetentionDays] = useState(1825);
  const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);
  const [purgeLoading, setPurgeLoading] = useState(false);
  const [purgeMessage, setPurgeMessage] = useState('');

  useEffect(() => {
    loadExpiringPosts();
  }, [daysFilter]);

  useEffect(() => {
    filterPosts();
  }, [posts, searchQuery, categoryFilter, authorFilter]);

  const loadExpiringPosts = async () => {
    try {
      setLoading(true);
      const response = await apiService.getExpiringIntelReports({
        page: 1,
        limit: 1000,
        daysUntilExpiry: parseInt(daysFilter)
      });
      setPosts(response.reports || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to load expiring intel reports');
    } finally {
      setLoading(false);
    }
  };

  const filterPosts = () => {
    let filtered = posts;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(report =>
        report.title?.toLowerCase().includes(query) ||
        report.author_name?.toLowerCase().includes(query) ||
        report.category_name?.toLowerCase().includes(query) ||
        report.content?.toLowerCase().includes(query)
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

  const getDaysUntilExpiry = (retentionDate?: string) => {
    if (!retentionDate) return Infinity; // Return a high value for posts without retention dates
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

  const handlePurgeExpiredData = async () => {
    try {
      setPurgeLoading(true);
      setPurgeMessage('');
      setError('');
      const result = await apiService.purgeExpiredData();
      setPurgeMessage(`Successfully purged ${result.purgedCount} expired items`);
      setPurgeDialogOpen(false);
      await loadExpiringPosts(); // Refresh the list
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to purge expired data');
    } finally {
      setPurgeLoading(false);
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
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '50vh',
        bgcolor: '#000000',
        color: '#E7E9EA'
      }}>
        <Typography sx={{ color: '#E7E9EA' }}>Loading expiring posts...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      p: { xs: 2, sm: 3 }, 
      bgcolor: '#000000', 
      color: '#E7E9EA', 
      minHeight: '100vh' 
    }}>
      {/* Mobile-friendly header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ color: '#E7E9EA', fontWeight: 600, mb: { xs: 2, sm: 2, md: 0 } }}>
          Post Expiration Management
        </Typography>
        <Box sx={{ 
          display: 'flex', 
          gap: { xs: 1, sm: 2 },
          flexDirection: { xs: 'column', sm: 'row' },
          flexWrap: 'wrap',
          mt: { xs: 0, md: 0 }
        }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadExpiringPosts}
            fullWidth={false}
            sx={{ 
              color: '#E7E9EA', 
              borderColor: '#2F3336',
              '&:hover': { borderColor: '#E7E9EA', bgcolor: '#16202A' },
              minWidth: { xs: 'auto', sm: '120px' }
            }}
          >
            Refresh
          </Button>
          {selectedPosts.size > 0 && (
            <Button
              variant="contained"
              startIcon={<ExtensionIcon />}
              onClick={() => setBulkDialogOpen(true)}
              fullWidth={false}
              sx={{ 
                backgroundColor: '#10B981', 
                '&:hover': { backgroundColor: '#059669' },
                color: '#FFFFFF',
                minWidth: { xs: 'auto', sm: '180px' }
              }}
            >
              Extend {selectedPosts.size} Posts
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<PurgeIcon />}
            onClick={() => setPurgeDialogOpen(true)}
            fullWidth={false}
            sx={{ 
              color: '#EF4444', 
              borderColor: '#EF4444',
              '&:hover': { borderColor: '#DC2626', bgcolor: 'rgba(239, 68, 68, 0.1)' },
              minWidth: { xs: 'auto', sm: '160px' }
            }}
          >
            Purge Expired
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3, bgcolor: '#D32F2F', color: '#E7E9EA' }}>{error}</Alert>}
      {purgeMessage && <Alert severity="success" sx={{ mb: 3, bgcolor: '#10B981', color: '#E7E9EA' }}>{purgeMessage}</Alert>}

      {/* Stats Cards */}
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: { 
          xs: '1fr', 
          sm: '1fr 1fr', 
          md: '1fr 1fr 1fr 1fr' 
        }, 
        gap: 2, 
        mb: 3 
      }}>
        <Card sx={{ backgroundColor: '#16202A', border: '1px solid #2F3336' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <WarningIcon sx={{ color: '#DC2626', fontSize: 32 }} />
              <Box>
                <Typography variant="h6" sx={{ color: '#EF4444', fontWeight: 600 }}>
                  {posts.filter(p => p.retention_date && getDaysUntilExpiry(p.retention_date) <= 7).length}
                </Typography>
                <Typography variant="body2" sx={{ color: '#8B98A5' }}>
                  Critical (&le;7 days)
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
        <Card sx={{ backgroundColor: '#16202A', border: '1px solid #2F3336' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <TimeIcon sx={{ color: '#D97706', fontSize: 32 }} />
              <Box>
                <Typography variant="h6" sx={{ color: '#F59E0B', fontWeight: 600 }}>
                  {posts.filter(p => {
                    const days = p.retention_date ? getDaysUntilExpiry(p.retention_date) : Infinity;
                    return days > 7 && days <= 30;
                  }).length}
                </Typography>
                <Typography variant="body2" sx={{ color: '#8B98A5' }}>
                  Warning (8-30 days)
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
        <Card sx={{ backgroundColor: '#16202A', border: '1px solid #2F3336' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <CategoryIcon sx={{ color: '#16A34A', fontSize: 32 }} />
              <Box>
                <Typography variant="h6" sx={{ color: '#10B981', fontWeight: 600 }}>
                  {posts.filter(p => p.retention_date && getDaysUntilExpiry(p.retention_date) > 30).length}
                </Typography>
                <Typography variant="body2" sx={{ color: '#8B98A5' }}>
                  Normal (&gt;30 days)
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
        <Card sx={{ backgroundColor: '#16202A', border: '1px solid #2F3336' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <PurgeIcon sx={{ color: '#64748B', fontSize: 32 }} />
              <Box>
                <Typography variant="h6" sx={{ color: '#8B98A5', fontWeight: 600 }}>
                  {posts.filter(p => p.retention_date && getDaysUntilExpiry(p.retention_date) < 0).length}
                </Typography>
                <Typography variant="body2" sx={{ color: '#8B98A5' }}>
                  Expired
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Search and Filter Section */}
      <Card sx={{ mb: 3, backgroundColor: '#16202A', border: '1px solid #2F3336' }}>
        <CardContent>
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: '1fr 1fr',
              md: '2fr 1fr 1fr 1fr 2fr'
            },
            gap: 2,
            alignItems: 'end'
          }}>
            <TextField
              fullWidth
              variant="outlined"
              label="Search"
              placeholder="Search posts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{
                '& .MuiInputLabel-root': { color: '#8B98A5' },
                '& .MuiOutlinedInput-root': {
                  color: '#E7E9EA',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#2F3336' }
                }
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#8B98A5' }} />
                  </InputAdornment>
                ),
                endAdornment: searchQuery && (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setSearchQuery('')} size="small" sx={{ color: '#8B98A5' }}>
                      <ClearIcon />
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
            <FormControl fullWidth>
              <InputLabel sx={{ color: '#8B98A5' }}>Days Until Expiry</InputLabel>
              <Select
                value={daysFilter}
                onChange={(e) => setDaysFilter(e.target.value)}
                label="Days Until Expiry"
                sx={{
                  color: '#E7E9EA',
                  '.MuiOutlinedInput-notchedOutline': { borderColor: '#2F3336' },
                  '.MuiSvgIcon-root': { color: '#E7E9EA' }
                }}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      backgroundColor: '#16202A !important',
                      border: '1px solid #2F3336 !important',
                      '& .MuiMenuItem-root': {
                        color: '#E7E9EA !important',
                        backgroundColor: '#16202A !important',
                        '&:hover': {
                          backgroundColor: '#2F3336 !important',
                        },
                        '&.Mui-selected': {
                          backgroundColor: 'rgba(29, 155, 240, 0.1) !important',
                          '&:hover': {
                            backgroundColor: 'rgba(29, 155, 240, 0.2) !important',
                          },
                        },
                      },
                    },
                  },
                }}
              >
                <MenuItem value="7">7 days</MenuItem>
                <MenuItem value="30">30 days</MenuItem>
                <MenuItem value="90">90 days</MenuItem>
                <MenuItem value="365">1 year</MenuItem>
                <MenuItem value="1825">5 years</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel sx={{ color: '#8B98A5' }}>Category</InputLabel>
              <Select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                label="Category"
                sx={{
                  color: '#E7E9EA',
                  '.MuiOutlinedInput-notchedOutline': { borderColor: '#2F3336' },
                  '.MuiSvgIcon-root': { color: '#E7E9EA' }
                }}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      backgroundColor: '#16202A !important',
                      border: '1px solid #2F3336 !important',
                      '& .MuiMenuItem-root': {
                        color: '#E7E9EA !important',
                        backgroundColor: '#16202A !important',
                        '&:hover': {
                          backgroundColor: '#2F3336 !important',
                        },
                        '&.Mui-selected': {
                          backgroundColor: 'rgba(29, 155, 240, 0.1) !important',
                          '&:hover': {
                            backgroundColor: 'rgba(29, 155, 240, 0.2) !important',
                          },
                        },
                      },
                    },
                  },
                }}
              >
                <MenuItem value="">All Categories</MenuItem>
                {uniqueCategories.map(category => (
                  <MenuItem key={category} value={category}>{category}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel sx={{ color: '#8B98A5' }}>Author</InputLabel>
              <Select
                value={authorFilter}
                onChange={(e) => setAuthorFilter(e.target.value)}
                label="Author"
                sx={{
                  color: '#E7E9EA',
                  '.MuiOutlinedInput-notchedOutline': { borderColor: '#2F3336' },
                  '.MuiSvgIcon-root': { color: '#E7E9EA' }
                }}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      backgroundColor: '#16202A !important',
                      border: '1px solid #2F3336 !important',
                      '& .MuiMenuItem-root': {
                        color: '#E7E9EA !important',
                        backgroundColor: '#16202A !important',
                        '&:hover': {
                          backgroundColor: '#2F3336 !important',
                        },
                        '&.Mui-selected': {
                          backgroundColor: 'rgba(29, 155, 240, 0.1) !important',
                          '&:hover': {
                            backgroundColor: 'rgba(29, 155, 240, 0.2) !important',
                          },
                        },
                      },
                    },
                  },
                }}
              >
                <MenuItem value="">All Authors</MenuItem>
                {uniqueAuthors.map(author => (
                  <MenuItem key={author} value={author}>{author}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              fullWidth
              variant="outlined"
              onClick={clearFilters}
              sx={{ 
                height: '56px',
                color: '#E7E9EA',
                borderColor: '#2F3336',
                '&:hover': { borderColor: '#E7E9EA', bgcolor: '#16202A' }
              }}
            >
              Clear Filters
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="body2" sx={{ color: '#8B98A5' }}>
          Showing {paginatedPosts.length} of {filteredPosts.length} posts
          {filteredPosts.length !== posts.length && ` (filtered from ${posts.length} total)`}
        </Typography>
      </Box>

      {/* Desktop Table View */}
      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        <TableContainer component={Paper} sx={{ backgroundColor: '#16202A', border: '1px solid #2F3336' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: '#0F1419' }}>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selectedPosts.size === paginatedPosts.length && paginatedPosts.length > 0}
                    indeterminate={selectedPosts.size > 0 && selectedPosts.size < paginatedPosts.length}
                    onChange={handleSelectAll}
                    sx={{ color: '#E7E9EA' }}
                  />
                </TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#E7E9EA' }}>Title</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#E7E9EA' }}>Author</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#E7E9EA' }}>Category</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#E7E9EA' }}>Created</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#E7E9EA' }}>Expires</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#E7E9EA' }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#E7E9EA' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedPosts.map((post) => {
                const daysUntil = post.retention_date ? getDaysUntilExpiry(post.retention_date) : Infinity;
                const status = getExpiryStatus(daysUntil);
                
                return (
                  <TableRow 
                    key={post.id}
                    sx={{ 
                      '&:hover': { backgroundColor: '#0F1419' },
                      borderBottom: '1px solid #2F3336',
                      bgcolor: '#16202A'
                    }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedPosts.has(post.id)}
                        onChange={() => handleSelectPost(post.id)}
                        sx={{ color: '#E7E9EA' }}
                      />
                    </TableCell>
                    <TableCell sx={{ maxWidth: '300px' }}>
                      <Typography variant="body2" sx={{ fontWeight: 500, color: '#E7E9EA' }}>
                        {post.title}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ color: '#8B98A5' }}>{post.author_name}</TableCell>
                    <TableCell sx={{ color: '#8B98A5' }}>
                      {post.category_name && (
                        <Chip 
                          size="small" 
                          label={post.category_name} 
                          variant="outlined" 
                          sx={{ color: '#E7E9EA', borderColor: '#2F3336' }}
                        />
                      )}
                    </TableCell>
                    <TableCell sx={{ color: '#8B98A5' }}>
                      {format(parseISO(post.wp_published_date), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell sx={{ color: '#8B98A5' }}>
                      {post.retention_date ? format(parseISO(post.retention_date), 'MMM dd, yyyy') : 'N/A'}
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
                            sx={{ 
                              minWidth: 'auto', 
                              px: 1,
                              color: '#E7E9EA',
                              borderColor: '#2F3336',
                              '&:hover': { borderColor: '#E7E9EA', bgcolor: '#000000' }
                            }}
                          >
                            +1Y
                          </Button>
                        </Tooltip>
                        <Tooltip title="Extend by 5 years">
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => handleExtendSingle(post.id, 1825)}
                            sx={{ 
                              minWidth: 'auto', 
                              px: 1, 
                              backgroundColor: '#10B981',
                              '&:hover': { backgroundColor: '#059669' },
                              color: '#FFFFFF'
                            }}
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
      </Box>

      {/* Mobile Card View */}
      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        {/* Mobile Select All */}
        <Card sx={{ mb: 2, backgroundColor: '#16202A', border: '1px solid #2F3336' }}>
          <CardContent sx={{ py: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Checkbox
                  checked={selectedPosts.size === paginatedPosts.length && paginatedPosts.length > 0}
                  indeterminate={selectedPosts.size > 0 && selectedPosts.size < paginatedPosts.length}
                  onChange={handleSelectAll}
                  sx={{ color: '#E7E9EA' }}
                />
                <Typography variant="body2" sx={{ color: '#E7E9EA' }}>
                  Select All
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ color: '#8B98A5' }}>
                {selectedPosts.size} selected
              </Typography>
            </Box>
          </CardContent>
        </Card>

        {/* Mobile Post Cards */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {paginatedPosts.map((post) => {
            const daysUntil = getDaysUntilExpiry(post.retention_date);
            const status = getExpiryStatus(daysUntil);
            
            return (
              <Card key={post.id} sx={{ backgroundColor: '#16202A', border: '1px solid #2F3336' }}>
                <CardContent>
                  {/* Header with checkbox and status */}
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, flex: 1 }}>
                      <Checkbox
                        checked={selectedPosts.has(post.id)}
                        onChange={() => handleSelectPost(post.id)}
                        sx={{ color: '#E7E9EA', p: 0, mt: 0.5 }}
                      />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body1" sx={{ fontWeight: 500, color: '#E7E9EA', mb: 1, lineHeight: 1.3 }}>
                          {post.title}
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                          <Typography variant="caption" sx={{ color: '#8B98A5' }}>
                            By {post.author_name}
                          </Typography>
                          {post.category_name && (
                            <Chip 
                              size="small" 
                              label={post.category_name} 
                              variant="outlined" 
                              sx={{ 
                                color: '#E7E9EA', 
                                borderColor: '#2F3336',
                                fontSize: '0.75rem',
                                height: '20px'
                              }}
                            />
                          )}
                        </Box>
                      </Box>
                    </Box>
                    <Chip 
                      size="small" 
                      label={`${status.label} (${daysUntil}d)`}
                      color={status.color}
                      variant="outlined"
                      sx={{ fontSize: '0.75rem' }}
                    />
                  </Box>

                  {/* Dates */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Box>
                      <Typography variant="caption" sx={{ color: '#8B98A5', display: 'block' }}>
                        Created
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#E7E9EA' }}>
                        {format(parseISO(post.wp_published_date), 'MMM dd, yyyy')}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ color: '#8B98A5', display: 'block' }}>
                        Expires
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#E7E9EA' }}>
                        {post.retention_date ? format(parseISO(post.retention_date), 'MMM dd, yyyy') : 'N/A'}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Actions */}
                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => handleExtendSingle(post.id, 365)}
                      sx={{ 
                        color: '#E7E9EA',
                        borderColor: '#2F3336',
                        '&:hover': { borderColor: '#E7E9EA', bgcolor: '#000000' }
                      }}
                    >
                      +1 Year
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => handleExtendSingle(post.id, 1825)}
                      sx={{ 
                        backgroundColor: '#10B981',
                        '&:hover': { backgroundColor: '#059669' },
                        color: '#FFFFFF'
                      }}
                    >
                      +5 Years
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      </Box>

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
            sx={{
              '& .MuiPaginationItem-root': {
                color: '#E7E9EA',
                borderColor: '#2F3336',
                '&:hover': { bgcolor: '#16202A' },
                '&.Mui-selected': { bgcolor: '#1976d2', color: '#FFFFFF' }
              }
            }}
          />
        </Box>
      )}

      {/* Bulk Extension Dialog */}
      <Dialog 
        open={bulkDialogOpen} 
        onClose={() => setBulkDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#16202A',
            color: '#E7E9EA'
          }
        }}
      >
        <DialogTitle sx={{ color: '#E7E9EA', bgcolor: '#16202A' }}>Bulk Extend Retention</DialogTitle>
        <DialogContent sx={{ bgcolor: '#16202A' }}>
          <Typography variant="body2" sx={{ mb: 3, color: '#8B98A5' }}>
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
            sx={{
              '& .MuiInputLabel-root': { color: '#8B98A5' },
              '& .MuiOutlinedInput-root': {
                color: '#E7E9EA',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#2F3336' }
              },
              '& .MuiFormHelperText-root': { color: '#8B98A5' }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#16202A', borderTop: '1px solid #2F3336' }}>
          <Button onClick={() => setBulkDialogOpen(false)} sx={{ color: '#E7E9EA' }}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleBulkExtension}
            sx={{ 
              backgroundColor: '#10B981', 
              '&:hover': { backgroundColor: '#059669' },
              color: '#FFFFFF'
            }}
          >
            Extend Retention
          </Button>
        </DialogActions>
      </Dialog>

      {/* Purge Expired Data Dialog */}
      <Dialog 
        open={purgeDialogOpen} 
        onClose={() => setPurgeDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#16202A',
            color: '#E7E9EA'
          }
        }}
      >
        <DialogTitle sx={{ color: '#E7E9EA', bgcolor: '#16202A' }}>
          Purge Expired Data
        </DialogTitle>
        <DialogContent sx={{ bgcolor: '#16202A' }}>
          <Typography variant="body2" sx={{ mb: 3, color: '#8B98A5', lineHeight: 1.6 }}>
            This will permanently delete all posts that have passed their retention period. 
            This action cannot be undone and will remove all expired content from the system.
          </Typography>
          <Typography variant="body2" sx={{ color: '#EF4444', fontWeight: 600 }}>
            ⚠️ Warning: This action is irreversible!
          </Typography>
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#16202A', borderTop: '1px solid #2F3336' }}>
          <Button 
            onClick={() => setPurgeDialogOpen(false)} 
            disabled={purgeLoading}
            sx={{ color: '#E7E9EA' }}
          >
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handlePurgeExpiredData}
            disabled={purgeLoading}
            sx={{ 
              backgroundColor: '#EF4444',
              '&:hover': { backgroundColor: '#DC2626' },
              '&:disabled': { backgroundColor: '#374151' },
              color: '#FFFFFF'
            }}
          >
            {purgeLoading ? 'Purging...' : 'Purge Expired Data'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PostExpiration;