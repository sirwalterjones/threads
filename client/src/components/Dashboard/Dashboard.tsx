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
  Clear as ClearIcon,
  Add as AddIcon
} from '@mui/icons-material';
import DashboardCard from './DashboardCard';
import apiService from '../../services/api';
import { DashboardStats as ApiDashboardStats, Post, SearchFilters } from '../../types';
import { format } from 'date-fns';
import PostDetailModal from '../PostDetailModal';
import MediaGallery from '../MediaGallery';

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

  const extractImageUrls = (html?: string): string[] => {
    if (!html) return [];
    try {
      const div = document.createElement('div');
      div.innerHTML = html;
      const imgs = Array.from(div.querySelectorAll('img'));
      return imgs.map(img => (img.getAttribute('src') || '').trim()).filter(Boolean);
    } catch { return []; }
  };

  const highlightText = (input: string) => {
    if (!searchQuery.trim()) return input;
    const terms = searchQuery.trim().split(/\s+/).filter(Boolean);
    
    // Create a single pattern for all terms with word variations
    const patterns = terms.map(term => {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Match the exact term or words containing the term
      return `\\b\\w*${escaped}\\w*\\b`;
    });
    
    const regex = new RegExp(`(${patterns.join('|')})`, 'gi');
    const parts = input.split(regex);
    
    return parts.map((part, i) => {
      if (!part) return <React.Fragment key={i}></React.Fragment>;
      
      // Check if this part matches our regex (was captured)
      const isMatch = regex.test(part);
      regex.lastIndex = 0; // Reset regex state
      
      // Also check manually for term matching
      const shouldHighlight = isMatch || terms.some(term => 
        part.toLowerCase().includes(term.toLowerCase())
      );
      
      return shouldHighlight ? (
        <mark key={i} style={{ backgroundColor: '#FFEB3B', padding: '0 2px', borderRadius: '2px' }}>{part}</mark>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      );
    });
  };

  const countMatches = (text: string, query: string) => {
    if (!text || !query.trim()) return 0;
    const terms = query.trim().split(/\s+/).filter(Boolean);
    const plain = stripHtmlTags(text);
    let total = 0;
    for (const term of terms) {
      if (!term) continue;
      const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const matches = plain.match(re);
      if (matches) total += matches.length;
    }
    return total;
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

  const handleAddThread = () => {
    const evt = new CustomEvent('open-new-post-modal');
    window.dispatchEvent(evt);
  };

  return (
    <Box sx={{ position: 'relative' }}>
      {/* Floating Add Thread Button */}
      <Box sx={{ 
        position: 'fixed', 
        bottom: 24, 
        right: 24, 
        zIndex: 1000 
      }}>
        <Button
          variant="contained"
          onClick={handleAddThread}
          startIcon={<AddIcon />}
          size="large"
          sx={{
            borderRadius: '50px',
            backgroundColor: '#000000',
            color: 'white',
            fontSize: '16px',
            fontWeight: 600,
            px: 3,
            py: 1.5,
            textTransform: 'none',
            boxShadow: '0 8px 25px rgba(0, 0, 0, 0.4)',
            '&:hover': {
              backgroundColor: '#1F2937',
              boxShadow: '0 12px 35px rgba(0, 0, 0, 0.5)',
              transform: 'translateY(-2px)'
            },
            transition: 'all 0.3s ease'
          }}
        >
          Add Thread
        </Button>
      </Box>

      {/* Dashboard Stats Cards removed */}

      {/* Central Search Bar - Primary Focus */}
      {searchResults.length === 0 && (
        <Box sx={{ 
          mb: 4, 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          minHeight: '40vh',
          flexDirection: 'column',
          px: 4
        }}>
          <Box sx={{ width: '100%', maxWidth: '800px', textAlign: 'center' }}>
            <Typography variant="h2" sx={{ 
              color: '#E7E9EA', 
              textAlign: 'center', 
              mb: 4,
              fontWeight: 700,
              fontSize: { xs: '2rem', md: '2.5rem' }
            }}>
                              Search Vector
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
                placeholder=""
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '50px',
                    backgroundColor: '#16181C',
                    fontSize: '20px',
                    height: '56px',
                    border: '1px solid #2F3336',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      borderColor: '#1D9BF0'
                    },
                    '&.Mui-focused': {
                      borderColor: '#1D9BF0',
                      backgroundColor: '#000000'
                    },
                    '& fieldset': {
                      border: 'none'
                    },
                    '& input': {
                      padding: '16px 24px 16px 60px',
                      fontSize: '20px',
                      color: '#E7E9EA',
                      '&::placeholder': {
                        color: '#71767B',
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
                      <SearchIcon sx={{ color: '#71767B', fontSize: 24 }} />
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
                    borderRadius: '50px',
                    backgroundColor: '#1D9BF0',
                    color: 'white',
                    fontSize: '16px',
                    fontWeight: 700,
                    px: 6,
                    py: 1.5,
                    textTransform: 'none',
                    border: '1px solid #1D9BF0',
                    '&:hover': {
                      backgroundColor: '#1A8CD8'
                    },
                    '&:disabled': {
                      backgroundColor: '#2F3336',
                      color: '#71767B',
                      borderColor: '#2F3336'
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
                placeholder=""
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
                  {/* Media Gallery - prefer uploaded attachments; fallback to first content image */}
                  {post.attachments && post.attachments.length > 0 ? (
                    <MediaGallery attachments={post.attachments} maxHeight={180} />
                  ) : (() => {
                    const imageUrls = extractImageUrls(post.content).slice(0, 5);
                    if (imageUrls.length === 0) return null;
                    return (
                      <Box sx={{ mb: 2, display: 'flex', gap: 1, overflowX: 'auto', pb: 1 }}>
                        {imageUrls.map((url, idx) => (
                          <img
                            key={idx}
                            src={url}
                            alt={`Post image ${idx + 1}`}
                            style={{ width: 160, height: 120, objectFit: 'cover', borderRadius: '8px', flex: '0 0 auto' }}
                            onError={(e)=>{ (e.currentTarget as HTMLImageElement).style.display='none'; }}
                          />
                        ))}
                      </Box>
                    );
                  })()}
                  
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
                          : `https://cso.vectoronline.us${post.featured_media_url}`}
                        alt="Featured media"
                        style={{ maxWidth: '100%', maxHeight: '150px', objectFit: 'cover', borderRadius: '4px' }}
                      />
                    </Box>
                  )}

                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {(() => {
                      const contentText = stripHtmlTags(post.content || '');
                      const contentCount = countMatches(contentText, searchQuery);
                      const showCount = contentCount > 0;
                      
                      return showCount ? (
                        <Badge badgeContent={contentCount} color="secondary">
                          <Button
                            startIcon={<Visibility />}
                            size="small"
                            variant="contained"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePostClick(post.id);
                            }}
                            sx={{
                              backgroundColor: '#000000',
                              color: 'white',
                              '&:hover': {
                                backgroundColor: '#1F2937'
                              }
                            }}
                          >
                            View Details
                          </Button>
                        </Badge>
                      ) : (
                        <Button
                          startIcon={<Visibility />}
                          size="small"
                          variant="contained"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePostClick(post.id);
                          }}
                          sx={{
                            backgroundColor: '#000000',
                            color: 'white',
                            '&:hover': {
                              backgroundColor: '#1F2937'
                            }
                          }}
                        >
                          View Details
                        </Button>
                      );
                    })()}
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