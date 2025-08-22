import React, { useEffect, useState } from 'react';
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
  FormControlLabel,
  IconButton
} from '@mui/material';
import { Edit as EditIcon } from '@mui/icons-material';
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
  const [editDialog, setEditDialog] = useState<{ open: boolean; user: any }>({ open: false, user: null });
  const [editUser, setEditUser] = useState({ username: '', email: '', password: '', role: 'view' });
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    apiService.getUsers().then((data) => {
      // Ensure we always get an array
      setUsers(Array.isArray(data) ? data : []);
    }).catch((e:any)=> setError(e?.response?.data?.error || 'Failed to load users'));
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

  const openEditDialog = (user: any) => {
    setEditUser({
      username: user.username,
      email: user.email,
      password: '',
      role: user.role
    });
    setEditDialog({ open: true, user });
  };

  const closeEditDialog = () => {
    setEditDialog({ open: false, user: null });
    setEditUser({ username: '', email: '', password: '', role: 'view' });
  };

  const handleEdit = async () => {
    try {
      setEditing(true);
      setError('');
      setSuccess('');
      
      const updateData: any = {};
      
      // Only include fields that have changed
      if (editUser.username !== editDialog.user.username) {
        updateData.username = editUser.username.trim();
      }
      if (editUser.email !== editDialog.user.email) {
        updateData.email = editUser.email.trim();
      }
      if (editUser.password) {
        updateData.password = editUser.password;
      }
      if (editUser.role !== editDialog.user.role) {
        updateData.role = editUser.role;
      }
      
      if (Object.keys(updateData).length === 0) {
        setError('No changes to save');
        return;
      }
      
      const res = await apiService.updateUser(editDialog.user.id, updateData);
      const updated = res.user as any;
      
      setUsers((prev) => prev.map(u => u.id === editDialog.user.id ? { ...u, ...updated } : u));
      closeEditDialog();
      setSuccess('User updated successfully');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to update user');
    } finally {
      setEditing(false);
    }
  };

  return (
    <Box sx={{ p: 2, bgcolor: 'background.default', color: 'text.primary', minHeight: '100vh' }}>
      <Typography variant="h5" sx={{ mb: 2, color: 'text.primary' }}>Users</Typography>
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
            <Card key={u.id} sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="subtitle1" sx={{ color: 'text.primary' }}>{u.username}</Typography>
                    <IconButton size="small" onClick={() => openEditDialog(u)} sx={{ color: 'text.secondary' }}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                  <Chip label={role.toUpperCase()} size="small" />
                </Stack>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>{u.email}</Typography>
                <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel sx={{ color: 'text.primary' }}>Role</InputLabel>
                    <Select
                      label="Role"
                      value={role}
                      sx={{ color: 'text.primary', '.MuiOutlinedInput-notchedOutline': { borderColor: 'divider' } }}
                      onChange={(e) => {
                        const val = e.target.value;
                        setUsers((prev:any)=> prev.map((x:any)=> x.id===u.id? { ...x, role: val }: x));
                      }}
                    >
                      <MenuItem value="admin" sx={{ color: 'text.primary' }}>Admin</MenuItem>
                      <MenuItem value="edit" sx={{ color: 'text.primary' }}>Edit</MenuItem>
                      <MenuItem value="view" sx={{ color: 'text.primary' }}>View</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControlLabel
                    control={<Switch checked={isActive} onChange={(e)=>{
                      const checked = e.target.checked;
                      setUsers((prev:any)=> prev.map((x:any)=> x.id===u.id? { ...x, isActive: checked, is_active: checked }: x));
                    }} />}
                    label={<span style={{ color: 'inherit' }}>{isActive ? 'Active' : 'Inactive'}</span>}
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
        <DialogTitle sx={{ color: 'text.primary', bgcolor: 'background.paper' }}>New User</DialogTitle>
        <DialogContent sx={{ bgcolor: 'background.paper' }}>
          <TextField
            label="Username"
            fullWidth
            sx={{ mt: 1, '& .MuiInputLabel-root': { color: 'text.secondary' }, '& .MuiOutlinedInput-root': { color: 'text.primary', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' } } }}
            value={newUser.username}
            onChange={(e)=> setNewUser((s)=> ({ ...s, username: e.target.value }))}
          />
          <TextField
            type="email"
            label="Email"
            fullWidth
            sx={{ mt: 2, '& .MuiInputLabel-root': { color: 'text.secondary' }, '& .MuiOutlinedInput-root': { color: 'text.primary', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' } } }}
            value={newUser.email}
            onChange={(e)=> setNewUser((s)=> ({ ...s, email: e.target.value }))}
          />
          <TextField
            type="password"
            label="Password"
            fullWidth
            sx={{ mt: 2, '& .MuiInputLabel-root': { color: 'text.secondary' }, '& .MuiOutlinedInput-root': { color: 'text.primary', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' } } }}
            value={newUser.password}
            onChange={(e)=> setNewUser((s)=> ({ ...s, password: e.target.value }))}
            helperText="Minimum 8 characters"
          />
          <TextField
            label="Role"
            select
            fullWidth
            sx={{ mt: 2, '& .MuiInputLabel-root': { color: 'text.secondary' }, '& .MuiOutlinedInput-root': { color: 'text.primary', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' } } }}
            value={newUser.role}
            onChange={(e)=> setNewUser((s)=> ({ ...s, role: e.target.value }))}
          >
            <MenuItem value="admin">Admin</MenuItem>
            <MenuItem value="edit">Edit</MenuItem>
            <MenuItem value="view">View</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions sx={{ bgcolor: 'background.paper', borderTop: '1px solid', borderColor: 'divider' }}>
          <Button onClick={()=> setOpenNew(false)} disabled={creating} sx={{ color: 'text.primary' }}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={creating || !newUser.username || !newUser.email || !newUser.password}> 
            {creating ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editDialog.open} onClose={closeEditDialog} fullWidth maxWidth="sm">
        <DialogTitle sx={{ color: 'text.primary', bgcolor: 'background.paper' }}>Edit User</DialogTitle>
        <DialogContent sx={{ bgcolor: 'background.paper' }}>
          <TextField
            label="Username"
            fullWidth
            sx={{ mt: 1, '& .MuiInputLabel-root': { color: 'text.secondary' }, '& .MuiOutlinedInput-root': { color: 'text.primary', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' } } }}
            value={editUser.username}
            onChange={(e) => setEditUser((s) => ({ ...s, username: e.target.value }))}
          />
          <TextField
            type="email"
            label="Email"
            fullWidth
            sx={{ mt: 2, '& .MuiInputLabel-root': { color: 'text.secondary' }, '& .MuiOutlinedInput-root': { color: 'text.primary', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' } } }}
            value={editUser.email}
            onChange={(e) => setEditUser((s) => ({ ...s, email: e.target.value }))}
          />
          <TextField
            type="password"
            label="New Password (leave blank to keep current)"
            fullWidth
            sx={{ mt: 2, '& .MuiInputLabel-root': { color: 'text.secondary' }, '& .MuiOutlinedInput-root': { color: 'text.primary', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' } } }}
            value={editUser.password}
            onChange={(e) => setEditUser((s) => ({ ...s, password: e.target.value }))}
            helperText="Minimum 8 characters if changing password"
          />
          <TextField
            label="Role"
            select
            fullWidth
            sx={{ mt: 2, '& .MuiInputLabel-root': { color: 'text.secondary' }, '& .MuiOutlinedInput-root': { color: 'text.primary', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' } } }}
            value={editUser.role}
            onChange={(e) => setEditUser((s) => ({ ...s, role: e.target.value }))}
          >
            <MenuItem value="admin" sx={{ color: 'text.primary' }}>Admin</MenuItem>
            <MenuItem value="edit" sx={{ color: 'text.primary' }}>Edit</MenuItem>
            <MenuItem value="view" sx={{ color: 'text.primary' }}>View</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions sx={{ bgcolor: 'background.paper', borderTop: '1px solid', borderColor: 'divider' }}>
          <Button onClick={closeEditDialog} disabled={editing} sx={{ color: 'text.primary' }}>Cancel</Button>
          <Button variant="contained" onClick={handleEdit} disabled={editing || !editUser.username || !editUser.email}>
            {editing ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UsersManage;


