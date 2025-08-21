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
import apiService, { API_BASE_URL } from '../../services/api';
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
  const [manualPosts, setManualPosts] = useState<Post[]>([]);
  const [manualPostsLoading, setManualPostsLoading] = useState(false);

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
      return imgs
        .map(img => {
          let src = (img.getAttribute('src') || '').trim();
          if (!src) src = (img.getAttribute('data-src') || '').trim();
          if (!src) {
            const srcset = (img.getAttribute('srcset') || '').trim();
            if (srcset) {
              src = srcset.split(',')[0].trim().split(' ')[0];
            }
          }
          return src;
        })
        .filter(Boolean);
    } catch { return []; }
  };

  const resolveContentImageUrl = (rawUrl: string): string => {
    if (!rawUrl) return rawUrl;
    const remoteBase = (process.env.REACT_APP_WP_SITE_URL || 'https://cmansrms.us').replace(/\/$/, '');
    let absolute = rawUrl;
    if (rawUrl.startsWith('/')) absolute = `${remoteBase}${rawUrl}`;
    else if (!rawUrl.startsWith('http')) absolute = `${remoteBase}/${rawUrl}`;
    const token = typeof window !== 'undefined' ? (localStorage.getItem('token') || '') : '';
    const tokenQuery = token ? `&t=${encodeURIComponent(token)}` : '';
    const shouldUseDirect = absolute.includes('cmansrms.us');
    return shouldUseDirect ? absolute : `${API_BASE_URL}/media?url=${encodeURIComponent(absolute)}${tokenQuery}`;
  };

  const highlightText = (input: string) => {
    if (!searchQuery.trim()) return input;
    const terms = (searchQuery.match(/\"[^\"]+\"|\S+/g) || [])
      .map(t => t.replace(/^\"|\"$/g, ''))
      .filter(t => t && !t.includes(':'));
    
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

  const loadManualPosts = async () => {
    try {
      console.log('Loading manual posts...'); // Debug
      setManualPostsLoading(true);
      const response = await apiService.getPosts({ mine: true, limit: 12, sortBy: 'ingested_at', sortOrder: 'DESC' });
      console.log('Manual posts response:', response); // Debug
      setManualPosts(response.posts);
    } catch (error) {
      console.error('Failed to load manual posts:', error);
    } finally {
      setManualPostsLoading(false);
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const dashboardStats = await apiService.getDashboardStats();
      setStats(dashboardStats);
      // Also load manual posts
      await loadManualPosts();
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    console.log('Search triggered with query:', searchQuery); // DEBUG
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
      console.log('Searching with filters:', filters); // DEBUG
      const response = await apiService.getPosts({ ...filters, limit: 20 });
      console.log('Search response:', response); // DEBUG
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
    // Reload manual posts when search is cleared
    loadManualPosts();
  };

  // Terms to highlight inside PostDetailModal and snippets (ignore filter tokens like author:)
  const modalHighlightTerms = React.useMemo(() => {
    const tokens = (searchQuery.match(/\"[^\"]+\"|\S+/g) || [])
      .map(t => t.replace(/^\"|\"$/g, ''))
      .filter(t => t && !t.includes(':'));
    return tokens;
  }, [searchQuery]);

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
    <Box sx={{ position: 'relative', overflow: 'hidden', width: '100%' }}>
      {/* Add Thread above Search Header */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, mb: 4 }}>
        <Button
          variant="contained"
          onClick={handleAddThread}
          startIcon={<AddIcon />}
          size="medium"
          sx={{
            borderRadius: '999px',
            backgroundColor: '#1D9BF0',
            color: 'black',
            fontSize: '14px',
            fontWeight: 700,
            px: 3,
            py: 1,
            textTransform: 'none',
            boxShadow: '0 6px 18px rgba(0, 0, 0, 0.35), 0 0 14px rgba(29, 155, 240, 0.45)',
            '&:hover': {
              backgroundColor: '#1A8CD8',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45), 0 0 18px rgba(29, 155, 240, 0.65)'
            },
          }}
        >
          Add Thread
        </Button>
      </Box>

      {/* Dashboard Stats Cards removed */}

      {/* Search Bar with Buttons */}
      <Box sx={{ mb: 4, px: 3 }}>
        <Box sx={{ 
          position: 'relative',
          width: '100%',
          maxWidth: '700px',
          margin: '0 auto'
        }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search your threads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '50px',
                backgroundColor: '#16181C',
                fontSize: '18px',
                height: '50px',
                border: '1px solid #2F3336',
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
                  padding: '12px 24px 12px 50px',
                  fontSize: '18px',
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
                  <SearchIcon sx={{ color: '#71767B', fontSize: 20 }} />
                </Box>
              )
            }}
          />
          
          {/* Search and Clear Buttons */}
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: 2, 
            mt: 2 
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

      {/* Search Results */}
      {searchResults.length > 0 && (
        <Box sx={{ mb: 4, px: 3 }}>
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 2,
            maxWidth: '100%', 
            mx: 'auto',
            overflow: 'hidden'
          }}>
            {searchResults.map((post) => (
              <Box key={post.id}>
                <Card 
                  sx={{ 
                    height: '100%',
                    backgroundColor: '#16181C',
                    border: '1px solid #2F3336',
                    borderRadius: 2,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out',
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
                      <MediaGallery attachments={post.attachments} maxHeight={120} />
                    ) : (() => {
                      const imageUrls = extractImageUrls(post.content).slice(0, 3);
                      if (imageUrls.length === 0) return null;
                      return (
                        <Box sx={{ mb: 1, display: 'flex', gap: 0.5, overflowX: 'auto', pb: 0.5 }}>
                          {imageUrls.map((url, idx) => (
                            <img
                              key={idx}
                              src={resolveContentImageUrl(url)}
                              alt={`Post image ${idx + 1}`}
                              style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: '4px', flex: '0 0 auto' }}
                              onError={(e)=>{ (e.currentTarget as HTMLImageElement).style.display='none'; }}
                            />
                          ))}
                        </Box>
                      );
                    })()}
                    
                    <Typography variant="h6" component="h2" gutterBottom sx={{ color: '#E7E9EA', fontSize: '1rem', mb: 1 }}>
                      {highlightText(stripHtmlTags(post.title))}
                    </Typography>
                    
                    {(() => {
                      const raw = post.excerpt && post.excerpt.trim().length > 0 
                        ? post.excerpt 
                        : (post.content || '');
                      const text = stripHtmlTags(raw);
                      if (!text) return null;
                      return (
                        <Typography variant="body2" sx={{ color: '#6B7280', mb: 1, fontSize: '0.875rem' }}>
                          {highlightText(text.substring(0, 80))}...
                        </Typography>
                      );
                    })()}

                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                      {post.category_name && (
                        <Chip 
                          size="small" 
                          label={post.category_name} 
                          color="primary"
                          variant="outlined"
                          sx={{ fontSize: '0.75rem' }}
                        />
                      )}
                      <Chip 
                        size="small" 
                        label={post.author_name} 
                        color="secondary"
                        variant="outlined"
                        sx={{ fontSize: '0.75rem' }}
                      />
                      <Chip 
                        size="small" 
                        label={format(new Date(post.wp_published_date || post.ingested_at), 'MMM d, yyyy')} 
                        color="default"
                        variant="outlined"
                        sx={{ fontSize: '0.75rem' }}
                      />
                    </Box>

                    <Button
                      variant="outlined"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePostClick(post.id);
                      }}
                      sx={{
                        borderColor: '#1D9BF0',
                        color: '#1D9BF0',
                        '&:hover': {
                          borderColor: '#1A8CD8',
                          backgroundColor: 'rgba(29, 155, 240, 0.1)'
                        }
                      }}
                    >
                      View
                    </Button>
                  </CardContent>
                </Card>
              </Box>
            ))}
          </Box>
        </Box>
      )}

