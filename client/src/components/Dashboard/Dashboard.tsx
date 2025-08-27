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
  IconButton,
  Tabs,
  Tab
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
  Bookmark,
  ViewModule,
  ViewList
} from '@mui/icons-material';
import DashboardCard from './DashboardCard';
import apiService, { API_BASE_URL } from '../../services/api';
import { DashboardStats as ApiDashboardStats, Post, SearchFilters } from '../../types';
import { format } from 'date-fns';
import PostDetailModal from '../PostDetailModal';
import MediaGallery from '../MediaGallery';
import TwitterStylePostCard from '../TwitterStylePostCard';
import FollowButton from '../FollowButton';
import DeletePostButton from '../DeletePostButton';

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

  // Following functionality state
  const [activeTab, setActiveTab] = useState<'all' | 'following'>('following');
  const [followingPosts, setFollowingPosts] = useState<Post[]>([]);
  const [followingLoading, setFollowingLoading] = useState(false);
  
  // View toggle state for Following posts
  const [followingViewMode, setFollowingViewMode] = useState<'cards' | 'feed'>('feed');
  
  // Debug logging for view mode changes
  useEffect(() => {
    console.log('Dashboard: followingViewMode changed to:', followingViewMode);
  }, [followingViewMode]);
  
  // Sort posts by modification date (newest first)
  const sortedFollowingPosts = [...followingPosts].sort((a, b) => {
    const dateA = new Date(a.wp_modified_date || a.wp_published_date);
    const dateB = new Date(b.wp_modified_date || b.wp_published_date);
    return dateB.getTime() - dateA.getTime();
  });

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

    // If it's already a local file URL (served by Threads Intel), return as-is
    if (rawUrl.startsWith('/api/files/') || rawUrl.startsWith(`${API_BASE_URL}/files/`)) {
      console.log('resolveContentImageUrl (Dashboard): Using local file URL:', rawUrl);
      return rawUrl;
    }

    const remoteBase = (process.env.REACT_APP_WP_SITE_URL || 'https://cmansrms.us').replace(/\/$/, '');
    let absolute = rawUrl;
    if (rawUrl.startsWith('/')) absolute = `${remoteBase}${rawUrl}`;
    else if (!rawUrl.startsWith('http')) absolute = `${remoteBase}/${rawUrl}`;

    // For now, skip the proxy and use direct URLs to ensure images display
    console.log('resolveContentImageUrl (Dashboard): Using direct URL (proxy disabled):', absolute);
    return absolute;
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

  const loadFollowingPosts = async () => {
    try {
      console.log('Loading following posts...');
      setFollowingLoading(true);
      const response = await apiService.getFollowedPosts(1, 12);
      console.log('Following posts response:', response);
      setFollowingPosts(response.posts);
    } catch (error) {
      console.error('Failed to load following posts:', error);
    } finally {
      setFollowingLoading(false);
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      // Only try to load admin stats if we're an admin user
      try {
        const dashboardStats = await apiService.getDashboardStats();
        setStats(dashboardStats);
      } catch (adminError) {
        // Non-admin users will get 403, that's expected - just continue without stats
        console.log('User is not admin, skipping dashboard stats');
        setStats(null);
      }
      // Load following posts for all users
      await loadFollowingPosts();
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
        sortBy: 'ingested_at',
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
    // Reload following posts when search is cleared
    loadFollowingPosts();
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



  return (
    <Box sx={{ position: 'relative', overflow: 'hidden', width: '100%' }}>


      {/* Dashboard Stats Cards removed */}

      {/* Search Bar with Buttons */}
      <Box sx={{ mb: 4, px: { xs: 2, sm: 3, md: 3 }, mt: 4 }}>
        <Box sx={{ 
          position: 'relative',
          width: '100%',
          maxWidth: { xs: '100%', sm: '600px', md: '700px' },
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
                borderRadius: { xs: '25px', sm: '50px' },
                backgroundColor: '#16181C',
                fontSize: { xs: '16px', sm: '18px' },
                height: { xs: '45px', sm: '50px' },
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
                  padding: { xs: '10px 20px 10px 45px', sm: '12px 24px 12px 50px' },
                  fontSize: { xs: '16px', sm: '18px' },
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
                  left: { xs: 15, sm: 20 }, 
                  zIndex: 1,
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <SearchIcon sx={{ color: '#71767B', fontSize: { xs: 18, sm: 20 } }} />
                </Box>
              )
            }}
          />
          
          {/* Search and Clear Buttons */}
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: { xs: 1, sm: 2 }, 
            mt: { xs: 1.5, sm: 2 },
            flexDirection: { xs: 'column', sm: 'row' }
          }}>
            <Button 
              variant="outlined" 
              onClick={handleSearch}
              disabled={searchLoading || !searchQuery.trim()}
              size={window.innerWidth < 600 ? "medium" : "small"}
              fullWidth={window.innerWidth < 600}
              sx={{ 
                borderRadius: '8px',
                borderColor: '#2F3336',
                color: '#E7E9EA',
                fontSize: { xs: '16px', sm: '14px' },
                fontWeight: 500,
                px: { xs: 4, sm: 3 },
                py: { xs: 1.5, sm: 1 },
                textTransform: 'none',
                '&:hover': {
                  borderColor: '#1D9BF0',
                  backgroundColor: 'rgba(29, 155, 240, 0.1)',
                  color: '#1D9BF0'
                },
                '&:disabled': {
                  borderColor: '#2F3336',
                  color: '#71767B'
                },
                transition: 'all 0.2s ease'
              }}
            >
              {searchLoading ? <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} /> : null}
              Search
            </Button>
            
            <Button 
              variant="outlined" 
              onClick={handleClearSearch}
              disabled={!searchQuery && searchResults.length === 0}
              size={window.innerWidth < 600 ? "medium" : "small"}
              fullWidth={window.innerWidth < 600}
              sx={{ 
                borderRadius: '8px',
                borderColor: '#2F3336',
                color: '#71767B',
                fontSize: { xs: '16px', sm: '14px' },
                fontWeight: 500,
                px: { xs: 4, sm: 3 },
                py: { xs: 1.5, sm: 1 },
                textTransform: 'none',
                '&:hover': {
                  borderColor: '#71767B',
                  backgroundColor: 'rgba(113, 118, 123, 0.1)',
                  color: '#E7E9EA'
                },
                '&:disabled': {
                  borderColor: '#2F3336',
                  color: '#71767B'
                },
                transition: 'all 0.2s ease'
              }}
            >
              Clear
            </Button>
          </Box>
        </Box>
      </Box>



