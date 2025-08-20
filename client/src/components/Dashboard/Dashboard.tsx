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
  CircularProgress
} from '@mui/material';
import {
  Assessment,
  Category,
  Description,
  Schedule,
  Search as SearchIcon,
  TrendingUp,
  CalendarToday
} from '@mui/icons-material';
import DashboardCard from './DashboardCard';
import apiService from '../../services/api';
import { DashboardStats as ApiDashboardStats, Post, SearchFilters } from '../../types';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<ApiDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Post[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Central Search Bar */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'center' }}>
        <Card sx={{ 
          p: 3, 
          width: '100%', 
          maxWidth: '800px',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.2)'
        }}>
          <Typography variant="h4" sx={{ 
            color: 'white', 
            textAlign: 'center', 
            mb: 3,
            fontWeight: 'bold' 
          }}>
            Search Intelligence Reports
          </Typography>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search posts, content, authors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'rgba(255, 255, 255, 0.7)' }} />
                </InputAdornment>
              ),
              endAdornment: searchLoading && (
                <InputAdornment position="end">
                  <CircularProgress size={20} sx={{ color: 'white' }} />
                </InputAdornment>
              ),
              sx: {
                '& .MuiOutlinedInput-root': {
                  color: 'white',
                  '& fieldset': {
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                  },
                  '&:hover fieldset': {
                    borderColor: 'rgba(255, 255, 255, 0.5)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'white',
                  },
                },
                '& .MuiInputBase-input::placeholder': {
                  color: 'rgba(255, 255, 255, 0.7)',
                },
              }
            }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <Button 
              variant="contained" 
              onClick={handleSearch}
              disabled={searchLoading}
              sx={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.3)',
                }
              }}
            >
              Search
            </Button>
          </Box>
        </Card>
      </Box>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <Card sx={{ mb: 4, backgroundColor: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(10px)' }}>
          <CardContent>
            <Typography variant="h6" sx={{ color: 'white', mb: 2 }}>
              Search Results ({searchResults.length})
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>Title</TableCell>
                    <TableCell sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>Category</TableCell>
                    <TableCell sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>Author</TableCell>
                    <TableCell sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {searchResults.map((post) => (
                    <TableRow key={post.id}>
                      <TableCell sx={{ color: 'white' }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {post.title}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ color: 'white' }}>
                        <Chip 
                          label={post.category_name || 'Uncategorized'} 
                          size="small"
                          sx={{ 
                            backgroundColor: 'rgba(255, 255, 255, 0.2)',
                            color: 'white'
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ color: 'white' }}>{post.author_name}</TableCell>
                      <TableCell sx={{ color: 'white' }}>
                        {new Date(post.wp_published_date).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Dashboard Stats Cards */}
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

      {/* Analytics Tables */}
      {stats && (
        <Grid container spacing={3}>
          {/* Recent Activity */}
          <Grid size={{ xs: 12, lg: 7 }}>
            <Card sx={{ 
              borderRadius: 3, 
              height: '100%',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)'
            }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: 'white' }}>
                    Recent Activity
                  </Typography>
                  <Button size="small" sx={{ textTransform: 'none', color: 'rgba(255, 255, 255, 0.8)' }}>
                    SEE ALL
                  </Button>
                </Box>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600, color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.75rem' }}>
                          ACTION
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600, color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.75rem' }}>
                          USER
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600, color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.75rem' }}>
                          TIME
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {stats.recentActivity.slice(0, 5).map((activity, index) => (
                        <TableRow key={index}>
                          <TableCell sx={{ py: 2 }}>
                            <Typography variant="body2" sx={{ fontWeight: 500, color: 'white' }}>
                              {activity.action}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ py: 2 }}>
                            <Typography variant="body2" sx={{ color: 'white' }}>
                              {activity.username || 'System'}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ py: 2 }}>
                            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
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
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)'
            }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: 'white' }}>
                    Top Categories
                  </Typography>
                  <Button size="small" sx={{ textTransform: 'none', color: 'rgba(255, 255, 255, 0.8)' }}>
                    SEE ALL
                  </Button>
                </Box>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600, color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.75rem' }}>
                          CATEGORY
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600, color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.75rem' }}>
                          REPORTS
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {stats.topCategories.slice(0, 5).map((category, index) => (
                        <TableRow key={index}>
                          <TableCell sx={{ py: 2 }}>
                            <Typography variant="body2" sx={{ fontWeight: 500, color: 'white' }}>
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
    </Box>
  );
};

export default Dashboard;