import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem, Box, Stack, Chip, Alert, Divider, Paper, Typography } from '@mui/material';
import { Editor } from '@tinymce/tinymce-react';
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
  const [editorReady, setEditorReady] = useState(false);
  const [showEditorFallback, setShowEditorFallback] = useState(false);

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

  const tinyInit = useMemo(() => ({
    menubar: false,
    height: 300,
    plugins: 'lists link image code table autoresize',
    toolbar: 'undo redo | bold italic underline | bullist numlist | link image | code',
    branding: false,
    base_url: '/tinymce',
    suffix: ''
  }), []);

  // If TinyMCE cannot load due to CSP, show a styled multiline fallback after a brief timeout
  useEffect(() => {
    if (!open) return;
    setEditorReady(false);
    setShowEditorFallback(false);
    const t = setTimeout(() => {
      if (!editorReady) setShowEditorFallback(true);
    }, 800);
    return () => clearTimeout(t);
  }, [open, editorReady]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const resp = await apiService.uploadFile(form);
      setUploads(prev => [...prev, { url: resp.url, path: resp.path, mimeType: resp.mimeType, name: file.name }]);
    } catch (err:any) {
      setError(err?.response?.data?.error || 'Upload failed');
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
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <Typography variant="h6" fontWeight={600}>{post ? 'Edit Post' : 'New Post'}</Typography>
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" onClick={submit} disabled={!title || !content || saving}>{saving ? (post ? 'Saving...' : 'Saving...') : (post ? 'Save Changes' : 'Create')}</Button>
        </Stack>
      </DialogTitle>
      <DialogContent dividers sx={{ bgcolor: 'background.default' }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {/* Top form row */}
        <Stack direction={{ xs:'column', md:'row' }} spacing={2} sx={{ mb: 2 }}>
          <TextField label="Subject" fullWidth required value={title} onChange={(e)=>setTitle(e.target.value)} />
        </Stack>

        {/* Rich editor / fallback */}
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
          {!showEditorFallback ? (
            <Editor
              value={content}
              init={tinyInit}
              onEditorChange={setContent}
              onInit={() => setEditorReady(true)}
            />
          ) : (
            <TextField
              label="Content"
              fullWidth
              multiline
              minRows={8}
              value={content}
              onChange={(e)=> setContent(e.target.value)}
              helperText="Rich editor blocked? Using fallback editor."
            />
          )}
        </Paper>

        {/* Uploads */}
        <Box sx={{ mt: 2 }}>
          <Button variant="outlined" component="label">
            Upload Media
            <input type="file" hidden onChange={handleUpload} />
          </Button>
        </Box>

        {uploads.length > 0 && (
          <Paper variant="outlined" sx={{ mt: 2, p: 1.5 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Uploaded</Typography>
            <Stack spacing={1}>
              {uploads.map((u, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap:'wrap' }}>
                  <Chip label={u.name || u.path} size="small" />
                  <Button size="small" onClick={()=>insertHtml(`<a href=\"${u.url}\" target=\"_blank\" rel=\"noopener noreferrer\">${u.name || 'attachment'}</a>`)}>Insert link</Button>
                  {u.mimeType.startsWith('image/') && (
                    <Button size="small" onClick={()=>insertHtml(`<img src=\"${u.url}\" style=\"max-width:100%\" />`)}>Insert image</Button>
                  )}
                </Box>
              ))}
            </Stack>
          </Paper>
        )}
      </DialogContent>
      <DialogActions sx={{ display:'flex', justifyContent:'space-between' }}>
        <Box sx={{ color:'text.secondary', fontSize: 12 }}>Category, author, and date are set automatically.</Box>
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" onClick={submit} disabled={!title || !content || saving}>{saving ? (post ? 'Saving...' : 'Saving...') : (post ? 'Save Changes' : 'Create')}</Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
};

export default NewPostModal;


