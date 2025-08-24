import React, { useState } from 'react';
import {
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';

interface DeletePostButtonProps {
  postId: number;
  postTitle: string;
  onDelete?: (postId: number) => void;
  variant?: 'icon' | 'button';
  size?: 'small' | 'medium' | 'large';
  sx?: any;
}

const DeletePostButton: React.FC<DeletePostButtonProps> = ({
  postId,
  postTitle,
  onDelete,
  variant = 'icon',
  size = 'medium',
  sx
}) => {
  const { user } = useAuth();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Only show for super admin users
  if (!user || user.super_admin !== true) {
    return null;
  }

  const handleDeleteClick = (event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    try {
      setDeleting(true);
      await apiService.deletePost(postId);
      
      // Call the callback to update the UI
      onDelete?.(postId);
      
      setDeleteDialogOpen(false);
      
      // Show success message (you could add a toast notification here)
      console.log(`Post "${postTitle}" deleted successfully`);
      
    } catch (error) {
      console.error('Error deleting post:', error);
      // You could add error handling here (toast notification, etc.)
    } finally {
      setDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
  };

  const buttonContent = variant === 'icon' ? (
    <IconButton
      onClick={handleDeleteClick}
      size={size}
      sx={{
        color: '#EF4444',
        '&:hover': {
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          color: '#DC2626'
        },
        ...sx
      }}
    >
      <DeleteIcon />
    </IconButton>
  ) : (
    <Button
      onClick={handleDeleteClick}
      variant="outlined"
      size={size}
      startIcon={<DeleteIcon />}
      sx={{
        color: '#EF4444',
        borderColor: '#EF4444',
        '&:hover': {
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderColor: '#DC2626'
        },
        ...sx
      }}
    >
      Delete
    </Button>
  );

  return (
    <>
      {buttonContent}
      
      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCancelDelete}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#1F2937',
            color: '#F9FAFB'
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          color: '#EF4444',
          borderBottom: '1px solid #374151'
        }}>
          <WarningIcon color="error" />
          Confirm Post Deletion
        </DialogTitle>
        
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body1" sx={{ mb: 2, color: '#F9FAFB' }}>
            Are you sure you want to delete this post?
          </Typography>
          
          <Box sx={{ 
            p: 2, 
            backgroundColor: '#374151', 
            borderRadius: 1,
            border: '1px solid #4B5563'
          }}>
            <Typography variant="body2" sx={{ color: '#D1D5DB' }}>
              <strong>Title:</strong> {postTitle}
            </Typography>
            <Typography variant="body2" sx={{ color: '#D1D5DB', mt: 1 }}>
              <strong>Post ID:</strong> {postId}
            </Typography>
          </Box>
          
          <Typography variant="body2" sx={{ mt: 2, color: '#9CA3AF' }}>
            <strong>Warning:</strong> This action cannot be undone. The post and all associated data (attachments, comments, follows) will be permanently deleted.
          </Typography>
        </DialogContent>
        
        <DialogActions sx={{ p: 2, borderTop: '1px solid #374151' }}>
          <Button
            onClick={handleCancelDelete}
            disabled={deleting}
            sx={{
              color: '#9CA3AF',
              borderColor: '#4B5563',
              '&:hover': {
                borderColor: '#6B7280'
              }
            }}
          >
            Cancel
          </Button>
          
          <Button
            onClick={handleConfirmDelete}
            disabled={deleting}
            variant="contained"
            startIcon={deleting ? <CircularProgress size={16} /> : <DeleteIcon />}
            sx={{
              backgroundColor: '#EF4444',
              color: '#FFFFFF',
              '&:hover': {
                backgroundColor: '#DC2626'
              },
              '&:disabled': {
                backgroundColor: '#6B7280'
              }
            }}
          >
            {deleting ? 'Deleting...' : 'Delete Post'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default DeletePostButton;
