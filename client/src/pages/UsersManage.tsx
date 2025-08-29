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
  IconButton,
  Checkbox
} from '@mui/material';
import { 
  Edit as EditIcon,
  Security as SecurityIcon,
  LockReset as ResetIcon,
  Shield as ShieldIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import apiService from '../services/api';
import auditService from '../services/auditService';
import { User } from '../types';

const UsersManage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);
  const [openNew, setOpenNew] = useState(false);
  const [newUser, setNewUser] = useState({ 
    username: '', 
    email: '', 
    password: '', 
    role: 'view',
    modules: {
      search: true,
      hotlist: true,
      bolo: true,
      intel: true
    }
  });
  const [require2FA, setRequire2FA] = useState<boolean>(false);
  const [creating, setCreating] = useState(false);
  const [success, setSuccess] = useState('');
  const [editDialog, setEditDialog] = useState<{ open: boolean; user: any }>({ open: false, user: null });
  const [editUser, setEditUser] = useState({ username: '', email: '', password: '', role: 'view' });
  const [editing, setEditing] = useState(false);
  const [force2FADialog, setForce2FADialog] = useState<{ open: boolean; user: any; setup?: any }>({ open: false, user: null });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; user: any }>({ open: false, user: null });
  const [deleting, setDeleting] = useState(false);

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
        role: newUser.role,
        modules: newUser.modules
      };
      const res = await apiService.register(payload as any);
      // If admin opted to require 2FA at setup, toggle it on the new user
      try {
        if (require2FA && res?.user?.id) {
          await apiService.adminToggle2FARequirement(String(res.user.id), true);
        }
      } catch (_) { /* non-blocking */ }
      setUsers((prev) => [res.user as any, ...prev]);
      
      // Track user creation
      await auditService.trackUserCreate(res.user.id, {
        username: payload.username,
        email: payload.email,
        role: payload.role
      });
      
      setOpenNew(false);
      setNewUser({ 
        username: '', 
        email: '', 
        password: '', 
        role: 'view',
        modules: {
          search: true,
          hotlist: true,
          bolo: true,
          intel: true
        }
      });
      setRequire2FA(false);
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
      
      // Track user edit
      await auditService.trackUserEdit(user.id, {
        role: user.role,
        isActive: typeof user.isActive === 'boolean' ? user.isActive : user.is_active
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
      
      // Track user edit with actual changes
      await auditService.trackUserEdit(editDialog.user.id, updateData);
      
      closeEditDialog();
      setSuccess('User updated successfully');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to update user');
    } finally {
      setEditing(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.user) return;
    
    try {
      setDeleting(true);
      setError('');
      await apiService.deleteUser(deleteDialog.user.id);
      
      // Remove user from state
      setUsers(prev => prev.filter(u => u.id !== deleteDialog.user.id));
      
      // Track deletion
      await auditService.trackUserDelete(deleteDialog.user.id, deleteDialog.user.username);
      
      setDeleteDialog({ open: false, user: null });
      setSuccess(`User ${deleteDialog.user.username} deleted successfully`);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to delete user');
    } finally {
      setDeleting(false);
    }
  };

  const handleReset2FA = async (userId: number, username: string) => {
    if (!window.confirm(`Reset 2FA for user ${username}? This will require them to set up 2FA again.`)) {
      return;
    }

    try {
      setError('');
      setSuccess('');
      await apiService.adminReset2FA(userId.toString());
      setSuccess(`2FA reset for user ${username}`);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to reset 2FA');
    }
  };

  const handleToggle2FARequirement = async (userId: number, username: string, required: boolean) => {
    try {
      setError('');
      setSuccess('');
      await apiService.adminToggle2FARequirement(userId.toString(), required);
      setSuccess(`2FA requirement ${required ? 'enabled' : 'disabled'} for user ${username}`);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to toggle 2FA requirement');
    }
  };

  const handleForceEnable2FA = async (userId: number, username: string) => {
    if (!window.confirm(`Force enable 2FA for user ${username}? This will generate new 2FA credentials that you'll need to share with the user.`)) {
      return;
    }

    try {
      setError('');
      setSuccess('');
      const result = await apiService.adminForceEnable2FA(userId.toString());
      setForce2FADialog({ 
        open: true, 
        user: { id: userId, username }, 
        setup: result.setup 
      });
      setSuccess(`2FA force enabled for user ${username}`);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to force enable 2FA');
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
      <Typography variant="h5" sx={{ mb: 2, color: '#E7E9EA' }}>Users</Typography>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <Button 
          variant="contained" 
          onClick={() => setOpenNew(true)}
          sx={{ 
            bgcolor: '#1976d2',
            '&:hover': { bgcolor: '#1565c0' }
          }}
        >
          Add User
        </Button>
      </Stack>
      {success && <Alert severity="success" sx={{ mb: 2, bgcolor: '#2E7D32', color: '#E7E9EA' }}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2, bgcolor: '#D32F2F', color: '#E7E9EA' }}>{error}</Alert>}
      <Box sx={{ display:'grid', gap:2, gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))' }}>
        {users.map((u: any, index) => {
          const role = u.role || 'view';
          const isActive = typeof u.isActive === 'boolean' ? u.isActive : !!u.is_active;
          return (
            <Card key={u.id} sx={{ 
              bgcolor: '#16202A', 
              border: '1px solid #2F3336', 
              color: '#E7E9EA'
            }}>
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="subtitle1" sx={{ color: '#E7E9EA' }}>{u.username}</Typography>
                    <IconButton size="small" onClick={() => openEditDialog(u)} sx={{ color: '#8B98A5' }}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    {!u.super_admin && (
                      <IconButton 
                        size="small" 
                        onClick={() => setDeleteDialog({ open: true, user: u })} 
                        sx={{ color: '#ff4757' }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Stack>
                  <Chip label={role.toUpperCase()} size="small" sx={{ bgcolor: '#2F3336', color: '#E7E9EA' }} />
                </Stack>
                <Typography variant="caption" sx={{ color: '#8B98A5' }}>{u.email}</Typography>
                <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel sx={{ color: '#E7E9EA' }}>Role</InputLabel>
                    <Select
                      label="Role"
                      value={role}
                      sx={{ 
                        color: '#E7E9EA', 
                        '.MuiOutlinedInput-notchedOutline': { borderColor: '#2F3336' },
                        '.MuiSvgIcon-root': { color: '#E7E9EA' }
                      }}
                      onChange={(e) => {
                        const val = e.target.value;
                        setUsers((prev:any)=> prev.map((x:any)=> x.id===u.id? { ...x, role: val }: x));
                      }}
                    >
                      <MenuItem value="admin" sx={{ color: '#E7E9EA', bgcolor: '#16202A' }}>Admin</MenuItem>
                      <MenuItem value="edit" sx={{ color: '#E7E9EA', bgcolor: '#16202A' }}>Edit</MenuItem>
                      <MenuItem value="view" sx={{ color: '#E7E9EA', bgcolor: '#16202A' }}>View</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControlLabel
                    control={<Switch 
                      checked={isActive} 
                      onChange={(e)=>{
                        const checked = e.target.checked;
                        setUsers((prev:any)=> prev.map((x:any)=> x.id===u.id? { ...x, isActive: checked, is_active: checked }: x));
                      }}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': {
                          color: '#1976d2',
                        },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                          backgroundColor: '#1976d2',
                        },
                      }}
                    />}
                    label={<span style={{ color: '#E7E9EA' }}>{isActive ? 'Active' : 'Inactive'}</span>}
                  />
                </Stack>
                <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                  <Button
                    variant="contained"
                    size="small"
                    disabled={savingId === u.id}
                    onClick={() => handleSave(users[index] as any, index)}
                    sx={{ 
                      bgcolor: '#1976d2',
                      '&:hover': { bgcolor: '#1565c0' },
                      '&:disabled': { bgcolor: '#2F3336', color: '#8B98A5' }
                    }}
                  >
                    {savingId === u.id ? 'Saving...' : 'Save'}
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<ResetIcon fontSize="small" />}
                    onClick={() => handleReset2FA(u.id, u.username)}
                    sx={{ 
                      color: '#FFC107',
                      borderColor: '#FFC107',
                      '&:hover': { 
                        borderColor: '#FFB300',
                        backgroundColor: 'rgba(255, 193, 7, 0.1)'
                      }
                    }}
                  >
                    Reset 2FA
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<ShieldIcon fontSize="small" />}
                    onClick={() => handleForceEnable2FA(u.id, u.username)}
                    sx={{ 
                      color: '#4CAF50',
                      borderColor: '#4CAF50',
                      '&:hover': { 
                        borderColor: '#45A049',
                        backgroundColor: 'rgba(76, 175, 80, 0.1)'
                      }
                    }}
                  >
                    Force 2FA
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Box>

      <Dialog 
        open={openNew} 
        onClose={() => setOpenNew(false)} 
        fullWidth 
        maxWidth="sm"
        PaperProps={{
          sx: {
            bgcolor: '#16202A',
            color: '#E7E9EA'
          }
        }}
      >
        <DialogTitle sx={{ color: '#E7E9EA', bgcolor: '#16202A' }}>New User</DialogTitle>
        <DialogContent sx={{ bgcolor: '#16202A' }}>
          <TextField
            label="Username"
            fullWidth
            sx={{ 
              mt: 1,
              '& .MuiInputLabel-root': { color: '#8B98A5' },
              '& .MuiInputLabel-root.Mui-focused': { color: '#E7E9EA' },
              '& .MuiOutlinedInput-root': { 
                color: '#E7E9EA',
                backgroundColor:'#1A1A1A',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#2F3336' },
                '&:hover .MuiOutlinedInput-notchedOutline':{ borderColor:'#4A4A4A' },
                '& input': {
                  color:'#E7E9EA',
                  '&:-webkit-autofill': {
                    WebkitBoxShadow: '0 0 0 1000px #1A1A1A inset',
                    WebkitTextFillColor: '#E7E9EA'
                  }
                }
              }
            }}
            value={newUser.username}
            onChange={(e)=> setNewUser((s)=> ({ ...s, username: e.target.value }))}
          />
          <TextField
            type="email"
            label="Email"
            fullWidth
            sx={{ 
              mt: 2,
              '& .MuiInputLabel-root': { color: '#8B98A5' },
              '& .MuiInputLabel-root.Mui-focused': { color: '#E7E9EA' },
              '& .MuiOutlinedInput-root': { 
                color: '#E7E9EA',
                backgroundColor:'#1A1A1A',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#2F3336' },
                '&:hover .MuiOutlinedInput-notchedOutline':{ borderColor:'#4A4A4A' },
                '& input': {
                  color:'#E7E9EA',
                  '&:-webkit-autofill': {
                    WebkitBoxShadow: '0 0 0 1000px #1A1A1A inset',
                    WebkitTextFillColor: '#E7E9EA'
                  }
                }
              },
              '& .MuiFormHelperText-root': { color: '#8B98A5' },
              '& .MuiSvgIcon-root': { color: '#E7E9EA' }
            }}
            value={newUser.email}
            onChange={(e)=> setNewUser((s)=> ({ ...s, email: e.target.value }))}
          />
          <TextField
            type="password"
            label="Password"
            fullWidth
            sx={{ 
              mt: 2,
              '& .MuiInputLabel-root': { color: '#8B98A5' },
              '& .MuiInputLabel-root.Mui-focused': { color: '#E7E9EA' },
              '& .MuiOutlinedInput-root': { 
                color: '#E7E9EA',
                backgroundColor:'#1A1A1A',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#2F3336' },
                '&:hover .MuiOutlinedInput-notchedOutline':{ borderColor:'#4A4A4A' },
                '& input': {
                  color:'#E7E9EA',
                  '&:-webkit-autofill': {
                    WebkitBoxShadow: '0 0 0 1000px #1A1A1A inset',
                    WebkitTextFillColor: '#E7E9EA'
                  }
                }
              },
              '& .MuiFormHelperText-root': { color: '#8B98A5' },
              '& .MuiSvgIcon-root': { color: '#E7E9EA' }
            }}
            value={newUser.password}
            onChange={(e)=> setNewUser((s)=> ({ ...s, password: e.target.value }))}
            helperText="Minimum 8 characters"
          />
          <TextField
            label="Role"
            select
            fullWidth
            sx={{ mt: 2, '& .MuiInputLabel-root': { color: '#8B98A5' }, '& .MuiOutlinedInput-root': { color: '#E7E9EA', backgroundColor:'#1A1A1A', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#2F3336' }, '&:hover .MuiOutlinedInput-notchedOutline':{ borderColor:'#4A4A4A' } }, '& .MuiFormHelperText-root': { color: '#8B98A5' }, '& .MuiSvgIcon-root': { color: '#E7E9EA' } }}
            value={newUser.role}
            onChange={(e)=> setNewUser((s)=> ({ ...s, role: e.target.value }))}
          >
            <MenuItem value="admin" sx={{ color: '#E7E9EA', bgcolor: '#16202A' }}>Admin</MenuItem>
            <MenuItem value="edit" sx={{ color: '#E7E9EA', bgcolor: '#16202A' }}>Edit</MenuItem>
            <MenuItem value="view" sx={{ color: '#E7E9EA', bgcolor: '#16202A' }}>View</MenuItem>
          </TextField>
          
          {/* Module Access */}
          <Typography variant="subtitle2" sx={{ mt: 3, mb: 1, color: '#E7E9EA' }}>
            Module Access
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={newUser.modules.search}
                  onChange={(e) => setNewUser(s => ({ 
                    ...s, 
                    modules: { ...s.modules, search: e.target.checked }
                  }))}
                  sx={{ 
                    color: '#8B98A5',
                    '&.Mui-checked': { color: '#1D9BF0' }
                  }}
                />
              }
              label="Search"
              sx={{ color: '#E7E9EA' }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={newUser.modules.hotlist}
                  onChange={(e) => setNewUser(s => ({ 
                    ...s, 
                    modules: { ...s.modules, hotlist: e.target.checked }
                  }))}
                  sx={{ 
                    color: '#8B98A5',
                    '&.Mui-checked': { color: '#1D9BF0' }
                  }}
                />
              }
              label="Hot List"
              sx={{ color: '#E7E9EA' }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={newUser.modules.bolo}
                  onChange={(e) => setNewUser(s => ({ 
                    ...s, 
                    modules: { ...s.modules, bolo: e.target.checked }
                  }))}
                  sx={{ 
                    color: '#8B98A5',
                    '&.Mui-checked': { color: '#1D9BF0' }
                  }}
                />
              }
              label="BOLO"
              sx={{ color: '#E7E9EA' }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={newUser.modules.intel}
                  onChange={(e) => setNewUser(s => ({ 
                    ...s, 
                    modules: { ...s.modules, intel: e.target.checked }
                  }))}
                  sx={{ 
                    color: '#8B98A5',
                    '&.Mui-checked': { color: '#1D9BF0' }
                  }}
                />
              }
              label="Intel Reports"
              sx={{ color: '#E7E9EA' }}
            />
          </Box>
          
          <Box sx={{ mt: 2 }}>
            <FormControlLabel
              control={<Switch checked={require2FA} onChange={(e)=> setRequire2FA(e.target.checked)} />}
              label={<span style={{ color: '#E7E9EA' }}>Require 2FA on first login</span>}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#16202A', borderTop: '1px solid #2F3336' }}>
          <Button onClick={()=> setOpenNew(false)} disabled={creating} sx={{ color: '#E7E9EA' }}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={creating || !newUser.username || !newUser.email || !newUser.password}> 
            {creating ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog 
        open={editDialog.open} 
        onClose={closeEditDialog} 
        fullWidth 
        maxWidth="sm"
        PaperProps={{
          sx: {
            bgcolor: '#16202A',
            color: '#E7E9EA'
          }
        }}
      >
        <DialogTitle sx={{ color: '#E7E9EA', bgcolor: '#16202A' }}>Edit User</DialogTitle>
        <DialogContent sx={{ bgcolor: '#16202A' }}>
          <TextField
            label="Username"
            fullWidth
            sx={{ 
              mt: 1, 
              '& .MuiInputLabel-root': { 
                color: '#8B98A5',
                '&.Mui-focused': { color: '#1D9BF0' }
              }, 
              '& .MuiOutlinedInput-root': { 
                color: '#E7E9EA',
                backgroundColor: '#1A1A1A',
                '& .MuiOutlinedInput-notchedOutline': { 
                  borderColor: '#2F3336',
                  '&:hover': { borderColor: '#4A4A4A' }
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#1D9BF0'
                }
              }, 
              '& .MuiFormHelperText-root': { color: '#8B98A5' }, 
              '& .MuiSvgIcon-root': { color: '#E7E9EA' } 
            }}
            value={editUser.username}
            onChange={(e) => setEditUser((s) => ({ ...s, username: e.target.value }))}
          />
          <TextField
            type="email"
            label="Email"
            fullWidth
            sx={{ 
              mt: 2, 
              '& .MuiInputLabel-root': { 
                color: '#8B98A5',
                '&.Mui-focused': { color: '#1D9BF0' }
              }, 
              '& .MuiOutlinedInput-root': { 
                color: '#E7E9EA',
                backgroundColor: '#1A1A1A',
                '& .MuiOutlinedInput-notchedOutline': { 
                  borderColor: '#2F3336',
                  '&:hover': { borderColor: '#4A4A4A' }
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#1D9BF0'
                }
              }, 
              '& .MuiFormHelperText-root': { color: '#8B98A5' }, 
              '& .MuiSvgIcon-root': { color: '#E7E9EA' } 
            }}
            value={editUser.email}
            onChange={(e) => setEditUser((s) => ({ ...s, email: e.target.value }))}
          />
          <TextField
            type="password"
            label="New Password (leave blank to keep current)"
            fullWidth
            sx={{ 
              mt: 2, 
              '& .MuiInputLabel-root': { 
                color: '#8B98A5',
                '&.Mui-focused': { color: '#1D9BF0' }
              }, 
              '& .MuiOutlinedInput-root': { 
                color: '#E7E9EA',
                backgroundColor: '#1A1A1A',
                '& .MuiOutlinedInput-notchedOutline': { 
                  borderColor: '#2F3336',
                  '&:hover': { borderColor: '#4A4A4A' }
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#1D9BF0'
                }
              }, 
              '& .MuiFormHelperText-root': { color: '#8B98A5' }, 
              '& .MuiSvgIcon-root': { color: '#E7E9EA' } 
            }}
            value={editUser.password}
            onChange={(e) => setEditUser((s) => ({ ...s, password: e.target.value }))}
            helperText="Minimum 8 characters if changing password"
          />
          <TextField
            label="Role"
            select
            fullWidth
            sx={{ 
              mt: 2, 
              '& .MuiInputLabel-root': { 
                color: '#8B98A5',
                '&.Mui-focused': { color: '#1D9BF0' }
              }, 
              '& .MuiOutlinedInput-root': { 
                color: '#E7E9EA',
                backgroundColor: '#1A1A1A',
                '& .MuiOutlinedInput-notchedOutline': { 
                  borderColor: '#2F3336',
                  '&:hover': { borderColor: '#4A4A4A' }
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#1D9BF0'
                }
              }, 
              '& .MuiFormHelperText-root': { color: '#8B98A5' }, 
              '& .MuiSvgIcon-root': { color: '#E7E9EA' } 
            }}
            value={editUser.role}
            onChange={(e) => setEditUser((s) => ({ ...s, role: e.target.value }))}
          >
            <MenuItem value="admin" sx={{ color: '#E7E9EA', bgcolor: '#16202A' }}>Admin</MenuItem>
            <MenuItem value="edit" sx={{ color: '#E7E9EA', bgcolor: '#16202A' }}>Edit</MenuItem>
            <MenuItem value="view" sx={{ color: '#E7E9EA', bgcolor: '#16202A' }}>View</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#16202A', borderTop: '1px solid #2F3336' }}>
          <Button onClick={closeEditDialog} disabled={editing} sx={{ color: '#E7E9EA' }}>Cancel</Button>
          <Button variant="contained" onClick={handleEdit} disabled={editing || !editUser.username || !editUser.email}>
            {editing ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Force 2FA Setup Dialog */}
      <Dialog 
        open={force2FADialog.open} 
        onClose={() => setForce2FADialog({ open: false, user: null })} 
        fullWidth 
        maxWidth="md"
        PaperProps={{
          sx: {
            bgcolor: '#16202A',
            color: '#E7E9EA'
          }
        }}
      >
        <DialogTitle sx={{ color: '#E7E9EA', bgcolor: '#16202A' }}>
          2FA Force Enabled for {force2FADialog.user?.username}
        </DialogTitle>
        <DialogContent sx={{ bgcolor: '#16202A' }}>
          {force2FADialog.setup && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body1" sx={{ mb: 2, color: '#E7E9EA' }}>
                2FA has been successfully enabled for this user. Share the following setup information with them:
              </Typography>
              
              <Box sx={{ mb: 3, textAlign: 'center' }}>
                <Typography variant="h6" sx={{ mb: 1, color: '#E7E9EA' }}>QR Code</Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                  <img 
                    src={force2FADialog.setup.qrCode} 
                    alt="2FA QR Code"
                    style={{ maxWidth: '200px', background: 'white', padding: '10px', borderRadius: '8px' }}
                  />
                </Box>
                <Typography variant="body2" sx={{ color: '#8B98A5' }}>
                  User can scan this with their authenticator app
                </Typography>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 1, color: '#E7E9EA' }}>Manual Entry Key</Typography>
                <TextField
                  fullWidth
                  variant="outlined"
                  value={force2FADialog.setup.manualEntryKey}
                  InputProps={{
                    readOnly: true,
                    style: { color: '#E7E9EA', backgroundColor: '#1A1A1A' }
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': { borderColor: '#2F3336' },
                      '&:hover fieldset': { borderColor: '#4A4A4A' },
                    }
                  }}
                />
                <Typography variant="body2" sx={{ color: '#8B98A5', mt: 1 }}>
                  Manual entry key if QR code cannot be scanned
                </Typography>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 1, color: '#E7E9EA' }}>Backup Codes</Typography>
                <Typography variant="body2" sx={{ color: '#8B98A5', mb: 2 }}>
                  Save these backup codes securely. Each can only be used once:
                </Typography>
                <Box sx={{ 
                  bgcolor: '#1A1A1A', 
                  p: 2, 
                  borderRadius: 1, 
                  border: '1px solid #2F3336',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 1
                }}>
                  {force2FADialog.setup.backupCodes.map((code: string, index: number) => (
                    <Typography key={index} variant="body2" sx={{ color: '#E7E9EA', fontFamily: 'monospace' }}>
                      {code}
                    </Typography>
                  ))}
                </Box>
              </Box>

              <Box sx={{ p: 2, bgcolor: '#2D5A87', borderRadius: 1, mb: 2 }}>
                <Typography variant="body2" sx={{ color: '#E7E9EA' }}>
                  <strong>Important:</strong> The user should set up their authenticator app immediately and test it before their next login.
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#16202A', borderTop: '1px solid #2F3336' }}>
          <Button 
            onClick={() => setForce2FADialog({ open: false, user: null })} 
            sx={{ color: '#E7E9EA' }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, user: null })}
        PaperProps={{ sx: { bgcolor: '#16202A', color: '#E7E9EA' } }}
      >
        <DialogTitle sx={{ color: '#E7E9EA', bgcolor: '#16202A' }}>
          Confirm Delete User
        </DialogTitle>
        <DialogContent sx={{ bgcolor: '#16202A' }}>
          <Alert severity="warning" sx={{ mb: 2, bgcolor: '#ff9800', color: '#000' }}>
            Are you sure you want to delete user <strong>{deleteDialog.user?.username}</strong>? This action cannot be undone.
          </Alert>
          {deleteDialog.user?.super_admin && (
            <Alert severity="error" sx={{ bgcolor: '#f44336', color: '#fff' }}>
              Super admin accounts cannot be deleted.
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#16202A', borderTop: '1px solid #2F3336' }}>
          <Button 
            onClick={() => setDeleteDialog({ open: false, user: null })} 
            sx={{ color: '#E7E9EA' }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDelete}
            disabled={deleting || deleteDialog.user?.super_admin}
            sx={{ 
              bgcolor: '#ff4757', 
              color: '#fff',
              '&:hover': { bgcolor: '#ff3838' },
              '&:disabled': { bgcolor: '#444', color: '#888' }
            }}
          >
            {deleting ? 'Deleting...' : 'Delete User'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UsersManage;


