import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Card, CardContent, MenuItem, TextField, Typography, Chip, Stack, Alert } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import DOMPurify from 'dompurify';
import { Editor } from '@tinymce/tinymce-react';
import { Category } from '../types';

const NewPost: React.FC = () => {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 16));
  const [uploads, setUploads] = useState<{url:string; path:string; mimeType:string; name?:string}[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const cats = await apiService.getCategories();
        setCategories(cats);
      } catch (e:any) {
        setError(e?.response?.data?.error || 'Failed to load categories');
      }
    };
    load();
  }, []);

  const tinyInit = useMemo(() => ({
    menubar: false,
    height: 360,
    plugins: 'lists link image code table autoresize',
    toolbar: 'undo redo | bold italic underline | bullist numlist | link image | code',
    branding: false
  }), []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const resp = await apiService.uploadFile(form);
      setUploads(prev => [...prev, { url: resp.url, path: resp.path, mimeType: resp.mimeType, name: file.name }]);
    } catch (e:any) {
      setError(e?.response?.data?.error || 'Upload failed');
    }
  };

  const insertAtCursor = (html: string) => {
    const quill = (document.querySelector('.ql-editor') as HTMLElement);
    if (!quill) return;
    const sanitized = DOMPurify.sanitize(html);
    const selection = window.getSelection();
    if (selection && selection.getRangeAt && selection.rangeCount) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const temp = document.createElement('div');
      temp.innerHTML = sanitized;
      const frag = document.createDocumentFragment();
      let node: ChildNode | null;
      while ((node = temp.firstChild)) {
        frag.appendChild(node);
      }
      range.insertNode(frag);
    } else {
      setContent(prev => prev + sanitized);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      // Server create API expects title, content, excerpt, categoryId, retentionDays
      await apiService.createPost({
        title,
        content,
        excerpt,
        categoryId,
        retentionDays: '365'
      });
      setSuccess('Post created');
      setTitle('');
      setContent('');
      setExcerpt('');
      setCategoryId('');
      setUploads([]);
    } catch (e:any) {
      setError(e?.response?.data?.error || 'Failed to create post');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>New Post</Typography>
      {error && (<Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>)}
      {success && (<Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>)}
      <Card>
        <CardContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 2 }}>
            <Box>
              <TextField
                label="Subject"
                value={title}
                onChange={(e)=>setTitle(e.target.value)}
                fullWidth
                required
                sx={{ mb: 2 }}
              />
              <Editor
                apiKey={''}
                value={content}
                init={tinyInit}
                onEditorChange={(v) => setContent(v)}
              />
              <TextField
                label="Summary (optional)"
                value={excerpt}
                onChange={(e)=>setExcerpt(e.target.value)}
                fullWidth
                multiline
                minRows={2}
                sx={{ mt: 2 }}
              />
            </Box>
            <Box>
              <TextField
                label="Date"
                type="datetime-local"
                value={date}
                onChange={(e)=>setDate(e.target.value)}
                fullWidth
                sx={{ mb: 2 }}
              />
              <TextField
                label="Author"
                value={user?.username || ''}
                fullWidth
                InputProps={{ readOnly: true }}
                sx={{ mb: 2 }}
              />
              <TextField
                label="Category"
                select
                value={categoryId}
                onChange={(e)=>setCategoryId(e.target.value)}
                fullWidth
                sx={{ mb: 2 }}
              >
                {categories.map(c => (
                  <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>
                ))}
              </TextField>
              <Button variant="outlined" component="label" fullWidth sx={{ mb: 1 }}>
                Upload Media
                <input type="file" hidden onChange={handleUpload} />
              </Button>
              {uploads.length > 0 && (
                <Box>
                  <Typography variant="subtitle2">Uploaded:</Typography>
                  <Stack direction="column" spacing={1} sx={{ mt: 1 }}>
                    {uploads.map((u, idx) => (
                      <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip label={u.name || u.path} size="small" />
                        <Button size="small" onClick={()=>insertAtCursor(`<a href="${u.url}" target="_blank" rel="noopener noreferrer">${u.name || 'attachment'}</a>`)}>Insert link</Button>
                        {u.mimeType.startsWith('image/') && (
                          <Button size="small" onClick={()=>insertAtCursor(`<img src="${u.url}" style=\"max-width:100%\" />`)}>Insert image</Button>
                        )}
                      </Box>
                    ))}
                  </Stack>
                </Box>
              )}
              <Button variant="contained" onClick={handleSubmit} disabled={submitting || !title || !content || !categoryId} fullWidth sx={{ mt: 2 }}>
                {submitting ? 'Saving...' : 'Create Post'}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default NewPost;


