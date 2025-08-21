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
  LocalFireDepartment
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import apiService from '../../services/api';
import { Post, Category } from '../../types';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';

const RightSidebar: React.FC = () => {
  const [recentThreads, setRecentThreads] = useState<Post[]>([]);
  const [topCategories, setTopCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadSidebarData();
  }, []);

  const loadSidebarData = async () => {
    try {
      setLoading(true);
      
      // Load recent threads
      const recentResponse = await apiService.getPosts({
        limit: 50, // Increased to show more threads in the full sidebar
        sortBy: 'wp_published_date',
        sortOrder: 'DESC'
      });
      
      // Sort posts by published date (newest first) since backend sorting is temporarily disabled
      const sortedPosts = recentResponse.posts.sort((a, b) => {
        const dateA = new Date(a.wp_published_date || a.ingested_at || 0);
        const dateB = new Date(b.wp_published_date || b.ingested_at || 0);
        return dateB.getTime() - dateA.getTime(); // Newest first
      });
      
      setRecentThreads(sortedPosts);

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
        .slice(0, 4); // Reduced to 4 to avoid clutter
      setTopCategories(sortedCategories);
      
    } catch (error) {
      console.error('Failed to load sidebar data:', error);
    } finally {
      setLoading(false);
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
      position: 'sticky', 
      top: 0, 
      pt: 1.5,
      maxHeight: '100vh',
      overflow: 'visible'
    }}>
      {/* Recent Threads - Full Height */}
      {!loading && recentThreads.length > 0 && (
      <Card 
        sx={{ 
          mb: 2, 
          backgroundColor: '#16181C', 
          border: 'none',
          borderRadius: 0,
          height: 'calc(100vh - 100px)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <CardContent sx={{ p: 0, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Box sx={{ p: 1, pb: 0.5 }}>
            <Typography variant="body2" sx={{ 
              color: '#E7E9EA', 
              fontWeight: 700, 
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              textAlign: 'center',
              justifyContent: 'center'
            }}>
              <Schedule sx={{ color: '#1D9BF0', fontSize: 16 }} />
              Recent Threads
            </Typography>
          </Box>
          
          <List dense sx={{ 
            py: 0, 
            flex: 1, 
            overflowY: 'auto', 
            maxHeight: '100%', 
            pr: 1, 
            minHeight: 0,
            WebkitOverflowScrolling: 'touch',
            '&::-webkit-scrollbar': { width: '8px' },
            '&::-webkit-scrollbar-track': { background: '#16181C' },
            '&::-webkit-scrollbar-thumb': { background: '#2F3336', borderRadius: '4px' },
            '&::-webkit-scrollbar-thumb:hover': { background: '#3F4144' }
          }}>
            {recentThreads.map((thread, index) => {
              const dt = new Date(thread.wp_published_date);
              const header = isToday(dt) ? 'Today' : (isYesterday(dt) ? 'Yesterday' : format(dt, 'MMM d'));
              const prev = index > 0 ? (() => { const pdt = new Date(recentThreads[index-1].wp_published_date); return isToday(pdt) ? 'Today' : (isYesterday(pdt) ? 'Yesterday' : format(pdt, 'MMM d')); })() : '';
              return (
              <Box key={thread.id}>
                {header !== prev && (
                  <Box sx={{ px: 1.25, pt: 0.75, pb: 0.25, position: 'sticky', top: 0, backgroundColor: '#16181C', zIndex: 1 }}>
                    <Typography sx={{ color: '#E7E9EA', fontWeight: 700, fontSize: '12px' }}>
                      {header}
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
                        @{thread.author_name} · {formatDistanceToNow(new Date(thread.wp_published_date), { addSuffix: true })}
                      </Typography>
                    }
                  />
                </ListItemButton>
              </ListItem>
              </Box>
            );})}
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