{/* Tabs for All Posts vs Following - Show when no search results */}
{searchResults.length === 0 && (
  <Box sx={{ mb: 3, px: { xs: 2, sm: 3, md: 3 } }}>
    <Card sx={{ backgroundColor: '#16181C', border: '1px solid #2F3336' }}>
      <Tabs 
        value={activeTab} 
        onChange={(_, newValue) => {
          console.log('Tab changed to:', newValue);
          setActiveTab(newValue);
          if (newValue === 'following') {
            console.log('Loading following posts...');
            loadFollowingPosts();
          }
        }}
        sx={{
          borderBottom: '1px solid #2F3336',
          '& .MuiTabs-indicator': {
            backgroundColor: '#1D9BF0',
          },
          '& .MuiTab-root': {
            color: '#71767B',
            textTransform: 'none',
            fontSize: '0.95rem',
            fontWeight: 500,
            minHeight: 48,
            '&.Mui-selected': {
              color: '#1D9BF0',
            },
            '&:hover': {
              color: '#E7E9EA',
            },
          },
        }}
      >

        <Tab 
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Bookmark sx={{ fontSize: 18 }} />
              Following
              <IconButton 
                size="small" 
                onClick={(e) => {
                  e.stopPropagation();
                  loadFollowingPosts();
                }}
                sx={{ 
                  color: '#1DA1F2', 
                  '&:hover': { backgroundColor: 'rgba(29, 161, 242, 0.1)' },
                  ml: 0.5,
                  p: 0.5
                }}
                title="Refresh following posts"
              >
                <TrendingUp fontSize="small" />
              </IconButton>
            </Box>
          } 
          value="following" 
          sx={{ minWidth: 120 }}
        />
        {/* Compact view toggles aligned to the right when Following tab is active */}
        {activeTab === 'following' && (
          <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
            <Button
              variant={followingViewMode === 'cards' ? 'contained' : 'outlined'}
              size="small"
              startIcon={<ViewModule />}
              onClick={() => setFollowingViewMode('cards')}
              sx={{
                backgroundColor: followingViewMode === 'cards' ? '#1D9BF0' : 'transparent',
                color: followingViewMode === 'cards' ? '#FFFFFF' : '#1D9BF0',
                borderColor: '#1D9BF0',
                '&:hover': {
                  backgroundColor: followingViewMode === 'cards' ? '#1A8CD8' : 'rgba(29, 155, 240, 0.1)'
                }
              }}
            >
              Cards
            </Button>
            <Button
              variant={followingViewMode === 'feed' ? 'contained' : 'outlined'}
              size="small"
              startIcon={<ViewList />}
              onClick={() => setFollowingViewMode('feed')}
              sx={{
                backgroundColor: followingViewMode === 'feed' ? '#1D9BF0' : 'transparent',
                color: followingViewMode === 'feed' ? '#FFFFFF' : '#1D9BF0',
                borderColor: '#1D9BF0',
                '&:hover': {
                  backgroundColor: followingViewMode === 'feed' ? '#1A8CD8' : 'rgba(29, 155, 240, 0.1)'
                }
              }}
            >
              Feed
            </Button>
          </Box>
        )}
      </Tabs>
    </Card>
  </Box>
)}

