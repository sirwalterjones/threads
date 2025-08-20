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
      {/* Stats cards removed - content now flows directly */}
    </Box>
  );
};

export default Dashboard;


