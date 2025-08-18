import React from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Box,
  Typography
} from '@mui/material';
import {
  Home,
  Search,
  Add,
  Category,
  People,
  Dashboard,
  History,
  CloudSync,
  Delete
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const DRAWER_WIDTH = 240;

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ open, onClose }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { text: 'Home', icon: <Home />, path: '/', roles: ['view', 'edit', 'admin'] },
    { text: 'Search Posts', icon: <Search />, path: '/search', roles: ['view', 'edit', 'admin'] },
    { text: 'Categories', icon: <Category />, path: '/categories', roles: ['view', 'edit', 'admin'] },
  ];

  const editMenuItems = [
    { text: 'My Threads', icon: <Add />, path: '/my-threads', roles: ['edit', 'admin'] },
    { text: 'Add Post', icon: <Add />, path: '#new', roles: ['edit', 'admin'] },
  ];

  const adminMenuItems = [
    { text: 'Dashboard', icon: <Dashboard />, path: '/dashboard', roles: ['admin'] },
    { text: 'User Management', icon: <People />, path: '/users', roles: ['admin'] },
    { text: 'Audit Log', icon: <History />, path: '/audit', roles: ['admin'] },
    { text: 'Data Sync', icon: <CloudSync />, path: '/sync', roles: ['admin'] },
    { text: 'Data Purge', icon: <Delete />, path: '/purge', roles: ['admin'] },
  ];

  const handleItemClick = (path: string) => {
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

  const isItemActive = (path: string) => {
    return location.pathname === path;
  };

  const renderMenuItems = (items: typeof menuItems, title?: string) => (
    <>
      {title && (
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="overline" color="text.secondary" fontWeight="bold">
            {title}
          </Typography>
        </Box>
      )}
      <List>
        {items
          .filter(item => isItemAllowed(item.roles))
          .map((item) => (
            <ListItem key={item.path} disablePadding>
              <ListItemButton
                onClick={() => handleItemClick(item.path)}
                selected={isItemActive(item.path)}
                sx={{
                  '&.Mui-selected': {
                    backgroundColor: 'primary.main',
                    color: 'white',
                    '&:hover': {
                      backgroundColor: 'primary.dark',
                    },
                    '& .MuiListItemIcon-root': {
                      color: 'white',
                    },
                  },
                }}
              >
                <ListItemIcon sx={{ color: isItemActive(item.path) ? 'white' : 'inherit' }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItemButton>
            </ListItem>
          ))}
      </List>
    </>
  );

  return (
    <Drawer
      variant="temporary"
      anchor="left"
      open={open}
      onClose={onClose}
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
        },
      }}
    >
      <Box sx={{ overflow: 'auto', height: '100%', bgcolor: 'background.paper' }}>
        {/* Logo/Brand Section */}
        <Box sx={{ p: 2, textAlign: 'center', bgcolor: 'primary.main', color: 'white' }}>
          <Typography variant="h6" fontWeight="bold">
            Threads
          </Typography>
          <Typography variant="caption">
            Clean, modern intelligence
          </Typography>
        </Box>

        {/* Main Navigation */}
        {renderMenuItems(menuItems)}

        {/* Edit/Content Management */}
        {user && ['edit', 'admin'].includes(user.role) && (
          <>
            <Divider />
            {renderMenuItems(editMenuItems, 'Content Management')}
          </>
        )}

        {/* Admin Functions */}
        {user && user.role === 'admin' && (
          <>
            <Divider />
            {renderMenuItems(adminMenuItems, 'Administration')}
          </>
        )}

        {/* User Info at Bottom */}
        {user && (
          <>
            <Box sx={{ flexGrow: 1 }} />
            <Divider />
            <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
              <Typography variant="body2" color="text.secondary">
                Logged in as:
              </Typography>
              <Typography variant="body2" fontWeight="bold">
                {user.username}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Role: {user.role.toUpperCase()}
              </Typography>
            </Box>
          </>
        )}
      </Box>
    </Drawer>
  );
};

export default Sidebar;