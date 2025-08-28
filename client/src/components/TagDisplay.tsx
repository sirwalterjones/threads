import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Chip, Typography } from '@mui/material';
import { Tag as TagIcon, LocalOffer } from '@mui/icons-material';

interface TagDisplayProps {
  tags: string[];
  onTagClick?: (tag: string) => void;
  size?: 'small' | 'medium';
  maxDisplay?: number;
  showIcon?: boolean;
  variant?: 'filled' | 'outlined';
}

const TagDisplay: React.FC<TagDisplayProps> = ({
  tags,
  onTagClick,
  size = 'small',
  maxDisplay = 5,
  showIcon = false,
  variant = 'filled'
}) => {
  const navigate = useNavigate();
  
  if (!tags || tags.length === 0) {
    return null;
  }

  const displayTags = tags.slice(0, maxDisplay);
  const remainingCount = tags.length - maxDisplay;
  
  const handleTagClick = (tag: string) => {
    if (onTagClick) {
      onTagClick(tag);
    } else {
      // Navigate to tag page by default
      navigate(`/tags/${encodeURIComponent(tag)}`);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 0.5,
        alignItems: 'center',
      }}
    >
      {showIcon && (
        <LocalOffer sx={{ fontSize: 16, color: 'text.secondary', mr: 0.5 }} />
      )}
      
      {displayTags.map((tag) => (
        <Chip
          key={tag}
          label={tag}
          size={size}
          variant={variant}
          onClick={() => handleTagClick(tag)}
          sx={{
            backgroundColor: variant === 'filled' ? 'rgba(29, 155, 240, 0.1)' : 'transparent',
            color: '#1D9BF0',
            borderColor: '#1D9BF0',
            fontSize: size === 'small' ? '0.75rem' : '0.875rem',
            height: size === 'small' ? 20 : 24,
            cursor: 'pointer',
            '&:hover': {
              backgroundColor: 'rgba(29, 155, 240, 0.2)',
              borderColor: '#1D9BF0',
            },
            '& .MuiChip-label': {
              px: 1,
              fontWeight: 500,
            },
          }}
        />
      ))}
      
      {remainingCount > 0 && (
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            ml: 0.5,
            alignSelf: 'center',
          }}
        >
          +{remainingCount} more
        </Typography>
      )}
    </Box>
  );
};

export default TagDisplay;