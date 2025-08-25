import React, { useEffect, useState } from 'react';
import { Box, Button, Card, CardContent, TextField, Typography, Alert, Divider, Chip } from '@mui/material';
import { Security, CheckCircle, Warning } from '@mui/icons-material';
import apiService from '../services/api';
import { User } from '../types';

const Profile: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [twoFactorStatus, setTwoFactorStatus] = useState<{ enabled: boolean; required: boolean; backupCodesRemaining: number } | null>(null);
  const [loading2FA, setLoading2FA] = useState(false);

  useEffect(() => { 
    apiService.getProfile().then(u => { setUser(u); setEmail(u.email || ''); }).catch(()=>{});
    // Load 2FA status
    apiService.get2FAStatus().then(status => setTwoFactorStatus(status)).catch(() => {});
  }, []);

  const save = async () => {
    try { setError(''); setMsg(''); const r = await apiService.updateProfile({ email }); setMsg('Profile updated'); }
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
    <Box sx={{ p:2 }}>
      <Typography variant="h5" sx={{ mb:2 }}>Profile</Typography>
      {msg && <Alert sx={{ mb:2 }}>{msg}</Alert>}
      {error && <Alert severity="error" sx={{ mb:2 }}>{error}</Alert>}
      <Card><CardContent>
        <TextField label="Username" value={user?.username || ''} fullWidth InputProps={{ readOnly: true }} sx={{ mb:2 }} />
        <TextField label="Email" value={email} onChange={(e)=>setEmail(e.target.value)} fullWidth sx={{ mb:2 }} />
        <Button variant="contained" onClick={save}>Save</Button>
      </CardContent></Card>

      {/* 2FA Management Section */}
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Security sx={{ mr: 1, color: '#1D9BF0' }} />
            <Typography variant="h6">Two-Factor Authentication</Typography>
          </Box>
          
          {twoFactorStatus && (
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="body2">Status:</Typography>
                {twoFactorStatus.enabled ? (
                  <Chip 
                    icon={<CheckCircle />} 
                    label="Enabled" 
                    color="success" 
                    size="small" 
                  />
                ) : (
                  <Chip 
                    icon={<Warning />} 
                    label="Not Enabled" 
                    color="warning" 
                    size="small" 
                  />
                )}
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Typography variant="body2">Requirement:</Typography>
                {twoFactorStatus.required ? (
                  <Chip 
                    label="Required" 
                    color="error" 
                    size="small" 
                  />
                ) : (
                  <Chip 
                    label="Optional" 
                    color="default" 
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
                  sx={{ mr: 1 }}
                >
                  Enable 2FA Requirement
                </Button>
              )}

              <Typography variant="caption" sx={{ color: '#71767B', display: 'block', mt: 1 }}>
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



