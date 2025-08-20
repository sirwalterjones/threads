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
  AppRegistration as RegisterIcon,
  History as AuditIcon,
  AccessTime as ExpirationIcon
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
    { text: 'Search', icon: <SearchIcon />, path: '/search', roles: ['view', 'edit', 'admin'] },
    { text: 'Categories', icon: <CategoryIcon />, path: '/categories', roles: ['view', 'edit', 'admin'] },
    { text: 'Post Expiration', icon: <ExpirationIcon />, path: '/expiration', roles: ['admin'] },
    { text: 'Audit Log', icon: <AuditIcon />, path: '/audit', roles: ['admin'] },
    { text: 'Settings', icon: <SettingsIcon />, path: '/settings', roles: ['admin'] }
  ];

  const authPages = [
    { text: 'Login', icon: <LoginIcon />, path: '/login', roles: ['view', 'edit', 'admin'] },
    { text: 'Register', icon: <RegisterIcon />, path: '/register', roles: ['admin'] }
  ];

  const contentPages = [
    { text: 'My Threads', icon: <AddIcon />, path: '/my-threads', roles: ['edit', 'admin'] },
    { text: 'Add Thread', icon: <AddIcon />, path: '#new', roles: ['edit', 'admin'] },
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
      {title && (
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
      )}
      <List sx={{ py: 0 }}>
        {items
          .filter(item => isItemAllowed(item.roles))
          .map((item) => (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                onClick={() => handleNavigation(item.path)}
                sx={{
                  mx: 2,
                  borderRadius: 25,
                  mb: 1,
                  px: 3,
                  py: 1.5,
                  backgroundColor: 'transparent',
                  color: isActive(item.path) ? '#E7E9EA' : '#71767B',
                  '&:hover': {
                    backgroundColor: '#16181C',
                    color: '#E7E9EA'
                  }
                }}
              >
                <ListItemIcon
                  sx={{
                    color: isActive(item.path) ? '#E7E9EA' : '#71767B',
                    minWidth: 48
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontSize: '20px',
                    fontWeight: isActive(item.path) ? 700 : 400
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
        backgroundColor: '#000000', // Pure black like social media
        color: 'white',
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 1200,
        display: 'flex',
        flexDirection: 'column',
        transform: { xs: open ? 'translateX(0)' : 'translateX(-100%)', md: 'translateX(0)' },
        transition: 'transform 0.3s ease-in-out',
        borderRight: '1px solid #2F3336'
      }}
    >
      {/* Header */}
      <Box sx={{ p: 3, borderBottom: '1px solid #2F3336' }}>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 700,
            color: '#E7E9EA',
            fontSize: '1.875rem',
            letterSpacing: '-0.025em'
          }}
        >
          𝕏
        </Typography>
      </Box>

      {/* Navigation */}
      <Box sx={{ 
        py: 2, 
        flex: 1, 
        overflowY: 'auto',
        '&::-webkit-scrollbar': {
          width: '8px',
        },
        '&::-webkit-scrollbar-track': {
          background: '#16181C',
        },
        '&::-webkit-scrollbar-thumb': {
          background: '#2F3336',
          borderRadius: '4px',
        },
        '&::-webkit-scrollbar-thumb:hover': {
          background: '#3F4144',
        },
      }}>
        {renderNavSection('', adminPages)}
        
        {user && ['edit', 'admin'].includes(user.role) && (
          <>
            <Divider sx={{ backgroundColor: '#2F3336', mx: 2, my: 2 }} />
            {renderNavSection('', contentPages)}
          </>
        )}
        
        <Divider sx={{ backgroundColor: '#2F3336', mx: 2, my: 2 }} />
        {renderNavSection('', authPages)}
      </Box>

      {/* User Info at Bottom */}
      {user && (
        <Box sx={{ 
          p: 3, 
          borderTop: '1px solid #2F3336',
          backgroundColor: '#000000',
          flexShrink: 0,
          cursor: 'pointer',
          borderRadius: '16px',
          mx: 2,
          mb: 2,
          '&:hover': {
            backgroundColor: '#16181C'
          }
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                backgroundColor: '#1D9BF0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 700
              }}
            >
              {user.username[0]?.toUpperCase()}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ 
                color: '#E7E9EA', 
                fontWeight: 700,
                fontSize: '15px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {user.username}
              </Typography>
              <Typography variant="caption" sx={{ 
                color: '#71767B', 
                fontSize: '15px'
              }}>
                @{user.username.toLowerCase()}
              </Typography>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default Sidebar;