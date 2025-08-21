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
  ListItemAvatar,
  Avatar,
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
import { format, formatDistanceToNow } from 'date-fns';

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
      setRecentThreads(recentResponse.posts);

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
      overflowY: 'auto',
      '&::-webkit-scrollbar': {
        width: '8px',
      },
      '&::-webkit-scrollbar-track': {
        background: '#16181C',
      },
      '&::-webkit-scrollbar-thumb': {
        background: '#2F3336',
        borderRadius: '4px',
      },
      '&::-webkit-scrollbar-thumb:hover': {
        background: '#3F4144',
      },
    }}>
      {/* Recent Threads - Full Height */}
      {!loading && recentThreads.length > 0 && (
      <Card 
        sx={{ 
          mb: 2, 
          backgroundColor: '#16181C', 
          border: 'none',
          borderRadius: 4,
          height: 'calc(100vh - 100px)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <CardContent sx={{ p: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
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
              Recent Vector
            </Typography>
          </Box>
          
          <List dense sx={{ py: 0, flex: 1, overflowY: 'auto' }}>
            {recentThreads.map((thread) => (
              <ListItem key={thread.id} disablePadding>
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
                  <ListItemAvatar sx={{ minWidth: 36 }}>
                    <Avatar sx={{ 
                      width: 24, 
                      height: 24,
                      backgroundColor: '#1D9BF0',
                      fontSize: '11px'
                    }}>
                      {thread.author_name[0]?.toUpperCase()}
                    </Avatar>
                  </ListItemAvatar>
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
            ))}
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