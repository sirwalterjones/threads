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
    
    // Create patterns for each term including variations
    const patterns = terms.map(term => {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Match the term with optional word boundaries and partial matches
      return `(${escaped}\\w*|\\w*${escaped}\\w*|${escaped})`;
    });
    
    const regex = new RegExp(`(${patterns.join('|')})`, 'gi');
    const parts = input.split(regex);
    
    return parts.map((part, i) => {
      if (!part) return <React.Fragment key={i}></React.Fragment>;
      
      // Check if this part contains any of our search terms
      const shouldHighlight = terms.some(term => 
        part.toLowerCase().includes(term.toLowerCase()) ||
        term.toLowerCase().includes(part.toLowerCase())
      );
      
      return shouldHighlight ? (
        <mark key={i} style={{ backgroundColor: '#FFEB3B', padding: '0 2px', borderRadius: '2px' }}>{part}</mark>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      );
    });
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

      {/* Central Search Bar - Primary Focus */}
      {searchResults.length === 0 && (
        <Box sx={{ 
          mb: 6, 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          minHeight: '60vh',
          flexDirection: 'column'
        }}>
          <Box sx={{ width: '100%', maxWidth: '800px', textAlign: 'center' }}>
            <Typography variant="h2" sx={{ 
              color: '#1F2937', 
              textAlign: 'center', 
              mb: 2,
              fontWeight: 300,
              fontSize: { xs: '2.5rem', md: '3.5rem' }
            }}>
              Search Threads
            </Typography>
            <Typography variant="h6" sx={{ 
              color: '#6B7280', 
              textAlign: 'center', 
              mb: 6,
              fontWeight: 400
            }}>
              Search through reports and intelligence data
            </Typography>
            
            <Box sx={{ 
              position: 'relative',
              width: '100%',
              maxWidth: '700px',
              margin: '0 auto'
            }}>
              <TextField
                fullWidth
                variant="outlined"
                placeholder="Search reports, content, authors, classifications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '50px',
                    backgroundColor: 'white',
                    fontSize: '18px',
                    height: '64px',
                    boxShadow: '0 12px 40px -8px rgba(0, 0, 0, 0.25)',
                    border: '2px solid transparent',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      boxShadow: '0 16px 50px -8px rgba(0, 0, 0, 0.35)',
                      transform: 'translateY(-1px)'
                    },
                    '&.Mui-focused': {
                      boxShadow: '0 16px 50px -8px rgba(0, 0, 0, 0.35)',
                      borderColor: '#3B82F6',
                      transform: 'translateY(-1px)'
                    },
                    '& fieldset': {
                      border: 'none'
                    },
                    '& input': {
                      padding: '20px 24px 20px 60px',
                      fontSize: '18px',
                      color: '#1F2937',
                      '&::placeholder': {
                        color: '#9CA3AF',
                        opacity: 1
                      }
                    }
                  }
                }}
                InputProps={{
                  startAdornment: (
                    <Box sx={{ 
                      position: 'absolute', 
                      left: 20, 
                      zIndex: 1,
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      <SearchIcon sx={{ color: '#6B7280', fontSize: 24 }} />
                    </Box>
                  ),
                  endAdornment: searchQuery && (
                    <Box sx={{ position: 'absolute', right: 20, zIndex: 1 }}>
                      <IconButton 
                        onClick={handleClearSearch}
                        sx={{ 
                          color: '#6B7280',
                          '&:hover': { color: '#374151' }
                        }}
                      >
                        <ClearIcon />
                      </IconButton>
                    </Box>
                  )
                }}
              />
              
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'center', 
                gap: 2, 
                mt: 4 
              }}>
                <Button 
                  variant="contained" 
                  onClick={handleSearch}
                  disabled={searchLoading || !searchQuery.trim()}
                  size="large"
                  sx={{ 
                    borderRadius: '25px',
                    backgroundColor: '#000000',
                    color: 'white',
                    fontSize: '16px',
                    fontWeight: 600,
                    px: 4,
                    py: 1.5,
                    textTransform: 'none',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                    '&:hover': {
                      backgroundColor: '#1F2937',
                      boxShadow: '0 6px 16px rgba(0, 0, 0, 0.4)',
                      transform: 'translateY(-1px)'
                    },
                    '&:disabled': {
                      backgroundColor: '#E5E7EB',
                      color: '#9CA3AF',
                      boxShadow: 'none'
                    },
                    transition: 'all 0.2s ease'
                  }}
                >
                  {searchLoading ? <CircularProgress size={20} color="inherit" sx={{ mr: 1 }} /> : null}
                  Search
                </Button>
                
                <Button 
                  variant="contained" 
                  onClick={handleClearSearch}
                  disabled={!searchQuery && searchResults.length === 0}
                  size="large"
                  sx={{ 
                    borderRadius: '25px',
                    backgroundColor: '#000000',
                    color: 'white',
                    fontSize: '16px',
                    fontWeight: 500,
                    px: 3,
                    py: 1.5,
                    textTransform: 'none',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                    '&:hover': {
                      backgroundColor: '#1F2937',
                      boxShadow: '0 6px 16px rgba(0, 0, 0, 0.4)',
                      transform: 'translateY(-1px)'
                    },
                    '&:disabled': {
                      backgroundColor: '#E5E7EB',
                      color: '#9CA3AF',
                      boxShadow: 'none'
                    },
                    transition: 'all 0.2s ease'
                  }}
                >
                  Clear
                </Button>
              </Box>
            </Box>
          </Box>
        </Box>
      )}

      {/* Search Results Section */}
      {searchResults.length > 0 && (
        <Box sx={{ mb: 4 }}>
          {/* Compact Search Bar Above Results */}
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            mb: 4,
            gap: 2,
            flexWrap: 'wrap'
          }}>
            <Box sx={{ 
              position: 'relative',
              width: '100%',
              maxWidth: '500px'
            }}>
              <TextField
                fullWidth
                variant="outlined"
                placeholder="Search reports, content, authors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '25px',
                    backgroundColor: 'white',
                    fontSize: '14px',
                    height: '44px',
                    boxShadow: '0 8px 25px -8px rgba(0, 0, 0, 0.2)',
                    border: '1px solid #E5E7EB',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      boxShadow: '0 10px 30px -8px rgba(0, 0, 0, 0.25)',
                      borderColor: '#D1D5DB'
                    },
                    '&.Mui-focused': {
                      boxShadow: '0 10px 30px -8px rgba(59, 130, 246, 0.15)',
                      borderColor: '#3B82F6'
                    },
                    '& input': {
                      padding: '12px 16px 12px 45px',
                      fontSize: '14px',
                      color: '#1F2937',
                      '&::placeholder': {
                        color: '#9CA3AF',
                        opacity: 1
                      }
                    }
                  }
                }}
                InputProps={{
                  startAdornment: (
                    <Box sx={{ 
                      position: 'absolute', 
                      left: 16, 
                      zIndex: 1,
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      <SearchIcon sx={{ color: '#6B7280', fontSize: 18 }} />
                    </Box>
                  )
                }}
              />
            </Box>
            
            <Button 
              variant="contained" 
              onClick={handleSearch}
              disabled={searchLoading || !searchQuery.trim()}
              sx={{ 
                borderRadius: '20px',
                backgroundColor: '#000000',
                color: 'white',
                fontSize: '14px',
                fontWeight: 600,
                px: 3,
                py: 1,
                textTransform: 'none',
                minWidth: 'auto',
                height: '44px',
                '&:hover': {
                  backgroundColor: '#1F2937'
                },
                '&:disabled': {
                  backgroundColor: '#E5E7EB',
                  color: '#9CA3AF'
                }
              }}
            >
              {searchLoading ? <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} /> : null}
              Search
            </Button>
            
            <Button 
              variant="outlined" 
              onClick={handleClearSearch}
              sx={{ 
                borderRadius: '20px',
                borderColor: '#000000',
                color: '#000000',
                backgroundColor: 'white',
                fontSize: '14px',
                fontWeight: 500,
                px: 3,
                py: 1,
                textTransform: 'none',
                minWidth: 'auto',
                height: '44px',
                '&:hover': {
                  borderColor: '#1F2937',
                  backgroundColor: '#F9FAFB',
                  color: '#1F2937'
                }
              }}
            >
              Reset
            </Button>
          </Box>

          {/* Results Header */}
          <Typography variant="h5" sx={{ 
            color: '#1F2937', 
            mb: 3, 
            textAlign: 'center',
            fontWeight: 600 
          }}>
            Search Results ({searchResults.length})
          </Typography>

          {/* Results Grid */}
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