{/* Following Posts Section - Show when no search results */}
{searchResults.length === 0 && followingPosts.length > 0 && (
  <Box sx={{ mb: 4, px: { xs: 2, sm: 3, md: 3 } }}>
    <Typography variant="h6" sx={{ color: '#E7E9EA', fontWeight: 600, mb: 2 }}>
      Following Posts ({sortedFollowingPosts.length})
    </Typography>

    {/* Cards View */}
    {followingViewMode === 'cards' && (
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 3,
        maxWidth: '100%', 
        mx: 'auto',
        overflow: 'hidden'
      }}>
              {sortedFollowingPosts.map((post) => (
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
            <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Media Gallery - prefer uploaded attachments; fallback to first image(s) in content */}
              {post.attachments && post.attachments.length > 0 && (
                <MediaGallery attachments={post.attachments} maxHeight={180} />
              )}
              {(!post.attachments || post.attachments.length === 0) && (
                <>
                  {(() => {
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
                            onError={(e) => {
                              console.log('Image failed to load, falling back to direct URL:', url);
                              const img = e.currentTarget as HTMLImageElement;
                              // Fallback to direct WordPress URL if proxy fails
                              if (url.includes('cmansrms.us') || url.includes('wordpress')) {
                                img.src = url.startsWith('http') ? url : `https://cmansrms.us${url.startsWith('/') ? url : `/${url}`}`;
                              } else {
                                img.style.display = 'none';
                              }
                            }}
                          />
                        ))}
                      </Box>
                    );
                  })()}
                </>
              )}
              
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
                    {highlightText(text.substring(0, 450))}...
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
                {post.wp_published_date && (
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
                )}
                {/* Comment Count Indicator */}
                {post.comment_count && post.comment_count > 0 && (
                  <Chip 
                    size="small" 
                    label={`💬 ${post.comment_count}`}
                    color="secondary"
                    variant="filled"
                    sx={{ 
                      fontSize: '0.75rem',
                      backgroundColor: '#8B5CF6',
                      color: 'white',
                      '& .MuiChip-label': {
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px'
                      }
                    }}
                  />
                )}
              </Box>

              {/* Featured media preview */}
              {post.featured_media_url && (
                <Box sx={{ mb: 2 }}>
                  <img
                    src={resolveContentImageUrl(post.featured_media_url)}
                    alt="Featured media"
                    style={{ 
                      maxWidth: '100%', 
                      height: 'auto', 
                      borderRadius: '8px',
                      border: 'none'
                    }}
                    onLoad={() => console.log('Featured media loaded successfully (Dashboard):', post.featured_media_url)}
                  />
                </Box>
              )}

              {/* Action Buttons - Centered at bottom */}
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 'auto', pt: 1 }}>
                {/* Follow Button */}
                <FollowButton
                  postId={post.id}
                  variant="icon"
                  size="small"
                  onFollowChange={(isFollowing) => {
                    // Refresh the appropriate list when follow status changes
                    if (activeTab === 'following') {
                      if (isFollowing) {
                        // Post was followed, refresh the following list to include it
                        loadFollowingPosts();
                      } else {
                        // Remove from following list if unfollowed
                        setFollowingPosts(prev => prev.filter(p => p.id !== post.id));
                      }
                    }
                  }}
                />
                
                {/* Super Admin Delete Button */}
                <DeletePostButton
                  postId={post.id}
                  postTitle={post.title}
                  variant="icon"
                  size="small"
                  onDelete={(deletedPostId) => {
                    console.log(`Post ${deletedPostId} deleted from dashboard`);
                    // Remove the deleted post from the appropriate list
                    if (activeTab === 'following') {
                      setFollowingPosts(prev => prev.filter(p => p.id !== deletedPostId));
                    } else {
                      setManualPosts(prev => prev.filter(p => p.id !== deletedPostId));
                    }
                  }}
                />
                
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
                    color: '#ffffff',
                    '&:hover': {
                      backgroundColor: '#1a1a1a'
                    }
                  }}
                >
                  View Details
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Box>
      ))}
    </Box>
    )}

    {/* Twitter-Style Feed View */}
    {followingViewMode === 'feed' && (
      <Box sx={{ 
          maxWidth: { xs: '100%', sm: '100%', md: '900px' }, 
          mx: 'auto',
          px: { xs: 1, sm: 2, md: 0 },
          overflow: 'hidden', // Prevent horizontal scrolling
          width: '100%', // Ensure full width
          boxSizing: 'border-box' // Include padding in width calculation
        }}>
          {sortedFollowingPosts.map((post) => (
            <TwitterStylePostCard
              key={`feed-post-${post.id}`}
              post={post}
              onClick={handlePostClick}
              highlightText={(text) => text}
              onFollowChange={(postId, isFollowing) => {
                console.log(`Post ${postId} ${isFollowing ? 'followed' : 'unfollowed'}`);
                if (activeTab === 'following') {
                  if (isFollowing) {
                    loadFollowingPosts();
                  } else {
                    setFollowingPosts(prev => prev.filter(p => p.id !== postId));
                  }
                }
              }}
            />
          ))}
        </Box>
      )}
    </Box>
)}

