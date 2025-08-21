import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Paper,
  Divider,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert
} from '@mui/material';
import {
  Send as SendIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Reply as ReplyIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import apiService from '../../services/api';
import { PostComment } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

interface CommentsProps {
  postId: number;
}

const Comments: React.FC<CommentsProps> = ({ postId }) => {
  const [comments, setComments] = useState<PostComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingComment, setEditingComment] = useState<PostComment | null>(null);
  const [editContent, setEditContent] = useState('');
  const [error, setError] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    loadComments();
  }, [postId]);

  const loadComments = async () => {
    try {
      setLoading(true);
      const response = await apiService.getComments(postId);
      setComments(response.comments);
    } catch (error) {
      console.error('Failed to load comments:', error);
      setError('Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !user) return;
    
    try {
      setSubmitting(true);
      setError('');
      const response = await apiService.createComment(postId, newComment.trim());
      setComments(prev => [...prev, response.comment]);
      setNewComment('');
    } catch (error: any) {
      console.error('Failed to create comment:', error);
      setError(error.response?.data?.error || 'Failed to create comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditComment = async () => {
    if (!editingComment || !editContent.trim()) return;
    
    try {
      setSubmitting(true);
      setError('');
      const response = await apiService.updateComment(editingComment.id, editContent.trim());
      setComments(prev => prev.map(c => c.id === editingComment.id ? response.comment : c));
      setEditingComment(null);
      setEditContent('');
    } catch (error: any) {
      console.error('Failed to update comment:', error);
      setError(error.response?.data?.error || 'Failed to update comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;
    
    try {
      setSubmitting(true);
      setError('');
      await apiService.deleteComment(commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch (error: any) {
      console.error('Failed to delete comment:', error);
      setError(error.response?.data?.error || 'Failed to delete comment');
    } finally {
      setSubmitting(false);
    }
  };

  const startEditing = (comment: PostComment) => {
    setEditingComment(comment);
    setEditContent(comment.content);
  };

  const cancelEditing = () => {
    setEditingComment(null);
    setEditContent('');
  };

  const canEditComment = (comment: PostComment) => {
    return user && (user.id === comment.user_id || user.role === 'admin');
  };

  const canDeleteComment = (comment: PostComment) => {
    return user && (user.id === comment.user_id || user.role === 'admin');
  };

  if (loading) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography>Loading comments...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h6" sx={{ mb: 2, color: '#1F2937', fontWeight: 600 }}>
        Comments ({comments.length})
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Add new comment */}
      {user && (
        <Paper elevation={1} sx={{ p: 2, mb: 3, backgroundColor: '#F9FAFB' }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
            <TextField
              fullWidth
              multiline
              rows={2}
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              disabled={submitting}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'white',
                  '&:hover fieldset': {
                    borderColor: '#3B82F6'
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#3B82F6'
                  }
                }
              }}
            />
            <Button
              variant="contained"
              onClick={handleSubmitComment}
              disabled={!newComment.trim() || submitting}
              startIcon={<SendIcon />}
              sx={{
                backgroundColor: '#3B82F6',
                '&:hover': { backgroundColor: '#2563EB' },
                '&:disabled': { backgroundColor: '#9CA3AF' }
              }}
            >
              Post
            </Button>
          </Box>
        </Paper>
      )}

      {/* Comments list */}
      {comments.length === 0 ? (
        <Box sx={{ p: 3, textAlign: 'center', color: '#6B7280' }}>
          <Typography>No comments yet. Be the first to comment!</Typography>
        </Box>
      ) : (
        <List sx={{ p: 0 }}>
          {comments.map((comment, index) => (
            <React.Fragment key={comment.id}>
              <ListItem sx={{ 
                p: 2, 
                backgroundColor: 'white',
                borderRadius: 1,
                mb: 1,
                border: '1px solid #E5E7EB'
              }}>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1F2937' }}>
                        {comment.username}
                      </Typography>
                      {comment.role === 'admin' && (
                        <Chip 
                          label="Admin" 
                          size="small" 
                          color="primary" 
                          variant="outlined"
                        />
                      )}
                      {comment.is_edited && (
                        <Chip 
                          label="Edited" 
                          size="small" 
                          color="secondary" 
                          variant="outlined"
                        />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box>
                      {editingComment?.id === comment.id ? (
                        <Box sx={{ mt: 1 }}>
                          <TextField
                            fullWidth
                            multiline
                            rows={2}
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                backgroundColor: '#F9FAFB'
                              }
                            }}
                          />
                          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                            <Button
                              size="small"
                              variant="contained"
                              onClick={handleEditComment}
                              disabled={!editContent.trim() || submitting}
                            >
                              Save
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={cancelEditing}
                              disabled={submitting}
                            >
                              Cancel
                            </Button>
                          </Box>
                        </Box>
                      ) : (
                        <Typography variant="body2" sx={{ color: '#374151', whiteSpace: 'pre-wrap' }}>
                          {comment.content}
                        </Typography>
                      )}
                      <Typography variant="caption" sx={{ color: '#9CA3AF', mt: 1, display: 'block' }}>
                        {format(new Date(comment.created_at), 'MMM dd, yyyy HH:mm')}
                        {comment.updated_at !== comment.created_at && (
                          <span> (edited {format(new Date(comment.updated_at), 'MMM dd, yyyy HH:mm')})</span>
                        )}
                      </Typography>
                    </Box>
                  }
                />
                
                {/* Action buttons */}
                {editingComment?.id !== comment.id && (
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {canEditComment(comment) && (
                      <IconButton
                        size="small"
                        onClick={() => startEditing(comment)}
                        sx={{ color: '#6B7280' }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    )}
                    {canDeleteComment(comment) && (
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteComment(comment.id)}
                        sx={{ color: '#EF4444' }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                )}
              </ListItem>
              {index < comments.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>
      )}
    </Box>
  );
};

export default Comments;
