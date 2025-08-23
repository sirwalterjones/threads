import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Chip,
  IconButton
} from '@mui/material';
import {
  Close as CloseIcon,
  Person,
  DateRange,
  Category as CategoryIcon,
  Schedule
} from '@mui/icons-material';
import { Post } from '../types';
import apiService, { API_BASE_URL } from '../services/api';
import AttachmentViewerModal from './AttachmentViewerModal';
import Comments from './Comments/Comments';
import { format } from 'date-fns';
import DOMPurify from 'dompurify';

interface PostDetailModalProps {
  open: boolean;
  onClose: () => void;
  postId: number | null;
  highlightTerms?: string[]; // optional terms to highlight
}

const PostDetailModal: React.FC<PostDetailModalProps> = ({ open, onClose, postId, highlightTerms: termsProp }) => {
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<{ url: string; mime_type?: string | null; title?: string | null } | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  // Resolve content image URLs through media proxy to avoid IP restriction issues
  const resolveContentImageUrl = (rawUrl: string): string => {
    if (!rawUrl) return rawUrl;
    const remoteBase = (process.env.REACT_APP_WP_SITE_URL || 'https://cmansrms.us').replace(/\/$/, '');
    let absolute = rawUrl;
    if (rawUrl.startsWith('/')) absolute = `${remoteBase}${rawUrl}`;
    else if (!rawUrl.startsWith('http')) absolute = `${remoteBase}/${rawUrl}`;
    const token = typeof window !== 'undefined' ? (localStorage.getItem('token') || '') : '';
    const tokenQuery = token ? `&t=${encodeURIComponent(token)}` : '';
    
    // Always use media proxy for WordPress media to avoid IP restriction issues
    // This ensures all media is accessible regardless of user's IP address
    return `${process.env.REACT_APP_API_URL || ''}/media?url=${encodeURIComponent(absolute)}${tokenQuery}`;
  };

  const highlightTerms = useMemo(() => {
    if (termsProp && termsProp.length) return termsProp;
    try {
      const params = new URLSearchParams(window.location.search);
      const q = params.get('search') || '';
      const tokens = (q.match(/\"[^\"]+\"|\S+/g) || [])
        .map(t => t.replace(/^\"|\"$/g, ''))
        .filter(t => t && !t.includes(':'));
      return tokens;
    } catch { return []; }
  }, [termsProp]);

  useEffect(() => {
    if (open && postId) {
      loadPost(postId);
    }
  }, [open, postId]);

  const loadPost = async (id: number) => {
    try {
      setLoading(true);
      setError('');
      const postData = await apiService.getPost(id);
      setPost(postData);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to load post details');
    } finally {
      setLoading(false);
    }
  };

  const stripHtmlTags = (html: string) => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  };

  const highlightPlain = (text: string) => {
    const escape = (s: string) => s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    let safe = escape(text || '');
    if (highlightTerms.length) {
      // Create patterns for word variations, similar to other highlight functions
      const patterns = highlightTerms.map(term => {
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Match the exact term or words containing the term
        return `\\b\\w*${escaped}\\w*\\b`;
      });
      const re = new RegExp(`(${patterns.join('|')})`, 'gi');
      safe = safe.replace(re, '<mark style="background-color: #F59E0B; color: #000000; padding: 2px; border-radius: 2px; font-weight: 600;">$1</mark>');
    }
    return safe;
  };

  const handleClose = () => {
    setPost(null);
    setError('');
    onClose();
  };

  // Intercept clicks inside rendered HTML to open viewer modal instead of navigating
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const onClick = (e: Event) => {
      let target = e.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest('a');
      const media = (target.tagName && ['IMG','VIDEO','AUDIO'].includes(target.tagName)) ? target : null;
      if (!anchor && !media) return;
      const clickable = (anchor as HTMLElement) || (media as HTMLElement);
      let rawUrl: string | null = clickable.getAttribute('data-raw-url');
      const srcAttr = media ? (media as HTMLElement).getAttribute('src') : null;
      const hrefAttr = anchor ? (anchor as HTMLElement).getAttribute('href') : null;
      const srcOrHref = hrefAttr || srcAttr;
      if (!rawUrl && srcOrHref) {
        try {
          const u = new URL(srcOrHref, window.location.origin);
          const qp = new URLSearchParams(u.search);
          rawUrl = qp.get('url') || srcOrHref;
        } catch {
          rawUrl = srcOrHref;
        }
      }
      if (!rawUrl) return;
      const lower = rawUrl.toLowerCase();
      const isAsset = /\.(jpg|jpeg|png|gif|bmp|webp|pdf|mp4|mov|webm|mp3|wav|m4a|aac)(\?|#|$)/.test(lower);
      if (!isAsset && !(media && ['IMG','VIDEO','AUDIO'].includes(media.tagName))) return;
      e.preventDefault();
      setSelectedAttachment({ url: rawUrl, mime_type: null, title: null });
      setAttachmentOpen(true);
    };
    el.addEventListener('click', onClick, true);
    return () => el.removeEventListener('click', onClick, true);
  }, [post?.id]);

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      scroll="paper"
      PaperProps={{
        sx: {
          backgroundColor: '#16181C',
          color: '#E7E9EA',
          '& .MuiDialogTitle-root': {
            backgroundColor: '#16181C',
            color: '#E7E9EA'
          },
          '& .MuiDialogContent-root': {
            backgroundColor: '#16181C',
            color: '#E7E9EA'
          },
          '& .MuiDialogActions-root': {
            backgroundColor: '#16181C',
            color: '#E7E9EA'
          }
        }
      }}
    >
      <DialogTitle sx={{ 
        pr: 6, 
        pb: 2,
        borderBottom: '1px solid #2F3336',
        backgroundColor: '#16181C',
        color: '#E7E9EA'
      }}>
        <IconButton
          onClick={handleClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: '#71767B',
            '&:hover': {
              backgroundColor: '#2F3336',
              color: '#E7E9EA'
            }
          }}
        >
          <CloseIcon />
        </IconButton>
        
        {loading ? (
          <Typography variant="h5" component="h2" sx={{ color: '#E7E9EA' }}>
            Loading...
          </Typography>
        ) : post ? (
          <Typography 
            variant="h5" 
            component="h2" 
            sx={{ color: '#E7E9EA' }}
            dangerouslySetInnerHTML={{ __html: highlightPlain(stripHtmlTags(post.title)) }} 
          />
        ) : (
          <Typography variant="h5" component="h2" sx={{ color: '#E7E9EA' }}>
            Post Details
          </Typography>
        )}
      </DialogTitle>

      <DialogContent sx={{ pt: 3, backgroundColor: '#16181C', color: '#E7E9EA' }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress sx={{ color: '#1D9BF0' }} />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2, backgroundColor: '#2F3336', color: '#E7E9EA' }}>
            {error}
          </Alert>
        )}

        {post && !loading && (
          <Box>
            {/* Post Metadata */}
            <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Chip
                icon={<Person sx={{ color: '#71767B' }} />}
                label={`Author: ${post.author_name}`}
                variant="outlined"
                size="small"
                sx={{
                  borderColor: '#2F3336',
                  color: '#E7E9EA',
                  backgroundColor: '#0F1115',
                  '& .MuiChip-label': { color: '#E7E9EA' }
                }}
              />
              <Chip
                icon={<DateRange sx={{ color: '#71767B' }} />}
                label={`Published: ${format(new Date(post.wp_published_date), 'MMM dd, yyyy HH:mm')}`}
                variant="outlined"
                size="small"
                sx={{
                  borderColor: '#2F3336',
                  color: '#E7E9EA',
                  backgroundColor: '#0F1115',
                  '& .MuiChip-label': { color: '#E7E9EA' }
                }}
              />
              {post.category_name && (
                <Chip
                  icon={<CategoryIcon sx={{ color: '#1D9BF0' }} />}
                  label={`Category: ${post.category_name}`}
                  variant="outlined"
                  size="small"
                  sx={{
                    borderColor: '#1D9BF0',
                    color: '#1D9BF0',
                    backgroundColor: '#0F1115',
                    '& .MuiChip-label': { color: '#1D9BF0' }
                  }}
                />
              )}
              <Chip
                icon={<Schedule sx={{ color: '#F59E0B' }} />}
                label={`Retention: ${format(new Date(post.retention_date), 'MMM dd, yyyy')}`}
                variant="outlined"
                size="small"
                sx={{
                  borderColor: '#F59E0B',
                  color: '#F59E0B',
                  backgroundColor: '#0F1115',
                  '& .MuiChip-label': { color: '#F59E0B' }
                }}
              />
            </Box>

            {/* Post Excerpt */}
            {post.excerpt && (
              <Box sx={{ mb: 3, p: 2, bgcolor: '#0F1115', borderRadius: 1, border: '1px solid #2F3336' }}>
                <Typography variant="subtitle2" sx={{ color: '#1D9BF0', fontWeight: 600 }} gutterBottom>
                  Summary
                </Typography>
                <Typography variant="body2" sx={{ color: '#E7E9EA', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: highlightPlain(stripHtmlTags(post.excerpt)) }} />
              </Box>
            )}

            {/* Full Post Content */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ color: '#1D9BF0', fontWeight: 600 }} gutterBottom>
                Full Details
              </Typography>
              <Box
                sx={{
                  lineHeight: 1.8,
                  color: '#E7E9EA',
                  '& img': { 
                    maxWidth: '100%', 
                    borderRadius: 1,
                    '&:not([src])': { display: 'none' }
                  },
                  '& p': { margin: '0 0 12px', color: '#E7E9EA' },
                  '& h1, & h2, & h3': { marginTop: '16px', color: '#E7E9EA' },
                  '& a': { color: '#1D9BF0', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } },
                  '& strong, & b': { color: '#E7E9EA', fontWeight: 600 },
                  '& em, & i': { color: '#E7E9EA', fontStyle: 'italic' },
                  '& code': { backgroundColor: '#2F3336', color: '#E7E9EA', padding: '2px 4px', borderRadius: '3px', fontSize: '0.9em' },
                  '& pre': { backgroundColor: '#0F1115', color: '#E7E9EA', padding: '12px', borderRadius: '4px', overflow: 'auto', border: '1px solid #2F3336' },
                  '& blockquote': { borderLeft: '4px solid #1D9BF0', paddingLeft: '16px', margin: '16px 0', fontStyle: 'italic', color: '#B1B5B8' }
                }}
                ref={contentRef}
                dangerouslySetInnerHTML={{ __html: (() => {
                  const raw = post.content || '';
                  const token = encodeURIComponent(localStorage.getItem('token') || '');
                  const remoteBase = (process.env.REACT_APP_WP_SITE_URL || 'https://cmansrms.us').replace(/\/$/, '');
                  // Proxy media sources (img/video/audio) but keep links pointing to remote host
                  let rewritten = raw.replace(/src=["']([^"'>]+)["']/gi, (m, url) => {
                    try {
                      const original = String(url).trim();
                      if (!original) return m;
                      
                      // Handle relative URLs
                      let absoluteUrl = original;
                      if (original.startsWith('/')) {
                        absoluteUrl = `${remoteBase}${original}`;
                      } else if (!original.startsWith('http')) {
                        absoluteUrl = `${remoteBase}/${original}`;
                      }
                      
                      // For cmansrms.us images, use direct URLs; for PDFs use proxy due to 403 errors
                      if (absoluteUrl.includes('cmansrms.us') && !absoluteUrl.toLowerCase().includes('.pdf')) {
                        return `src=\"${absoluteUrl}\" data-raw-url=\"${absoluteUrl}\"`;
                      } else {
                        const encoded = encodeURIComponent(absoluteUrl);
                        return `src=\"${API_BASE_URL}/media?url=${encoded}&t=${token}\" data-raw-url=\"${absoluteUrl}\" onerror=\"this.onerror=null; this.src='${absoluteUrl}'; console.log('Media proxy failed for: ${absoluteUrl}');\"`;
                      }
                    } catch (error) { 
                      console.error('Error processing image src:', error, url);
                      return m; 
                    }
                  });
                  rewritten = rewritten.replace(/href=["']([^"'>]+)["']/gi, (m, url) => {
                    try {
                      const original = String(url);
                      // For media-like links, neutralize default navigation and keep raw-url for modal
                      if (/(\.(jpg|jpeg|png|gif|bmp|webp|pdf|mp4|mov|webm|mp3|wav|m4a|aac)(\?|#|$))|\/wp-content\//i.test(original)) {
                        return `href=\"#\" data-raw-url=\"${original}\"`;
                      }
                      // Non-media links remain as is (absolute for relative)
                      if (!original.startsWith('http')) {
                        const absolute = `${remoteBase}${original}`;
                        return `href=\"${absolute}\"`;
                      }
                      return `href=\"${original}\"`;
                    } catch { return m; }
                  });
                  // Strip download attributes on links to prevent forced download
                  rewritten = rewritten.replace(/\sdownload(=\"[^\"]*\"|='[^']*'|)/gi, '');
                  let sanitized = DOMPurify.sanitize(rewritten);
                  // Highlight terms in sanitized HTML, but only inside text nodes (not attributes)
                  if (highlightTerms.length) {
                    const escaped = highlightTerms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                    const re = new RegExp(`(${escaped.join('|')})`, 'gi');
                    sanitized = sanitized.replace(/>([^<]+)</g, (m, text) => {
                      const replaced = text.replace(re, '<mark style="background-color: #F59E0B; color: #000000; padding: 2px; border-radius: 2px; font-weight: 600;">$1</mark>');
                      return '>' + replaced + '<';
                    });
                  }
                  return sanitized;
                })() }}
              />
            </Box>

            {/* Media and Attachments */}
            {(post.featured_media_url || (post.attachments && post.attachments.length > 0)) && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" sx={{ color: '#1D9BF0', fontWeight: 600 }} gutterBottom>
                  Media & Attachments
                </Typography>
                
                {/* Featured Media */}
                {post.featured_media_url && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" sx={{ color: '#B1B5B8' }} gutterBottom>
                      Featured Image:
                    </Typography>
                    <img
                      src={resolveContentImageUrl(post.featured_media_url)}
                      alt="Featured media"
                      style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain', borderRadius: '4px', border: '1px solid #2F3336' }}
                    />
                  </Box>
                )}

                {/* Additional Attachments */}
                {post.attachments && post.attachments.length > 0 && (
                  <Box>
                    <Typography variant="body2" sx={{ color: '#B1B5B8' }} gutterBottom>
                      Additional Attachments:
                    </Typography>
                    <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
                      {post.attachments.map((att, index: number) => {
                        const url = `/api/files/${att.id}/${encodeURIComponent(att.filename)}`;
                        const isImage = att.mime_type?.startsWith('image/');
                        const isPdf = att.mime_type === 'application/pdf';
                        const isVideo = att.mime_type?.startsWith('video/');
                        const isAudio = att.mime_type?.startsWith('audio/');

                        const openViewer = () => {
                          setSelectedAttachment({ 
                            url, 
                            mime_type: att.mime_type, 
                            title: att.original_name 
                          });
                          setAttachmentOpen(true);
                        };

                        if (isImage) {
                          return (
                            <Box key={index} onClick={openViewer} sx={{ cursor: 'zoom-in' }}>
                              <img
                                src={url}
                                alt={att.original_name}
                                style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 4, border: '1px solid #2F3336' }}
                              />
                            </Box>
                          );
                        }

                        if (isPdf) {
                          return (
                            <Box key={index} onClick={openViewer} sx={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: 1, 
                              p: 1, 
                              border: '1px solid #2F3336', 
                              borderRadius: 1, 
                              cursor: 'pointer',
                              backgroundColor: '#0F1115',
                              '&:hover': { backgroundColor: '#2F3336' }
                            }}>
                              <span role="img" aria-label="PDF">📄</span>
                              <Typography variant="caption" noWrap sx={{ color: '#E7E9EA' }}>PDF</Typography>
                            </Box>
                          );
                        }

                        if (isVideo) {
                          return (
                            <Box key={index} onClick={openViewer} sx={{ cursor: 'pointer' }}>
                              <video style={{ width: '100%', height: 100, borderRadius: 4, border: '1px solid #2F3336' }}>
                                <source src={url} />
                              </video>
                            </Box>
                          );
                        }

                        if (isAudio) {
                          return (
                            <Box key={index} onClick={openViewer} sx={{ cursor: 'pointer' }}>
                              <audio controls style={{ width: '100%' }}>
                                <source src={url} />
                              </audio>
                            </Box>
                          );
                        }

                        return (
                          <Box key={index} onClick={openViewer} sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 1, 
                            p: 1, 
                            border: '1px solid #2F3336', 
                            borderRadius: 1, 
                            cursor: 'pointer',
                            backgroundColor: '#0F1115',
                            '&:hover': { backgroundColor: '#2F3336' }
                          }}>
                            <span role="img" aria-label="File">📎</span>
                            <Typography variant="caption" noWrap sx={{ color: '#E7E9EA' }}>{att.original_name}</Typography>
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>
                )}
              </Box>
            )}

            <AttachmentViewerModal open={attachmentOpen} onClose={()=>setAttachmentOpen(false)} attachment={selectedAttachment} />

            {/* Additional Metadata */}
            {post.metadata && (
              <Box sx={{ mt: 3, p: 2, bgcolor: '#0F1115', borderRadius: 1, border: '1px solid #2F3336' }}>
                <Typography variant="subtitle2" sx={{ color: '#1D9BF0', fontWeight: 600 }} gutterBottom>
                  Additional Information
                </Typography>
                <Typography variant="caption" sx={{ color: '#B1B5B8' }}>
                  Post ID: {post.wp_post_id} | 
                  Status: {post.status} | 
                  Ingested: {format(new Date(post.ingested_at), 'MMM dd, yyyy HH:mm')}
                </Typography>
              </Box>
            )}

            {/* Comments Section */}
            <Comments postId={post.id} />
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, backgroundColor: '#16181C' }}>
        <Button 
          onClick={handleClose} 
          variant="contained"
          sx={{
            backgroundColor: '#1D9BF0',
            color: '#000000',
            fontWeight: 600,
            '&:hover': {
              backgroundColor: '#1A8CD8'
            }
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PostDetailModal;