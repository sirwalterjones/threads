import React, { useState, KeyboardEvent, ChangeEvent } from 'react';
import {
  Box,
  Chip,
  TextField,
  InputAdornment,
  Typography,
  Autocomplete,
  Paper
} from '@mui/material';
import { Tag as TagIcon, Add } from '@mui/icons-material';

interface TagInputProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  maxTags?: number;
  placeholder?: string;
  helperText?: string;
  existingTags?: string[]; // For autocomplete suggestions
}

const TagInput: React.FC<TagInputProps> = ({
  tags,
  onTagsChange,
  maxTags = 10,
  placeholder = 'Add tags (e.g., #canton, #news)',
  helperText = 'Press Enter or comma to add a tag',
  existingTags = []
}) => {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');

  const processTag = (tag: string): string => {
    // Remove whitespace and ensure it starts with #
    let processed = tag.trim().toLowerCase();
    if (processed && !processed.startsWith('#')) {
      processed = '#' + processed;
    }
    // Remove any invalid characters (keep only alphanumeric, underscore)
    processed = processed.replace(/[^#a-z0-9_]/g, '');
    return processed;
  };

  const handleAddTag = (tagToAdd: string) => {
    const processedTag = processTag(tagToAdd);
    
    if (!processedTag || processedTag === '#') {
      return;
    }

    if (tags.length >= maxTags) {
      setError(`Maximum ${maxTags} tags allowed`);
      return;
    }

    if (tags.includes(processedTag)) {
      setError('Tag already exists');
      return;
    }

    if (processedTag.length > 30) {
      setError('Tag too long (max 30 characters)');
      return;
    }

    onTagsChange([...tags, processedTag]);
    setInputValue('');
    setError('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onTagsChange(tags.filter(tag => tag !== tagToRemove));
    setError('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (inputValue.trim()) {
        handleAddTag(inputValue);
      }
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      // Remove last tag when backspace is pressed with empty input
      handleRemoveTag(tags[tags.length - 1]);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // If user types comma, add the tag
    if (value.includes(',')) {
      const tagValue = value.replace(',', '').trim();
      if (tagValue) {
        handleAddTag(tagValue);
      }
    } else {
      setInputValue(value);
      setError('');
    }
  };

  // Generate suggestions from existing tags
  const suggestions = existingTags.filter(
    tag => !tags.includes(tag) && tag.toLowerCase().includes(inputValue.toLowerCase())
  );

  return (
    <Box sx={{ width: '100%' }}>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1,
          p: 1.5,
          border: '1px solid',
          borderColor: error ? 'error.main' : 'divider',
          borderRadius: 1,
          backgroundColor: 'background.paper',
          minHeight: 56,
          '&:hover': {
            borderColor: error ? 'error.main' : 'primary.main',
          },
          '&:focus-within': {
            borderColor: error ? 'error.main' : 'primary.main',
            borderWidth: 2,
            p: 'calc(12px - 1px)', // Adjust padding to account for border width
          },
        }}
      >
        {tags.map((tag) => (
          <Chip
            key={tag}
            label={tag}
            onDelete={() => handleRemoveTag(tag)}
            size="small"
            sx={{
              backgroundColor: 'primary.main',
              color: 'primary.contrastText',
              '&:hover': {
                backgroundColor: 'primary.dark',
              },
              '& .MuiChip-deleteIcon': {
                color: 'primary.contrastText',
                '&:hover': {
                  color: 'inherit',
                },
              },
            }}
          />
        ))}
        <TextField
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? placeholder : 'Add more...'}
          variant="standard"
          size="small"
          sx={{
            flex: 1,
            minWidth: 150,
            '& .MuiInput-underline:before': {
              borderBottom: 'none',
            },
            '& .MuiInput-underline:hover:before': {
              borderBottom: 'none',
            },
            '& .MuiInput-underline:after': {
              borderBottom: 'none',
            },
          }}
          InputProps={{
            startAdornment: tags.length === 0 && (
              <InputAdornment position="start">
                <TagIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
              </InputAdornment>
            ),
          }}
        />
      </Box>
      
      {/* Suggestions dropdown */}
      {inputValue && suggestions.length > 0 && (
        <Paper
          elevation={3}
          sx={{
            mt: 1,
            p: 1,
            maxHeight: 200,
            overflow: 'auto',
            position: 'absolute',
            zIndex: 1000,
            minWidth: 200,
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>
            Suggestions
          </Typography>
          {suggestions.slice(0, 5).map((suggestion) => (
            <Box
              key={suggestion}
              onClick={() => {
                handleAddTag(suggestion);
              }}
              sx={{
                p: 1,
                cursor: 'pointer',
                borderRadius: 1,
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
              }}
            >
              <Chip
                label={suggestion}
                size="small"
                variant="outlined"
                sx={{ cursor: 'pointer' }}
              />
            </Box>
          ))}
        </Paper>
      )}

      {/* Helper text or error */}
      <Box sx={{ mt: 1, minHeight: 20 }}>
        {error ? (
          <Typography variant="caption" color="error">
            {error}
          </Typography>
        ) : (
          <Typography variant="caption" color="text.secondary">
            {helperText} ({tags.length}/{maxTags} tags)
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default TagInput;