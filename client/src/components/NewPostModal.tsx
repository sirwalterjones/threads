import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem, Box, Stack, Chip, Alert, Divider, Paper, Typography } from '@mui/material';
import DOMPurify from 'dompurify';
import apiService from '../services/api';
import { Category } from '../types';
import { useAuth } from '../contexts/AuthContext';

import { Post } from '../types';

interface Props { open: boolean; onClose: () => void; onCreated?: () => void; post?: Post | null; }

const NewPostModal: React.FC<Props> = ({ open, onClose, onCreated, post }) => {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [uploads, setUploads] = useState<{url:string; path:string; mimeType:string; name?:string}[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    apiService.getCategories().then(setCategories).catch(()=>{});
    if (post) {
      setTitle(post.title || '');
      setContent(post.content || '');
      setExcerpt(post.excerpt || '');
      setCategoryId(post.category_slug ? String(post.category_slug) : '');
    } else {
      setTitle(''); setContent(''); setExcerpt(''); setCategoryId('');
    }
  }, [open, post]);

  // Remove TinyMCE completely to avoid API key issues

  // Always use the textarea fallback instead of TinyMCE

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    
    // Validate file size (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
      setError('File too large. Maximum size is 50MB.');
      return;
    }
    
    // Validate file type
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp',
      'application/pdf',
      'audio/mpeg', 'audio/wav', 'audio/aac', 'audio/mp4', 'audio/x-m4a',
      'video/mp4', 'video/quicktime', 'video/webm'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      setError('Unsupported file type. Please upload images, PDFs, or media files.');
      return;
    }
    
    try {
      const form = new FormData();
      form.append('file', file);
      const resp = await apiService.uploadFile(form);
      setUploads(prev => [...prev, { url: resp.url, path: resp.path, mimeType: resp.mimeType, name: file.name }]);
    } catch (err:any) {
      console.error('Upload error:', err);
      const errorMsg = err?.response?.data?.error || err?.message || 'Upload failed';
      setError(`Upload failed: ${errorMsg}`);
    }
  };

  const insertHtml = (html: string) => {
    const safe = DOMPurify.sanitize(html);
    setContent(prev => prev + safe);
  };

  const generateExcerpt = (html: string) => {
    const div = document.createElement('div');
    div.innerHTML = html || '';
    const text = (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    const maxLen = 300;
    return text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text;
  };

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      const autoExcerpt = generateExcerpt(content);
      const payload = { title, content, excerpt: autoExcerpt, categoryId: '' as any, retentionDays: '365' } as any;
      if (post) await apiService.updatePost(post.id, payload);
      else await apiService.createPost(payload);
      setTitle(''); setContent(''); setExcerpt(''); setCategoryId(''); setUploads([]);
      onCreated?.();
      onClose();
    } catch (err:any) {
      setError(err?.response?.data?.error || 'Failed to create post');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      fullWidth 
      maxWidth="md"
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow: '0 20px 40px -12px rgba(0, 0, 0, 0.25)'
        }
      }}
    >
      <DialogTitle sx={{ 
        p: 3, 
        pb: 2,
        borderBottom: '1px solid #E5E7EB'
      }}>
        <Typography variant="h5" sx={{ 
          fontWeight: 600, 
          color: '#1F2937',
          textAlign: 'center'
        }}>
          {post ? 'Edit Thread' : 'Add Thread'}
        </Typography>
      </DialogTitle>
      
      <DialogContent sx={{ 
        p: 3, 
        bgcolor: '#FAFAFA',
        minHeight: '500px'
      }}>
        {error && (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 3, 
              borderRadius: 2,
              '& .MuiAlert-message': {
                fontSize: '14px'
              }
            }}
          >
            {error}
          </Alert>
        )}

        {/* Thread Title */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" sx={{ 
            mb: 1, 
            color: '#374151', 
            fontWeight: 600 
          }}>
            Thread Title
          </Typography>
          <TextField 
            fullWidth 
            required 
            placeholder="Enter thread title..."
            value={title} 
            onChange={(e) => setTitle(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                backgroundColor: 'white',
                '&:hover fieldset': {
                  borderColor: '#3B82F6'
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#3B82F6'
                }
              }
            }}
          />
        </Box>

        {/* Thread Content */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" sx={{ 
            mb: 1, 
            color: '#374151', 
            fontWeight: 600 
          }}>
            Content
          </Typography>
          
          <Paper 
            elevation={0}
            sx={{ 
              border: '1px solid #D1D5DB',
              borderRadius: 2,
              backgroundColor: 'white',
              overflow: 'hidden'
            }}
          >
            <TextField
              fullWidth
              multiline
              minRows={10}
              placeholder="Write your thread content here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    border: 'none'
                  }
                },
                '& .MuiInputBase-input': {
                  fontSize: '14px',
                  lineHeight: 1.6
                }
              }}
            />
          </Paper>
        </Box>

        {/* Media Upload */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" sx={{ 
            mb: 1, 
            color: '#374151', 
            fontWeight: 600 
          }}>
            Media Attachments
          </Typography>
          
          <Button 
            variant="outlined" 
            component="label"
            sx={{
              borderRadius: 2,
              borderStyle: 'dashed',
              borderWidth: 2,
              py: 2,
              px: 3,
              backgroundColor: 'white',
              '&:hover': {
                backgroundColor: '#F9FAFB',
                borderColor: '#3B82F6'
              }
            }}
          >
            📎 Upload Media Files
            <input type="file" hidden onChange={handleUpload} />
          </Button>
        </Box>

        {/* Uploaded Files */}
        {uploads.length > 0 && (
          <Paper 
            elevation={0}
            sx={{ 
              p: 2, 
              backgroundColor: 'white',
              border: '1px solid #E5E7EB',
              borderRadius: 2 
            }}
          >
            <Typography variant="subtitle2" sx={{ mb: 2, color: '#374151', fontWeight: 600 }}>
              Uploaded Files ({uploads.length})
            </Typography>
            <Stack spacing={2}>
              {uploads.map((u, i) => (
                <Box key={i} sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 2, 
                  p: 2,
                  backgroundColor: '#F9FAFB',
                  borderRadius: 2,
                  flexWrap: 'wrap' 
                }}>
                  <Chip 
                    label={u.name || u.path} 
                    size="small" 
                    sx={{ backgroundColor: 'white' }}
                  />
                  <Button 
                    size="small" 
                    variant="outlined"
                    onClick={() => insertHtml(`<a href="${u.url}" target="_blank" rel="noopener noreferrer">${u.name || 'attachment'}</a>`)}
                    sx={{ fontSize: '12px', borderRadius: 1 }}
                  >
                    Insert Link
                  </Button>
                  {u.mimeType.startsWith('image/') && (
                    <Button 
                      size="small" 
                      variant="contained"
                      onClick={() => insertHtml(`<img src="${u.url}" style="max-width:100%" />`)}
                      sx={{ 
                        fontSize: '12px', 
                        borderRadius: 1,
                        backgroundColor: '#10B981',
                        '&:hover': { backgroundColor: '#059669' }
                      }}
                    >
                      Insert Image
                    </Button>
                  )}
                </Box>
              ))}
            </Stack>
          </Paper>
        )}
      </DialogContent>
      
      <DialogActions sx={{ 
        p: 3, 
        pt: 2,
        borderTop: '1px solid #E5E7EB',
        backgroundColor: 'white',
        gap: 2,
        justifyContent: 'space-between'
      }}>
        <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '12px' }}>
          Category, author, and date are set automatically
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button 
            onClick={onClose}
            sx={{ 
              borderRadius: 2,
              px: 3,
              color: '#6B7280',
              '&:hover': { backgroundColor: '#F3F4F6' }
            }}
          >
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={submit} 
            disabled={!title || !content || saving}
            sx={{
              borderRadius: 2,
              px: 4,
              backgroundColor: '#000000',
              '&:hover': { backgroundColor: '#1F2937' },
              '&:disabled': { backgroundColor: '#E5E7EB' }
            }}
          >
            {saving ? 
              (post ? 'Saving Thread...' : 'Creating Thread...') : 
              (post ? 'Save Changes' : 'Create Thread')
            }
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default NewPostModal;


