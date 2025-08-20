import React, { useState } from 'react';
import { Box, IconButton, useMediaQuery, useTheme } from '@mui/material';
import { Menu as MenuIcon } from '@mui/icons-material';
import Sidebar from './Sidebar';
import RightSidebar from './RightSidebar';
import NewPostModal from '../NewPostModal';
import apiService from '../../services/api';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openNewPost, setOpenNewPost] = useState(false);
  const [editingPost, setEditingPost] = useState<any>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

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
            borderLeft: '1px solid #2F3336',
            borderRight: '1px solid #2F3336',
            backgroundColor: '#000000',
            minHeight: '100vh'
          }}
        >
          {/* Mobile Menu Button - only show on mobile */}
          <Box
            sx={{
              display: { xs: 'block', md: 'none' },
              position: 'sticky',
              top: 0,
              zIndex: 10,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              backdropFilter: 'blur(12px)',
              borderBottom: '1px solid #2F3336',
              p: 2
            }}
          >
            <IconButton
              edge="start"
              onClick={handleSidebarToggle}
              sx={{ color: '#E7E9EA' }}
            >
              <MenuIcon />
            </IconButton>
          </Box>

          {/* Main Content Feed */}
          <Box sx={{ backgroundColor: '#000000' }}>
            {children}
          </Box>
        </Box>

        {/* Right Sidebar - Suggestions & Trends */}
        <Box
          sx={{
            width: { xs: 0, lg: '480px' },
            minWidth: '480px',
            display: { xs: 'none', lg: 'block' },
            p: 4,
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