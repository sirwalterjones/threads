import React, { useEffect, useState } from 'react';
import { Box, Button, Card, CardContent, TextField, Typography, Alert } from '@mui/material';
import apiService from '../services/api';
import { User } from '../types';

const Profile: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { apiService.getProfile().then(u => { setUser(u); setEmail(u.email || ''); }).catch(()=>{}); }, []);

  const save = async () => {
    try { setError(''); setMsg(''); const r = await apiService.updateProfile({ email }); setMsg('Profile updated'); }
    catch (e:any) { setError(e?.response?.data?.error || 'Update failed'); }
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
    </Box>
  );
};

export default Profile;



