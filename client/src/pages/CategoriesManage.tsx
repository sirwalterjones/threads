import React, { useEffect, useState } from 'react';
import { Box, Button, Card, CardContent, TextField, Typography, Alert } from '@mui/material';
import apiService from '../services/api';
import { Category } from '../types';

const CategoriesManage: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try { setLoading(true); setCategories(await apiService.getCategories()); }
      catch (e:any) { setError(e?.response?.data?.error || 'Failed to load categories'); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>Categories</Typography>
      {error && <Alert severity="error" sx={{ mb:2 }}>{error}</Alert>}
      <Box sx={{ display:'grid', gap:2, gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))' }}>
        {categories.map(c => (
          <Card key={c.id}><CardContent>
            <Typography variant="subtitle1">{c.name}</Typography>
            <Typography variant="caption" color="text.secondary">Slug: {c.slug}</Typography>
          </CardContent></Card>
        ))}
      </Box>
    </Box>
  );
};

export default CategoriesManage;


