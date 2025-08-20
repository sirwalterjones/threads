import React, { useState } from 'react';
import { Box, IconButton, useMediaQuery, useTheme, AppBar, Toolbar, Typography, InputBase, Avatar, Menu, MenuItem } from '@mui/material';
import { Menu as MenuIcon, Search as SearchIcon, AccountCircle, ExitToApp, Settings, Dashboard } from '@mui/icons-material';
import Sidebar from './Sidebar';
import { useAuth } from '../../contexts/AuthContext';
import NewPostModal from '../NewPostModal';
import apiService from '../../services/api';
import { useNavigate } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openNewPost, setOpenNewPost] = useState(false);
  const [editingPost, setEditingPost] = useState<any>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Listen for global open-new-post-modal events from sidebar
  React.useEffect(() => {
    const handler = async (e: any) => {
      const postId = e?.detail?.postId;
      if (postId) {
        try { 
          const p = await apiService.getPost(postId); 
          setEditingPost(p); 
        } catch { 
          setEditingPost(null); 
        }
      } else {
        setEditingPost(null);
      }
      setOpenNewPost(true);
    };
    window.addEventListener('open-new-post-modal', handler as any);
    return () => window.removeEventListener('open-new-post-modal', handler as any);
  }, []);

  const handleSidebarToggle = () => {
    setSidebarOpen(!sidebarOpen);
  };

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
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      {/* Main Content Area */}
      <Box 
        sx={{ 
          flexGrow: 1, 
          marginLeft: { xs: 0, md: '280px' },
          minHeight: '100vh',
          backgroundColor: '#111827', // Dark blue like sidebar bottom
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Top Navigation Bar */}
        <AppBar 
          position="static" 
          elevation={0}
          sx={{ 
            backgroundColor: 'transparent',
            borderBottom: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          <Toolbar sx={{ justifyContent: 'space-between', py: 1 }}>
            {/* Mobile Menu Button */}
            <IconButton
              color="inherit"
              edge="start"
              onClick={handleSidebarToggle}
              sx={{ display: { xs: 'block', md: 'none' }, mr: 2 }}
            >
              <MenuIcon />
            </IconButton>

            {/* Page Title */}
            <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>
              DASHBOARD
            </Typography>

            {/* Search and User Section */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {/* Search Bar */}
              <Box
                sx={{
                  position: 'relative',
                  borderRadius: 1,
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  '&:hover': {
                    backgroundColor: 'rgba(255,255,255,0.25)',
                  },
                  marginLeft: 0,
                  width: { xs: 'auto', sm: '300px' },
                  display: { xs: 'none', sm: 'block' }
                }}
              >
                <Box
                  sx={{
                    padding: theme.spacing(0, 2),
                    height: '100%',
                    position: 'absolute',
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <SearchIcon sx={{ color: 'rgba(255,255,255,0.7)' }} />
                </Box>
                <InputBase
                  placeholder="Search here..."
                  sx={{
                    color: 'white',
                    '& .MuiInputBase-input': {
                      padding: theme.spacing(1, 1, 1, 0),
                      paddingLeft: `calc(1em + ${theme.spacing(4)})`,
                      width: '100%',
                      '&::placeholder': {
                        color: 'rgba(255,255,255,0.7)',
                      },
                    },
                  }}
                />
              </Box>

              {/* User Avatar */}
              <IconButton
                size="large"
                edge="end"
                aria-label="account menu"
                aria-controls="account-menu"
                aria-haspopup="true"
                onClick={handleMenuOpen}
                color="inherit"
                sx={{ p: 0 }}
              >
                <Avatar 
                  sx={{ 
                    width: 40, 
                    height: 40,
                    border: '2px solid rgba(255,255,255,0.3)',
                    cursor: 'pointer'
                  }}
                >
                  {user?.username?.[0]?.toUpperCase() || <AccountCircle />}
                </Avatar>
              </IconButton>
            </Box>
          </Toolbar>
        </AppBar>

        {/* User Menu */}
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
          <MenuItem onClick={handleProfile}>
            <Settings sx={{ mr: 2 }} />
            Profile Settings
          </MenuItem>
          <MenuItem onClick={handleLogout}>
            <ExitToApp sx={{ mr: 2 }} />
            Logout
          </MenuItem>
        </Menu>

        {/* Content Area with white background */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: 4,
            backgroundColor: 'transparent', // Transparent to show gradient
            minHeight: 'calc(100vh - 80px)'
          }}
        >
          {children}
        </Box>
      </Box>
      
      {/* New Post Modal */}
      <NewPostModal 
        open={openNewPost} 
        onClose={() => setOpenNewPost(false)} 
        onCreated={() => { /* optionally refresh */ }} 
        post={editingPost} 
      />
    </Box>
  );
};

export default Layout;