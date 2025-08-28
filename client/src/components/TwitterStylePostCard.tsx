import React, { ReactElement } from 'react';
import {
  Box,
  Typography,
  Avatar,
  IconButton,
  Divider
} from '@mui/material';
import {
  ChatBubbleOutline,
  Repeat,
  FavoriteBorder,
  Favorite,
  BookmarkBorder,
  Bookmark,
  MoreHoriz,
  Verified
} from '@mui/icons-material';
import { Post } from '../types';
import { format } from 'date-fns';
import MediaGallery from './MediaGallery';
import FollowButton from './FollowButton';
import TagDisplay from './TagDisplay';

interface TwitterStylePostCardProps {
  post: Post;
  onClick: (postId: number) => void;
  highlightText: (text: string) => React.ReactNode;
  onFollowChange?: (postId: number, isFollowing: boolean) => void;
}

const TwitterStylePostCard: React.FC<TwitterStylePostCardProps> = ({
  post,
  onClick,
  highlightText,
  onFollowChange
}) => {
  const stripHtmlTags = (html: string) => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  };

  const extractImageUrls = (html?: string): string[] => {
    if (!html) return [];
    try {
      const div = document.createElement('div');
      div.innerHTML = html;
      const imgs = Array.from(div.querySelectorAll('img'));
      return imgs
        .map(img => {
          let src = (img.getAttribute('src') || '').trim();
          if (!src) src = (img.getAttribute('data-src') || '').trim();
          if (!src) {
            const srcset = (img.getAttribute('srcset') || '').trim();
            if (srcset) {
              src = srcset.split(',')[0].trim().split(' ')[0];
            }
          }
          return src;
        })
        .filter(Boolean);
    } catch { return []; }
  };

  const resolveContentImageUrl = (rawUrl: string): string => {
    if (!rawUrl) return rawUrl;
    
    // If it's already a local file URL, return as-is
    if (rawUrl.startsWith('/api/files/')) {
      return rawUrl;
    }

    const remoteBase = (process.env.REACT_APP_WP_SITE_URL || 'https://cmansrms.us').replace(/\/$/, '');
    
    // If it's already a full URL, return as-is
    if (rawUrl.startsWith('http')) {
      return rawUrl;
    }
    
    // If it's a relative path, construct the full URL
    if (rawUrl.startsWith('/')) {
      return `${remoteBase}${rawUrl}`;
    }
    
    return `${remoteBase}/${rawUrl}`;
  };

  const handlePostClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick(post.id);
  };

  const handleComment = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick(post.id); // Open the post modal which will show comments
    
    // Wait for modal to open, then scroll to comment box
    setTimeout(() => {
      const commentBox = document.querySelector('textarea[placeholder*="Share your thoughts"]') as HTMLTextAreaElement;
      if (commentBox) {
        commentBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
        commentBox.focus();
      }
    }, 500);
  };

  const hasMedia = (post.attachments && post.attachments.length > 0) || 
                  post.featured_media_url || 
                  (post.content && extractImageUrls(post.content).length > 0);

  return (
    <Box
      sx={{
        backgroundColor: '#000000',
        borderBottom: '1px solid #2F3336',
        p: 3,
        cursor: 'pointer',
        transition: 'background-color 0.2s ease',
        overflow: 'hidden', // Prevent horizontal overflow
        maxWidth: '100%', // Ensure container doesn't exceed parent width
        boxSizing: 'border-box', // Include padding in width calculation
        '& mark': {
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
          maxWidth: '100%',
          display: 'inline-block'
        },
        '& *': {
          maxWidth: '100%',
          boxSizing: 'border-box',
          wordWrap: 'break-word',
          overflowWrap: 'break-word'
        },
        '&:hover': {
          backgroundColor: '#080808'
        }
      }}
      onClick={handlePostClick}
    >
      {/* Profile Section */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Avatar
          sx={{
            width: 48,
            height: 48,
            backgroundColor: '#1D9BF0',
            fontSize: '1.2rem',
            fontWeight: 'bold'
          }}
        >
          {post.author_name.charAt(0).toUpperCase()}
        </Avatar>
        
        <Box sx={{ 
          flex: 1, 
          minWidth: 0,
          maxWidth: '100%',
          overflow: 'hidden'
        }}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1, 
            mb: 0.5,
            maxWidth: '100%',
            overflow: 'hidden',
            flexWrap: 'wrap'
          }}>
            <Typography
              variant="body1"
              sx={{
                color: '#E7E9EA',
                fontWeight: 700,
                fontSize: '1rem',
                '&:hover': { textDecoration: 'underline' }
              }}
            >
              {post.author_name}
            </Typography>
            
            {/* Verified Badge */}
            <Verified sx={{ color: '#1D9BF0', fontSize: '1.2rem' }} />
            
            <Typography
              variant="body2"
              sx={{
                color: '#71767B',
                fontSize: '0.9rem'
              }}
            >
              @{post.author_name.toLowerCase().replace(/\s+/g, '')}
            </Typography>
            
            <Typography
              variant="body2"
              sx={{
                color: '#71767B',
                fontSize: '0.9rem'
              }}
            >
              ·
            </Typography>
            
            <Typography
              variant="body2"
              sx={{
                color: '#71767B',
                fontSize: '0.9rem'
              }}
            >
              {format(new Date(post.wp_published_date), 'MMM d')}
            </Typography>
          </Box>
          
          {post.category_name && (
            <Typography
              variant="body2"
              sx={{
                color: '#71767B',
                fontSize: '0.9rem'
              }}
            >
              {post.category_name}
            </Typography>
          )}
        </Box>
        
        <IconButton
          size="small"
          sx={{
            color: '#71767B',
            '&:hover': {
              backgroundColor: 'rgba(29, 155, 240, 0.1)',
              color: '#1D9BF0'
            }
          }}
        >
          <MoreHoriz />
        </IconButton>
      </Box>

      {/* Post Content */}
      <Box sx={{ 
        mb: 3,
        maxWidth: '100%',
        overflow: 'hidden',
        wordWrap: 'break-word'
      }}>
        <Typography
          variant="body1"
          sx={{
            color: '#E7E9EA',
            fontSize: '1.1rem',
            lineHeight: 1.5,
            mb: 2,
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
            hyphens: 'auto',
            maxWidth: '100%',
            width: '100%'
          }}
        >
          {highlightText(stripHtmlTags(post.title))}
        </Typography>
        
        {post.excerpt && (
          <Typography
            variant="body1"
            sx={{
              color: '#E7E9EA',
              fontSize: '1rem',
              lineHeight: 1.5,
              mb: 2,
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              hyphens: 'auto',
              maxWidth: '100%',
              width: '100%'
            }}
          >
            {highlightText(stripHtmlTags(post.excerpt))}
          </Typography>
        )}
        
        {!post.excerpt && post.content && (
          <Typography
            variant="body1"
            sx={{
              color: '#E7E9EA',
              fontSize: '1rem',
              lineHeight: 1.5,
              mb: 2,
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              hyphens: 'auto',
              maxWidth: '100%',
              width: '100%'
            }}
          >
            {post.content && highlightText(stripHtmlTags(post.content.substring(0, 280)))}
            {post.content && post.content.length > 280 && '...'}
          </Typography>
        )}
      </Box>

      {/* Tags Section */}
      {post.tags && post.tags.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <TagDisplay 
            tags={post.tags} 
            size="small"
            onTagClick={(tag) => {
              console.log('Tag clicked:', tag);
              // You can add navigation or filtering here
            }}
          />
        </Box>
      )}

      {/* Media Section */}
      {hasMedia && (
        <Box sx={{ 
          mb: 3, 
          borderRadius: 3, 
          overflow: 'hidden',
          maxWidth: '100%',
          width: '100%'
        }}>
          {post.attachments && post.attachments.length > 0 ? (
            <MediaGallery attachments={post.attachments} maxHeight={window.innerWidth < 600 ? 300 : 400} />
          ) : post.featured_media_url ? (
            <img
              src={resolveContentImageUrl(post.featured_media_url)}
              alt="Featured media"
              style={{
                width: '100%',
                height: 'auto',
                maxHeight: window.innerWidth < 600 ? 300 : 400,
                objectFit: 'cover',
                borderRadius: window.innerWidth < 600 ? '12px' : '16px'
              }}
            />
          ) : (
            <Box sx={{ 
              display: 'flex', 
              gap: 1, 
              overflow: 'hidden',
              flexWrap: 'nowrap'
            }}>
              {post.content && extractImageUrls(post.content).slice(0, 3).map((url, idx) => (
                <img
                  key={idx}
                  src={resolveContentImageUrl(url)}
                  alt={`Post image ${idx + 1}`}
                  style={{
                    width: window.innerWidth < 600 ? 150 : 200,
                    height: window.innerWidth < 600 ? 112 : 150,
                    objectFit: 'cover',
                    borderRadius: window.innerWidth < 600 ? '12px' : '16px',
                    flex: '0 0 auto'
                  }}
                />
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* Engagement Bar - Right side only */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 2 }}>
        {/* Comment Button */}
        <IconButton
          size="small"
          onClick={handleComment}
          sx={{
            color: '#71767B',
            '&:hover': {
              backgroundColor: 'rgba(29, 155, 240, 0.1)',
              color: '#1D9BF0'
            }
          }}
        >
          <ChatBubbleOutline sx={{ fontSize: '1.2rem' }} />
          {(post.comment_count || 0) > 0 && (
            <Box component="span" sx={{ ml: 0.5, fontSize: '0.8rem' }}>
              {post.comment_count || 0}
            </Box>
          )}
        </IconButton>
        
        {/* Follow Button */}
        <FollowButton
          postId={post.id}
          variant="chip"
          size="small"
          onFollowChange={(isFollowing) => {
            if (onFollowChange) {
              onFollowChange(post.id, isFollowing);
            }
          }}
        />
      </Box>
    </Box>
  );
};

export default TwitterStylePostCard;
