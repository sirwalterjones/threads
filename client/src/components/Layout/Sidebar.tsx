import React from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Search as SearchIcon,
  Add as AddIcon,
  Category as CategoryIcon,
  People as PeopleIcon,
  Settings as SettingsIcon,
  TableChart as TableIcon,
  Person as PersonIcon,
  Login as LoginIcon,
  AppRegistration as RegisterIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const DRAWER_WIDTH = 280;

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ open, onClose }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const adminPages = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/', roles: ['view', 'edit', 'admin'] },
    { text: 'Search Posts', icon: <SearchIcon />, path: '/search', roles: ['view', 'edit', 'admin'] },
    { text: 'Categories', icon: <CategoryIcon />, path: '/categories', roles: ['view', 'edit', 'admin'] },
    { text: 'Settings', icon: <SettingsIcon />, path: '/settings', roles: ['admin'] },
    { text: 'Tables', icon: <TableIcon />, path: '/tables', roles: ['admin'] }
  ];

  const authPages = [
    { text: 'Login', icon: <LoginIcon />, path: '/login', roles: ['view', 'edit', 'admin'] },
    { text: 'Register', icon: <RegisterIcon />, path: '/register', roles: ['admin'] }
  ];

  const contentPages = [
    { text: 'My Threads', icon: <AddIcon />, path: '/my-threads', roles: ['edit', 'admin'] },
    { text: 'Add Post', icon: <AddIcon />, path: '#new', roles: ['edit', 'admin'] },
    { text: 'User Management', icon: <PeopleIcon />, path: '/users', roles: ['admin'] }
  ];

  const handleNavigation = (path: string) => {
    if (path === '#new') {
      const evt = new CustomEvent('open-new-post-modal');
      window.dispatchEvent(evt);
    } else {
      navigate(path);
    }
    onClose();
  };

  const isItemAllowed = (roles: string[]) => {
    return user && roles.includes(user.role);
  };

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname === '/home';
    }
    return location.pathname.startsWith(path);
  };

  const renderNavSection = (title: string, items: any[], color = '#9CA3AF') => (
    <Box sx={{ mb: 2 }}>
      <Typography
        variant="caption"
        sx={{
          px: 3,
          py: 1,
          color: color,
          fontWeight: 600,
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          display: 'block'
        }}
      >
        {title}
      </Typography>
      <List sx={{ py: 0 }}>
        {items
          .filter(item => isItemAllowed(item.roles))
          .map((item) => (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                onClick={() => handleNavigation(item.path)}
                sx={{
                  mx: 2,
                  borderRadius: 2,
                  mb: 0.5,
                  backgroundColor: isActive(item.path) ? '#3B82F6' : 'transparent',
                  color: isActive(item.path) ? 'white' : '#D1D5DB',
                  '&:hover': {
                    backgroundColor: isActive(item.path) ? '#2563EB' : '#374151'
                  }
                }}
              >
                <ListItemIcon
                  sx={{
                    color: isActive(item.path) ? 'white' : '#9CA3AF',
                    minWidth: 40
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontSize: '0.875rem',
                    fontWeight: isActive(item.path) ? 600 : 500
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
      </List>
    </Box>
  );

  return (
    <Box
      sx={{
        width: DRAWER_WIDTH,
        height: '100vh',
        backgroundColor: '#1F2937', // Dark gray background like in the screenshot
        color: 'white',
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 1200,
        overflow: 'auto',
        transform: { xs: open ? 'translateX(0)' : 'translateX(-100%)', md: 'translateX(0)' },
        transition: 'transform 0.3s ease-in-out',
        borderRight: '1px solid #374151'
      }}
    >
      {/* Header */}
      <Box sx={{ p: 3, borderBottom: '1px solid #374151' }}>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 700,
            color: 'white',
            fontSize: '1.125rem',
            letterSpacing: '0.5px'
          }}
        >
          THREADS
        </Typography>
      </Box>

      {/* Navigation */}
      <Box sx={{ py: 2 }}>
        {renderNavSection('ADMIN LAYOUT PAGES', adminPages)}
        
        {user && ['edit', 'admin'].includes(user.role) && (
          <>
            <Divider sx={{ backgroundColor: '#374151', mx: 2, my: 2 }} />
            {renderNavSection('CONTENT MANAGEMENT', contentPages)}
          </>
        )}
        
        <Divider sx={{ backgroundColor: '#374151', mx: 2, my: 2 }} />
        {renderNavSection('AUTH LAYOUT PAGES', authPages)}
      </Box>

      {/* User Info at Bottom */}
      {user && (
        <Box sx={{ 
          position: 'absolute', 
          bottom: 0, 
          left: 0, 
          right: 0, 
          p: 3, 
          borderTop: '1px solid #374151',
          backgroundColor: '#111827'
        }}>
          <Typography variant="body2" sx={{ color: '#9CA3AF', fontSize: '0.75rem' }}>
            Logged in as:
          </Typography>
          <Typography variant="body2" sx={{ color: 'white', fontWeight: 600 }}>
            {user.username}
          </Typography>
          <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '0.7rem' }}>
            Role: {user.role.toUpperCase()}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default Sidebar;