import React, { useState, useEffect } from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  CircularProgress,
  Typography,
  Fade,
  Zoom
} from '@mui/material';
import {
  Sync as SyncIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  CloudDownload as DownloadIcon
} from '@mui/icons-material';
import apiService from '../../services/api';

interface SyncStatus {
  status: 'idle' | 'syncing' | 'success' | 'error';
  lastSync?: string;
  nextSync?: string;
  message?: string;
  progress?: number;
}

const SyncNotification: React.FC = () => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ status: 'idle' });
  const [isVisible, setIsVisible] = useState(false);

  // Poll sync status every 10 seconds
  useEffect(() => {
    const checkSyncStatus = async () => {
      try {
        const response = await apiService.getHealthSync();
        const status = response.sync || {};
        
        // Determine sync state
        let newStatus: SyncStatus = { status: 'idle' };
        
        if (status.status === 'syncing' || status.status === 'running') {
          newStatus = { 
            status: 'syncing', 
            message: 'Ingesting new data...',
            progress: 50 // Simulate progress
          };
          setIsVisible(true);
        } else if (status.status === 'success' || status.status === 'completed') {
          newStatus = { 
            status: 'success', 
            message: 'Sync completed',
            lastSync: status.lastSync
          };
          setIsVisible(true);
          // Hide success after 5 seconds
          setTimeout(() => setIsVisible(false), 5000);
        } else if (status.status === 'error' || status.status === 'failed') {
          newStatus = { 
            status: 'error', 
            message: 'Sync failed',
            lastSync: status.lastSync
          };
          setIsVisible(true);
          // Hide error after 8 seconds
          setTimeout(() => setIsVisible(false), 8000);
        } else {
          setIsVisible(false);
        }
        
        setSyncStatus(newStatus);
      } catch (error) {
        console.error('Failed to check sync status:', error);
      }
    };

    // Check immediately
    checkSyncStatus();
    
    // Then check every 10 seconds
    const interval = setInterval(checkSyncStatus, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const getIcon = () => {
    switch (syncStatus.status) {
      case 'syncing':
        return (
          <Box sx={{ position: 'relative', display: 'inline-flex' }}>
            <CircularProgress 
              size={24} 
              thickness={4}
              sx={{ 
                color: '#1DA1F2',
                '& .MuiCircularProgress-circle': {
                  strokeLinecap: 'round',
                }
              }} 
            />
            <Box
              sx={{
                top: 0,
                left: 0,
                bottom: 0,
                right: 0,
                position: 'absolute',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <DownloadIcon sx={{ fontSize: 12, color: '#1DA1F2' }} />
            </Box>
          </Box>
        );
      case 'success':
        return <CheckIcon sx={{ fontSize: 24, color: '#10B981' }} />;
      case 'error':
        return <ErrorIcon sx={{ fontSize: 24, color: '#EF4444' }} />;
      default:
        return <SyncIcon sx={{ fontSize: 24, color: '#71767B' }} />;
    }
  };

  const getTooltipText = () => {
    if (syncStatus.status === 'syncing') {
      return '🔄 Ingesting new data from WordPress...';
    } else if (syncStatus.status === 'success') {
      return `✅ Sync completed successfully${syncStatus.lastSync ? ` at ${new Date(syncStatus.lastSync).toLocaleTimeString()}` : ''}`;
    } else if (syncStatus.status === 'error') {
      return `❌ Sync failed${syncStatus.lastSync ? ` at ${new Date(syncStatus.lastSync).toLocaleTimeString()}` : ''}`;
    }
    return '📊 System sync status';
  };

  const getBackgroundColor = () => {
    switch (syncStatus.status) {
      case 'syncing':
        return 'rgba(29, 161, 242, 0.1)';
      case 'success':
        return 'rgba(16, 185, 129, 0.1)';
      case 'error':
        return 'rgba(239, 68, 68, 0.1)';
      default:
        return 'transparent';
    }
  };

  const getBorderColor = () => {
    switch (syncStatus.status) {
      case 'syncing':
        return '#1DA1F2';
      case 'success':
        return '#10B981';
      case 'error':
        return '#EF4444';
      default:
        return 'transparent';
    }
  };

  return (
    <Fade in={isVisible} timeout={300}>
      <Box>
        <Tooltip 
          title={getTooltipText()}
          placement="bottom"
          arrow
        >
          <IconButton
            sx={{
              width: 40,
              height: 40,
              backgroundColor: getBackgroundColor(),
              border: `2px solid ${getBorderColor()}`,
              borderRadius: '50%',
              transition: 'all 0.3s ease',
              '&:hover': {
                backgroundColor: getBackgroundColor(),
                transform: 'scale(1.05)',
                boxShadow: `0 4px 12px ${getBorderColor()}40`
              },
              ...(syncStatus.status === 'syncing' && {
                animation: 'pulse 2s infinite',
                '@keyframes pulse': {
                  '0%': {
                    boxShadow: `0 0 0 0 ${getBorderColor()}40`
                  },
                  '70%': {
                    boxShadow: `0 0 0 10px ${getBorderColor()}00`
                  },
                  '100%': {
                    boxShadow: `0 0 0 0 ${getBorderColor()}00`
                  }
                }
              })
            }}
          >
            {getIcon()}
          </IconButton>
        </Tooltip>
        
        {/* Status Message */}
        {syncStatus.message && (
          <Zoom in={!!syncStatus.message} timeout={200}>
            <Box
              sx={{
                position: 'absolute',
                top: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                mt: 1,
                px: 2,
                py: 1,
                backgroundColor: '#1C1F23',
                color: '#E7E9EA',
                borderRadius: 2,
                border: `1px solid ${getBorderColor()}`,
                fontSize: '12px',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                zIndex: 1400,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
              }}
            >
              {syncStatus.message}
            </Box>
          </Zoom>
        )}
      </Box>
    </Fade>
  );
};

export default SyncNotification;