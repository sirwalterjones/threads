import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Chip,
  CircularProgress,
  Paper
} from '@mui/material';
import { Tag as TagIcon } from '@mui/icons-material';
import apiService from '../services/api';

interface TagWithCount {
  tag: string;
  count: number;
}

interface TagCloudProps {
  limit?: number;
  title?: string;
}

const TagCloud: React.FC<TagCloudProps> = ({ 
  limit = 15, 
  title = 'Popular Tags' 
}) => {
  const navigate = useNavigate();
  const [tags, setTags] = useState<TagWithCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPopularTags();
  }, [limit]);

  const loadPopularTags = async () => {
    try {
      setLoading(true);
      const response = await apiService.getPopularTags(limit);
      console.log('Popular tags raw response:', response);
      console.log('Response type:', typeof response);
      console.log('Is Array:', Array.isArray(response));
      
      // Handle both array and object responses
      let popularTags: TagWithCount[] = [];
      if (Array.isArray(response)) {
        popularTags = response;
        console.log('Response is already an array');
      } else if (response && typeof response === 'object') {
        // If it's an object with a tags property
        const responseObj = response as any;
        console.log('Response object keys:', Object.keys(responseObj));
        
        if (responseObj.tags && Array.isArray(responseObj.tags)) {
          popularTags = responseObj.tags;
          console.log('Found tags in response.tags:', popularTags);
        } else if (responseObj.popularTags && Array.isArray(responseObj.popularTags)) {
          popularTags = responseObj.popularTags;
          console.log('Found tags in response.popularTags:', popularTags);
        } else {
          console.warn('Unexpected response format for popular tags:', response);
          popularTags = [];
        }
      }
      
      console.log('Final popularTags array:', popularTags);
      console.log('Number of tags:', popularTags.length);
      
      setTags(popularTags);
    } catch (error) {
      console.error('Failed to load popular tags:', error);
      setTags([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTagClick = (tag: string) => {
    navigate(`/tags/${encodeURIComponent(tag)}`);
  };

  // Calculate font size based on count (tag cloud effect)
  const getFontSize = (count: number, maxCount: number) => {
    const minSize = 0.75;
    const maxSize = 1.0;
    const ratio = count / maxCount;
    return minSize + (maxSize - minSize) * ratio;
  };

  const maxCount = Math.max(...tags.map(t => t.count), 1);

  if (loading) {
    return (
      <Paper sx={{ p: 2, backgroundColor: '#000000', border: '1px solid #2F3336' }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      </Paper>
    );
  }

  if (tags.length === 0) {
    return null;
  }

  return (
    <Paper sx={{ 
      p: 2, 
      backgroundColor: '#000000', 
      border: '1px solid #2F3336',
      borderRadius: 2
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <TagIcon sx={{ color: '#1D9BF0', mr: 1, fontSize: '1.2rem' }} />
        <Typography 
          variant="h6" 
          sx={{ 
            color: '#E7E9EA',
            fontSize: '1rem',
            fontWeight: 600
          }}
        >
          {title}
        </Typography>
      </Box>
      
      <Box sx={{ 
        display: 'flex', 
        flexWrap: 'wrap', 
        gap: 0.5,
        justifyContent: 'flex-start'
      }}>
        {tags.map((tagItem) => (
          <Chip
            key={tagItem.tag}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <span>{tagItem.tag}</span>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: '0.65rem'
                  }}
                >
                  ({tagItem.count})
                </Typography>
              </Box>
            }
            onClick={() => handleTagClick(tagItem.tag)}
            sx={{
              backgroundColor: 'rgba(29, 155, 240, 0.1)',
              color: '#1D9BF0',
              borderColor: '#1D9BF0',
              border: '1px solid',
              fontSize: `${getFontSize(tagItem.count, maxCount)}rem`,
              height: 'auto',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              '&:hover': {
                backgroundColor: 'rgba(29, 155, 240, 0.2)',
                transform: 'scale(1.05)',
                borderColor: '#1D9BF0',
              },
              '& .MuiChip-label': {
                px: 0.75,
                py: 0.25,
                fontWeight: tagItem.count > maxCount * 0.5 ? 500 : 400,
              },
            }}
          />
        ))}
      </Box>

      {tags.length === limit && (
        <Typography 
          variant="caption" 
          sx={{ 
            color: '#71767B',
            display: 'block',
            mt: 2,
            textAlign: 'center',
            fontSize: '0.75rem'
          }}
        >
          Showing top {limit} tags
        </Typography>
      )}
    </Paper>
  );
};

export default TagCloud;