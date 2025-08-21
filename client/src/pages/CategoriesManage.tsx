import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Card, 
  CardContent, 
  TextField, 
  Typography, 
  Alert, 
  Grid,
  Chip,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  InputAdornment,
  IconButton,
  Pagination,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress
} from '@mui/material';
import { 
  Search as SearchIcon, 
  Clear as ClearIcon, 
  ArrowBack as BackIcon,
  Folder as CategoryIcon,
  Article as PostIcon
} from '@mui/icons-material';
import apiService from '../services/api';
import auditService from '../services/auditService';
import { Category, Post } from '../types';
import { format } from 'date-fns';
import PostDetailModal from '../components/PostDetailModal';

const CategoriesManage: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'post_count' | 'created_at'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Category detail view
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categoryPosts, setCategoryPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsPage, setPostsPage] = useState(1);
  const [postsTotal, setPostsTotal] = useState(0);
  const [postsSearch, setPostsSearch] = useState('');
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const postsPerPage = 25;

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await apiService.getCategories();
      setCategories(data);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortCategories = React.useCallback(() => {
    console.log('Filtering categories. Original count:', categories.length, 'Search:', searchQuery, 'Sort:', sortBy, sortOrder);
    
    let filtered = [...categories];

    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(cat => 
        cat.name.toLowerCase().includes(query) ||
        cat.slug.toLowerCase().includes(query)
      );
      console.log('After search filter:', filtered.length);
    }

    filtered.sort((a, b) => {
      let aVal, bVal;
      switch (sortBy) {
        case 'post_count':
          aVal = a.post_count || 0;
          bVal = b.post_count || 0;
          break;
        case 'created_at':
          aVal = new Date(a.created_at || 0).getTime();
          bVal = new Date(b.created_at || 0).getTime();
          break;
        default:
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    console.log('Final filtered categories:', filtered.length);
    setFilteredCategories(filtered);
  }, [categories, searchQuery, sortBy, sortOrder]);

  const loadCategoryPosts = React.useCallback(async () => {
    if (!selectedCategory) return;
    
    try {
      setPostsLoading(true);
      setError(''); // Clear any previous errors
      console.log('Attempting to load posts for category:', selectedCategory.name, selectedCategory.slug);
      
      // Try category filter first, but fall back to showing a message if it fails
      try {
        const data = await apiService.getPosts({
          page: postsPage,
          limit: postsPerPage,
          search: postsSearch || undefined,
          category: selectedCategory.slug // Use category slug for filtering
        });
        
        console.log('Loaded posts:', data);
        setCategoryPosts(data.posts || []);
        setPostsTotal(data.pagination?.total || 0);
      } catch (filterError: any) {
        console.warn('Category filter failed, this is expected for some categories:', filterError);
        
        // Set a helpful message for the user
        setCategoryPosts([]);
        setPostsTotal(selectedCategory.post_count || 0);
        setError(`Cannot load posts for "${selectedCategory.name}" - this category has ${selectedCategory.post_count} posts but the server cannot filter them efficiently. Try searching for specific terms instead.`);
      }
    } catch (e: any) {
      console.error('Error loading category posts:', e);
      setError(e?.response?.data?.error || 'Failed to load category posts. The server may be experiencing issues.');
    } finally {
      setPostsLoading(false);
    }
  }, [selectedCategory, postsPage, postsPerPage, postsSearch]);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    filterAndSortCategories();
  }, [filterAndSortCategories]);

  useEffect(() => {
    if (selectedCategory) {
      console.log('Loading posts for category:', selectedCategory.name, selectedCategory.id);
      loadCategoryPosts();
    }
  }, [selectedCategory, loadCategoryPosts]);

  const handleCategoryClick = async (category: Category) => {
    setSelectedCategory(category);
    setPostsPage(1);
    setPostsSearch('');
    
    // Track category view (don't block UI if audit fails)
    try {
      await auditService.trackView('category', category.id, category.name);
    } catch (e) {
      console.warn('Failed to log category view:', e);
    }
  };

  const handlePostClick = async (postId: number) => {
    setSelectedPostId(postId);
    setModalOpen(true);
    
    // Find the post title for audit logging (don't block UI if audit fails)
    try {
      const post = categoryPosts.find(p => p.id === postId);
      await auditService.trackView('post', postId, post?.title);
    } catch (e) {
      console.warn('Failed to log post view:', e);
    }
  };

  const handleBackToCategories = () => {
    setSelectedCategory(null);
    setCategoryPosts([]);
    setPostsPage(1);
    setPostsSearch('');
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  const clearPostsSearch = () => {
    setPostsSearch('');
    setPostsPage(1);
  };

  const handlePostsSearch = () => {
    setPostsPage(1);
    loadCategoryPosts();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Category Detail View
  if (selectedCategory) {
    return (
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={handleBackToCategories} sx={{ mr: 2, color: '#E7E9EA' }}>
            <BackIcon />
          </IconButton>
          <CategoryIcon sx={{ mr: 2, color: '#1D9BF0' }} />
          <Box>
            <Typography variant="h4" sx={{ color: '#E7E9EA', fontWeight: 700 }}>
              {selectedCategory.name}
            </Typography>
            <Typography variant="body2" sx={{ color: '#71767B' }}>
              {selectedCategory.post_count || 0} posts • Created {format(new Date(selectedCategory.created_at), 'MMM dd, yyyy')}
            </Typography>
          </Box>
        </Box>

        {/* Posts Search */}
        <Card sx={{ mb: 3, backgroundColor: '#16181C', border: '1px solid #2F3336' }}>
          <CardContent>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <TextField
                fullWidth
                variant="outlined"
                label="Search posts in this category"
                value={postsSearch}
                onChange={(e) => setPostsSearch(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handlePostsSearch()}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: '#71767B' }} />
                    </InputAdornment>
                  ),
                  endAdornment: postsSearch && (
                    <InputAdornment position="end">
                      <IconButton onClick={clearPostsSearch} size="small">
                        <ClearIcon />
                      </IconButton>
                    </InputAdornment>
                  ),
                  sx: { color: '#E7E9EA' }
                }}
                sx={{ 
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#2F3336' },
                    '&:hover fieldset': { borderColor: '#1D9BF0' },
                    '&.Mui-focused fieldset': { borderColor: '#1D9BF0' }
                  },
                  '& .MuiInputLabel-root': { color: '#71767B' }
                }}
              />
              <Button
                variant="contained"
                onClick={handlePostsSearch}
                sx={{ 
                  backgroundColor: '#1D9BF0', 
                  '&:hover': { backgroundColor: '#1A8CD8' },
                  minWidth: '100px'
                }}
              >
                Search
              </Button>
            </Box>
          </CardContent>
        </Card>

        {/* Posts Table */}
        <Card sx={{ backgroundColor: '#16181C', border: '1px solid #2F3336' }}>
          <CardContent sx={{ p: 0 }}>
            <Box sx={{ p: 2, borderBottom: '1px solid #2F3336' }}>
              <Typography variant="h6" sx={{ color: '#E7E9EA', display: 'flex', alignItems: 'center', gap: 1 }}>
                <PostIcon />
                Posts ({postsTotal})
              </Typography>
            </Box>

            {postsLoading ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 4 }}>
                <CircularProgress />
                <Typography sx={{ mt: 2, color: '#71767B' }}>Loading posts...</Typography>
              </Box>
            ) : categoryPosts.length === 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 4 }}>
                <Typography variant="h6" sx={{ color: '#71767B', mb: 1 }}>No posts found</Typography>
                <Typography variant="body2" sx={{ color: '#71767B', textAlign: 'center' }}>
                  {error ? 'There was an error loading posts for this category.' : 'This category doesn\'t have any posts yet.'}
                </Typography>
                {error && (
                  <Button 
                    variant="outlined" 
                    onClick={() => loadCategoryPosts()} 
                    sx={{ mt: 2, color: '#1D9BF0', borderColor: '#1D9BF0' }}
                  >
                    Try Again
                  </Button>
                )}
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#1C1F23' }}>
                      <TableCell sx={{ color: '#E7E9EA', fontWeight: 600 }}>Title</TableCell>
                      <TableCell sx={{ color: '#E7E9EA', fontWeight: 600 }}>Author</TableCell>
                      <TableCell sx={{ color: '#E7E9EA', fontWeight: 600 }}>Published</TableCell>
                      <TableCell sx={{ color: '#E7E9EA', fontWeight: 600 }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {categoryPosts.map((post) => (
                      <TableRow 
                        key={post.id}
                        onClick={() => handlePostClick(post.id)}
                        sx={{ 
                          '&:hover': { backgroundColor: '#1C1F23' },
                          cursor: 'pointer',
                          borderBottom: '1px solid #2F3336'
                        }}
                      >
                        <TableCell sx={{ color: '#E7E9EA' }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {post.title}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#71767B' }}>
                            {post.excerpt?.substring(0, 100)}...
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ color: '#71767B' }}>
                          {post.author_name}
                        </TableCell>
                        <TableCell sx={{ color: '#71767B' }}>
                          {format(new Date(post.wp_published_date), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={post.status}
                            size="small"
                            color={post.status === 'publish' ? 'success' : 'default'}
                            variant="outlined"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {/* Pagination */}
            {Math.ceil(postsTotal / postsPerPage) > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                <Pagination
                  count={Math.ceil(postsTotal / postsPerPage)}
                  page={postsPage}
                  onChange={(_, value) => setPostsPage(value)}
                  color="primary"
                />
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Post Detail Modal */}
        <PostDetailModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          postId={selectedPostId}
        />
      </Box>
    );
  }

  // Categories List View
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 3, color: '#E7E9EA', fontWeight: 700 }}>
        Categories
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {/* Search and Filter Section */}
      <Card sx={{ mb: 3, backgroundColor: '#16181C', border: '1px solid #2F3336' }}>
        <CardContent>
          {/* Centered Search Field */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
            <Box sx={{ width: { xs: '100%', sm: '80%', md: '60%', lg: '50%' } }}>
              <TextField
                fullWidth
                variant="outlined"
                label="Search categories"
                placeholder="Search by name or slug..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: '#71767B' }} />
                    </InputAdornment>
                  ),
                  endAdornment: searchQuery && (
                    <InputAdornment position="end">
                      <IconButton onClick={clearSearch} size="small">
                        <ClearIcon />
                      </IconButton>
                    </InputAdornment>
                  ),
                  sx: { color: '#E7E9EA' }
                }}
                sx={{ 
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#2F3336' },
                    '&:hover fieldset': { borderColor: '#1D9BF0' },
                    '&.Mui-focused fieldset': { borderColor: '#1D9BF0' }
                  },
                  '& .MuiInputLabel-root': { color: '#71767B' }
                }}
              />
            </Box>
          </Box>
          
          {/* Sort Controls */}
          <Grid container spacing={3} justifyContent="center">
            <Grid size={{ xs: 6, sm: 4, md: 3 }}>
              <FormControl fullWidth>
                <InputLabel sx={{ color: '#71767B' }}>Sort by</InputLabel>
                <Select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  label="Sort by"
                  sx={{ 
                    color: '#E7E9EA',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#2F3336' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#1D9BF0' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1D9BF0' }
                  }}
                >
                  <MenuItem value="name">Name</MenuItem>
                  <MenuItem value="post_count">Post Count</MenuItem>
                  <MenuItem value="created_at">Created Date</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 6, sm: 4, md: 3 }}>
              <FormControl fullWidth>
                <InputLabel sx={{ color: '#71767B' }}>Order</InputLabel>
                <Select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  label="Order"
                  sx={{ 
                    color: '#E7E9EA',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#2F3336' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#1D9BF0' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1D9BF0' }
                  }}
                >
                  <MenuItem value="asc">Ascending</MenuItem>
                  <MenuItem value="desc">Descending</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" sx={{ color: '#71767B' }}>
          Showing {filteredCategories.length} of {categories.length} categories
        </Typography>
      </Box>

      {/* Categories Grid */}
      <Box sx={{ 
        display: 'grid', 
        gap: 3, 
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' 
      }}>
        {filteredCategories.map((category) => (
          <Card 
            key={category.id}
            onClick={() => handleCategoryClick(category)}
            sx={{ 
              backgroundColor: '#16181C', 
              border: '1px solid #2F3336',
              borderRadius: 2,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              '&:hover': {
                backgroundColor: '#1C1F23',
                borderColor: '#1D9BF0',
                transform: 'translateY(-2px)'
              }
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                <CategoryIcon sx={{ color: '#1D9BF0', mt: 0.5 }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" sx={{ 
                    color: '#E7E9EA', 
                    fontWeight: 600, 
                    mb: 1 
                  }}>
                    {category.name}
                  </Typography>
                  
                  <Typography variant="body2" sx={{ 
                    color: '#71767B', 
                    mb: 2,
                    lineHeight: 1.5 
                  }}>
                    {category.parent_name ? `Parent: ${category.parent_name}` : 'Top-level category'} • Created {format(new Date(category.created_at), 'MMM dd, yyyy')}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip
                      label={`${category.post_count || 0} posts`}
                      size="small"
                      sx={{
                        backgroundColor: '#1D9BF0',
                        color: 'white',
                        fontSize: '12px'
                      }}
                    />
                    <Chip
                      label={category.slug}
                      size="small"
                      variant="outlined"
                      sx={{
                        borderColor: '#2F3336',
                        color: '#71767B',
                        fontSize: '12px'
                      }}
                    />
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  );
};

export default CategoriesManage;


