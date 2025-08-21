import React, { useState } from 'react';
import { Box, Button, Typography, Alert, Card, CardContent } from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import apiService from '../services/api';

const DataManagement: React.FC = () => {
  const [msg, setMsg] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const runPurge = async () => {
    try { 
      setError(''); 
      setLoading(true);
      setMsg('Purging expired data...');
      const r = await apiService.purgeExpiredData(); 
      setMsg(`Successfully purged ${r.purgedCount} expired items`); 
    } catch (e: any) { 
      setError(e?.response?.data?.error || 'Failed to purge expired data'); 
      setMsg('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 800 }}>
      <Typography variant="h4" sx={{ 
        mb: 3, 
        color: '#E7E9EA',
        fontWeight: 700 
      }}>
        Data Management
      </Typography>

      <Card sx={{ 
        backgroundColor: '#16181C', 
        border: '1px solid #2F3336',
        borderRadius: 2
      }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ 
            mb: 2, 
            color: '#E7E9EA',
            fontWeight: 600 
          }}>
            Expired Data Cleanup
          </Typography>
          
          <Typography variant="body2" sx={{ 
            mb: 3, 
            color: '#71767B',
            lineHeight: 1.6 
          }}>
            Remove expired threads and data that are past their retention period. 
            This action cannot be undone and will permanently delete expired content.
          </Typography>

          {msg && (
            <Alert 
              severity="success" 
              sx={{ 
                mb: 2,
                backgroundColor: '#10B981',
                color: 'white',
                '& .MuiAlert-icon': { color: 'white' }
              }}
            >
              {msg}
            </Alert>
          )}
          
          {error && (
            <Alert 
              severity="error" 
              sx={{ 
                mb: 2,
                backgroundColor: '#EF4444',
                color: 'white',
                '& .MuiAlert-icon': { color: 'white' }
              }}
            >
              {error}
            </Alert>
          )}

          <Button 
            variant="contained" 
            color="error"
            onClick={runPurge}
            disabled={loading}
            startIcon={<DeleteIcon />}
            sx={{
              backgroundColor: '#EF4444',
              '&:hover': { backgroundColor: '#DC2626' },
              '&:disabled': { backgroundColor: '#374151' },
              borderRadius: 2,
              px: 3,
              py: 1.5
            }}
          >
            {loading ? 'Purging...' : 'Purge Expired Data'}
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
};

export default DataManagement;