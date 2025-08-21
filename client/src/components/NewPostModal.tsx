import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem, Box, Stack, Chip, Alert, Divider, Paper, Typography } from '@mui/material';
import DOMPurify from 'dompurify';
import { Editor } from '@tinymce/tinymce-react';
import apiService from '../services/api';
import auditService from '../services/auditService';
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
  const [uploads, setUploads] = useState<{url:string; path:string; mimeType:string; name?:string; id?:number}[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setEditorRef(null);
      return;
    }
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

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    
    console.log('Uploading file:', {
      name: file.name,
      type: file.type,
      size: file.size,
      sizeInMB: (file.size / (1024 * 1024)).toFixed(2)
    });
    
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
      setError(`Unsupported file type: ${file.type}. Please upload images, PDFs, or media files.`);
      return;
    }
    
    try {
      console.log('Creating FormData...');
      const form = new FormData();
      form.append('file', file);
      
      console.log('FormData entries:');
      for (let [key, value] of Array.from(form.entries())) {
        console.log(key, value);
      }
      
      console.log('Calling API upload...');
      const resp = await apiService.uploadFile(form);
      console.log('Upload successful:', resp);
      
      setUploads(prev => [...prev, { 
        url: resp.url, 
        path: resp.path, 
        mimeType: resp.mimeType, 
        name: resp.originalName || file.name,
        id: resp.id 
      }]);
    } catch (err:any) {
      console.error('Upload error details:', {
        message: err?.message,
        status: err?.response?.status,
        statusText: err?.response?.statusText,
        data: err?.response?.data,
        config: err?.config
      });
      
      let errorMsg = 'Upload failed';
      if (err?.response?.status === 400) {
        errorMsg = err?.response?.data?.error || 'Bad request - invalid file or request format';
      } else if (err?.response?.status === 401) {
        errorMsg = 'Authentication required for file upload';
      } else if (err?.response?.status === 403) {
        errorMsg = 'You do not have permission to upload files';
      } else if (err?.response?.data?.error) {
        errorMsg = err.response.data.error;
      } else if (err?.message) {
        errorMsg = err.message;
      }
      
      setError(`Upload failed: ${errorMsg}`);
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setUploads(prev => prev.filter((_, i) => i !== index));
  };

  const [editorRef, setEditorRef] = useState<any>(null);

  const insertHtml = (html: string) => {
    const safe = DOMPurify.sanitize(html);
    if (editorRef) {
      editorRef.insertContent(safe);
    } else {
      setContent(prev => prev + safe);
    }
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
      // Validate input
      if (!title?.trim()) {
        setError('Thread title is required');
        return;
      }
      if (!content?.trim()) {
        setError('Thread content is required');
        return;
      }
      
      // Check user permissions
      if (!user || !['edit', 'admin'].includes(user.role)) {
        setError('You do not have permission to create threads');
        return;
      }
      
      const autoExcerpt = generateExcerpt(content);
      const payload: any = { 
        title: title.trim(), 
        content: content.trim(), 
        excerpt: autoExcerpt, 
        categoryId: categoryId || null, // Send null instead of empty string
        retentionDays: '365',
        attachments: uploads.map(u => u.id).filter(Boolean) // Include file IDs
      };
      
      console.log('User role:', user.role);
      console.log('Submitting payload:', payload);
      
      if (post) {
        await apiService.updatePost(post.id, payload);
        // Track edit
        await auditService.trackEdit('post', post.id, { title, content, excerpt });
      } else {
        const result = await apiService.createPost(payload);
        // Track creation
        await auditService.trackCreate('post', result.id || 'new', { title, content, excerpt });
      }
      
      // Reset form
      setTitle(''); 
      setContent(''); 
      setExcerpt(''); 
      setCategoryId(''); 
      setUploads([]);
      setEditorRef(null);
      
      onCreated?.();
      onClose();
    } catch (err:any) {
      console.error('Thread creation error:', err);
      let errorMessage = 'Failed to create thread';
      
      if (err?.response?.status === 401) {
        errorMessage = 'Authentication required. Please log in again.';
      } else if (err?.response?.status === 403) {
        errorMessage = 'You do not have permission to create threads.';
      } else if (err?.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err?.message) {
        errorMessage = err.message;
      }
      
      setError(`Error: ${errorMessage}`);
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
              overflow: 'hidden',
              '& .tox-tinymce': {
                borderRadius: '8px',
                border: 'none'
              },
              '& .tox-editor-header': {
                borderBottom: '1px solid #E5E7EB'
              }
            }}
          >
            <Editor
              tinymceScriptSrc="/tinymce/tinymce.min.js"
              value={content}
              onEditorChange={(value) => setContent(value)}
              onInit={(evt, editor) => setEditorRef(editor)}
              init={{
                license_key: 'gpl',
                height: 400,
                menubar: false,
                plugins: [
                  'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
                  'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                  'insertdatetime', 'media', 'table', 'help', 'wordcount'
                ],
                toolbar: 'undo redo | blocks | ' +
                  'bold italic forecolor | alignleft aligncenter ' +
                  'alignright alignjustify | bullist numlist outdent indent | ' +
                  'removeformat | help',
                content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px }',
                // Use local skins to avoid remote fetches
                skin_url: '/tinymce/skins/ui/oxide',
                content_css: '/tinymce/skins/content/default/content.min.css',
                branding: false,
                promotion: false,
                resize: false,
                statusbar: false,
                placeholder: 'Write your thread content here...',
                setup: (editor) => {
                  editor.on('init', () => {
                    editor.getContainer().style.transition = 'border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out';
                  });
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
                  <Button 
                    size="small" 
                    variant="outlined"
                    color="error"
                    onClick={() => handleRemoveAttachment(i)}
                    sx={{ 
                      fontSize: '12px', 
                      borderRadius: 1,
                      borderColor: '#EF4444',
                      color: '#EF4444',
                      '&:hover': { 
                        backgroundColor: '#FEF2F2',
                        borderColor: '#DC2626'
                      }
                    }}
                  >
                    Remove
                  </Button>
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
        justifyContent: 'flex-end'
      }}>
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


