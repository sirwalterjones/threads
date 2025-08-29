import React, { useEffect, useState } from 'react';
import { Box, Button, Card, CardContent, TextField, Typography, Alert, Divider, Chip, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { Security, CheckCircle, Warning, AccessTime } from '@mui/icons-material';
import apiService from '../services/api';
import { User } from '../types';

const Profile: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [twoFactorStatus, setTwoFactorStatus] = useState<{ enabled: boolean; required: boolean; backupCodesRemaining: number } | null>(null);
  const [loading2FA, setLoading2FA] = useState(false);
  const [sessionDuration, setSessionDuration] = useState<number>(24);

  useEffect(() => { 
    apiService.getProfile().then(u => { 
      setUser(u); 
      setEmail(u.email || ''); 
      // Set session duration from user profile
      if ((u as any).session_duration_hours) {
        setSessionDuration((u as any).session_duration_hours);
      }
    }).catch(()=>{});
    // Load 2FA status
    apiService.get2FAStatus().then(status => setTwoFactorStatus(status)).catch(() => {});
  }, []);

  const save = async () => {
    try { 
      setError(''); 
      setMsg(''); 
      // Update profile with email and session duration
      const r = await apiService.updateProfile({ 
        email, 
        session_duration_hours: sessionDuration 
      }); 
      setMsg('Profile updated. You will need to log in again for session duration changes to take effect.'); 
    }
    catch (e:any) { setError(e?.response?.data?.error || 'Update failed'); }
  };

  const enable2FARequirement = async () => {
    try {
      setLoading2FA(true);
      setError('');
      await apiService.enable2FARequirement();
      setMsg('2FA requirement enabled. You will be prompted to set up 2FA on next login.');
      // Refresh 2FA status
      const status = await apiService.get2FAStatus();
      setTwoFactorStatus(status);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to enable 2FA requirement');
    } finally {
      setLoading2FA(false);
    }
  };

  return (
    <Box sx={{ 
      p: 2, 
      bgcolor: '#0F1419', 
      color: '#E7E9EA', 
      minHeight: '100vh',
      '& .MuiPaper-root': {
        bgcolor: '#16202A !important',
        color: '#E7E9EA !important'
      }
    }}>
      <Typography variant="h5" sx={{ mb: 2, color: '#E7E9EA' }}>Profile</Typography>
      {msg && <Alert severity="success" sx={{ mb: 2, bgcolor: '#2E7D32', color: '#E7E9EA' }}>{msg}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2, bgcolor: '#D32F2F', color: '#E7E9EA' }}>{error}</Alert>}
      
      <Card sx={{ 
        bgcolor: '#16202A', 
        border: '1px solid #2F3336', 
        color: '#E7E9EA'
      }}>
        <CardContent>
          <TextField 
            label="Username" 
            value={user?.username || ''} 
            fullWidth 
            InputProps={{ readOnly: true }}
            sx={{ 
              mb: 2,
              '& .MuiInputLabel-root': { color: '#8B98A5' },
              '& .MuiInputLabel-root.Mui-focused': { color: '#E7E9EA' },
              '& .MuiOutlinedInput-root': { 
                color: '#E7E9EA',
                backgroundColor: '#1A1A1A',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#2F3336' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#4A4A4A' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1D9BF0' },
                '& input': {
                  color: '#E7E9EA',
                  '&:-webkit-autofill': {
                    WebkitBoxShadow: '0 0 0 1000px #1A1A1A inset',
                    WebkitTextFillColor: '#E7E9EA'
                  }
                }
              }
            }} 
          />
          <TextField 
            label="Email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            fullWidth 
            sx={{ 
              mb: 2,
              '& .MuiInputLabel-root': { color: '#8B98A5' },
              '& .MuiInputLabel-root.Mui-focused': { color: '#E7E9EA' },
              '& .MuiOutlinedInput-root': { 
                color: '#E7E9EA',
                backgroundColor: '#1A1A1A',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#2F3336' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#4A4A4A' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1D9BF0' },
                '& input': {
                  color: '#E7E9EA',
                  '&:-webkit-autofill': {
                    WebkitBoxShadow: '0 0 0 1000px #1A1A1A inset',
                    WebkitTextFillColor: '#E7E9EA'
                  }
                }
              }
            }} 
          />
          
          {/* Session Duration Selection */}
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel sx={{ color: '#8B98A5', '&.Mui-focused': { color: '#E7E9EA' } }}>
              Session Duration
            </InputLabel>
            <Select
              value={sessionDuration}
              onChange={(e) => setSessionDuration(e.target.value as number)}
              label="Session Duration"
              sx={{
                color: '#E7E9EA',
                backgroundColor: '#1A1A1A',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#2F3336' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#4A4A4A' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1D9BF0' },
                '& .MuiSelect-icon': { color: '#8B98A5' }
              }}
            >
              <MenuItem value={1}>1 Hour</MenuItem>
              <MenuItem value={2}>2 Hours</MenuItem>
              <MenuItem value={4}>4 Hours</MenuItem>
              <MenuItem value={8}>8 Hours</MenuItem>
              <MenuItem value={12}>12 Hours</MenuItem>
              <MenuItem value={24}>24 Hours (1 Day)</MenuItem>
              <MenuItem value={48}>48 Hours (2 Days)</MenuItem>
              <MenuItem value={72}>72 Hours (3 Days)</MenuItem>
              <MenuItem value={168}>168 Hours (1 Week)</MenuItem>
              <MenuItem value={336}>336 Hours (2 Weeks)</MenuItem>
              <MenuItem value={720}>720 Hours (30 Days)</MenuItem>
            </Select>
          </FormControl>
          
          <Typography variant="caption" sx={{ display: 'block', mb: 2, color: '#8B98A5' }}>
            <AccessTime sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
            Session duration determines how long you stay logged in. Shorter durations are more secure.
          </Typography>
          
          <Button 
            variant="contained" 
            onClick={save}
            sx={{ 
              bgcolor: '#1976d2',
              '&:hover': { bgcolor: '#1565c0' }
            }}
          >
            Save
          </Button>
        </CardContent>
      </Card>

      {/* 2FA Management Section */}
      <Card sx={{ 
        mt: 2, 
        bgcolor: '#16202A', 
        border: '1px solid #2F3336', 
        color: '#E7E9EA'
      }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Security sx={{ mr: 1, color: '#1D9BF0' }} />
            <Typography variant="h6" sx={{ color: '#E7E9EA' }}>Two-Factor Authentication</Typography>
          </Box>
          
          {twoFactorStatus && (
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="body2" sx={{ color: '#E7E9EA' }}>Status:</Typography>
                {twoFactorStatus.enabled ? (
                  <Chip 
                    icon={<CheckCircle />} 
                    label="Enabled" 
                    sx={{
                      bgcolor: '#2E7D32',
                      color: '#E7E9EA',
                      '& .MuiChip-icon': { color: '#E7E9EA' }
                    }}
                    size="small" 
                  />
                ) : (
                  <Chip 
                    icon={<Warning />} 
                    label="Not Enabled" 
                    sx={{
                      bgcolor: '#FF8F00',
                      color: '#E7E9EA',
                      '& .MuiChip-icon': { color: '#E7E9EA' }
                    }}
                    size="small" 
                  />
                )}
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Typography variant="body2" sx={{ color: '#E7E9EA' }}>Requirement:</Typography>
                {twoFactorStatus.required ? (
                  <Chip 
                    label="Required" 
                    sx={{
                      bgcolor: '#D32F2F',
                      color: '#E7E9EA'
                    }}
                    size="small" 
                  />
                ) : (
                  <Chip 
                    label="Optional" 
                    sx={{
                      bgcolor: '#2F3336',
                      color: '#E7E9EA'
                    }}
                    size="small" 
                  />
                )}
              </Box>

              {!twoFactorStatus.required && (
                <Button
                  variant="outlined"
                  onClick={enable2FARequirement}
                  disabled={loading2FA}
                  startIcon={<Security />}
                  sx={{ 
                    mr: 1,
                    color: '#1D9BF0',
                    borderColor: '#1D9BF0',
                    '&:hover': { 
                      borderColor: '#1976d2',
                      backgroundColor: 'rgba(29, 155, 240, 0.1)'
                    }
                  }}
                >
                  Enable 2FA Requirement
                </Button>
              )}

              <Typography variant="caption" sx={{ color: '#8B98A5', display: 'block', mt: 1 }}>
                {twoFactorStatus.required 
                  ? '2FA is required for your account. You will be prompted to set it up on next login.'
                  : '2FA is optional. Enable the requirement to be prompted to set it up on next login.'
                }
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default Profile;