{/* Loading State for Following Posts */}
{searchResults.length === 0 && activeTab === 'following' && followingLoading && (
  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
    <CircularProgress />
  </Box>
)}

{/* Empty State for Following Posts */}
{searchResults.length === 0 && activeTab === 'following' && !followingLoading && followingPosts.length === 0 && (
  <Box sx={{ textAlign: 'center', py: 8, px: { xs: 2, sm: 3, md: 3 } }}>
    <Typography variant="h6" sx={{ color: '#E7E9EA', mb: 2 }}>
      No followed posts found
    </Typography>
    <Typography variant="body2" sx={{ color: '#71767B' }}>
      Start following posts to see them here
    </Typography>
  </Box>
)}

{/* Loading State for Manual Posts */}
{searchResults.length === 0 && activeTab === 'all' && manualPostsLoading && (
  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
    <CircularProgress />
  </Box>
)}

{/* Empty State for Manual Posts */}
{searchResults.length === 0 && activeTab === 'all' && !manualPostsLoading && manualPosts.length === 0 && (
  <Box sx={{ textAlign: 'center', py: 8, px: { xs: 2, sm: 3, md: 3 } }}>
    <Typography variant="h6" sx={{ color: '#E7E9EA', mb: 2 }}>
      No posts found
    </Typography>
    <Typography variant="body2" sx={{ color: '#71767B' }}>
      Create your first post to get started
    </Typography>
  </Box>
)}

