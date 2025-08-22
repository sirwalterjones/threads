import React, { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem, Box, Stack, Chip, Alert, Divider, Paper, Typography, LinearProgress, IconButton } from '@mui/material';
import { CloudUpload, Delete, CheckCircle, Error, Close } from '@mui/icons-material';
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
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [uploads, setUploads] = useState<{url:string; path:string; mimeType:string; name?:string; id?:number}[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<{file: File; progress: number; status: 'uploading' | 'success' | 'error'; error?: string}[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!open) {
      setEditorRef(null);
      return;
    }
    if (post) {
      setTitle(post.title || '');
      setContent(post.content || '');
      setExcerpt(post.excerpt || '');
      setCategoryId(post.category_slug ? String(post.category_slug) : '');
    } else {
      setTitle(''); setContent(''); setExcerpt(''); setCategoryId('');
    }
  }, [open, post]);

  const validateFile = (file: File): string | null => {
    // Validate file size (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
      return 'File too large. Maximum size is 50MB.';
    }
    
    // Validate file type
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp',
      'application/pdf',
      'audio/mpeg', 'audio/wav', 'audio/aac', 'audio/mp4', 'audio/x-m4a',
      'video/mp4', 'video/quicktime', 'video/webm'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      return `Unsupported file type: ${file.type}. Please upload images, PDFs, or media files.`;
    }
    
    return null;
  };

  const handleFileUpload = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    
    // Add file to uploading list
    const uploadingFile = { file, progress: 0, status: 'uploading' as const };
    setUploadingFiles(prev => [...prev, uploadingFile]);
    
    let progressInterval: NodeJS.Timeout | undefined;
    
    try {
      const form = new FormData();
      form.append('file', file);
      
      // Simulate progress updates (since we don't have real progress from the API)
      progressInterval = setInterval(() => {
        setUploadingFiles(prev => prev.map(f => 
          f.file === file 
            ? { ...f, progress: Math.min(f.progress + Math.random() * 20, 90) }
            : f
        ));
      }, 200);
      
      const resp = await apiService.uploadFile(form);
      clearInterval(progressInterval);
      
      // Mark as complete
      setUploadingFiles(prev => prev.map(f => 
        f.file === file 
          ? { ...f, progress: 100, status: 'success' as const }
          : f
      ));
      
      // Add to uploads after a brief delay to show completion
      setTimeout(() => {
        setUploads(prev => [...prev, { 
          url: resp.url, 
          path: resp.path, 
          mimeType: resp.mimeType, 
          name: resp.originalName || file.name,
          id: resp.id 
        }]);
        
        // Remove from uploading list
        setUploadingFiles(prev => prev.filter(f => f.file !== file));
      }, 500);
      
    } catch (err: any) {
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      
      // Mark as error
      setUploadingFiles(prev => prev.map(f => 
        f.file === file 
          ? { ...f, status: 'error' as const, error: 'Upload failed' }
          : f
      ));
      
      console.error('Upload error:', err);
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

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    console.log('Selected files:', files.map(f => ({ name: f.name, size: f.size, type: f.type })));
    files.forEach(handleFileUpload);
    // Force reset the input to prevent caching issues
    e.target.value = '';
    // Also reset the input element completely
    const input = e.target as HTMLInputElement;
    input.files = null;
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    files.forEach(handleFileUpload);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleRemoveAttachment = (index: number) => {
    setUploads(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveFailedUpload = (file: File) => {
    setUploadingFiles(prev => prev.filter(f => f.file !== file));
  };

  const handleClearAllFailedUploads = () => {
    setUploadingFiles(prev => prev.filter(f => f.status !== 'error'));
  };

  const [editorRef, setEditorRef] = useState<any>(null);

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
      
      // Check if any files are still uploading (only block if actively uploading)
      const activeUploads = uploadingFiles.filter(f => f.status === 'uploading');
      if (activeUploads.length > 0) {
        setError('Please wait for all files to finish uploading before creating the thread');
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
        console.log('Updating post with payload:', payload);
        const updatedPost = await apiService.updatePost(post.id, payload);
        console.log('Post updated successfully:', updatedPost);
        // Track edit
        await auditService.trackEdit('post', post.id, { title, content, excerpt });
      } else {
        console.log('Creating post with payload:', payload);
        const result = await apiService.createPost(payload);
        console.log('Post created successfully:', result);
        // Track creation
        await auditService.trackCreate('post', result.id || 'new', { title, content, excerpt });
      }
      
      // Show success message
      setShowSuccess(true);
      
      // Wait a moment for user to see success message, then close and refresh
      setTimeout(() => {
        // Reset form
        setTitle(''); 
        setContent(''); 
        setExcerpt(''); 
        setCategoryId(''); 
        setUploads([]);
        setEditorRef(null);
        setShowSuccess(false);
        setError(''); // Clear any previous errors
        
        // Close modal first
        onClose();
        onCreated?.();
        
        // Small delay before refresh to ensure modal closes
        setTimeout(() => {
          window.location.reload();
        }, 100);
      }, 1500);
    } catch (err:any) {
      console.error('Thread creation error:', err);
      console.error('Error details:', {
        status: err?.response?.status,
        statusText: err?.response?.statusText,
        data: err?.response?.data,
        message: err?.message,
        stack: err?.stack
      });
      
      let errorMessage = 'Failed to create thread';
      
      if (err?.response?.status === 401) {
        errorMessage = 'Authentication required. Please log in again.';
      } else if (err?.response?.status === 403) {
        errorMessage = 'You do not have permission to create threads.';
      } else if (err?.response?.status === 500) {
        errorMessage = `Server error: ${err?.response?.data?.error || 'Internal server error'}`;
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
        borderBottom: '1px solid #E5E7EB',
        position: 'relative'
      }}>
        <Typography variant="h5" sx={{ 
          fontWeight: 600, 
          color: '#1F2937',
          textAlign: 'center'
        }}>
          {post ? 'Edit Thread' : 'Add Thread'}
        </Typography>
        <IconButton
          onClick={() => {
            // Reset all states when closing
            setTitle('');
            setContent('');
            setExcerpt('');
            setCategoryId('');
            setUploads([]);
            setEditorRef(null);
            setShowSuccess(false);
            setError('');
            onClose();
          }}
          sx={{
            position: 'absolute',
            right: 16,
            top: 16,
            color: '#6B7280',
            '&:hover': {
              backgroundColor: '#F3F4F6',
              color: '#374151'
            }
          }}
        >
          <Close />
        </IconButton>
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
        
        {showSuccess && (
          <Alert 
            severity="success" 
            sx={{ 
              mb: 3, 
              borderRadius: 2,
              '& .MuiAlert-message': {
                fontSize: '14px'
              }
            }}
          >
            {post ? 'Thread updated successfully!' : 'Thread created successfully!'}
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

        {/* Media Upload Dropzone */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" sx={{ 
            mb: 1, 
            color: '#374151', 
            fontWeight: 600 
          }}>
            Media Attachments
          </Typography>
          
          <Paper
            elevation={0}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            sx={{
              border: '2px dashed',
              borderColor: isDragOver ? '#3B82F6' : '#D1D5DB',
              borderRadius: 2,
              backgroundColor: isDragOver ? '#F0F9FF' : 'white',
              p: 4,
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              '&:hover': {
                borderColor: '#3B82F6',
                backgroundColor: '#F0F9FF'
              }
            }}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <CloudUpload sx={{ fontSize: 48, color: '#6B7280', mb: 2 }} />
            <Typography variant="h6" sx={{ color: '#374151', mb: 1 }}>
              Drop files here or click to browse
            </Typography>
            <Typography variant="body2" sx={{ color: '#6B7280', mb: 2 }}>
              Supports images, PDFs, audio, and video files (max 50MB each)
            </Typography>
            <Button 
              variant="outlined" 
              component="label"
              sx={{
                borderRadius: 2,
                borderColor: '#3B82F6',
                color: '#3B82F6',
                '&:hover': {
                  backgroundColor: '#EFF6FF',
                  borderColor: '#2563EB'
                }
              }}
              onClick={(e) => e.stopPropagation()}
            >
              Choose Files
              <input 
                id="file-input"
                type="file" 
                multiple 
                hidden 
                onChange={handleFileInput}
                accept="image/*,application/pdf,audio/*,video/*"
              />
            </Button>
          </Paper>
        </Box>

        {/* Uploading Files */}
        {uploadingFiles.length > 0 && (
          <Paper 
            elevation={0}
            sx={{ 
              p: 2, 
              backgroundColor: 'white',
              border: '1px solid #E5E7EB',
              borderRadius: 2,
              mb: 2
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle2" sx={{ color: '#374151', fontWeight: 600 }}>
                Uploading Files ({uploadingFiles.length})
              </Typography>
              {uploadingFiles.some(f => f.status === 'error') && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleClearAllFailedUploads}
                  sx={{
                    fontSize: '12px',
                    color: '#EF4444',
                    borderColor: '#EF4444',
                    '&:hover': {
                      backgroundColor: '#FEF2F2',
                      borderColor: '#DC2626'
                    }
                  }}
                >
                  Clear All Failed
                </Button>
              )}
            </Box>
            <Stack spacing={2}>
              {uploadingFiles.map((fileData, i) => (
                <Box key={i} sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 2, 
                  p: 2,
                  backgroundColor: '#F9FAFB',
                  borderRadius: 2
                }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                      {fileData.file.name}
                    </Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={fileData.progress} 
                      sx={{ 
                        height: 6, 
                        borderRadius: 3,
                        backgroundColor: '#E5E7EB',
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: fileData.status === 'error' ? '#EF4444' : '#10B981'
                        }
                      }}
                    />
                    <Typography variant="caption" sx={{ color: '#6B7280', mt: 0.5, display: 'block' }}>
                      {fileData.status === 'uploading' && `${Math.round(fileData.progress)}% uploaded`}
                      {fileData.status === 'success' && 'Upload complete!'}
                      {fileData.status === 'error' && fileData.error}
                    </Typography>
                  </Box>
                  {fileData.status === 'success' && (
                    <CheckCircle sx={{ color: '#10B981', fontSize: 20 }} />
                  )}
                  {fileData.status === 'error' && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Error sx={{ color: '#EF4444', fontSize: 20 }} />
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveFailedUpload(fileData.file)}
                        sx={{ 
                          color: '#EF4444',
                          '&:hover': { 
                            backgroundColor: '#FEF2F2'
                          }
                        }}
                      >
                        <Delete />
                      </IconButton>
                    </Box>
                  )}
                </Box>
              ))}
            </Stack>
          </Paper>
        )}

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
                  borderRadius: 2
                }}>
                  <Chip 
                    label={u.name || u.path} 
                    size="small" 
                    sx={{ backgroundColor: 'white' }}
                  />
                  <Typography variant="caption" sx={{ color: '#6B7280' }}>
                    {u.mimeType.startsWith('image/') ? 'Image' : 
                     u.mimeType.startsWith('video/') ? 'Video' :
                     u.mimeType.startsWith('audio/') ? 'Audio' : 'Document'}
                  </Typography>
                  <Box sx={{ flex: 1 }} />
                  <IconButton 
                    size="small"
                    onClick={() => handleRemoveAttachment(i)}
                    sx={{ 
                      color: '#EF4444',
                      '&:hover': { 
                        backgroundColor: '#FEF2F2'
                      }
                    }}
                  >
                    <Delete />
                  </IconButton>
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
            disabled={!title || !content || saving || uploadingFiles.length > 0}
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


