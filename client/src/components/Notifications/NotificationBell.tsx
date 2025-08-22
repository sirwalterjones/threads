import React, { useState, useEffect } from 'react';
import {
  IconButton,
  Badge,
  Menu,
  MenuItem,
  Typography,
  Box,
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
      const data = await apiService.getUnreadNotificationCount();
      setUnreadCount(data.count);
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

  const handleNotificationClick = async (notification: any) => {
    try {
      // Mark notification as read
      await apiService.markNotificationRead(notification.id);
      setNotifications(prev => 
        prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));

      // Close the notification menu
      setAnchorEl(null);

      // Open the post detail modal if there's a related post
      if (notification.related_post_id) {
        const evt = new CustomEvent('open-post-detail', { 
          detail: { postId: notification.related_post_id } 
        });
        window.dispatchEvent(evt);
      }
    } catch (error) {
      console.error('Failed to handle notification click:', error);
    }
  };



  const handleClearAllNotifications = async () => {
    try {
      console.log('Clearing all notifications...');
      const response = await apiService.clearAllNotifications();
      console.log('Clear notifications response:', response);
      setNotifications([]);
      setUnreadCount(0);
      handleClose(); // Close the dropdown after clearing
    } catch (error) {
      console.error('Failed to clear all notifications:', error);
      alert('Failed to clear notifications. Please try again.');
    }
  };

  const open = Boolean(anchorEl);

  return (
    <>
      <IconButton
        color="inherit"
        onClick={handleClick}
        size="medium"
        sx={{ 
          color: '#E7E9EA',
          backgroundColor: 'rgba(29, 155, 240, 0.1)',
          border: '1px solid rgba(29, 155, 240, 0.3)',
          padding: '8px',
          minWidth: '40px',
          height: '40px',
          '&:hover': {
            backgroundColor: 'rgba(29, 155, 240, 0.2)',
            borderColor: 'rgba(29, 155, 240, 0.5)'
          },
          '& .MuiBadge-badge': {
            backgroundColor: '#ff4444',
            color: 'white'
          }
        }}
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
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ color: '#E7E9EA' }}>
              Notifications
            </Typography>
            {notifications.length > 0 && (
              <Button
                size="small"
                onClick={handleClearAllNotifications}
                sx={{ color: '#71767B', textTransform: 'none', fontSize: '12px' }}
              >
                Clear all
              </Button>
            )}
          </Box>
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
                onClick={() => handleNotificationClick(notification)}
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
                      fontWeight: notification.is_read ? 'normal' : 'bold',
                      fontSize: '13px',
                      lineHeight: 1.3
                    }}
                  >
                    {notification.from_username && (
                      <Box component="span" sx={{ color: '#1D9BF0', fontWeight: 600 }}>
                        @{notification.from_username}
                      </Box>
                    )}
                    {notification.from_username && ' mentioned you'}
                    {!notification.from_username && notification.title}
                  </Typography>
                  {notification.post_title && (
                    <Typography
                      variant="caption"
                      sx={{ 
                        color: notification.is_read ? '#6B7280' : '#E7E9EA', 
                        display: 'block', 
                        mt: 0.5,
                        fontWeight: 700,
                        fontSize: '12px'
                      }}
                    >
                      in "{notification.post_title}"
                    </Typography>
                  )}
                  <Typography
                    variant="caption"
                    sx={{ color: '#71767B', display: 'block', mt: 0.5, fontSize: '11px' }}
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
