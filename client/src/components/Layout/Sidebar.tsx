import React, { useState, useEffect } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  Menu,
  MenuItem,
  Badge
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Search as SearchIcon,
  Add as AddIcon,
  Category as CategoryIcon,
  People as PeopleIcon,
  Settings as SettingsIcon,
  History as AuditIcon,
  AccessTime as ExpirationIcon,
  ExitToApp as LogoutIcon,
  Whatshot as HotListIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/api';

const DRAWER_WIDTH = 280;

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ open, onClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [hotListAlertCount, setHotListAlertCount] = useState<number>(0);

  // Load hot list alert count
  useEffect(() => {
    const loadHotListAlertCount = async () => {
      if (!user) return;
      try {
        const response = await apiService.getHotListUnreadCount();
        setHotListAlertCount(response.count);
      } catch (error) {
        console.error('Failed to load hot list alert count:', error);
      }
    };

    loadHotListAlertCount();
    
    // Poll for updates every 30 seconds
    const interval = setInterval(loadHotListAlertCount, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleProfile = () => {
    navigate('/profile');
    handleMenuClose();
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    handleMenuClose();
  };

  const mainPages = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/', roles: ['view', 'edit', 'admin'] },
    { text: 'Search', icon: <SearchIcon />, path: '/search', roles: ['view', 'edit', 'admin'] },
    { text: 'Hot List', icon: <HotListIcon />, path: '/hotlist', roles: ['view', 'edit', 'admin'] }
  ];

  const contentPages = [
            { text: 'My Threads', icon: <AddIcon />, path: '/my-threads', roles: ['edit', 'admin'] },
    { text: 'Add Thread', icon: <AddIcon />, path: '#new', roles: ['edit', 'admin'] }
  ];

  const systemAdminPages = [
    { text: 'Categories', icon: <CategoryIcon />, path: '/categories', roles: ['admin'] },
    { text: 'User Management', icon: <PeopleIcon />, path: '/users', roles: ['admin'] },
    { text: 'Post Expiration', icon: <ExpirationIcon />, path: '/expiration', roles: ['admin'] },
    { text: 'Audit Log', icon: <AuditIcon />, path: '/audit', roles: ['admin'] }
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
                  mb: 0.5,
                  px: 2,
                  py: 1,
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
                    minWidth: 36
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                {item.path === '/hotlist' ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <Typography
                      sx={{
                        fontSize: '12px',
                        fontWeight: isActive(item.path) ? 600 : 400,
                        color: 'inherit',
                        flex: 1
                      }}
                    >
                      {item.text}
                    </Typography>
                    {hotListAlertCount > 0 && (
                      <Badge
                        badgeContent={hotListAlertCount}
                        color="warning"
                        sx={{
                          '& .MuiBadge-badge': {
                            backgroundColor: '#FFC107',
                            color: '#000',
                            fontSize: '10px',
                            height: '16px',
                            minWidth: '16px'
                          }
                        }}
                      >
                        <Box sx={{ width: 8 }} />
                      </Badge>
                    )}
                  </Box>
                ) : (
                  <ListItemText
                    primary={item.text}
                    primaryTypographyProps={{
                      fontSize: '12px',
                      fontWeight: isActive(item.path) ? 600 : 400
                    }}
                  />
                )}
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
        height: 'calc(100vh - 64px)', // Subtract header height
        backgroundColor: '#000000',
        color: 'white',
        position: 'fixed',
        left: 0,
        top: '64px', // Position below header
        zIndex: 1200,
        display: 'flex',
        flexDirection: 'column',
        transform: { xs: open ? 'translateX(0)' : 'translateX(-100%)', md: 'translateX(0)' },
        transition: 'transform 0.3s ease-in-out',
        borderRight: '1px solid #2F3336'
      }}
    >

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
        {renderNavSection('', mainPages)}
        
        {user && ['edit', 'admin'].includes(user.role) && (
          <>
            <Divider sx={{ backgroundColor: '#2F3336', mx: 2, my: 2 }} />
            {renderNavSection('Content', contentPages, '#9CA3AF')}
          </>
        )}
        
        {user && user.role === 'admin' && (
          <>
            <Divider sx={{ backgroundColor: '#2F3336', mx: 2, my: 2 }} />
            {renderNavSection('System Admin', systemAdminPages, '#9CA3AF')}
          </>
        )}
      </Box>

      {/* User Info at Bottom */}
      {user && (
        <>
          <Box 
            onClick={handleMenuOpen}
            sx={{ 
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
            }}
          >
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
                  fontSize: '14px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {user.username}
                </Typography>
                <Typography variant="caption" sx={{ 
                  color: '#71767B', 
                  fontSize: '12px'
                }}>
                  @{user.username.toLowerCase()}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* User Menu */}
          <Menu
            id="user-menu"
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            PaperProps={{
              sx: {
                backgroundColor: '#000000',
                border: '1px solid #2F3336',
                color: '#E7E9EA',
                minWidth: 200
              }
            }}
            MenuListProps={{
              'aria-labelledby': 'user-button',
            }}
            transformOrigin={{ horizontal: 'left', vertical: 'bottom' }}
            anchorOrigin={{ horizontal: 'left', vertical: 'top' }}
          >
            <MenuItem onClick={handleProfile} sx={{ color: '#E7E9EA' }}>
              <SettingsIcon sx={{ mr: 2 }} />
              Profile Settings
            </MenuItem>
            <MenuItem onClick={handleLogout} sx={{ color: '#E7E9EA' }}>
              <LogoutIcon sx={{ mr: 2 }} />
              Logout
            </MenuItem>
          </Menu>
        </>
      )}
    </Box>
  );
};

export default Sidebar;