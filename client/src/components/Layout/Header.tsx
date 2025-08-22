import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Box
} from '@mui/material';
import {
  AccountCircle,
  ExitToApp,
  Settings,
  Add
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


  return (
    <AppBar position="fixed" color="primary" enableColorOnDark sx={{
      backgroundColor: '#000000',
      color: '#E7E9EA',
      border: 'none',
      borderBottom: '1px solid #2F3336',
      boxShadow: '0 4px 12px rgba(29, 155, 240, 0.15)',
      zIndex: 1300,
      top: 0,
      left: 0,
      right: 0
    }}>
      <Toolbar sx={{ justifyContent: 'space-between', px: 3 }}>
        <Typography
          variant="h4"
          component="div"
          sx={{ 
            cursor: 'pointer',
            fontWeight: 700,
            color: '#E7E9EA',
            fontSize: '1.875rem',
            letterSpacing: '-0.025em'
          }}
          onClick={() => navigate('/')}
        >
          VECTOR
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'nowrap' }}>
          {/* Notification Bell - Give it dedicated space */}
          {user && (
            <Box sx={{ display: 'flex', alignItems: 'center', minWidth: '40px', justifyContent: 'center' }}>
              <NotificationBell />
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
            {(user?.role === 'admin' || user?.role === 'edit') && (
              <MenuItem onClick={() => { setOpenNew(true); handleMenuClose(); }}>
                <Add sx={{ mr: 2 }} />
                New Thread
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
        </Box>

        {!user && (
          <Button
            color="inherit"
            onClick={() => navigate('/login')}
            startIcon={<AccountCircle />}
          >
            Login
          </Button>
        )}
      </Toolbar>
      <NewPostModal open={openNew} onClose={()=>setOpenNew(false)} onCreated={()=>{ /* optionally refresh */ }} post={editingPost} />
    </AppBar>
  );
};

export default Header;