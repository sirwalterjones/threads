import React, { useState, useEffect } from 'react';
import {
  IconButton,
  Badge,
  Menu,
  MenuItem,
  Typography,
  Box,
  Divider,
  List,
  ListItem,
  ListItemText,
  Button
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  NotificationsNone as NotificationsNoneIcon
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import apiService from '../../services/api';
import { Notification } from '../../types';

const NotificationBell: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [loading, setLoading] = useState(false);

  const loadNotifications = async () => {
    try {
      const data = await apiService.getNotifications();
      setNotifications(data.notifications);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const count = await apiService.getUnreadNotificationCount();
      setUnreadCount(count);
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  };

  useEffect(() => {
    loadUnreadCount();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleClick = async (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    if (notifications.length === 0) {
      setLoading(true);
      await loadNotifications();
      setLoading(false);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleMarkAsRead = async (notificationId: number) => {
    try {
      await apiService.markNotificationRead(notificationId);
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await apiService.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const open = Boolean(anchorEl);

  return (
    <>
      <IconButton
        color="inherit"
        onClick={handleClick}
        sx={{ color: '#E7E9EA' }}
      >
        <Badge badgeContent={unreadCount} color="error">
          {unreadCount > 0 ? <NotificationsIcon /> : <NotificationsNoneIcon />}
        </Badge>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width: 350,
            maxHeight: 400,
            backgroundColor: '#16181C',
            border: '1px solid #2F3336',
          }
        }}
      >
        <Box sx={{ p: 2, borderBottom: '1px solid #2F3336' }}>
          <Typography variant="h6" sx={{ color: '#E7E9EA' }}>
            Notifications
          </Typography>
          {unreadCount > 0 && (
            <Button
              size="small"
              onClick={handleMarkAllAsRead}
              sx={{ color: '#1D9BF0', textTransform: 'none' }}
            >
              Mark all as read
            </Button>
          )}
        </Box>

        <List sx={{ p: 0, maxHeight: 300, overflow: 'auto' }}>
          {loading ? (
            <ListItem>
              <ListItemText 
                primary="Loading..."
                sx={{ '& .MuiListItemText-primary': { color: '#6B7280' } }}
              />
            </ListItem>
          ) : notifications.length === 0 ? (
            <ListItem>
              <ListItemText 
                primary="No notifications"
                sx={{ '& .MuiListItemText-primary': { color: '#6B7280' } }}
              />
            </ListItem>
          ) : (
            notifications.slice(0, 10).map((notification) => (
              <MenuItem
                key={notification.id}
                onClick={() => handleMarkAsRead(notification.id)}
                sx={{
                  backgroundColor: notification.is_read ? 'transparent' : 'rgba(29, 155, 240, 0.1)',
                  borderLeft: notification.is_read ? 'none' : '3px solid #1D9BF0',
                  '&:hover': {
                    backgroundColor: 'rgba(29, 155, 240, 0.05)'
                  }
                }}
              >
                <Box sx={{ width: '100%' }}>
                  <Typography
                    variant="body2"
                    sx={{
                      color: notification.is_read ? '#6B7280' : '#E7E9EA',
                      fontWeight: notification.is_read ? 'normal' : 'bold'
                    }}
                  >
                    {notification.title}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: '#71767B', display: 'block', mt: 0.5 }}
                  >
                    {notification.message}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: '#71767B', display: 'block', mt: 0.5 }}
                  >
                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                  </Typography>
                </Box>
              </MenuItem>
            ))
          )}
        </List>
      </Menu>
    </>
  );
};

export default NotificationBell;
