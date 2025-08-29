import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  IconButton,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Snackbar,
  Alert as MuiAlert
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Share as ShareIcon,
  Loop as RepostIcon,
  BookmarkBorder as SaveIcon,
  Bookmark as SavedIcon,
  Edit as EditIcon,
  Warning as WarningIcon,
  Person as PersonIcon,
  DirectionsCar as VehicleIcon,
  LocationOn as LocationIcon,
  Phone as PhoneIcon,
  CalendarToday as CalendarIcon,
  Shield as ShieldIcon,
  Send as SendIcon,
  ContentCopy as CopyIcon
} from '@mui/icons-material';
import { BOLO, BOLOComment, BOLOFormData } from '../../types/bolo';
import boloApi from '../../services/boloApi';
import { useAuth } from '../../contexts/AuthContext';
import { format, formatDistanceToNow } from 'date-fns';
import './BOLODetail.css';

interface BOLODetailStyledProps {
  isPublic?: boolean;
}

const BOLODetailStyled: React.FC<BOLODetailStyledProps> = ({ isPublic = false }) => {
  const { id, token } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [bolo, setBolo] = useState<BOLO | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editData, setEditData] = useState<Partial<BOLO>>({});
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [repostDialogOpen, setRepostDialogOpen] = useState(false);
  const [repostMessage, setRepostMessage] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const canEdit = user && (user.role === 'admin' || (user.role === 'edit' && bolo?.created_by === user.id));

  useEffect(() => {
    loadBOLO();
  }, [id, token]);

  const loadBOLO = async () => {
    try {
      setLoading(true);
      let data: BOLO;
      
      if (isPublic && token) {
        data = await boloApi.getPublicBOLO(token);
      } else if (id) {
        data = await boloApi.getBOLOById(parseInt(id));
      } else {
        throw new Error('Invalid BOLO reference');
      }
      
      setBolo(data);
      setEditData(data);
      if (data.public_share_token) {
        setShareLink(boloApi.getShareableLink(data));
      }
    } catch (error) {
      console.error('Error loading BOLO:', error);
      setSnackbar({ open: true, message: 'Failed to load BOLO', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!bolo) return;
    
    try {
      const saved = await boloApi.toggleSaveBOLO(bolo.id);
      setBolo({ ...bolo, is_saved: saved });
      setSnackbar({ 
        open: true, 
        message: saved ? 'BOLO saved to your dashboard' : 'BOLO removed from saved items', 
        severity: 'success' 
      });
    } catch (error) {
      console.error('Error saving BOLO:', error);
      setSnackbar({ open: true, message: 'Failed to save BOLO', severity: 'error' });
    }
  };

  const handleRepost = async () => {
    if (!bolo) return;
    
    try {
      await boloApi.repostBOLO(bolo.id, repostMessage);
      setBolo({ ...bolo, repost_count: bolo.repost_count + 1, is_reposted: true });
      setRepostDialogOpen(false);
      setRepostMessage('');
      setSnackbar({ open: true, message: 'BOLO reposted successfully', severity: 'success' });
    } catch (error: any) {
      console.error('Error reposting BOLO:', error);
      setSnackbar({ 
        open: true, 
        message: error.message === 'Already reposted this BOLO' ? 'You have already reposted this BOLO' : 'Failed to repost BOLO', 
        severity: 'error' 
      });
    }
  };

  const handleComment = async () => {
    if (!bolo || !commentText.trim()) return;
    
    try {
      const comment = await boloApi.addComment(bolo.id, commentText, isInternal);
      setBolo({
        ...bolo,
        comments: [...(bolo.comments || []), comment],
        comment_count: bolo.comment_count + 1
      });
      setCommentText('');
      setSnackbar({ open: true, message: 'Comment added', severity: 'success' });
    } catch (error) {
      console.error('Error adding comment:', error);
      setSnackbar({ open: true, message: 'Failed to add comment', severity: 'error' });
    }
  };

  const handleEdit = () => {
    setEditData(bolo || {});
    setEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!bolo || !editData) return;
    
    try {
      // Convert editData to format for API, only including fields that exist in BOLOFormData
      const formData: any = {
        title: editData.title,
        summary: editData.summary,
        narrative: editData.narrative,
        priority: editData.priority,
        officer_safety_info: editData.officer_safety_info,
        approach_instructions: editData.approach_instructions,
        subject_aliases: Array.isArray(editData.subject_aliases) 
          ? editData.subject_aliases.join(', ') 
          : editData.subject_aliases,
        vehicle_year: editData.vehicle_year?.toString(),
        // Status will be handled separately
        status: editData.status
      };
      const updated = await boloApi.updateBOLO(bolo.id, formData);
      setBolo(updated);
      setEditDialogOpen(false);
      setSnackbar({ open: true, message: 'BOLO updated successfully', severity: 'success' });
    } catch (error) {
      console.error('Error updating BOLO:', error);
      setSnackbar({ open: true, message: 'Failed to update BOLO', severity: 'error' });
    }
  };

  const handleShare = () => {
    if (bolo?.public_share_token) {
      setShareLink(boloApi.getShareableLink(bolo));
      setShareDialogOpen(true);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareLink);
    setSnackbar({ open: true, message: 'Link copied to clipboard', severity: 'success' });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'immediate': return 'priority-immediate';
      case 'high': return 'priority-high';
      case 'medium': return 'priority-medium';
      default: return 'priority-medium';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'person': return <PersonIcon />;
      case 'vehicle': return <VehicleIcon />;
      default: return <WarningIcon />;
    }
  };

  if (loading) {
    return (
      <div className="bolo-detail-page">
        <div className="loading-container">
          <CircularProgress className="loading-spinner" />
        </div>
      </div>
    );
  }

  if (!bolo) {
    return (
      <div className="bolo-detail-page">
        <div className="detail-container">
          <MuiAlert severity="error">BOLO not found</MuiAlert>
        </div>
      </div>
    );
  }

  return (
    <div className="bolo-detail-page">
      <div className="detail-container">
        {/* Header Bar */}
        {!isPublic && (
          <div className="detail-header">
            <div className="header-left">
              <IconButton className="back-button" onClick={() => navigate(-1)}>
                <BackIcon />
              </IconButton>
              <div className="case-badge">
                <ShieldIcon fontSize="small" />
                <span className="case-number">{bolo.case_number}</span>
              </div>
            </div>
            <div className="header-actions">
              {canEdit && (
                <IconButton onClick={handleEdit} title="Edit BOLO">
                  <EditIcon />
                </IconButton>
              )}
              <IconButton onClick={handleShare} title="Share">
                <ShareIcon />
              </IconButton>
            </div>
          </div>
        )}

        <div className="detail-content">
          {/* Main Content */}
          <div className="detail-main-card">
            {/* Alert Banner for Armed & Dangerous */}
            {bolo.armed_dangerous && (
              <div className="alert-banner">
                <WarningIcon />
                <span>ARMED & DANGEROUS - {bolo.armed_dangerous_details || 'Exercise extreme caution'}</span>
              </div>
            )}

            {/* Hero Section */}
            <div className="hero-section">
              <h1 className="hero-title">{bolo.title}</h1>
              <div className="hero-meta">
                <span className={`priority-badge ${getPriorityColor(bolo.priority)}`}>
                  {bolo.priority} priority
                </span>
                <span className={`status-badge status-${bolo.status}`}>
                  {bolo.status}
                </span>
                <div className="meta-item">
                  {getTypeIcon(bolo.type)}
                  <span>{bolo.type}</span>
                </div>
                {bolo.incident_date && (
                  <div className="meta-item">
                    <CalendarIcon />
                    <span>{format(new Date(bolo.incident_date), 'MMM dd, yyyy h:mm a')}</span>
                  </div>
                )}
                <div className="meta-item">
                  <LocationIcon />
                  <span>{bolo.jurisdiction}</span>
                </div>
              </div>
              
              {bolo.summary && (
                <div className="summary-box">
                  <p className="summary-text">{bolo.summary}</p>
                </div>
              )}
            </div>

            {/* Subject Information */}
            {bolo.subject_name && (
              <div className="info-section">
                <h2 className="section-title">
                  <PersonIcon />
                  Subject Information
                </h2>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">Name</span>
                    <span className="info-value">{bolo.subject_name}</span>
                  </div>
                  {bolo.subject_aliases && bolo.subject_aliases.length > 0 && (
                    <div className="info-item">
                      <span className="info-label">Aliases</span>
                      <span className="info-value">{bolo.subject_aliases.join(', ')}</span>
                    </div>
                  )}
                  {bolo.date_of_birth && (
                    <div className="info-item">
                      <span className="info-label">Date of Birth</span>
                      <span className="info-value">{format(new Date(bolo.date_of_birth), 'MM/dd/yyyy')}</span>
                    </div>
                  )}
                  {bolo.age_range && (
                    <div className="info-item">
                      <span className="info-label">Age</span>
                      <span className="info-value">{bolo.age_range}</span>
                    </div>
                  )}
                  {bolo.height && (
                    <div className="info-item">
                      <span className="info-label">Height</span>
                      <span className="info-value">{bolo.height}</span>
                    </div>
                  )}
                  {bolo.weight && (
                    <div className="info-item">
                      <span className="info-label">Weight</span>
                      <span className="info-value">{bolo.weight}</span>
                    </div>
                  )}
                  {bolo.hair_color && (
                    <div className="info-item">
                      <span className="info-label">Hair Color</span>
                      <span className="info-value">{bolo.hair_color}</span>
                    </div>
                  )}
                  {bolo.eye_color && (
                    <div className="info-item">
                      <span className="info-label">Eye Color</span>
                      <span className="info-value">{bolo.eye_color}</span>
                    </div>
                  )}
                  {bolo.distinguishing_features && (
                    <div className="info-item">
                      <span className="info-label">Distinguishing Features</span>
                      <span className="info-value">{bolo.distinguishing_features}</span>
                    </div>
                  )}
                  {bolo.last_seen_wearing && (
                    <div className="info-item">
                      <span className="info-label">Last Seen Wearing</span>
                      <span className="info-value">{bolo.last_seen_wearing}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Vehicle Information */}
            {bolo.vehicle_make && (
              <div className="info-section">
                <h2 className="section-title">
                  <VehicleIcon />
                  Vehicle Information
                </h2>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">Make/Model</span>
                    <span className="info-value">
                      {bolo.vehicle_year} {bolo.vehicle_make} {bolo.vehicle_model}
                    </span>
                  </div>
                  {bolo.vehicle_color && (
                    <div className="info-item">
                      <span className="info-label">Color</span>
                      <span className="info-value">{bolo.vehicle_color}</span>
                    </div>
                  )}
                  {bolo.license_plate && (
                    <div className="info-item">
                      <span className="info-label">License Plate</span>
                      <span className="info-value">{bolo.license_plate}</span>
                    </div>
                  )}
                  {bolo.vehicle_vin && (
                    <div className="info-item">
                      <span className="info-label">VIN</span>
                      <span className="info-value">{bolo.vehicle_vin}</span>
                    </div>
                  )}
                  {bolo.vehicle_features && (
                    <div className="info-item">
                      <span className="info-label">Features</span>
                      <span className="info-value">{bolo.vehicle_features}</span>
                    </div>
                  )}
                  {bolo.direction_of_travel && (
                    <div className="info-item">
                      <span className="info-label">Direction of Travel</span>
                      <span className="info-value">{bolo.direction_of_travel}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Location Information */}
            <div className="info-section">
              <h2 className="section-title">
                <LocationIcon />
                Location Information
              </h2>
              <div className="info-grid">
                {bolo.incident_location && (
                  <div className="info-item">
                    <span className="info-label">Incident Location</span>
                    <span className="info-value">{bolo.incident_location}</span>
                  </div>
                )}
                {bolo.last_known_location && (
                  <div className="info-item">
                    <span className="info-label">Last Known Location</span>
                    <span className="info-value">{bolo.last_known_location}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Narrative */}
            {bolo.narrative && (
              <div className="narrative-section">
                <h3 className="section-title">Narrative</h3>
                <p className="narrative-text">{bolo.narrative}</p>
              </div>
            )}

            {/* Officer Safety & Approach */}
            {(bolo.officer_safety_info || bolo.approach_instructions) && (
              <div className="info-section">
                <h2 className="section-title">
                  <ShieldIcon />
                  Officer Safety
                </h2>
                {bolo.officer_safety_info && (
                  <div className="narrative-section">
                    <h4 style={{ color: 'var(--detail-warning)', marginBottom: '8px' }}>Safety Information</h4>
                    <p className="narrative-text">{bolo.officer_safety_info}</p>
                  </div>
                )}
                {bolo.approach_instructions && (
                  <div className="narrative-section" style={{ marginTop: '16px' }}>
                    <h4 style={{ color: 'var(--detail-accent)', marginBottom: '8px' }}>Approach Instructions</h4>
                    <p className="narrative-text">{bolo.approach_instructions}</p>
                  </div>
                )}
              </div>
            )}

            {/* Action Bar */}
            {!isPublic && (
              <div className="action-bar">
                <div className="action-buttons">
                  <button className="action-btn" onClick={() => setRepostDialogOpen(true)}>
                    <RepostIcon />
                    <span className="action-count">{bolo.repost_count || 0}</span>
                    <span>Repost</span>
                  </button>
                  <button className={`action-btn ${bolo.is_saved ? 'saved' : ''}`} onClick={handleSave}>
                    {bolo.is_saved ? <SavedIcon /> : <SaveIcon />}
                    <span>{bolo.is_saved ? 'Saved' : 'Save'}</span>
                  </button>
                  <button className="action-btn" onClick={handleShare}>
                    <ShareIcon />
                    <span>Share</span>
                  </button>
                </div>
                <div className="meta-item">
                  <span>{bolo.view_count || 0} views</span>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="detail-sidebar">
            {/* Agency Card */}
            <div className="agency-card">
              <div className="agency-header">
                <div className="agency-avatar">
                  <ShieldIcon />
                </div>
                <div className="agency-info">
                  <div className="agency-name">{bolo.agency_name}</div>
                  <div className="agency-officer">Officer: {bolo.officer_name}</div>
                </div>
              </div>
              {bolo.contact_info && (
                <div className="contact-info">
                  <div className="contact-item">
                    <PhoneIcon fontSize="small" />
                    <span>{bolo.contact_info}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Comments Section */}
            {!isPublic && (
              <div className="comments-section">
                <h3 className="comments-header">Comments ({bolo.comment_count || 0})</h3>
                
                <div className="comment-form">
                  <input
                    type="text"
                    className="comment-input"
                    placeholder="Add a comment..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleComment()}
                  />
                  <button className="comment-submit" onClick={handleComment}>
                    <SendIcon fontSize="small" />
                  </button>
                </div>

                {canEdit && (
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={isInternal}
                        onChange={(e) => setIsInternal(e.target.checked)}
                        size="small"
                      />
                    }
                    label="Internal comment"
                    style={{ marginTop: '8px', marginBottom: '16px' }}
                  />
                )}

                <div className="comments-list">
                  {bolo.comments?.map((comment) => (
                    <div key={comment.id} className="comment-item">
                      <div className="comment-avatar">
                        {comment.username?.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="comment-content">
                        <div className="comment-header">
                          <span className="comment-author">{comment.username}</span>
                          {comment.is_internal && <span className="internal-badge">Internal</span>}
                          <span className="comment-time">
                            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <div className="comment-text">{comment.content}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            {!isPublic && canEdit && (
              <div className="quick-actions">
                <h3 className="quick-actions-title">Quick Actions</h3>
                <div className="action-list">
                  <button className="quick-action-btn" onClick={handleEdit}>
                    <EditIcon />
                    <span>Edit BOLO Details</span>
                  </button>
                  <button className="quick-action-btn" onClick={() => {
                    setEditData({ ...bolo, status: 'resolved' });
                    handleUpdate();
                  }}>
                    <span>Mark as Resolved</span>
                  </button>
                  <button className="quick-action-btn" onClick={() => {
                    setEditData({ ...bolo, status: 'cancelled' });
                    handleUpdate();
                  }}>
                    <span>Cancel BOLO</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit BOLO</DialogTitle>
        <DialogContent>
          <div style={{ display: 'grid', gap: '16px', marginTop: '16px' }}>
            <TextField
              label="Title"
              value={editData.title || ''}
              onChange={(e) => setEditData({ ...editData, title: e.target.value })}
              fullWidth
            />
            <TextField
              label="Summary"
              value={editData.summary || ''}
              onChange={(e) => setEditData({ ...editData, summary: e.target.value })}
              multiline
              rows={3}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={editData.status || 'active'}
                onChange={(e) => setEditData({ ...editData, status: e.target.value as BOLO['status'] })}
              >
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="resolved">Resolved</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
                <MenuItem value="expired">Expired</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                value={editData.priority || 'medium'}
                onChange={(e) => setEditData({ ...editData, priority: e.target.value as BOLO['priority'] })}
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="immediate">Immediate</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Narrative"
              value={editData.narrative || ''}
              onChange={(e) => setEditData({ ...editData, narrative: e.target.value })}
              multiline
              rows={4}
              fullWidth
            />
            <TextField
              label="Officer Safety Info"
              value={editData.officer_safety_info || ''}
              onChange={(e) => setEditData({ ...editData, officer_safety_info: e.target.value })}
              multiline
              rows={3}
              fullWidth
            />
            <TextField
              label="Approach Instructions"
              value={editData.approach_instructions || ''}
              onChange={(e) => setEditData({ ...editData, approach_instructions: e.target.value })}
              multiline
              rows={3}
              fullWidth
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleUpdate} variant="contained">Save Changes</Button>
        </DialogActions>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onClose={() => setShareDialogOpen(false)}>
        <DialogTitle>Share BOLO</DialogTitle>
        <DialogContent>
          <TextField
            value={shareLink}
            fullWidth
            InputProps={{
              readOnly: true,
              endAdornment: (
                <IconButton onClick={copyToClipboard}>
                  <CopyIcon />
                </IconButton>
              )
            }}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Repost Dialog */}
      <Dialog open={repostDialogOpen} onClose={() => setRepostDialogOpen(false)}>
        <DialogTitle>Repost BOLO</DialogTitle>
        <DialogContent>
          <TextField
            label="Add a message (optional)"
            value={repostMessage}
            onChange={(e) => setRepostMessage(e.target.value)}
            multiline
            rows={3}
            fullWidth
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRepostDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleRepost} variant="contained">Repost</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <MuiAlert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </MuiAlert>
      </Snackbar>
    </div>
  );
};

export default BOLODetailStyled;