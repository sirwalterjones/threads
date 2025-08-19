import React, { useState } from 'react';
import { Box, IconButton, useMediaQuery, useTheme, AppBar, Toolbar, Typography, InputBase, Avatar } from '@mui/material';
import { Menu as MenuIcon, Search as SearchIcon, AccountCircle } from '@mui/icons-material';
import Sidebar from './Sidebar';
import { useAuth } from '../../contexts/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user } = useAuth();

  const handleSidebarToggle = () => {
    setSidebarOpen(!sidebarOpen);
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
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', // Blue gradient like in screenshot
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
              <Avatar 
                sx={{ 
                  width: 40, 
                  height: 40,
                  border: '2px solid rgba(255,255,255,0.3)'
                }}
              >
                {user?.username?.[0]?.toUpperCase() || <AccountCircle />}
              </Avatar>
            </Box>
          </Toolbar>
        </AppBar>

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
    </Box>
  );
};

export default Layout;