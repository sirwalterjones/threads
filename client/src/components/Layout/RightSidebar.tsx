import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Chip,
  Divider,
  Button,
  IconButton
} from '@mui/material';
import {
  Search as SearchIcon,
  TrendingUp,
  Person,
  Schedule,
  Visibility,
  Group,
  LocalFireDepartment,
  Comment as CommentIcon,
  LocalFireDepartment as HotListIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import apiService from '../../services/api';
import { Post, Category } from '../../types';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import TagCloud from '../TagCloud';

const RightSidebar: React.FC = () => {
  const [recentThreads, setRecentThreads] = useState<Post[]>([]);
  const [topCategories, setTopCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [hotListMatches, setHotListMatches] = useState<Set<number>>(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    loadSidebarData();
    
    // Auto-refresh every 2 minutes to show new posts
    const interval = setInterval(() => {
      loadSidebarData();
    }, 120000); // 2 minutes
    
    return () => clearInterval(interval);
  }, []);

  const loadSidebarData = async () => {
    try {
      setLoading(true);
      console.log('Loading sidebar data...');
      
      // Load recent threads - get ALL posts to ensure we have today's posts
      const recentResponse = await apiService.getPosts({
        limit: 200, // Get more posts to ensure we have today's
        sortBy: 'ingested_at',
        sortOrder: 'DESC'
      });
      
      console.log('Recent response:', recentResponse);
      
      if (recentResponse.posts && recentResponse.posts.length > 0) {
        console.log(`Found ${recentResponse.posts.length} posts`);
        
        // Sort posts by ingested_at date (newest first)
        const sortedPosts = recentResponse.posts.sort((a, b) => {
          const dateA = new Date(a.ingested_at || a.wp_published_date || 0);
          const dateB = new Date(b.ingested_at || b.wp_published_date || 0);
          return dateB.getTime() - dateA.getTime(); // Newest first
        });
        
        // Take the first 25 posts (most recent)
        const finalPosts = sortedPosts.slice(0, 25);
        console.log('Final posts to display:', finalPosts.length);
        console.log('First post:', finalPosts[0]);
        setRecentThreads(finalPosts);

        // Check which posts match hot lists
        await checkHotListMatches(finalPosts);
      } else {
        console.log('No posts found in response');
        setRecentThreads([]);
      }

      // Load top categories
      const categoriesResponse = await apiService.getCategories();
      
      // Remove duplicates by name and filter properly
      const uniqueCategories = categoriesResponse.reduce((acc: Category[], current) => {
        const exists = acc.find(cat => cat.name.toLowerCase() === current.name.toLowerCase());
        if (!exists && current.post_count > 0) {
          acc.push(current);
        }
        return acc;
      }, []);
      
      const sortedCategories = uniqueCategories
        .sort((a, b) => b.post_count - a.post_count)
        .slice(0, 4);
      setTopCategories(sortedCategories);
      
    } catch (error) {
      console.error('Failed to load sidebar data:', error);
      setRecentThreads([]);
    } finally {
      setLoading(false);
    }
  };

  const checkHotListMatches = async (posts: Post[]) => {
    try {
      // Get user's hot lists
      const hotListsResponse = await apiService.getHotLists();
      const hotLists = hotListsResponse.hotLists;
      
      if (hotLists.length === 0) {
        setHotListMatches(new Set());
        return;
      }

      // Check each post against hot list terms
      const matches = new Set<number>();
      
      for (const post of posts) {
        const searchableContent = `${post.title} ${post.content || ''} ${post.excerpt || ''}`.toLowerCase();
        
        for (const hotList of hotLists) {
          const searchWords = hotList.search_term.toLowerCase().split(/\s+/).filter(word => word.length > 0);
          const allWordsFound = searchWords.every(word => searchableContent.includes(word));
          
          if (allWordsFound) {
            matches.add(post.id);
            break; // Post matches at least one hot list
          }
        }
      }
      
      setHotListMatches(matches);
    } catch (error) {
      console.error('Failed to check hot list matches:', error);
      setHotListMatches(new Set());
    }
  };

  const handleThreadClick = (threadId: number) => {
    // Navigate to thread detail or trigger modal
    const evt = new CustomEvent('open-post-detail', { detail: { postId: threadId } });
    window.dispatchEvent(evt);
  };

  const handleCategoryClick = (categoryId: number) => {
    navigate(`/search?category=${categoryId}`);
  };

  return (
    <Box sx={{ 
      position: 'fixed', 
      top: '64px', // Position below header
      right: 0,
      width: '320px', // Fixed width for right sidebar
      height: 'calc(100vh - 64px)', // Subtract header height
      zIndex: 1200,
      pt: 1.5,
      maxHeight: '100vh',
      overflowY: 'auto', // Make entire sidebar scrollable
      backgroundColor: '#000000', // Ensure black background
      '&::-webkit-scrollbar': { width: '8px' },
      '&::-webkit-scrollbar-track': { background: '#16181C' },
      '&::-webkit-scrollbar-thumb': { background: '#2F3336', borderRadius: '4px' },
      '&::-webkit-scrollbar-thumb:hover': { background: '#3F4144' }
    }}>
      {/* Tag Cloud */}
      <Box sx={{ mb: 2, px: 2 }}>
        <TagCloud limit={20} title="Trending Tags" />
      </Box>

      {/* Recent Threads */}
      {!loading && recentThreads.length > 0 && (
      <Card 
        sx={{ 
          mb: 2, 
          backgroundColor: '#16181C', 
          border: 'none',
          borderRadius: 0,
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <CardContent sx={{ p: 0, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* Add Thread Button - Subtle and above Recent Threads header */}
          <Box sx={{ p: 1, pb: 0.5, display: 'flex', justifyContent: 'center' }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                const evt = new CustomEvent('open-new-post-modal');
                window.dispatchEvent(evt);
              }}
              sx={{
                borderRadius: '8px',
                borderColor: '#2F3336',
                color: '#E7E9EA',
                backgroundColor: 'rgba(29, 155, 240, 0.1)',
                fontSize: '11px',
                fontWeight: 500,
                px: 1.5,
                py: 0.5,
                minWidth: 'auto',
                textTransform: 'none',
                '&:hover': {
                  borderColor: '#1D9BF0',
                  backgroundColor: 'rgba(29, 155, 240, 0.2)',
                  color: '#1D9BF0'
                }
              }}
            >
              + Add Thread
            </Button>
          </Box>
          
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ 
              color: '#E7E9EA', 
              mb: 1, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' // Center the header
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Schedule sx={{ color: '#1D9BF0', fontSize: 16, mr: 1 }} />
                Recent Threads
              </Box>
              <IconButton 
                size="small" 
                onClick={loadSidebarData}
                sx={{ 
                  color: '#1DA1F2', 
                  '&:hover': { backgroundColor: 'rgba(29, 161, 242, 0.1)' },
                  ml: 1
                }}
                title="Refresh recent threads"
              >
                <TrendingUp fontSize="small" />
              </IconButton>
            </Typography>
          </Box>
          
          <List dense sx={{ 
            py: 0, 
            flex: 1, 
            overflowY: 'auto', 
            maxHeight: '400px', // Fixed height for recent threads list
            pr: 1, 
            minHeight: 0,
            WebkitOverflowScrolling: 'touch',
            '&::-webkit-scrollbar': { width: '8px' },
            '&::-webkit-scrollbar-track': { background: '#16181C' },
            '&::-webkit-scrollbar-thumb': { background: '#2F3336', borderRadius: '4px' },
            '&::-webkit-scrollbar-thumb:hover': { background: '#3F4144' }
          }}>
            {recentThreads.map((thread, index) => {
              const threadDate = new Date(thread.ingested_at || thread.wp_published_date);
              const currentHeader = isToday(threadDate) ? 'TODAY' : 
                                  isYesterday(threadDate) ? 'YESTERDAY' : 
                                  format(threadDate, 'MMM d');
              
              const previousThread = index > 0 ? recentThreads[index - 1] : null;
              const previousDate = previousThread ? new Date(previousThread.ingested_at || previousThread.wp_published_date) : null;
              const previousHeader = previousDate ? 
                (isToday(previousDate) ? 'TODAY' : 
                 isYesterday(previousDate) ? 'YESTERDAY' : 
                 format(previousDate, 'MMM d')) : '';
              
              const showHeader = currentHeader !== previousHeader;
              
              return (
                <Box key={thread.id}>
                  {showHeader && (
                    <Box sx={{ 
                      px: 1.25, 
                      pt: 1, 
                      pb: 0.5, 
                      position: 'sticky', 
                      top: 0, 
                      backgroundColor: '#16181C', 
                      zIndex: 1 
                    }}>
                      <Typography sx={{ 
                        color: '#1D9BF0', 
                        fontWeight: 700, 
                        fontSize: '12px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        {currentHeader}
                      </Typography>
                      <Box sx={{ mt: 0.5, height: '1px', backgroundColor: '#2F3336', width: '100%' }} />
                    </Box>
                  )}
                  <ListItem disablePadding>
                    <ListItemButton
                      onClick={() => handleThreadClick(thread.id)}
                      sx={{
                        py: 0.75,
                        px: 1,
                        '&:hover': {
                          backgroundColor: '#1C1F23'
                        }
                      }}
                    >
                      <ListItemText
                        primary={
                          <Typography sx={{ 
                            color: '#E7E9EA', 
                            fontWeight: 500, 
                            fontSize: '13px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {thread.title}
                          </Typography>
                        }
                        secondary={
                          <Typography sx={{ 
                            color: '#71767B', 
                            fontSize: '11px' 
                          }}>
                            @{thread.author_name} · {formatDistanceToNow(threadDate, { addSuffix: true })}
                          </Typography>
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                </Box>
              );
            })}
          </List>
          
          <Box sx={{ p: 1.25, pt: 1 }}>
            <Button
              fullWidth
              sx={{
                color: '#1D9BF0',
                textTransform: 'none',
                fontWeight: 400,
                fontSize: '12px',
                justifyContent: 'center',
                '&:hover': {
                  backgroundColor: 'transparent',
                  textDecoration: 'underline'
                }
              }}
              onClick={() => navigate('/search')}
            >
              Show more threads
            </Button>
          </Box>
        </CardContent>
      </Card>
      )}

    </Box>
  );
};

export default RightSidebar;