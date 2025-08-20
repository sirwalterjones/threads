import React, { useState } from 'react';
import { Box, IconButton, useMediaQuery, useTheme, AppBar, Toolbar, Typography, InputBase, Avatar, Menu, MenuItem } from '@mui/material';
import { Menu as MenuIcon, Search as SearchIcon, AccountCircle, ExitToApp, Settings, Dashboard } from '@mui/icons-material';
import Sidebar from './Sidebar';
import RightSidebar from './RightSidebar';
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
    <Box sx={{ 
      display: 'flex', 
      minHeight: '100vh', 
      backgroundColor: '#0F0F0F' // Dark background like social media
    }}>
      {/* Left Sidebar - Navigation */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      {/* Main Layout - Center + Right Sidebar */}
      <Box 
        sx={{ 
          flexGrow: 1, 
          marginLeft: { xs: 0, md: '280px' },
          minHeight: '100vh',
          display: 'flex'
        }}
      >
        {/* Center Content Area */}
        <Box
          sx={{
            flexGrow: 1,
            maxWidth: { xs: '100%', lg: '600px' },
            borderLeft: '1px solid #2F3336',
            borderRight: '1px solid #2F3336',
            backgroundColor: '#000000',
            minHeight: '100vh'
          }}
        >
          {/* Top Header Bar */}
          <Box
            sx={{
              position: 'sticky',
              top: 0,
              zIndex: 10,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              backdropFilter: 'blur(12px)',
              borderBottom: '1px solid #2F3336',
              p: 2
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {/* Mobile Menu Button */}
              <IconButton
                edge="start"
                onClick={handleSidebarToggle}
                sx={{ display: { xs: 'block', md: 'none' }, color: '#E7E9EA' }}
              >
                <MenuIcon />
              </IconButton>

              {/* Page Title - Social Media Style */}
              <Typography variant="h5" sx={{ 
                color: '#E7E9EA', 
                fontWeight: 700,
                fontSize: '20px'
              }}>
                Home
              </Typography>

              {/* User Avatar */}
              <IconButton
                onClick={handleMenuOpen}
                sx={{ p: 0 }}
              >
                <Avatar 
                  sx={{ 
                    width: 32, 
                    height: 32,
                    backgroundColor: '#1D9BF0',
                    color: 'white',
                    fontSize: '14px'
                  }}
                >
                  {user?.username?.[0]?.toUpperCase() || <AccountCircle />}
                </Avatar>
              </IconButton>
            </Box>
          </Box>

          {/* User Menu */}
          <Menu
            id="account-menu"
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            PaperProps={{
              sx: {
                backgroundColor: '#000000',
                border: '1px solid #2F3336',
                color: '#E7E9EA'
              }
            }}
            MenuListProps={{
              'aria-labelledby': 'account-button',
            }}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <MenuItem onClick={handleProfile} sx={{ color: '#E7E9EA' }}>
              <Settings sx={{ mr: 2 }} />
              Profile Settings
            </MenuItem>
            <MenuItem onClick={handleLogout} sx={{ color: '#E7E9EA' }}>
              <ExitToApp sx={{ mr: 2 }} />
              Logout
            </MenuItem>
          </Menu>

          {/* Main Content Feed */}
          <Box sx={{ backgroundColor: '#000000' }}>
            {children}
          </Box>
        </Box>

        {/* Right Sidebar - Suggestions & Trends */}
        <Box
          sx={{
            width: { xs: 0, lg: '350px' },
            display: { xs: 'none', lg: 'block' },
            p: 2,
            backgroundColor: '#000000'
          }}
        >
          <RightSidebar />
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