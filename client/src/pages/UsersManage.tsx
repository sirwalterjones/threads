import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Stack,
  Chip,
  Select,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel
} from '@mui/material';
import apiService from '../services/api';
import { User } from '../types';

const UsersManage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);
  const [openNew, setOpenNew] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', email: '', password: '', role: 'view' });
  const [creating, setCreating] = useState(false);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    apiService.getUsers().then(setUsers).catch((e:any)=> setError(e?.response?.data?.error || 'Failed to load users'));
  }, []);

  const handleCreate = async () => {
    try {
      setCreating(true);
      setError('');
      setSuccess('');
      const payload = {
        username: newUser.username.trim(),
        email: newUser.email.trim(),
        password: newUser.password,
        role: newUser.role
      };
      const res = await apiService.register(payload as any);
      setUsers((prev) => [res.user as any, ...prev]);
      setOpenNew(false);
      setNewUser({ username: '', email: '', password: '', role: 'view' });
      setSuccess('User created');
    } catch (e:any) {
      setError(e?.response?.data?.error || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const handleSave = async (user: any, idx: number) => {
    try {
      setSavingId(user.id);
      setError('');
      setSuccess('');
      const res = await apiService.updateUser(user.id, {
        role: user.role,
        isActive: typeof user.isActive === 'boolean' ? user.isActive : user.is_active
      } as any);
      const updated = res.user as any;
      setUsers((prev) => {
        const copy = [...prev] as any[];
        copy[idx] = { ...copy[idx], ...updated } as any;
        return copy as any;
      });
      setSuccess('User updated');
    } catch (e:any) {
      setError(e?.response?.data?.error || 'Failed to update user');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>Users</Typography>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <Button variant="contained" onClick={() => setOpenNew(true)}>Add User</Button>
      </Stack>
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Box sx={{ display:'grid', gap:2, gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))' }}>
        {users.map((u: any, index) => {
          const role = u.role || 'view';
          const isActive = typeof u.isActive === 'boolean' ? u.isActive : !!u.is_active;
          return (
            <Card key={u.id}>
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                  <Typography variant="subtitle1">{u.username}</Typography>
                  <Chip label={role.toUpperCase()} size="small" />
                </Stack>
                <Typography variant="caption" color="text.secondary">{u.email}</Typography>
                <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel>Role</InputLabel>
                    <Select
                      label="Role"
                      value={role}
                      onChange={(e) => {
                        const val = e.target.value;
                        setUsers((prev:any)=> prev.map((x:any)=> x.id===u.id? { ...x, role: val }: x));
                      }}
                    >
                      <MenuItem value="admin">Admin</MenuItem>
                      <MenuItem value="edit">Edit</MenuItem>
                      <MenuItem value="view">View</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControlLabel
                    control={<Switch checked={isActive} onChange={(e)=>{
                      const checked = e.target.checked;
                      setUsers((prev:any)=> prev.map((x:any)=> x.id===u.id? { ...x, isActive: checked, is_active: checked }: x));
                    }} />}
                    label={isActive ? 'Active' : 'Inactive'}
                  />
                </Stack>
                <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                  <Button
                    variant="contained"
                    size="small"
                    disabled={savingId === u.id}
                    onClick={() => handleSave(users[index] as any, index)}
                  >
                    {savingId === u.id ? 'Saving...' : 'Save'}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Box>

      <Dialog open={openNew} onClose={() => setOpenNew(false)} fullWidth maxWidth="sm">
        <DialogTitle>New User</DialogTitle>
        <DialogContent>
          <TextField
            label="Username"
            fullWidth
            sx={{ mt: 1 }}
            value={newUser.username}
            onChange={(e)=> setNewUser((s)=> ({ ...s, username: e.target.value }))}
          />
          <TextField
            type="email"
            label="Email"
            fullWidth
            sx={{ mt: 2 }}
            value={newUser.email}
            onChange={(e)=> setNewUser((s)=> ({ ...s, email: e.target.value }))}
          />
          <TextField
            type="password"
            label="Password"
            fullWidth
            sx={{ mt: 2 }}
            value={newUser.password}
            onChange={(e)=> setNewUser((s)=> ({ ...s, password: e.target.value }))}
            helperText="Minimum 8 characters"
          />
          <TextField
            label="Role"
            select
            fullWidth
            sx={{ mt: 2 }}
            value={newUser.role}
            onChange={(e)=> setNewUser((s)=> ({ ...s, role: e.target.value }))}
          >
            <MenuItem value="admin">Admin</MenuItem>
            <MenuItem value="edit">Edit</MenuItem>
            <MenuItem value="view">View</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={()=> setOpenNew(false)} disabled={creating}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={creating || !newUser.username || !newUser.email || !newUser.password}> 
            {creating ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UsersManage;


