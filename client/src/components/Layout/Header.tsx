import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Box,
  Chip,
  Avatar
} from '@mui/material';
import {
  AccountCircle,
  ExitToApp,
  Settings,
  Dashboard,
  DarkMode,
  LightMode
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import NewPostModal from '../NewPostModal';
import NotificationBell from '../Notifications/NotificationBell';
import apiService from '../../services/api';

const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [openNew, setOpenNew] = useState(false);
  const [editingPost, setEditingPost] = useState<any>(null);

  // Listen for global open-new-post-modal events (e.g., from sidebar)
  React.useEffect(() => {
    const handler = async (e: any) => {
      const postId = e?.detail?.postId;
      if (postId) {
        try { const p = await apiService.getPost(postId); setEditingPost(p); } catch { setEditingPost(null); }
      } else {
        setEditingPost(null);
      }
      setOpenNew(true);
    };
    window.addEventListener('open-new-post-modal', handler as any);
    return () => window.removeEventListener('open-new-post-modal', handler as any);
  }, []);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    handleMenuClose();
  };

  const handleProfile = () => {
    navigate('/profile');
    handleMenuClose();
  };

  const handleDashboard = () => {
    navigate('/dashboard');
    handleMenuClose();
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'error';
      case 'edit':
        return 'warning';
      case 'view':
        return 'info';
      default:
        return 'default';
    }
  };

  return (
    <AppBar position="static" color="primary" enableColorOnDark sx={{
      backgroundColor: 'background.paper',
      color: 'text.primary',
      borderBottom: '1px solid',
      borderColor: 'divider'
    }}>
      <Toolbar>
        <Typography
          variant="h6"
          component="div"
          sx={{ 
            flexGrow: 1, 
            cursor: 'pointer',
            fontWeight: 'bold',
            color: 'inherit'
          }}
          onClick={() => navigate('/')}
        >
          Vector
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'nowrap' }}>
          {/* Debug: Show user info */}
          <Box sx={{ color: 'red', fontSize: '10px', border: '1px solid red', padding: '2px', whiteSpace: 'nowrap' }}>
            User: {user ? `${user.username} (${user.role})` : 'null'}
          </Box>
          
          {/* Notification Bell - Always show if user exists */}
          {user && <NotificationBell />}
          
          {/* User Role Chip */}
          {user && (
            <Chip
              label={user.role.toUpperCase()}
              color={getRoleColor(user.role) as any}
              variant="outlined"
              size="small"
              sx={{ color: 'text.primary', borderColor: 'divider', bgcolor: 'transparent', whiteSpace: 'nowrap' }}
            />
          )}
          
          {/* New Post Button */}
          {user && (user.role === 'admin' || user.role === 'edit') && (
            <Button
              variant="contained"
              color="secondary"
              size="small"
              onClick={() => setOpenNew(true)}
              sx={{ whiteSpace: 'nowrap' }}
            >
              New Post
            </Button>
          )}
          
          {/* User Avatar and Name */}
          {user && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, whiteSpace: 'nowrap' }}>
              <Avatar sx={{ width: 28, height: 28, bgcolor: 'secondary.main', color: 'common.white' }}>
                {user.username.charAt(0).toUpperCase()}
              </Avatar>
              <Typography variant="body2" sx={{ color: 'text.primary', fontSize: '0.875rem' }}>
                {user.username}
              </Typography>
            </Box>
          )}

          {/* Account Menu Button */}
          {user && (
            <IconButton
              size="medium"
              edge="end"
              aria-label="account menu"
              aria-controls="account-menu"
              aria-haspopup="true"
              onClick={handleMenuOpen}
              color="inherit"
              sx={{ ml: 1 }}
            >
              <AccountCircle />
            </IconButton>
          )}

              <Menu
                id="account-menu"
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                MenuListProps={{
                  'aria-labelledby': 'account-button',
                }}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              >
                {(user.role === 'admin' || user.role === 'edit') && (
                  <MenuItem onClick={handleDashboard}>
                    <Dashboard sx={{ mr: 2 }} />
                    Admin Dashboard
                  </MenuItem>
                )}
                {(user.role === 'admin' || user.role === 'edit') && (
                  <MenuItem onClick={() => { setOpenNew(true); handleMenuClose(); }}>
                    <Dashboard sx={{ mr: 2 }} />
                    New Post
                  </MenuItem>
                )}
                <MenuItem onClick={handleProfile}>
                  <Settings sx={{ mr: 2 }} />
                  Profile Settings
                </MenuItem>
                <MenuItem onClick={handleLogout}>
                  <ExitToApp sx={{ mr: 2 }} />
                  Logout
                </MenuItem>
              </Menu>
            </>
          )}

          {!user && (
            <Button
              color="inherit"
              onClick={() => navigate('/login')}
              startIcon={<AccountCircle />}
            >
              Login
            </Button>
          )}
        </Box>
      </Toolbar>
      <NewPostModal open={openNew} onClose={()=>setOpenNew(false)} onCreated={()=>{ /* optionally refresh */ }} post={editingPost} />
    </AppBar>
  );
};

export default Header;