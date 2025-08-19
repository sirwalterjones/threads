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
  const [selectedAttachment, setSelectedAttachment] = useState<any>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

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
      const escaped = highlightTerms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const re = new RegExp(`(${escaped.join('|')})`, 'gi');
      safe = safe.replace(re, '<mark style="background-color: yellow; padding:0;">$1</mark>');
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
    >
      <DialogTitle sx={{ 
        pr: 6, 
        pb: 2,
        borderBottom: '1px solid #e0e0e0'
      }}>
        <IconButton
          onClick={handleClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: 'grey.500',
          }}
        >
          <CloseIcon />
        </IconButton>
        
        {loading ? (
          'Loading...'
        ) : post ? (
          <Typography variant="h5" component="h2" dangerouslySetInnerHTML={{ __html: highlightPlain(stripHtmlTags(post.title)) }} />
        ) : (
          'Post Details'
        )}
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {post && !loading && (
          <Box>
            {/* Post Metadata */}
            <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Chip
                icon={<Person />}
                label={`Author: ${post.author_name}`}
                variant="outlined"
                size="small"
              />
              <Chip
                icon={<DateRange />}
                label={`Published: ${format(new Date(post.wp_published_date), 'MMM dd, yyyy HH:mm')}`}
                variant="outlined"
                size="small"
              />
              {post.category_name && (
                <Chip
                  icon={<CategoryIcon />}
                  label={`Category: ${post.category_name}`}
                  variant="outlined"
                  size="small"
                  color="primary"
                />
              )}
              <Chip
                icon={<Schedule />}
                label={`Retention: ${format(new Date(post.retention_date), 'MMM dd, yyyy')}`}
                variant="outlined"
                size="small"
                color="warning"
              />
            </Box>

            {/* Post Excerpt */}
            {post.excerpt && (
              <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  Summary
                </Typography>
                <Typography variant="body2" color="textSecondary" dangerouslySetInnerHTML={{ __html: highlightPlain(stripHtmlTags(post.excerpt)) }} />
              </Box>
            )}

            {/* Full Post Content */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                Full Details
              </Typography>
              <Box
                sx={{
                  lineHeight: 1.8,
                  '& img': { 
                    maxWidth: '100%', 
                    borderRadius: 1,
                    '&:not([src])': { display: 'none' }
                  },
                  '& p': { margin: '0 0 12px' },
                  '& h1, & h2, & h3': { marginTop: '16px' }
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
                      
                      // For cmansrms.us, use direct URLs since it's a public WordPress site
                      if (absoluteUrl.includes('cmansrms.us')) {
                        return `src=\"${absoluteUrl}\" data-raw-url=\"${absoluteUrl}\"`;
                      } else {
                        const encoded = encodeURIComponent(absoluteUrl);
                        return `src=\"${API_BASE_URL}/media?url=${encoded}&t=${token}\" data-raw-url=\"${absoluteUrl}\" onerror=\"this.onerror=null; this.src='${absoluteUrl}'; console.log('Media proxy failed for: ${absoluteUrl}');\"`;
                      };
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
                  // Highlight terms in sanitized HTML
                  if (highlightTerms.length) {
                    const escaped = highlightTerms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                    const re = new RegExp(`(${escaped.join('|')})`, 'gi');
                    sanitized = sanitized.replace(re, '<mark style="background-color: yellow; padding:0;">$1</mark>');
                  }
                  return sanitized;
                })() }}
              />
            </Box>

            {/* Media and Attachments */}
            {(post.featured_media_url || (post.attachments && JSON.parse(post.attachments || '[]').length > 0)) && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  Media & Attachments
                </Typography>
                
                {/* Featured Media */}
                {post.featured_media_url && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      Featured Image:
                    </Typography>
                    <img
                      src={post.featured_media_url.startsWith('http') 
                        ? post.featured_media_url 
                        : `https://cmansrms.us${post.featured_media_url}`}
                      alt="Featured media"
                      style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain', borderRadius: '4px' }}
                    />
                  </Box>
                )}

                {/* Additional Attachments */}
                {post.attachments && JSON.parse(post.attachments || '[]').length > 0 && (
                  <Box>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      Additional Attachments:
                    </Typography>
                    <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
                      {JSON.parse(post.attachments || '[]').map((att: any, index: number) => {
                        const rawUrl = typeof att === 'string' ? att : att?.url;
                        if (!rawUrl) return null;
                        const relativeOrAbsolute = rawUrl.startsWith('/') ? rawUrl : rawUrl;
                        const remoteBase = (process.env.REACT_APP_WP_SITE_URL || 'https://cmansrms.us').replace(/\/$/, '');
                        const remoteUrl = relativeOrAbsolute.startsWith('http') ? relativeOrAbsolute : `${remoteBase}${relativeOrAbsolute}`;
                        const url = relativeOrAbsolute;
                        const mime = typeof att === 'object' ? att.mime_type || '' : '';
                        const contentHasUrl = (post.content || '').includes(url) || (post.content || '').includes(remoteUrl);
                        if (contentHasUrl || (post.featured_media_url && (post.featured_media_url.includes(url) || post.featured_media_url.includes(remoteUrl)))) {
                          return null;
                        }
                        const isImage = /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(url) || mime.startsWith('image/');
                        const isPdf = /\.pdf$/i.test(url) || mime === 'application/pdf';
                        const isVideo = /\.(mp4|mov|webm)$/i.test(url) || mime.startsWith('video/');
                        const isAudio = /\.(mp3|wav|m4a|aac)$/i.test(url) || mime.startsWith('audio/');

                        const openViewer = (attObj: any) => {
                          setSelectedAttachment({ url: rawUrl, mime_type: attObj?.mime_type || mime, title: attObj?.title || null });
                          setAttachmentOpen(true);
                        };

                        if (isImage) {
                          return (
                            <a key={index} onClick={(e)=>{e.preventDefault(); openViewer(att);}} href={remoteUrl} rel="noopener noreferrer" style={{ textDecoration: 'none', cursor: 'zoom-in' }}>
                              <img
                                src={remoteUrl}
                                alt={att.title || `Image ${index + 1}`}
                                style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 4, border: '1px solid #e0e0e0' }}
                              />
                            </a>
                          );
                        }

                        if (isPdf) {
                          return (
                            <a key={index} onClick={(e)=>{e.preventDefault(); openViewer(att);}} href={remoteUrl} rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, border: '1px solid #e0e0e0', borderRadius: 4, cursor: 'pointer' }}>
                              <span role="img" aria-label="PDF">📄</span>
                              <Typography variant="caption" noWrap>PDF</Typography>
                            </a>
                          );
                        }

                        if (isVideo) {
                          return (
                            <video key={index} controls style={{ width: '100%', height: 100, borderRadius: 4, border: '1px solid #e0e0e0' }} onClick={(e)=>{e.preventDefault(); openViewer(att);}}>
                              <source src={remoteUrl} />
                            </video>
                          );
                        }

                        if (isAudio) {
                          return (
                            <audio key={index} controls style={{ width: '100%' }} onClick={(e)=>{e.preventDefault(); openViewer(att);}}>
                              <source src={remoteUrl} />
                            </audio>
                          );
                        }

                        return (
                          <a key={index} onClick={(e)=>{e.preventDefault(); openViewer(att);}} href={remoteUrl} rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, border: '1px solid #e0e0e0', borderRadius: 4, cursor: 'pointer' }}>
                            <span role="img" aria-label="File">📎</span>
                            <Typography variant="caption" noWrap>Attachment</Typography>
                          </a>
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
              <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  Additional Information
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  Post ID: {post.wp_post_id} | 
                  Status: {post.status} | 
                  Ingested: {format(new Date(post.ingested_at), 'MMM dd, yyyy HH:mm')}
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PostDetailModal;