{/* Search Results Section */}
{searchResults.length > 0 && (
  <Box sx={{ mb: 4 }}>

    {/* Results Header */}
    <Typography variant="h5" sx={{ 
      color: '#1F2937', 
      mb: { xs: 2, sm: 3 }, 
      textAlign: 'center',
      fontWeight: 600,
      fontSize: { xs: '1.25rem', sm: '1.5rem', md: '1.75rem' },
      px: { xs: 2, sm: 0 }
    }}>
      Search Results ({searchResults.length})
    </Typography>

    {/* Results Grid */}
    <Box sx={{ 
      display: 'grid', 
      gap: { xs: 2, sm: 2, md: 3 }, 
      gridTemplateColumns: { 
        xs: 'repeat(1, 1fr)', 
        sm: 'repeat(auto-fit, minmax(280px, 1fr))', 
        md: 'repeat(auto-fit, minmax(300px, 1fr))' 
      }, 
      maxWidth: { xs: '100%', sm: '100%', md: '1200px' }, 
      mx: 'auto',
      px: { xs: 2, sm: 2, md: 0 }
    }}>
      {searchResults.map((post) => (
        <Card
          key={post.id}
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
          <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Media Gallery - prefer uploaded attachments; fallback to first image(s) in content */}
            {post.attachments && post.attachments.length > 0 && (
              <MediaGallery attachments={post.attachments} maxHeight={180} />
            )}
            {(!post.attachments || post.attachments.length === 0) && (
              <>
                {(() => {
                  const imageUrls = extractImageUrls(post.content).slice(0, 5);
                  if (imageUrls.length === 0) return null;
                  return (
                    <Box sx={{ 
                      mb: 2, 
                      display: 'flex', 
                      gap: { xs: 0.5, sm: 1 }, 
                      overflowX: 'auto', 
                      pb: 1,
                      px: { xs: 0.5, sm: 0 }
                    }}>
                      {imageUrls.map((url, idx) => (
                        <img
                          key={idx}
                          src={resolveContentImageUrl(url)}
                          alt={`Post image ${idx + 1}`}
                          style={{ 
                            width: window.innerWidth < 600 ? 120 : 160, 
                            height: window.innerWidth < 600 ? 90 : 120, 
                            objectFit: 'cover', 
                            borderRadius: '8px', 
                            flex: '0 0 auto' 
                          }}
                          onError={(e)=>{ (e.currentTarget as HTMLImageElement).style.display='none'; }}
                        />
                      ))}
                    </Box>
                  );
                })()}
              </>
            )}
            
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
                  {highlightText(text.substring(0, 450))}...
                </Typography>
              );
            })()}

            <Box sx={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: { xs: 0.25, sm: 0.5 }, 
              mb: 1 
            }}>
              {post.category_name && (
                <Chip 
                  size={window.innerWidth < 600 ? "medium" : "small"}
                  label={post.category_name} 
                  color="primary"
                  variant="outlined"
                  sx={{ 
                    fontSize: { xs: '0.875rem', sm: '0.75rem' },
                    height: { xs: '28px', sm: '24px' }
                  }}
                />
              )}
              <Chip 
                size={window.innerWidth < 600 ? "medium" : "small"}
                label={post.author_name} 
                variant="outlined"
                sx={{ 
                  borderColor: '#E5E7EB',
                  color: '#6B7280',
                  fontSize: { xs: '0.875rem', sm: '0.75rem' },
                  height: { xs: '28px', sm: '24px' }
                }}
              />
              <Chip 
                size={window.innerWidth < 600 ? "medium" : "small"}
                label={format(new Date(post.wp_published_date), 'MMM dd, yyyy')} 
                variant="outlined"
                sx={{ 
                  borderColor: '#E5E7EB',
                  color: '#6B7280',
                  fontSize: { xs: '0.875rem', sm: '0.75rem' },
                  height: { xs: '28px', sm: '24px' }
                }}
              />
              {/* Comment Count Indicator */}
              {post.comment_count && post.comment_count > 0 && (
                <Chip 
                  size={window.innerWidth < 600 ? "medium" : "small"}
                  label={`💬 ${post.comment_count}`}
                  color="secondary"
                  variant="filled"
                  sx={{ 
                    fontSize: { xs: '0.875rem', sm: '0.75rem' },
                    backgroundColor: '#8B5CF6',
                    color: 'white',
                    height: { xs: '28px', sm: '24px' },
                    '& .MuiChip-label': {
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px'
                    }
                  }}
                />
              )}
            </Box>

            {/* Media attachments preview */}
            {post.featured_media_url && (
              <Box sx={{ mb: 2 }}>
                                 <img 
                   src={resolveContentImageUrl(post.featured_media_url)}
                   alt="Featured media"
                   style={{ maxWidth: '100%', maxHeight: '150px', objectFit: 'cover', borderRadius: '4px' }}
                   onError={(e) => {
                     console.log('Featured media failed to load, falling back to direct URL:', post.featured_media_url);
                     const img = e.currentTarget as HTMLImageElement;
                     // Fallback to direct WordPress URL if proxy fails
                     if (post.featured_media_url && (post.featured_media_url.includes('cmansrms.us') || post.featured_media_url.includes('wordpress'))) {
                       img.src = post.featured_media_url.startsWith('http') ? post.featured_media_url : `https://cmansrms.us${post.featured_media_url.startsWith('/') ? post.featured_media_url : `/${post.featured_media_url}`}`;
                     }
                   }}
                 />
              </Box>
            )}

            {/* Action Buttons - Centered at bottom */}
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              gap: { xs: 0.5, sm: 1 }, 
              mt: 'auto', 
              pt: 1,
              flexDirection: { xs: 'column', sm: 'row' }
            }}>
              {(() => {
                const contentText = stripHtmlTags(post.content || '');
                const contentCount = countMatches(contentText, searchQuery);
                const showCount = contentCount > 0;
                
                return showCount ? (
                  <Badge badgeContent={contentCount} color="secondary">
                    <Button
                      startIcon={<Visibility />}
                      size={window.innerWidth < 600 ? "medium" : "small"}
                      variant="contained"
                      fullWidth={window.innerWidth < 600}
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePostClick(post.id);
                      }}
                      sx={{
                        backgroundColor: '#000000',
                        color: '#ffffff',
                        fontSize: { xs: '14px', sm: '12px' },
                        px: { xs: 3, sm: 2 },
                        py: { xs: 1, sm: 0.5 },
                        '&:hover': {
                          backgroundColor: '#1a1a1a'
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
                      color: '#ffffff',
                      '&:hover': {
                        backgroundColor: '#1a1a1a'
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
                  sx={{
                    borderColor: '#2F3336',
                    color: '#E7E9EA',
                    '&:hover': {
                      borderColor: '#1D9BF0',
                      backgroundColor: 'rgba(29, 155, 240, 0.1)'
                    }
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