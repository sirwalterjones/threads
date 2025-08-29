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
  
  // Helper function to format comment text with mentions
  const formatCommentWithMentions = (text: string) => {
    const parts = text.split(/(@[a-zA-Z0-9_]+)/g);
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        return (
          <span key={index} style={{ color: '#2fa9ff', fontWeight: 500 }}>
            {part}
          </span>
        );
      }
      return part;
    });
  };

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
    if (bolo) {
      navigate(`/bolo/edit/${bolo.id}`);
    }
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
        status: editData.status,
        type: editData.type,
        
        // Subject Information
        subject_name: editData.subject_name,
        subject_aliases: Array.isArray(editData.subject_aliases) 
          ? editData.subject_aliases.join(', ') 
          : editData.subject_aliases,
        subject_description: editData.subject_description,
        date_of_birth: editData.date_of_birth,
        age_range: editData.age_range,
        height: editData.height,
        weight: editData.weight,
        hair_color: editData.hair_color,
        eye_color: editData.eye_color,
        distinguishing_features: editData.distinguishing_features,
        last_seen_wearing: editData.last_seen_wearing,
        armed_dangerous: editData.armed_dangerous,
        armed_dangerous_details: editData.armed_dangerous_details,
        
        // Vehicle Information
        vehicle_make: editData.vehicle_make,
        vehicle_model: editData.vehicle_model,
        vehicle_year: editData.vehicle_year?.toString(),
        vehicle_color: editData.vehicle_color,
        license_plate: editData.license_plate,
        vehicle_vin: editData.vehicle_vin,
        vehicle_features: editData.vehicle_features,
        direction_of_travel: editData.direction_of_travel,
        
        // Incident Information
        incident_date: editData.incident_date,
        incident_location: editData.incident_location,
        last_known_location: editData.last_known_location,
        jurisdiction: editData.jurisdiction,
        
        // Safety & Instructions
        officer_safety_info: editData.officer_safety_info,
        approach_instructions: editData.approach_instructions,
        contact_info: editData.contact_info
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

  const handleStatusUpdate = async (newStatus: 'resolved' | 'cancelled') => {
    if (!bolo) return;
    
    try {
      const statusData = { ...bolo, status: newStatus };
      
      // Convert to format for API, only including fields that exist in BOLOFormData
      const formData: any = {
        title: statusData.title,
        summary: statusData.summary,
        narrative: statusData.narrative,
        priority: statusData.priority,
        status: statusData.status,
        type: statusData.type,
        
        // Subject Information
        subject_name: statusData.subject_name,
        subject_aliases: Array.isArray(statusData.subject_aliases) 
          ? statusData.subject_aliases.join(', ') 
          : statusData.subject_aliases,
        subject_description: statusData.subject_description,
        date_of_birth: statusData.date_of_birth,
        age_range: statusData.age_range,
        height: statusData.height,
        weight: statusData.weight,
        hair_color: statusData.hair_color,
        eye_color: statusData.eye_color,
        distinguishing_features: statusData.distinguishing_features,
        last_seen_wearing: statusData.last_seen_wearing,
        armed_dangerous: statusData.armed_dangerous,
        armed_dangerous_details: statusData.armed_dangerous_details,
        
        // Vehicle Information
        vehicle_make: statusData.vehicle_make,
        vehicle_model: statusData.vehicle_model,
        vehicle_year: statusData.vehicle_year?.toString(),
        vehicle_color: statusData.vehicle_color,
        license_plate: statusData.license_plate,
        vehicle_vin: statusData.vehicle_vin,
        vehicle_features: statusData.vehicle_features,
        direction_of_travel: statusData.direction_of_travel,
        
        // Incident Information
        incident_date: statusData.incident_date,
        incident_location: statusData.incident_location,
        last_known_location: statusData.last_known_location,
        jurisdiction: statusData.jurisdiction,
        
        // Safety & Instructions
        officer_safety_info: statusData.officer_safety_info,
        approach_instructions: statusData.approach_instructions,
        contact_info: statusData.contact_info
      };

      const updated = await boloApi.updateBOLO(bolo.id, formData);
      setBolo(updated);
      setEditData(updated);
      
      const statusMessage = newStatus === 'resolved' 
        ? `BOLO #${bolo.case_number} marked as RESOLVED` 
        : `BOLO #${bolo.case_number} has been CANCELLED`;
        
      setSnackbar({ 
        open: true, 
        message: statusMessage, 
        severity: 'success' 
      });
    } catch (error) {
      console.error('Error updating BOLO status:', error);
      setSnackbar({ 
        open: true, 
        message: `Failed to ${newStatus === 'resolved' ? 'resolve' : 'cancel'} BOLO`, 
        severity: 'error' 
      });
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
      {/* Vector Branding for Public View */}
      {isPublic && (
        <div style={{
          backgroundColor: '#0b0d10',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          padding: '16px 0'
        }}>
          <div className="detail-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <span style={{ 
                  fontSize: '28px', 
                  fontWeight: 'bold', 
                  color: '#2fa9ff' 
                }}>V</span>
                <span style={{ 
                  fontSize: '28px', 
                  fontWeight: 'bold', 
                  color: 'white' 
                }}>ECTOR</span>
                <span style={{
                  fontSize: '16px',
                  color: '#a9b0b6',
                  marginLeft: '12px',
                  fontWeight: '500'
                }}>INTELLIGENCE</span>
              </div>
              <div style={{
                backgroundColor: 'rgba(47,169,255,0.2)',
                color: '#2fa9ff',
                padding: '4px 12px',
                borderRadius: '16px',
                fontSize: '12px',
                fontWeight: '600',
                border: '1px solid #2fa9ff'
              }}>
                PUBLIC BOLO
              </div>
            </div>
            <div style={{ 
              color: '#a9b0b6', 
              fontSize: '14px' 
            }}>
              Cherokee Sheriff's Office
            </div>
          </div>
        </div>
      )}
      
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
            <div className="comments-section">
              <h3 className="comments-header">
                Comments ({isPublic ? bolo.comments?.filter(c => !c.is_internal).length || 0 : bolo.comment_count || 0})
              </h3>
              
              {!isPublic && (
                <>
                  <div className="comment-form">
                    <input
                      type="text"
                      className="comment-input"
                      placeholder="Add a comment... (use @username to mention)"
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
                </>
              )}

              <div className="comments-list">
                {(isPublic ? bolo.comments?.filter(c => !c.is_internal) : bolo.comments)?.map((comment) => (
                  <div key={comment.id} className="comment-item">
                    <div className="comment-avatar">
                      {comment.username?.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="comment-content">
                      <div className="comment-header">
                        <span className="comment-author">{comment.username}</span>
                        {!isPublic && comment.is_internal && <span className="internal-badge">Internal</span>}
                        <span className="comment-time">
                          {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <div className="comment-text">{formatCommentWithMentions(comment.content)}</div>
                    </div>
                  </div>
                ))}
                {((isPublic ? bolo.comments?.filter(c => !c.is_internal) : bolo.comments)?.length === 0) && (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'var(--detail-muted)' }}>
                    {isPublic ? 'No public comments yet' : 'No comments yet'}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            {!isPublic && canEdit && (
              <div className="quick-actions">
                <h3 className="quick-actions-title">Quick Actions</h3>
                <div className="action-list">
                  <button className="quick-action-btn" onClick={handleEdit}>
                    <EditIcon />
                    <span>Edit BOLO Details</span>
                  </button>
                  <button className="quick-action-btn" onClick={async () => {
                    await handleStatusUpdate('resolved');
                  }}>
                    <span>Mark as Resolved</span>
                  </button>
                  <button className="quick-action-btn" onClick={async () => {
                    await handleStatusUpdate('cancelled');
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
      <Dialog 
        open={editDialogOpen} 
        onClose={() => setEditDialogOpen(false)} 
        maxWidth="lg" 
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#16181b',
            color: 'white'
          }
        }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Edit BOLO</DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <div style={{ display: 'grid', gap: '20px' }}>
            {/* Basic Information */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <TextField
                label="Title"
                value={editData.title || ''}
                onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                fullWidth
                variant="outlined"
                InputProps={{ sx: { color: 'white' } }}
                InputLabelProps={{ sx: { color: '#a9b0b6' } }}
                sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
              />
              <FormControl fullWidth>
                <InputLabel sx={{ color: '#a9b0b6' }}>Type</InputLabel>
                <Select
                  value={editData.type || 'person'}
                  onChange={(e) => setEditData({ ...editData, type: e.target.value as BOLO['type'] })}
                  sx={{ color: 'white', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }}
                >
                  <MenuItem value="person">Person</MenuItem>
                  <MenuItem value="vehicle">Vehicle</MenuItem>
                  <MenuItem value="property">Property</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <FormControl fullWidth>
                <InputLabel sx={{ color: '#a9b0b6' }}>Status</InputLabel>
                <Select
                  value={editData.status || 'active'}
                  onChange={(e) => setEditData({ ...editData, status: e.target.value as BOLO['status'] })}
                  sx={{ color: 'white', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }}
                >
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="resolved">Resolved</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                  <MenuItem value="expired">Expired</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel sx={{ color: '#a9b0b6' }}>Priority</InputLabel>
                <Select
                  value={editData.priority || 'medium'}
                  onChange={(e) => setEditData({ ...editData, priority: e.target.value as BOLO['priority'] })}
                  sx={{ color: 'white', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }}
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="immediate">Immediate</MenuItem>
                </Select>
              </FormControl>
            </div>

            <TextField
              label="Summary"
              value={editData.summary || ''}
              onChange={(e) => setEditData({ ...editData, summary: e.target.value })}
              multiline
              rows={3}
              fullWidth
              InputProps={{ sx: { color: 'white' } }}
              InputLabelProps={{ sx: { color: '#a9b0b6' } }}
              sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
            />

            {/* Subject Information (show if type is person) */}
            {editData.type === 'person' && (
              <>
                <div style={{ fontSize: '14px', color: '#a9b0b6', marginTop: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>Subject Information</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <TextField
                    label="Subject Name"
                    value={editData.subject_name || ''}
                    onChange={(e) => setEditData({ ...editData, subject_name: e.target.value })}
                    fullWidth
                    InputProps={{ sx: { color: 'white' } }}
                    InputLabelProps={{ sx: { color: '#a9b0b6' } }}
                    sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
                  />
                  <TextField
                    label="Aliases"
                    value={Array.isArray(editData.subject_aliases) ? editData.subject_aliases.join(', ') : editData.subject_aliases || ''}
                    onChange={(e) => setEditData({ ...editData, subject_aliases: e.target.value.split(',').map(s => s.trim()) })}
                    fullWidth
                    InputProps={{ sx: { color: 'white' } }}
                    InputLabelProps={{ sx: { color: '#a9b0b6' } }}
                    sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px' }}>
                  <TextField
                    label="Date of Birth"
                    type="date"
                    value={editData.date_of_birth || ''}
                    onChange={(e) => setEditData({ ...editData, date_of_birth: e.target.value })}
                    fullWidth
                    InputLabelProps={{ shrink: true, sx: { color: '#a9b0b6' } }}
                    InputProps={{ sx: { color: 'white' } }}
                    sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
                  />
                  <TextField
                    label="Age Range"
                    value={editData.age_range || ''}
                    onChange={(e) => setEditData({ ...editData, age_range: e.target.value })}
                    fullWidth
                    InputProps={{ sx: { color: 'white' } }}
                    InputLabelProps={{ sx: { color: '#a9b0b6' } }}
                    sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
                  />
                  <TextField
                    label="Height"
                    value={editData.height || ''}
                    onChange={(e) => setEditData({ ...editData, height: e.target.value })}
                    fullWidth
                    InputProps={{ sx: { color: 'white' } }}
                    InputLabelProps={{ sx: { color: '#a9b0b6' } }}
                    sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
                  />
                  <TextField
                    label="Weight"
                    value={editData.weight || ''}
                    onChange={(e) => setEditData({ ...editData, weight: e.target.value })}
                    fullWidth
                    InputProps={{ sx: { color: 'white' } }}
                    InputLabelProps={{ sx: { color: '#a9b0b6' } }}
                    sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <TextField
                    label="Hair Color"
                    value={editData.hair_color || ''}
                    onChange={(e) => setEditData({ ...editData, hair_color: e.target.value })}
                    fullWidth
                    InputProps={{ sx: { color: 'white' } }}
                    InputLabelProps={{ sx: { color: '#a9b0b6' } }}
                    sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
                  />
                  <TextField
                    label="Eye Color"
                    value={editData.eye_color || ''}
                    onChange={(e) => setEditData({ ...editData, eye_color: e.target.value })}
                    fullWidth
                    InputProps={{ sx: { color: 'white' } }}
                    InputLabelProps={{ sx: { color: '#a9b0b6' } }}
                    sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
                  />
                </div>
                <TextField
                  label="Distinguishing Features"
                  value={editData.distinguishing_features || ''}
                  onChange={(e) => setEditData({ ...editData, distinguishing_features: e.target.value })}
                  multiline
                  rows={2}
                  fullWidth
                  InputProps={{ sx: { color: 'white' } }}
                  InputLabelProps={{ sx: { color: '#a9b0b6' } }}
                  sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
                />
                <TextField
                  label="Last Seen Wearing"
                  value={editData.last_seen_wearing || ''}
                  onChange={(e) => setEditData({ ...editData, last_seen_wearing: e.target.value })}
                  multiline
                  rows={2}
                  fullWidth
                  InputProps={{ sx: { color: 'white' } }}
                  InputLabelProps={{ sx: { color: '#a9b0b6' } }}
                  sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={editData.armed_dangerous || false}
                      onChange={(e) => setEditData({ ...editData, armed_dangerous: e.target.checked })}
                      sx={{ color: '#a9b0b6' }}
                    />
                  }
                  label="Armed & Dangerous"
                  sx={{ color: '#a9b0b6' }}
                />
                {editData.armed_dangerous && (
                  <TextField
                    label="Armed & Dangerous Details"
                    value={editData.armed_dangerous_details || ''}
                    onChange={(e) => setEditData({ ...editData, armed_dangerous_details: e.target.value })}
                    multiline
                    rows={2}
                    fullWidth
                    InputProps={{ sx: { color: 'white' } }}
                    InputLabelProps={{ sx: { color: '#a9b0b6' } }}
                    sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
                  />
                )}
              </>
            )}

            {/* Vehicle Information (show if type is vehicle) */}
            {editData.type === 'vehicle' && (
              <>
                <div style={{ fontSize: '14px', color: '#a9b0b6', marginTop: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>Vehicle Information</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <TextField
                    label="Make"
                    value={editData.vehicle_make || ''}
                    onChange={(e) => setEditData({ ...editData, vehicle_make: e.target.value })}
                    fullWidth
                    InputProps={{ sx: { color: 'white' } }}
                    InputLabelProps={{ sx: { color: '#a9b0b6' } }}
                    sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
                  />
                  <TextField
                    label="Model"
                    value={editData.vehicle_model || ''}
                    onChange={(e) => setEditData({ ...editData, vehicle_model: e.target.value })}
                    fullWidth
                    InputProps={{ sx: { color: 'white' } }}
                    InputLabelProps={{ sx: { color: '#a9b0b6' } }}
                    sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
                  />
                  <TextField
                    label="Year"
                    value={editData.vehicle_year || ''}
                    onChange={(e) => setEditData({ ...editData, vehicle_year: parseInt(e.target.value) || undefined })}
                    fullWidth
                    InputProps={{ sx: { color: 'white' } }}
                    InputLabelProps={{ sx: { color: '#a9b0b6' } }}
                    sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <TextField
                    label="Color"
                    value={editData.vehicle_color || ''}
                    onChange={(e) => setEditData({ ...editData, vehicle_color: e.target.value })}
                    fullWidth
                    InputProps={{ sx: { color: 'white' } }}
                    InputLabelProps={{ sx: { color: '#a9b0b6' } }}
                    sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
                  />
                  <TextField
                    label="License Plate"
                    value={editData.license_plate || ''}
                    onChange={(e) => setEditData({ ...editData, license_plate: e.target.value })}
                    fullWidth
                    InputProps={{ sx: { color: 'white' } }}
                    InputLabelProps={{ sx: { color: '#a9b0b6' } }}
                    sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
                  />
                </div>
                <TextField
                  label="VIN"
                  value={editData.vehicle_vin || ''}
                  onChange={(e) => setEditData({ ...editData, vehicle_vin: e.target.value })}
                  fullWidth
                  InputProps={{ sx: { color: 'white' } }}
                  InputLabelProps={{ sx: { color: '#a9b0b6' } }}
                  sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
                />
                <TextField
                  label="Vehicle Features"
                  value={editData.vehicle_features || ''}
                  onChange={(e) => setEditData({ ...editData, vehicle_features: e.target.value })}
                  multiline
                  rows={2}
                  fullWidth
                  InputProps={{ sx: { color: 'white' } }}
                  InputLabelProps={{ sx: { color: '#a9b0b6' } }}
                  sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
                />
                <TextField
                  label="Direction of Travel"
                  value={editData.direction_of_travel || ''}
                  onChange={(e) => setEditData({ ...editData, direction_of_travel: e.target.value })}
                  fullWidth
                  InputProps={{ sx: { color: 'white' } }}
                  InputLabelProps={{ sx: { color: '#a9b0b6' } }}
                  sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
                />
              </>
            )}

            {/* Incident Information */}
            <div style={{ fontSize: '14px', color: '#a9b0b6', marginTop: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>Incident Information</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <TextField
                label="Incident Date"
                type="datetime-local"
                value={editData.incident_date ? editData.incident_date.slice(0, 16) : ''}
                onChange={(e) => setEditData({ ...editData, incident_date: e.target.value })}
                fullWidth
                InputLabelProps={{ shrink: true, sx: { color: '#a9b0b6' } }}
                InputProps={{ sx: { color: 'white' } }}
                sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
              />
              <TextField
                label="Jurisdiction"
                value={editData.jurisdiction || ''}
                onChange={(e) => setEditData({ ...editData, jurisdiction: e.target.value })}
                fullWidth
                InputProps={{ sx: { color: 'white' } }}
                InputLabelProps={{ sx: { color: '#a9b0b6' } }}
                sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
              />
            </div>
            <TextField
              label="Incident Location"
              value={editData.incident_location || ''}
              onChange={(e) => setEditData({ ...editData, incident_location: e.target.value })}
              fullWidth
              InputProps={{ sx: { color: 'white' } }}
              InputLabelProps={{ sx: { color: '#a9b0b6' } }}
              sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
            />
            <TextField
              label="Last Known Location"
              value={editData.last_known_location || ''}
              onChange={(e) => setEditData({ ...editData, last_known_location: e.target.value })}
              fullWidth
              InputProps={{ sx: { color: 'white' } }}
              InputLabelProps={{ sx: { color: '#a9b0b6' } }}
              sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
            />

            {/* Narrative and Safety Information */}
            <TextField
              label="Narrative"
              value={editData.narrative || ''}
              onChange={(e) => setEditData({ ...editData, narrative: e.target.value })}
              multiline
              rows={4}
              fullWidth
              InputProps={{ sx: { color: 'white' } }}
              InputLabelProps={{ sx: { color: '#a9b0b6' } }}
              sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
            />
            <TextField
              label="Officer Safety Info"
              value={editData.officer_safety_info || ''}
              onChange={(e) => setEditData({ ...editData, officer_safety_info: e.target.value })}
              multiline
              rows={3}
              fullWidth
              InputProps={{ sx: { color: 'white' } }}
              InputLabelProps={{ sx: { color: '#a9b0b6' } }}
              sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
            />
            <TextField
              label="Approach Instructions"
              value={editData.approach_instructions || ''}
              onChange={(e) => setEditData({ ...editData, approach_instructions: e.target.value })}
              multiline
              rows={3}
              fullWidth
              InputProps={{ sx: { color: 'white' } }}
              InputLabelProps={{ sx: { color: '#a9b0b6' } }}
              sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
            />
            <TextField
              label="Contact Information"
              value={editData.contact_info || ''}
              onChange={(e) => setEditData({ ...editData, contact_info: e.target.value })}
              fullWidth
              InputProps={{ sx: { color: 'white' } }}
              InputLabelProps={{ sx: { color: '#a9b0b6' } }}
              sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } }}
            />
          </div>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', p: 2 }}>
          <Button onClick={() => setEditDialogOpen(false)} sx={{ color: '#a9b0b6' }}>Cancel</Button>
          <Button onClick={handleUpdate} variant="contained" sx={{ backgroundColor: '#2fa9ff', '&:hover': { backgroundColor: '#2090e0' } }}>Save Changes</Button>
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