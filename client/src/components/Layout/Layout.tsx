import React, { useState } from 'react';
import { Box, IconButton, useMediaQuery, useTheme } from '@mui/material';
import { Menu as MenuIcon } from '@mui/icons-material';
import Sidebar from './Sidebar';
import RightSidebar from './RightSidebar';
import Header from './Header';
import NewPostModal from '../NewPostModal';
import PostDetailModal from '../PostDetailModal';
import apiService from '../../services/api';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openNewPost, setOpenNewPost] = useState(false);
  const [editingPost, setEditingPost] = useState<any>(null);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
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

  // Listen for global open-post-detail events from right sidebar
  React.useEffect(() => {
    const handler = (e: any) => {
      const postId = e?.detail?.postId;
      if (postId) {
        setSelectedPostId(postId);
        setModalOpen(true);
      }
    };
    window.addEventListener('open-post-detail', handler as any);
    return () => window.removeEventListener('open-post-detail', handler as any);
  }, []);

  const handleSidebarToggle = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column',
      minHeight: '100vh', 
      backgroundColor: '#0F0F0F'
    }}>
      {/* Full-width Header */}
      <Header />
      
      {/* Main Layout Container - Below Header */}
      <Box sx={{ 
        display: 'flex', 
        flex: 1,
        pt: '64px' // Account for fixed header height
      }}>
        {/* Left Sidebar - Navigation */}
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        
        {/* Main Layout - Center + Right Sidebar */}
        <Box 
          sx={{ 
            flexGrow: 1, 
            marginLeft: { xs: 0, md: '280px' },
            minHeight: 'calc(100vh - 64px)', // Subtract header height
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
              minHeight: 'calc(100vh - 64px)',
              display: 'flex',
              flexDirection: 'column'
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
            <Box sx={{ backgroundColor: '#000000', flexGrow: 1 }}>
              {children}
            </Box>
          </Box>

          {/* Right Sidebar - Suggestions & Trends */}
          <Box
            sx={{
              width: { xs: 0, lg: '320px' },
              minWidth: '320px',
              display: { xs: 'none', lg: 'block' },
              p: 2,
              backgroundColor: '#000000',
              height: 'calc(100vh - 64px)', // Match sidebar height
              overflowY: 'auto'
            }}
          >
            <RightSidebar />
          </Box>
        </Box>
      </Box>
      
      {/* New Post Modal */}
      <NewPostModal 
        open={openNewPost} 
        onClose={() => setOpenNewPost(false)} 
        onCreated={() => { /* optionally refresh */ }} 
        post={editingPost} 
      />
      
      {/* Post Detail Modal */}
      <PostDetailModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        postId={selectedPostId}
      />
    </Box>
  );
};

export default Layout;