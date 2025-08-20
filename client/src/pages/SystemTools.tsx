import React, { useState } from 'react';
import { Box, Button, Typography, Alert, Stack } from '@mui/material';
import apiService from '../services/api';

const SystemTools: React.FC = () => {
  const [msg, setMsg] = useState<string>('');
  const [error, setError] = useState<string>('');

  const runIngest = async () => {
    try { setError(''); const r = await apiService.ingestWordPressData(); setMsg('Full ingestion started'); } catch (e:any) { setError(e?.response?.data?.error || 'Failed to start ingestion'); }
  };

  const runIncrementalSync = async () => {
    try { 
      setError(''); 
      setMsg('Starting incremental sync...');
      const r = await apiService.ingestWordPressDataIncremental(); 
      setMsg(`Incremental sync completed: ${r.result?.newPosts || 0} new posts ingested`); 
    } catch (e:any) { 
      setError(e?.response?.data?.error || 'Failed to start incremental sync'); 
    }
  };

  const runPurge = async () => {
    try { setError(''); const r = await apiService.purgeExpiredData(); setMsg(`Purged ${r.purgedCount} items`); } catch (e:any) { setError(e?.response?.data?.error || 'Failed to purge'); }
  };

  return (
    <Box sx={{ p:2 }}>
      <Typography variant="h5" sx={{ mb:2 }}>System Tools</Typography>
      {msg && <Alert sx={{ mb:2 }}>{msg}</Alert>}
      {error && <Alert severity="error" sx={{ mb:2 }}>{error}</Alert>}
      <Stack direction="row" spacing={2}>
        <Button variant="contained" onClick={runIncrementalSync}>Quick Sync (New Posts)</Button>
        <Button variant="outlined" onClick={runIngest}>Full Sync from WordPress</Button>
        <Button variant="outlined" color="error" onClick={runPurge}>Purge Expired</Button>
      </Stack>
    </Box>
  );
};

export default SystemTools;



