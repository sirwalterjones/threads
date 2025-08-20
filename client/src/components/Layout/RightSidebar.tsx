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
        limit: 3, // Reduced to 3 to avoid clutter
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
      pt: 2,
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
      {/* Search Box */}
      <Card 
        sx={{ 
          mb: 4, 
          backgroundColor: '#16181C', 
          border: 'none',
          borderRadius: 4
        }}
      >
        <CardContent sx={{ p: 4 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#202327',
              borderRadius: 10,
              px: 4,
              py: 2,
              cursor: 'pointer',
              '&:hover': {
                backgroundColor: '#2C2F33'
              }
            }}
            onClick={() => navigate('/search')}
          >
            <SearchIcon sx={{ color: '#71767B', mr: 2 }} />
            <Typography sx={{ color: '#71767B', fontSize: '15px' }}>
              Search Threads
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Trending Categories */}
      {!loading && topCategories.length > 0 && (
        <Card 
          sx={{ 
            mb: 4, 
            backgroundColor: '#16181C', 
            border: 'none',
            borderRadius: 4
          }}
        >
          <CardContent sx={{ p: 0 }}>
            <Box sx={{ p: 4, pb: 3 }}>
              <Typography variant="h6" sx={{ 
                color: '#E7E9EA', 
                fontWeight: 700, 
                fontSize: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
                <LocalFireDepartment sx={{ color: '#FF6B35' }} />
                What's happening
              </Typography>
            </Box>
            
            <List sx={{ py: 0 }}>
              {topCategories.map((category, index) => (
              <ListItem key={category.id} disablePadding>
                <ListItemButton
                  onClick={() => handleCategoryClick(category.id)}
                  sx={{
                    py: 3,
                    px: 4,
                    '&:hover': {
                      backgroundColor: '#1C1F23'
                    }
                  }}
                >
                  <ListItemText
                    primary={
                      <Typography sx={{ 
                        color: '#E7E9EA', 
                        fontWeight: 700, 
                        fontSize: '16px' 
                      }}>
                        {category.name}
                      </Typography>
                    }
                    secondary={
                      <Typography sx={{ 
                        color: '#71767B', 
                        fontSize: '14px' 
                      }}>
                        {category.post_count > 1000 
                          ? `${(category.post_count / 1000).toFixed(1)}K threads`
                          : `${category.post_count} threads`
                        }
                      </Typography>
                    }
                  />
                  <Chip
                    label={`#${index + 1}`}
                    size="small"
                    sx={{
                      backgroundColor: '#1D9BF0',
                      color: 'white',
                      fontSize: '11px',
                      height: '20px',
                      minWidth: '24px'
                    }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
          
          <Box sx={{ p: 4, pt: 3 }}>
            <Button
              fullWidth
              sx={{
                color: '#1D9BF0',
                textTransform: 'none',
                fontWeight: 400,
                justifyContent: 'flex-start',
                pl: 0,
                '&:hover': {
                  backgroundColor: 'transparent',
                  textDecoration: 'underline'
                }
              }}
              onClick={() => navigate('/categories')}
            >
              Show more
            </Button>
          </Box>
        </CardContent>
      </Card>
      )}

      {/* Recent Activity */}
      {!loading && recentThreads.length > 0 && (
      <Card 
        sx={{ 
          mb: 4, 
          backgroundColor: '#16181C', 
          border: 'none',
          borderRadius: 4
        }}
      >
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ p: 2, pb: 1 }}>
            <Typography variant="h6" sx={{ 
              color: '#E7E9EA', 
              fontWeight: 700, 
              fontSize: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}>
              <Schedule sx={{ color: '#1D9BF0' }} />
              Recent Threads
            </Typography>
          </Box>
          
          <List sx={{ py: 0 }}>
            {recentThreads.map((thread) => (
              <ListItem key={thread.id} disablePadding>
                <ListItemButton
                  onClick={() => handleThreadClick(thread.id)}
                  sx={{
                    py: 3,
                    px: 4,
                    '&:hover': {
                      backgroundColor: '#1C1F23'
                    }
                  }}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ 
                      width: 32, 
                      height: 32,
                      backgroundColor: '#1D9BF0',
                      fontSize: '12px'
                    }}>
                      {thread.author_name[0]?.toUpperCase()}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Typography sx={{ 
                        color: '#E7E9EA', 
                        fontWeight: 500, 
                        fontSize: '15px',
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
                        fontSize: '13px' 
                      }}>
                        @{thread.author_name} · {formatDistanceToNow(new Date(thread.wp_published_date), { addSuffix: true })}
                      </Typography>
                    }
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
          
          <Box sx={{ p: 4, pt: 3 }}>
            <Button
              fullWidth
              sx={{
                color: '#1D9BF0',
                textTransform: 'none',
                fontWeight: 400,
                justifyContent: 'flex-start',
                pl: 0,
                '&:hover': {
                  backgroundColor: 'transparent',
                  textDecoration: 'underline'
                }
              }}
              onClick={() => navigate('/search')}
            >
              Show more
            </Button>
          </Box>
        </CardContent>
      </Card>
      )}

      {/* Who to follow */}
      {!loading && recentThreads.length > 0 && (
      <Card 
        sx={{ 
          mb: 4, 
          backgroundColor: '#16181C', 
          border: 'none',
          borderRadius: 4
        }}
      >
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ p: 2, pb: 1 }}>
            <Typography variant="h6" sx={{ 
              color: '#E7E9EA', 
              fontWeight: 700, 
              fontSize: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}>
              <Group sx={{ color: '#1D9BF0' }} />
              Active Contributors
            </Typography>
          </Box>
          
          <List sx={{ py: 0 }}>
            {recentThreads
              .reduce((unique: Post[], thread) => {
                const exists = unique.find(t => t.author_name === thread.author_name);
                if (!exists) unique.push(thread);
                return unique;
              }, [])
              .slice(0, 3)
              .map((thread) => (
              <ListItem 
                key={`author-${thread.author_name}`}
                sx={{ py: 1.5, px: 2 }}
              >
                <ListItemAvatar>
                  <Avatar sx={{ 
                    width: 32, 
                    height: 32,
                    backgroundColor: '#1D9BF0',
                    fontSize: '12px'
                  }}>
                    {thread.author_name[0]?.toUpperCase()}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Typography sx={{ 
                      color: '#E7E9EA', 
                      fontWeight: 700, 
                      fontSize: '14px' 
                    }}>
                      {thread.author_name}
                    </Typography>
                  }
                  secondary={
                    <Typography sx={{ 
                      color: '#71767B', 
                      fontSize: '13px' 
                    }}>
                      @{thread.author_name.toLowerCase()}
                    </Typography>
                  }
                />
                <Button
                  variant="outlined"
                  size="small"
                  sx={{
                    borderColor: '#536471',
                    color: '#E7E9EA',
                    borderRadius: 10,
                    textTransform: 'none',
                    minWidth: '60px',
                    height: '28px',
                    fontSize: '13px',
                    fontWeight: 600,
                    '&:hover': {
                      borderColor: '#E7E9EA',
                      backgroundColor: 'rgba(231, 233, 234, 0.1)'
                    }
                  }}
                >
                  View
                </Button>
              </ListItem>
            ))}
          </List>
          
          <Box sx={{ p: 4, pt: 3 }}>
            <Button
              fullWidth
              sx={{
                color: '#1D9BF0',
                textTransform: 'none',
                fontWeight: 400,
                justifyContent: 'flex-start',
                pl: 0,
                '&:hover': {
                  backgroundColor: 'transparent',
                  textDecoration: 'underline'
                }
              }}
              onClick={() => navigate('/users')}
            >
              Show more
            </Button>
          </Box>
        </CardContent>
      </Card>
      )}

      {/* Footer */}
      <Box sx={{ px: 4, pb: 4 }}>
        <Typography sx={{ 
          color: '#536471', 
          fontSize: '13px',
          lineHeight: 1.3
        }}>
          Terms of Service Privacy Policy Cookie Policy
          <br />
          Accessibility Ads info More
          <br />
          © 2025 Threads Intel System
        </Typography>
      </Box>
    </Box>
  );
};

export default RightSidebar;