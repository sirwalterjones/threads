import React, { useState, useEffect } from 'react';
import {
  IconButton,
  Tooltip,
  CircularProgress,
  Chip
} from '@mui/material';
import {
  Bookmark,
  BookmarkBorder,
  Favorite,
  FavoriteBorder
} from '@mui/icons-material';
import apiService from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface FollowButtonProps {
  postId: number;
  variant?: 'icon' | 'chip';
  size?: 'small' | 'medium' | 'large';
  initialFollowState?: boolean;
  onFollowChange?: (isFollowing: boolean) => void;
  showTooltip?: boolean;
}

const FollowButton: React.FC<FollowButtonProps> = ({
  postId,
  variant = 'icon',
  size = 'medium',
  initialFollowState,
  onFollowChange,
  showTooltip = true
}) => {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(initialFollowState || false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialFollowState !== undefined) {
      setIsFollowing(initialFollowState);
    } else if (user) {
      // Check initial follow status
      checkFollowStatus();
    }
  }, [postId, user, initialFollowState]);

  const checkFollowStatus = async () => {
    try {
      console.log('Checking follow status for post:', postId);
      const response = await apiService.getFollowStatus([postId]);
      console.log('Follow status response:', response);
      setIsFollowing(response.follows[postId] || false);
    } catch (error) {
      console.error('Error checking follow status:', error);
    }
  };

  const handleToggleFollow = async (event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }
    
    if (!user || loading) {
      console.log('Follow button clicked but user not logged in or already loading:', { user: !!user, loading });
      return;
    }

    console.log('Attempting to toggle follow for post:', postId, 'Current state:', isFollowing);
    setLoading(true);
    
    // Add client-side timeout
    const timeoutId = setTimeout(() => {
      console.log('Client-side timeout reached for post:', postId);
      setLoading(false);
    }, 15000); // 15 second timeout
    
    try {
      if (isFollowing) {
        console.log('Unfollowing post:', postId);
        const response = await apiService.unfollowPost(postId);
        console.log('Unfollow response:', response);
        setIsFollowing(false);
        onFollowChange?.(false);
      } else {
        console.log('Following post:', postId);
        console.log('About to call apiService.followPost...');
        const response = await apiService.followPost(postId);
        console.log('Follow response received:', response);
        setIsFollowing(true);
        onFollowChange?.(true);
      }
    } catch (error) {
      console.error('Error toggling follow status:', error);
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as any;
        console.error('Error details:', {
          message: axiosError.message,
          response: axiosError.response?.data,
          status: axiosError.response?.status,
          statusText: axiosError.response?.statusText
        });
      }
    } finally {
      clearTimeout(timeoutId);
      console.log('Setting loading to false');
      setLoading(false);
    }
  };

  if (!user) return null;

  const followedColor = '#1D9BF0';
  const unFollowedColor = '#71767B';

  if (variant === 'chip') {
    return (
      <Chip
        icon={loading ? (
          <CircularProgress size={16} sx={{ color: 'inherit' }} />
        ) : isFollowing ? (
          <Bookmark />
        ) : (
          <BookmarkBorder />
        )}
        label={isFollowing ? 'Following' : 'Follow'}
        onClick={handleToggleFollow}
        disabled={loading}
        size={size as 'small' | 'medium'}
        variant={isFollowing ? 'filled' : 'outlined'}
        sx={{
          color: isFollowing ? '#FFFFFF' : '#E7E9EA',
          backgroundColor: isFollowing ? followedColor : 'transparent',
          borderColor: isFollowing ? followedColor : '#2F3336',
          '&:hover': {
            backgroundColor: isFollowing ? '#1A91DA' : 'rgba(29, 155, 240, 0.1)',
            borderColor: followedColor,
          },
          '&.Mui-disabled': {
            color: '#71767B',
            borderColor: '#2F3336',
          },
          '& .MuiChip-icon': {
            color: 'inherit',
          },
        }}
      />
    );
  }

  const button = (
    <IconButton
      onClick={handleToggleFollow}
      disabled={loading}
      size={size}
      sx={{
        color: isFollowing ? followedColor : unFollowedColor,
        '&:hover': {
          backgroundColor: isFollowing ? 
            'rgba(29, 155, 240, 0.1)' : 
            'rgba(29, 155, 240, 0.1)',
          color: followedColor,
        },
        '&.Mui-disabled': {
          color: '#71767B',
        },
      }}
    >
      {loading ? (
        <CircularProgress size={size === 'small' ? 16 : 20} sx={{ color: 'inherit' }} />
      ) : isFollowing ? (
        <Bookmark />
      ) : (
        <BookmarkBorder />
      )}
    </IconButton>
  );

  if (showTooltip) {
    return (
      <Tooltip title={isFollowing ? 'Unfollow this post' : 'Follow this post'}>
        {button}
      </Tooltip>
    );
  }

  return button;
};

export default FollowButton;