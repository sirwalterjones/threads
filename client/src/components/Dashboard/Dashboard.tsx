import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  TextField,
  InputAdornment,
  CircularProgress,
  Badge,
  IconButton
} from '@mui/material';
import {
  Assessment,
  Category,
  Description,
  Schedule,
  Search as SearchIcon,
  TrendingUp,
  CalendarToday,
  Visibility,
  Clear as ClearIcon
} from '@mui/icons-material';
import DashboardCard from './DashboardCard';
import apiService from '../../services/api';
import { DashboardStats as ApiDashboardStats, Post, SearchFilters } from '../../types';
import { format } from 'date-fns';
import PostDetailModal from '../PostDetailModal';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<ApiDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Post[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Utility functions for text processing
  const stripHtmlTags = (html: string) => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  };

  const highlightText = (input: string) => {
    if (!searchQuery.trim()) return input;
    const terms = searchQuery.trim().split(/\s+/).filter(Boolean);
    const escaped = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
    const parts = input.split(regex);
    return parts.map((part, i) => (
      regex.test(part) ? (
        <mark key={i} style={{ backgroundColor: 'yellow', padding: 0 }}>{part}</mark>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      )
    ));
  };

  const handlePostClick = (postId: number) => {
    setSelectedPostId(postId);
    setModalOpen(true);
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const dashboardStats = await apiService.getDashboardStats();
      setStats(dashboardStats);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearchLoading(true);
      const filters: SearchFilters = {
        search: searchQuery,
        sortBy: 'wp_published_date',
        sortOrder: 'DESC'
      };
      const response = await apiService.getPosts({ ...filters, limit: 20 });
      setSearchResults(response.posts);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSearch();
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Dashboard Stats Cards at Top */}
      {stats && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <DashboardCard
              title="TOTAL REPORTS"
              value={stats.counts.totalPosts.toLocaleString()}
              change="Active"
              changeType="positive"
              period="Intelligence reports"
              icon={Description}
              iconColor="#EF4444"
              iconBgColor="#FEE2E2"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <DashboardCard
              title="RECENT ACTIVITY"
              value={stats.counts.recentPosts.toLocaleString()}
              change="This week"
              changeType="positive"
              period="New reports"
              icon={TrendingUp}
              iconColor="#F97316"
              iconBgColor="#FED7AA"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <DashboardCard
              title="CATEGORIES"
              value={stats.counts.totalCategories}
              change="Active"
              changeType="positive"
              period="Classification types"
              icon={Category}
              iconColor="#EC4899"
              iconBgColor="#FCE7F3"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <DashboardCard
              title="EXPIRING SOON"
              value={stats.counts.expiringPosts}
              change="Attention required"
              changeType="negative"
              period="Reports expiring"
              icon={CalendarToday}
              iconColor="#3B82F6"
              iconBgColor="#DBEAFE"
            />
          </Grid>
        </Grid>
      )}

      {/* Central Search Bar - Google Style */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'center' }}>
        <Box sx={{ width: '100%', maxWidth: '600px' }}>
          <Typography variant="h4" sx={{ 
            color: '#1F2937', 
            textAlign: 'center', 
            mb: 3,
            fontWeight: 'bold' 
          }}>
            Search Intelligence Reports
          </Typography>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            backgroundColor: 'white',
            border: '1px solid #E5E7EB',
            borderRadius: '24px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            '&:hover': {
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
            },
            '&:focus-within': {
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              borderColor: '#3B82F6'
            }
          }}>
            <SearchIcon sx={{ color: '#6B7280', ml: 2 }} />
            <TextField
              fullWidth
              variant="standard"
              placeholder="Search posts, content, authors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              InputProps={{
                disableUnderline: true,
                sx: {
                  px: 2,
                  py: 1,
                  '& input': {
                    color: '#1F2937',
                    fontSize: '16px',
                    '&::placeholder': {
                      color: '#9CA3AF',
                    },
                  }
                }
              }}
            />
            {searchQuery && (
              <IconButton 
                onClick={handleClearSearch}
                sx={{ mr: 1, color: '#6B7280' }}
              >
                <ClearIcon />
              </IconButton>
            )}
            <Button 
              variant="contained" 
              onClick={handleSearch}
              disabled={searchLoading || !searchQuery.trim()}
              sx={{ 
                mr: 1,
                borderRadius: '20px',
                backgroundColor: '#3B82F6',
                '&:hover': {
                  backgroundColor: '#2563EB',
                },
                '&:disabled': {
                  backgroundColor: '#E5E7EB'
                },
                textTransform: 'none',
                px: 3
              }}
            >
              {searchLoading ? <CircularProgress size={20} color="inherit" /> : 'Search'}
            </Button>
          </Box>
        </Box>
      </Box>

      {/* Search Results as Cards */}
      {searchResults.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ color: '#1F2937', mb: 3, textAlign: 'center' }}>
            Search Results ({searchResults.length})
          </Typography>
          <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))' }}>
            {searchResults.map((post) => (
              <Card
                key={post.id}
                sx={{
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  backgroundColor: 'white',
                  border: '1px solid #E5E7EB',
                  borderRadius: 3,
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                  },
                }}
                onClick={() => handlePostClick(post.id)}
              >
                <CardContent>
                  <Typography variant="h6" component="h2" gutterBottom sx={{ color: '#1F2937' }}>
                    {highlightText(stripHtmlTags(post.title))}
                  </Typography>
                  
                  {post.excerpt && (
                    <Typography variant="body2" sx={{ color: '#6B7280', mb: 2 }}>
                      {highlightText(stripHtmlTags(post.excerpt).substring(0, 150))}...
                    </Typography>
                  )}

                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                    {post.category_name && (
                      <Chip 
                        size="small" 
                        label={post.category_name} 
                        color="primary"
                        variant="outlined"
                      />
                    )}
                    <Chip 
                      size="small" 
                      label={post.author_name} 
                      variant="outlined"
                      sx={{ 
                        borderColor: '#E5E7EB',
                        color: '#6B7280'
                      }}
                    />
                    <Chip 
                      size="small" 
                      label={format(new Date(post.wp_published_date), 'MMM dd, yyyy')} 
                      variant="outlined"
                      sx={{ 
                        borderColor: '#E5E7EB',
                        color: '#6B7280'
                      }}
                    />
                  </Box>

                  {/* Media attachments preview */}
                  {post.featured_media_url && (
                    <Box sx={{ mb: 2 }}>
                      <img 
                        src={post.featured_media_url.startsWith('http') 
                          ? post.featured_media_url 
                          : `https://cmansrms.us${post.featured_media_url}`}
                        alt="Featured media"
                        style={{ maxWidth: '100%', maxHeight: '150px', objectFit: 'cover', borderRadius: '4px' }}
                      />
                    </Box>
                  )}

                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      startIcon={<Visibility />}
                      size="small"
                      variant="contained"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePostClick(post.id);
                      }}
                    >
                      View Details
                    </Button>
                    {!post.wp_post_id && (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={(e) => {
                          e.stopPropagation();
                          const evt = new CustomEvent('open-new-post-modal', { detail: { postId: post.id } });
                          window.dispatchEvent(evt);
                        }}
                      >
                        Edit
                      </Button>
                    )}
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
        </Box>
      )}

      {/* Analytics Tables */}
      {stats && (
        <Grid container spacing={3}>
          {/* Recent Activity */}
          <Grid size={{ xs: 12, lg: 7 }}>
            <Card sx={{ 
              borderRadius: 3, 
              height: '100%',
              backgroundColor: 'white',
              border: '1px solid #E5E7EB'
            }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: '#1F2937' }}>
                    Recent Activity
                  </Typography>
                  <Button size="small" sx={{ textTransform: 'none', color: '#3B82F6' }}>
                    SEE ALL
                  </Button>
                </Box>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600, color: '#6B7280', fontSize: '0.75rem' }}>
                          ACTION
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600, color: '#6B7280', fontSize: '0.75rem' }}>
                          USER
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600, color: '#6B7280', fontSize: '0.75rem' }}>
                          TIME
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {stats.recentActivity.slice(0, 5).map((activity, index) => (
                        <TableRow key={index}>
                          <TableCell sx={{ py: 2 }}>
                            <Typography variant="body2" sx={{ fontWeight: 500, color: '#1F2937' }}>
                              {activity.action}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ py: 2 }}>
                            <Typography variant="body2" sx={{ color: '#1F2937' }}>
                              {activity.username || 'System'}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ py: 2 }}>
                            <Typography variant="body2" sx={{ color: '#6B7280' }}>
                              {new Date(activity.timestamp).toLocaleTimeString()}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Top Categories */}
          <Grid size={{ xs: 12, lg: 5 }}>
            <Card sx={{ 
              borderRadius: 3, 
              height: '100%',
              backgroundColor: 'white',
              border: '1px solid #E5E7EB'
            }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: '#1F2937' }}>
                    Top Categories
                  </Typography>
                  <Button size="small" sx={{ textTransform: 'none', color: '#3B82F6' }}>
                    SEE ALL
                  </Button>
                </Box>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600, color: '#6B7280', fontSize: '0.75rem' }}>
                          CATEGORY
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600, color: '#6B7280', fontSize: '0.75rem' }}>
                          REPORTS
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {stats.topCategories.slice(0, 5).map((category, index) => (
                        <TableRow key={index}>
                          <TableCell sx={{ py: 2 }}>
                            <Typography variant="body2" sx={{ fontWeight: 500, color: '#1F2937' }}>
                              {category.name}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ py: 2 }}>
                            <Typography variant="body2" sx={{ color: '#10B981', fontWeight: 600 }}>
                              {category.post_count.toLocaleString()}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Post Detail Modal */}
      <PostDetailModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        postId={selectedPostId}
      />
    </Box>
  );
};

export default Dashboard;