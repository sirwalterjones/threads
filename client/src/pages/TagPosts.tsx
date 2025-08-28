import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  CircularProgress,
  IconButton,
  Chip,
  Paper,
  Button
} from '@mui/material';
import { ArrowBack, Tag as TagIcon } from '@mui/icons-material';
import apiService from '../services/api';
import { Post } from '../types';
import TwitterStylePostCard from '../components/TwitterStylePostCard';
import PostDetailModal from '../components/PostDetailModal';

const TagPosts: React.FC = () => {
  const { tagName } = useParams<{ tagName: string }>();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  
  // Decode the tag name (in case it has special characters)
  const decodedTag = tagName ? decodeURIComponent(tagName) : '';
  
  useEffect(() => {
    if (decodedTag) {
      loadPostsByTag();
    }
  }, [decodedTag]);

  const loadPostsByTag = async () => {
    try {
      setLoading(true);
      // Use the tag-specific endpoint
      const response = await apiService.getPostsByTag(decodedTag, 1, 50);
      setPosts(response.posts || []);
    } catch (error) {
      console.error('Failed to load posts by tag:', error);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePostClick = (postId: number) => {
    setSelectedPostId(postId);
    setModalOpen(true);
  };

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <Box sx={{ 
      minHeight: '100vh',
      backgroundColor: '#000',
      color: '#E7E9EA'
    }}>
      {/* Header */}
      <Paper 
        elevation={0}
        sx={{ 
          position: 'sticky',
          top: 0,
          zIndex: 100,
          backgroundColor: 'rgba(0, 0, 0, 0.95)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid #2F3336',
          borderRadius: 0
        }}
      >
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 2,
          p: 2
        }}>
          <IconButton 
            onClick={handleBack}
            sx={{ 
              color: '#E7E9EA',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.1)'
              }
            }}
          >
            <ArrowBack />
          </IconButton>
          
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TagIcon sx={{ color: '#1D9BF0' }} />
              <Typography variant="h5" sx={{ fontWeight: 600, color: '#E7E9EA' }}>
                {decodedTag}
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: '#71767B', mt: 0.5 }}>
              {loading ? 'Loading...' : `${posts.length} ${posts.length === 1 ? 'thread' : 'threads'}`}
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Content */}
      <Box sx={{ maxWidth: 800, mx: 'auto', p: { xs: 1, sm: 2 } }}>
        {loading ? (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            minHeight: 300 
          }}>
            <CircularProgress />
          </Box>
        ) : posts.length === 0 ? (
          <Paper
            elevation={0}
            sx={{
              p: 4,
              textAlign: 'center',
              backgroundColor: '#16181C',
              border: '1px solid #2F3336',
              borderRadius: 2
            }}
          >
            <TagIcon sx={{ fontSize: 64, color: '#2F3336', mb: 2 }} />
            <Typography variant="h6" sx={{ color: '#E7E9EA', mb: 1 }}>
              No threads found with {decodedTag}
            </Typography>
            <Typography variant="body2" sx={{ color: '#71767B', mb: 3 }}>
              Be the first to create a thread with this tag!
            </Typography>
            <Button
              variant="contained"
              onClick={() => navigate('/')}
              sx={{
                backgroundColor: '#1D9BF0',
                '&:hover': {
                  backgroundColor: '#1A91DA'
                }
              }}
            >
              Back to Dashboard
            </Button>
          </Paper>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {posts.map((post) => (
              <TwitterStylePostCard
                key={post.id}
                post={post}
                onClick={handlePostClick}
                highlightText={(text) => text}
                onFollowChange={(postId, isFollowing) => {
                  // Update local state if needed
                  console.log(`Post ${postId} follow state changed to ${isFollowing}`);
                }}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* Post Detail Modal */}
      {selectedPostId && (
        <PostDetailModal
          postId={selectedPostId}
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelectedPostId(null);
          }}
        />
      )}
    </Box>
  );
};

export default TagPosts;