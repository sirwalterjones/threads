import React, { useState, useEffect } from 'react';
import {
  Box,
  Chip,
  IconButton,
  Typography,
  Popover,
  TextField,
  InputAdornment,
  Divider,
  Button,
  Badge
} from '@mui/material';
import {
  FilterList,
  Clear,
  Search,
  LocalOffer
} from '@mui/icons-material';

interface TagFilterProps {
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  availableTags: string[];
  showLabel?: boolean;
}

const TagFilter: React.FC<TagFilterProps> = ({
  selectedTags,
  onTagsChange,
  availableTags,
  showLabel = true
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [popularTags, setPopularTags] = useState<string[]>([]);

  useEffect(() => {
    // Get top 10 most used tags
    const tagCounts: { [key: string]: number } = {};
    availableTags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
    
    const sorted = Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([tag]) => tag);
    
    setPopularTags(sorted);
  }, [availableTags]);

  const handleOpenFilter = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseFilter = () => {
    setAnchorEl(null);
    setSearchTerm('');
  };

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter(t => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  const clearAll = () => {
    onTagsChange([]);
    handleCloseFilter();
  };

  const filteredTags = searchTerm
    ? availableTags.filter(tag => 
        tag.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : popularTags;

  const open = Boolean(anchorEl);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {showLabel && (
        <Typography variant="body2" color="text.secondary">
          Filter by tags:
        </Typography>
      )}

      {/* Selected tags display */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {selectedTags.map(tag => (
          <Chip
            key={tag}
            label={tag}
            size="small"
            onDelete={() => toggleTag(tag)}
            sx={{
              backgroundColor: 'rgba(29, 155, 240, 0.1)',
              color: '#1D9BF0',
              borderColor: '#1D9BF0',
              '& .MuiChip-deleteIcon': {
                color: '#1D9BF0',
                fontSize: 18,
                '&:hover': {
                  color: '#1A91DA',
                },
              },
            }}
          />
        ))}
      </Box>

      {/* Filter button */}
      <Badge badgeContent={selectedTags.length} color="primary">
        <IconButton
          onClick={handleOpenFilter}
          size="small"
          sx={{
            color: selectedTags.length > 0 ? 'primary.main' : 'text.secondary',
            backgroundColor: selectedTags.length > 0 ? 'rgba(29, 155, 240, 0.1)' : 'transparent',
            '&:hover': {
              backgroundColor: 'rgba(29, 155, 240, 0.2)',
            },
          }}
        >
          <FilterList />
        </IconButton>
      </Badge>

      {/* Filter popover */}
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleCloseFilter}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
      >
        <Box sx={{ p: 2, minWidth: 300, maxWidth: 400 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LocalOffer /> Filter by Tags
            </Typography>
            {selectedTags.length > 0 && (
              <Button
                size="small"
                onClick={clearAll}
                startIcon={<Clear />}
                sx={{ color: 'text.secondary' }}
              >
                Clear
              </Button>
            )}
          </Box>

          {/* Search input */}
          <TextField
            fullWidth
            size="small"
            placeholder="Search tags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            }}
          />

          <Divider sx={{ mb: 2 }} />

          {/* Tag list */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              {searchTerm ? 'Search Results' : 'Popular Tags'}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, maxHeight: 300, overflow: 'auto' }}>
              {filteredTags.length > 0 ? (
                filteredTags.map(tag => (
                  <Chip
                    key={tag}
                    label={tag}
                    onClick={() => toggleTag(tag)}
                    variant={selectedTags.includes(tag) ? 'filled' : 'outlined'}
                    sx={{
                      backgroundColor: selectedTags.includes(tag) 
                        ? 'primary.main' 
                        : 'transparent',
                      color: selectedTags.includes(tag) 
                        ? 'primary.contrastText' 
                        : 'primary.main',
                      borderColor: 'primary.main',
                      cursor: 'pointer',
                      '&:hover': {
                        backgroundColor: selectedTags.includes(tag)
                          ? 'primary.dark'
                          : 'rgba(29, 155, 240, 0.1)',
                      },
                    }}
                  />
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No tags found
                </Typography>
              )}
            </Box>
          </Box>
        </Box>
      </Popover>
    </Box>
  );
};

export default TagFilter;