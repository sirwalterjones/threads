import React, { useEffect, useState } from 'react';
import { Box, Card, CardContent, Typography, CircularProgress, Alert } from '@mui/material';
import apiService from '../services/api';

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await apiService.getDashboardStats();
        setStats(data);
      } catch (e: any) {
        setError(e?.response?.data?.error || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <Box sx={{ display:'flex', justifyContent:'center', py:4 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>Dashboard</Typography>
      <Box sx={{ display:'grid', gap:2, gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <Card><CardContent>
          <Typography variant="overline">Total Posts</Typography>
          <Typography variant="h4">{stats?.counts?.totalPosts ?? '-'}</Typography>
        </CardContent></Card>
        <Card><CardContent>
          <Typography variant="overline">Categories</Typography>
          <Typography variant="h4">{stats?.counts?.totalCategories ?? '-'}</Typography>
        </CardContent></Card>
        <Card><CardContent>
          <Typography variant="overline">Users</Typography>
          <Typography variant="h4">{stats?.counts?.totalUsers ?? '-'}</Typography>
        </CardContent></Card>
      </Box>
    </Box>
  );
};

export default Dashboard;


