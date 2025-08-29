import React, { useState, useEffect, useRef } from 'react';
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
  Alert,
  Popper
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
  onCommentAdded?: () => void;
  onCommentDeleted?: () => void;
}

const Comments: React.FC<CommentsProps> = ({ postId, onCommentAdded, onCommentDeleted }) => {
  const [comments, setComments] = useState<PostComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingComment, setEditingComment] = useState<PostComment | null>(null);
  const [editContent, setEditContent] = useState('');
  const [error, setError] = useState('');
  
  // @ mention functionality
  const [mentionUsers, setMentionUsers] = useState<Array<{ id: number; username: string; role: string }>>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionAnchorEl, setMentionAnchorEl] = useState<HTMLElement | null>(null);
  const [mentionSearch, setMentionSearch] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const textFieldRef = useRef<HTMLDivElement>(null);
  
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
      
      // Call the callback if a hashtag was added
      if (onCommentAdded) {
        const hashtags = extractHashtags(newComment);
        if (hashtags.length > 0) {
          onCommentAdded();
        }
      }
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
      
      // Get the comment content before deleting to check for hashtags
      const commentToDelete = comments.find(c => c.id === commentId);
      const hadHashtags = commentToDelete ? extractHashtags(commentToDelete.content).length > 0 : false;
      
      await apiService.deleteComment(commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
      
      // Call the callback if the deleted comment had hashtags
      if (onCommentDeleted && hadHashtags) {
        onCommentDeleted();
      }
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

  // Helper function to extract hashtags from text
  const extractHashtags = (text: string): string[] => {
    const hashtagRegex = /#(\w+)/g;
    const hashtags: string[] = [];
    let match;
    while ((match = hashtagRegex.exec(text)) !== null) {
      hashtags.push('#' + match[1].toLowerCase());
    }
    return Array.from(new Set(hashtags)); // Remove duplicates
  };

  // @ mention handling
  const handleCommentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewComment(value);
    
    // Check for @ mentions
    const cursorPos = e.target.selectionStart || 0;
    setCursorPosition(cursorPos);
    
    const beforeCursor = value.substring(0, cursorPos);
    const mentionMatch = beforeCursor.match(/@(\w*)$/);
    
    if (mentionMatch) {
      const searchTerm = mentionMatch[1];
      setMentionSearch(searchTerm);
      setMentionAnchorEl(e.target);
      setShowMentions(true);
      searchUsers(searchTerm);
    } else {
      setShowMentions(false);
    }
  };

  const searchUsers = async (search: string) => {
    try {
      const response = await apiService.getUsersForMentions(search);
      setMentionUsers(response.users);
    } catch (error) {
      console.error('Failed to search users:', error);
    }
  };

  const handleMentionSelect = (username: string) => {
    const beforeAt = newComment.substring(0, cursorPosition).replace(/@\w*$/, '');
    const afterAt = newComment.substring(cursorPosition);
    const newValue = beforeAt + '@' + username + ' ' + afterAt;
    
    setNewComment(newValue);
    setShowMentions(false);
    
    // Focus back to text field
    if (textFieldRef.current) {
      const input = textFieldRef.current.querySelector('input');
      if (input) {
        input.focus();
        const newCursorPos = beforeAt.length + username.length + 2; // +2 for @ and space
        input.setSelectionRange(newCursorPos, newCursorPos);
      }
    }
  };

  // Highlight @ mentions in comment text
  const highlightMentions = (text: string) => {
    const mentionRegex = /@(\w+)/g;
    const parts = text.split(mentionRegex);
    const result = [];
    
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        // Regular text
        result.push(parts[i]);
      } else {
        // Username (odd indices)
        result.push(
          <span key={i} style={{ color: '#1D9BF0', fontWeight: 600 }}>
            @{parts[i]}
          </span>
        );
      }
    }
    
    return result;
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
      {/* Subtle Comment Section Header */}
      <Box sx={{ 
        mb: 3, 
        p: 2.5, 
        backgroundColor: '#1C1F23', 
        borderRadius: 2, 
        border: '1px solid #2F3336',
        borderLeft: '4px solid #1DA1F2',
        position: 'relative'
      }}>
        <Typography variant="h6" sx={{ 
          color: '#E7E9EA', 
          fontWeight: 600, 
          mb: 0.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          💬 Comments ({comments.length})
        </Typography>
        <Typography variant="body2" sx={{ color: '#71767B', fontSize: '14px' }}>
          Share your thoughts and join the discussion
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ 
          mb: 2, 
          backgroundColor: '#1C1F23',
          color: '#E7E9EA',
          border: '1px solid #EF4444',
          '& .MuiAlert-icon': { color: '#EF4444' }
        }}>
          {error}
        </Alert>
      )}

      {/* Add new comment */}
      {user && (
        <Paper elevation={0} sx={{ 
          p: 2.5, 
          mb: 3, 
          backgroundColor: '#1C1F23',
          border: '1px solid #2F3336',
          borderRadius: 2
        }}>
          <Typography variant="subtitle2" sx={{ 
            mb: 2, 
            color: '#E7E9EA', 
            fontWeight: 500,
            fontSize: '15px'
          }}>
            Add a comment
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
            <TextField
              ref={textFieldRef}
              fullWidth
              multiline
              rows={3}
              placeholder="Share your thoughts... Use @ to mention users"
              value={newComment}
              onChange={handleCommentChange}
              disabled={submitting}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: '#16181C',
                  color: '#E7E9EA',
                  '& fieldset': {
                    borderColor: '#2F3336'
                  },
                  '&:hover fieldset': {
                    borderColor: '#1DA1F2'
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#1DA1F2'
                  }
                },
                '& .MuiInputLabel-root': {
                  color: '#71767B'
                },
                '& .MuiInputBase-input': {
                  color: '#E7E9EA',
                  '&::placeholder': {
                    color: '#71767B',
                    opacity: 1
                  }
                }
              }}
            />
            
            {/* @ Mention Dropdown */}
            <Popper
              open={showMentions && mentionUsers.length > 0}
              anchorEl={mentionAnchorEl}
              placement="bottom-start"
              style={{ zIndex: 1300 }}
            >
              <Paper sx={{ 
                maxHeight: 200, 
                overflow: 'auto', 
                minWidth: 200,
                backgroundColor: '#1C1F23',
                border: '1px solid #2F3336'
              }}>
                <List>
                  {mentionUsers.map((user) => (
                    <ListItem
                      key={user.id}
                      onClick={() => handleMentionSelect(user.username)}
                      sx={{ 
                        py: 1, 
                        cursor: 'pointer', 
                        '&:hover': { backgroundColor: '#2F3336' },
                        color: '#E7E9EA'
                      }}
                    >
                      <ListItemText
                        primary={`@${user.username}`}
                        secondary={user.role}
                        primaryTypographyProps={{ fontWeight: 500, color: '#E7E9EA' }}
                        secondaryTypographyProps={{ color: '#71767B' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </Popper>
            <Button
              variant="contained"
              onClick={handleSubmitComment}
              disabled={!newComment.trim() || submitting}
              startIcon={<SendIcon />}
              sx={{
                backgroundColor: '#1DA1F2',
                color: '#FFFFFF',
                fontWeight: 500,
                px: 2.5,
                py: 1.2,
                '&:hover': { 
                  backgroundColor: '#1A8CD8'
                },
                '&:disabled': { 
                  backgroundColor: '#2F3336',
                  color: '#71767B'
                }
              }}
            >
              {submitting ? 'Posting...' : 'Post'}
            </Button>
          </Box>
        </Paper>
      )}

      {/* Comments list */}
      {comments.length === 0 ? (
        <Box sx={{ 
          p: 4, 
          textAlign: 'center', 
          backgroundColor: '#1C1F23',
          border: '1px solid #2F3336',
          borderRadius: 2
        }}>
          <Typography sx={{ color: '#71767B', fontSize: '16px' }}>
            💭 No comments yet. Be the first to start the conversation!
          </Typography>
        </Box>
      ) : (
        <List sx={{ p: 0 }}>
          {comments.map((comment, index) => (
            <React.Fragment key={comment.id}>
              <ListItem sx={{ 
                p: 3, 
                backgroundColor: '#1C1F23',
                borderRadius: 2,
                mb: 2,
                border: '1px solid #2F3336',
                '&:hover': {
                  backgroundColor: '#16181C',
                  borderColor: '#3F4144'
                },
                transition: 'all 0.2s ease'
              }}>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#E7E9EA' }}>
                        {comment.username}
                      </Typography>
                      {comment.role === 'admin' && (
                        <Chip 
                          label="Admin" 
                          size="small" 
                          sx={{ 
                            backgroundColor: '#1DA1F2',
                            color: '#FFFFFF',
                            fontWeight: 600,
                            border: 'none'
                          }}
                        />
                      )}
                      {comment.is_edited && (
                        <Chip 
                          label="Edited" 
                          size="small" 
                          sx={{ 
                            backgroundColor: '#794BC4',
                            color: '#FFFFFF',
                            fontWeight: 600,
                            border: 'none'
                          }}
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
                                backgroundColor: '#16181C',
                                color: '#E7E9EA',
                                '& fieldset': {
                                  borderColor: '#2F3336'
                                },
                                '&:hover fieldset': {
                                  borderColor: '#1DA1F2'
                                },
                                '&.Mui-focused fieldset': {
                                  borderColor: '#1DA1F2'
                                }
                              },
                              '& .MuiInputBase-input': {
                                color: '#E7E9EA'
                              }
                            }}
                          />
                          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                            <Button
                              size="small"
                              variant="contained"
                              onClick={handleEditComment}
                              disabled={!editContent.trim() || submitting}
                              sx={{
                                backgroundColor: '#1DA1F2',
                                '&:hover': { backgroundColor: '#1A8CD8' }
                              }}
                            >
                              Save
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={cancelEditing}
                              disabled={submitting}
                              sx={{
                                borderColor: '#2F3336',
                                color: '#71767B',
                                '&:hover': { 
                                  borderColor: '#3F4144',
                                  backgroundColor: 'rgba(113, 118, 123, 0.1)'
                                }
                              }}
                            >
                              Cancel
                            </Button>
                          </Box>
                        </Box>
                      ) : (
                        <Typography variant="body2" sx={{ 
                          color: '#E7E9EA', 
                          whiteSpace: 'pre-wrap',
                          lineHeight: 1.6,
                          fontSize: '15px'
                        }}>
                          {highlightMentions(comment.content)}
                        </Typography>
                      )}
                      <Typography variant="caption" sx={{ 
                        color: '#71767B', 
                        mt: 2, 
                        display: 'block',
                        fontSize: '13px'
                      }}>
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
                        sx={{ 
                          color: '#71767B',
                          '&:hover': { 
                            backgroundColor: 'rgba(113, 118, 123, 0.1)',
                            color: '#1DA1F2'
                          }
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    )}
                    {canDeleteComment(comment) && (
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteComment(comment.id)}
                        sx={{ 
                          color: '#EF4444',
                          '&:hover': { 
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            color: '#DC2626'
                          }
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                )}
              </ListItem>
              {index < comments.length - 1 && (
                <Divider sx={{ 
                  borderColor: '#2F3336',
                  my: 1
                }} />
              )}
            </React.Fragment>
          ))}
        </List>
      )}
    </Box>
  );
};

export default Comments;