{/* Manual Posts Grid - Show when no search results */}
{searchResults.length === 0 && manualPosts.length > 0 && (
  <Box sx={{ mb: 4, px: 3 }}>
    <Box sx={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
      gap: 2,
      maxWidth: '100%', 
      mx: 'auto',
      overflow: 'hidden'
    }}>
      {manualPosts.map((post) => (
        <Box key={post.id}>
          <Card 
            sx={{ 
              height: '100%',
              backgroundColor: '#16181C',
              border: '1px solid #2F3336',
              borderRadius: 2,
              cursor: 'pointer',
              transition: 'all 0.2s ease-in-out',
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
                <MediaGallery attachments={post.attachments} maxHeight={120} />
              ) : (() => {
                const imageUrls = extractImageUrls(post.content).slice(0, 3);
                if (imageUrls.length === 0) return null;
                return (
                  <Box sx={{ mb: 1, display: 'flex', gap: 0.5, overflowX: 'auto', pb: 0.5 }}>
                    {imageUrls.map((url, idx) => (
                      <img
                        key={idx}
                        src={resolveContentImageUrl(url)}
                        alt={`Post image ${idx + 1}`}
                        style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: '4px', flex: '0 0 auto' }}
                        onError={(e)=>{ (e.currentTarget as HTMLImageElement).style.display='none'; }}
                      />
                    ))}
                  </Box>
                );
              })()}
              
              <Typography variant="h6" component="h2" gutterBottom sx={{ color: '#E7E9EA', fontSize: '1rem', mb: 1 }}>
                {highlightText(stripHtmlTags(post.title))}
              </Typography>
              
              {(() => {
                const raw = post.excerpt && post.excerpt.trim().length > 0 
                  ? post.excerpt 
                  : (post.content || '');
                const text = stripHtmlTags(raw);
                if (!text) return null;
                return (
                  <Typography variant="body2" sx={{ color: '#6B7280', mb: 1, fontSize: '0.875rem' }}>
                    {highlightText(text.substring(0, 80))}...
                  </Typography>
                );
              })()}

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                {post.category_name && (
                  <Chip 
                    size="small" 
                    label={post.category_name} 
                    color="primary"
                    variant="outlined"
                    sx={{ fontSize: '0.75rem' }}
                  />
                )}
                <Chip 
                  size="small" 
                  label={post.author_name} 
                  variant="outlined"
                  sx={{ 
                    borderColor: '#E5E7EB',
                    color: '#6B7280',
                    fontSize: '0.75rem'
                  }}
                />
                <Chip 
                  size="small" 
                  label={format(new Date(post.wp_published_date), 'MMM dd, yyyy')} 
                  variant="outlined"
                  sx={{ 
                    borderColor: '#E5E7EB',
                    color: '#6B7280',
                    fontSize: '0.75rem'
                  }}
                />
              </Box>

              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  startIcon={<Visibility />}
                  size="small"
                  variant="contained"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePostClick(post.id);
                  }}
                  sx={{
                    backgroundColor: '#10B981',
                    '&:hover': { backgroundColor: '#059669' },
                    fontSize: '0.75rem',
                    py: 0.5,
                    px: 1.5
                  }}
                >
                  View
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Box>
      ))}
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
                      src={resolveContentImageUrl(url)}
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
            
            {(() => {
              const raw = post.excerpt && post.excerpt.trim().length > 0 
                ? post.excerpt 
                : (post.content || '');
              const text = stripHtmlTags(raw);
              if (!text) return null;
              return (
                <Typography variant="body2" sx={{ color: '#6B7280', mb: 2 }}>
                  {highlightText(text.substring(0, 150))}...
                </Typography>
              );
            })()}

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
  highlightTerms={modalHighlightTerms}
/>
</Box>
);
};

export default Dashboard;