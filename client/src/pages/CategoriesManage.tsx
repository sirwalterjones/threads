import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Card, 
  CardContent, 
  TextField, 
  Typography, 
  Alert, 
  Chip,
  InputAdornment,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Tooltip,
  Tabs,
  Tab
} from '@mui/material';
import { 
  Search as SearchIcon, 
  Clear as ClearIcon, 
  Folder as CategoryIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon
} from '@mui/icons-material';
import apiService from '../services/api';
import auditService from '../services/auditService';
import { Category } from '../types';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';

const CategoriesManage: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'post_count' | 'created_at'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentTab, setCurrentTab] = useState<'visible' | 'hidden' | 'all'>('all');
  
  // Category visibility management
  const [updatingCategory, setUpdatingCategory] = useState<number | null>(null);
  const { user } = useAuth();

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
    console.log('Filtering categories. Original count:', categories.length, 'Search:', searchQuery, 'Sort:', sortBy, sortOrder, 'Tab:', currentTab);
    
    // Start with categories based on tab selection and user role
    let filtered = getVisibleCategories(categories);

    // Apply tab-based filtering
    if (currentTab === 'visible') {
      filtered = filtered.filter(cat => !cat.is_hidden);
    } else if (currentTab === 'hidden') {
      filtered = filtered.filter(cat => cat.is_hidden);
    }
    // 'all' tab shows all categories (already handled by getVisibleCategories)

    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(cat => 
        cat.name.toLowerCase().includes(query) ||
        cat.slug.toLowerCase().includes(query)
      );
      console.log('After search filter:', filtered.length);
    }

    // Ensure we have a valid array before sorting
    if (filtered && filtered.length > 0) {
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
    }

    console.log('Final filtered categories:', filtered.length);
    setFilteredCategories(filtered || []);
  }, [categories, searchQuery, sortBy, sortOrder, currentTab, user]);

  const handleToggleCategoryVisibility = async (category: Category, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent card click
    
    if (!user || user.role !== 'admin') {
      setError('Only administrators can hide/show categories');
      return;
    }

    try {
      setUpdatingCategory(category.id);
      setError('');

      let updatedCategory: Category;
      if (category.is_hidden) {
        updatedCategory = await apiService.showCategoryToPublic(category.id);
      } else {
        updatedCategory = await apiService.hideCategoryFromPublic(category.id);
      }

      // Update the categories list with the new visibility state
      setCategories(prev => 
        prev.map(cat => cat.id === category.id ? updatedCategory : cat)
      );

      // Track the action
      await auditService.trackEdit('category', category.id, {
        visibility: updatedCategory.is_hidden ? 'hidden' : 'visible',
        name: category.name
      });

    } catch (e: any) {
      console.error('Error toggling category visibility:', e);
      setError(e?.response?.data?.error || 'Failed to update category visibility');
    } finally {
      setUpdatingCategory(null);
    }
  };

  // Filter categories based on user role and visibility
  const getVisibleCategories = (categories: Category[]) => {
    if (!user || user.role !== 'admin') {
      // Non-admin users only see non-hidden categories
      return categories.filter(cat => !cat.is_hidden);
    }
    // Admin users see all categories
    return categories;
  };

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    filterAndSortCategories();
  }, [filterAndSortCategories]);

  const clearSearch = () => {
    setSearchQuery('');
  };


  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }


  // Get counts for tabs
  const visibleCount = categories.filter(cat => !cat.is_hidden).length;
  const hiddenCount = categories.filter(cat => cat.is_hidden).length;
  const allCount = categories.length;

  // Categories List View
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 3, color: '#E7E9EA', fontWeight: 700 }}>
        Categories
      </Typography>

      {/* Tab Navigation */}
      {user && user.role === 'admin' && (
        <Box sx={{ mb: 3 }}>
          <Tabs
            value={currentTab}
            onChange={(_, newValue) => setCurrentTab(newValue)}
            sx={{
              '& .MuiTabs-root': {
                borderBottom: '1px solid #2F3336',
              },
              '& .MuiTab-root': {
                color: '#71767B',
                fontWeight: 500,
                textTransform: 'none',
                fontSize: '14px',
                '&.Mui-selected': {
                  color: '#1D9BF0',
                },
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#1D9BF0',
              },
            }}
          >
            <Tab 
              label={`All Categories (${allCount})`} 
              value="all" 
            />
            <Tab 
              label={`Visible (${visibleCount})`} 
              value="visible" 
            />
            <Tab 
              label={`Hidden (${hiddenCount})`} 
              value="hidden" 
            />
          </Tabs>
        </Box>
      )}

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
                    backgroundColor: '#0F1115',
                    '& fieldset': { borderColor: '#2F3336' },
                    '&:hover fieldset': { borderColor: '#1D9BF0' },
                    '&.Mui-focused fieldset': { borderColor: '#1D9BF0' },
                    '& input': {
                      color: '#E7E9EA',
                      '::placeholder': { color: '#9CA3AF', opacity: 1 }
                    }
                  },
                  '& .MuiInputLabel-root': { color: '#9CA3AF' },
                  '& .MuiInputLabel-root.Mui-focused': { color: '#E7E9EA' }
                }}
              />
            </Box>
          </Box>
          
          {/* Sort Controls */}
          <Box sx={{ display: 'flex', gap: 3, justifyContent: 'center', flexWrap: 'wrap', color: '#E7E9EA' }}>
            <Box sx={{ minWidth: 200 }}>
              <FormControl fullWidth>
                <InputLabel sx={{ color: '#9CA3AF' }}>Sort by</InputLabel>
                <Select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  label="Sort by"
                  sx={{ 
                    color: '#E7E9EA',
                    backgroundColor: '#0F1115',
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
            </Box>
            <Box sx={{ minWidth: 200 }}>
              <FormControl fullWidth>
                <InputLabel sx={{ color: '#9CA3AF' }}>Order</InputLabel>
                <Select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  label="Order"
                  sx={{ 
                    color: '#E7E9EA',
                    backgroundColor: '#0F1115',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#2F3336' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#1D9BF0' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1D9BF0' }
                  }}
                >
                  <MenuItem value="asc">Ascending</MenuItem>
                  <MenuItem value="desc">Descending</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>
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
            sx={{ 
              backgroundColor: '#16181C', 
              border: '1px solid #2F3336',
              borderRadius: 2,
              transition: 'all 0.2s ease',
              opacity: category.is_hidden ? 0.6 : 1,
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
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="h6" sx={{ 
                      color: '#E7E9EA', 
                      fontWeight: 600
                    }}>
                      {category.name}
                    </Typography>
                    {category.is_hidden && (
                      <Chip
                        label="Hidden"
                        size="small"
                        color="warning"
                        sx={{ fontSize: '10px', height: '20px' }}
                      />
                    )}
                  </Box>
                  
                  <Typography variant="body2" sx={{ 
                    color: '#71767B', 
                    mb: 2,
                    lineHeight: 1.5 
                  }}>
                    {category.parent_name ? `Parent: ${category.parent_name}` : 'Top-level category'} • Created {format(new Date(category.created_at), 'MMM dd, yyyy')}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
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
                    
                    {/* Visibility Toggle for Admins */}
                    {user && user.role === 'admin' && (
                      <Tooltip title={category.is_hidden ? 'Show category to public' : 'Hide category from public'}>
                        <IconButton
                          onClick={(e) => handleToggleCategoryVisibility(category, e)}
                          disabled={updatingCategory === category.id}
                          size="small"
                          sx={{
                            color: category.is_hidden ? '#71767B' : '#1D9BF0',
                            '&:hover': {
                              backgroundColor: category.is_hidden ? '#2F3336' : '#1D9BF020'
                            }
                          }}
                        >
                          {updatingCategory === category.id ? (
                            <CircularProgress size={16} sx={{ color: '#71767B' }} />
                          ) : category.is_hidden ? (
                            <VisibilityOffIcon fontSize="small" />
                          ) : (
                            <VisibilityIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Tooltip>
                    )}
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


