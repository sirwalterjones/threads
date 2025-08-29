import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  IconButton,
  Button,
  Avatar,
  Chip,
  Divider,
  TextField,
  Alert,
  Card,
  CardMedia,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Share as ShareIcon,
  Loop as RepostIcon,
  BookmarkBorder as SaveIcon,
  Bookmark as SavedIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon,
  Person as PersonIcon,
  DirectionsCar as VehicleIcon,
  HomeWork as PropertyIcon,
  LocationOn as LocationIcon,
  Phone as PhoneIcon,
  CalendarToday as CalendarIcon,
  AccessTime as TimeIcon,
  CheckCircle as ResolvedIcon,
  Cancel as CancelledIcon,
  Schedule as PendingIcon,
  Send as SendIcon
} from '@mui/icons-material';
import Grid from '@mui/material/Grid';
import { BOLO, BOLOComment } from '../../types/bolo';
import boloApi from '../../services/boloApi';
import { useAuth } from '../../contexts/AuthContext';
import { format, formatDistanceToNow } from 'date-fns';

interface BOLODetailProps {
  isPublic?: boolean;
}

const BOLODetail: React.FC<BOLODetailProps> = ({ isPublic = false }) => {
  const { id, token } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [bolo, setBolo] = useState<BOLO | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<BOLO['status']>('active');
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareLink, setShareLink] = useState('');

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
      if (data.public_share_token) {
        setShareLink(boloApi.getShareableLink(data));
      }
    } catch (error) {
      console.error('Error loading BOLO:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRepost = async () => {
    if (!bolo) return;
    try {
      await boloApi.repostBOLO(bolo.id);
      loadBOLO();
    } catch (error) {
      console.error('Error reposting:', error);
    }
  };

  const handleSave = async () => {
    if (!bolo) return;
    try {
      await boloApi.toggleSaveBOLO(bolo.id);
      loadBOLO();
    } catch (error) {
      console.error('Error saving:', error);
    }
  };

  const handleShare = () => {
    if (!bolo) return;
    setShareDialogOpen(true);
  };

  const handleCopyLink = async () => {
    if (!bolo) return;
    await boloApi.copyShareableLink(bolo);
    // Show success message
  };

  const handleAddComment = async () => {
    if (!bolo || !commentText.trim()) return;
    try {
      await boloApi.addComment(bolo.id, commentText, isInternal);
      setCommentText('');
      setIsInternal(false);
      loadBOLO();
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const handleStatusChange = async () => {
    if (!bolo) return;
    try {
      await boloApi.updateBOLOStatus(bolo.id, newStatus);
      setStatusDialogOpen(false);
      loadBOLO();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const getStatusIcon = (status: BOLO['status']) => {
    switch (status) {
      case 'pending': return <PendingIcon color="action" />;
      case 'active': return <TimeIcon color="primary" />;
      case 'resolved': return <ResolvedIcon color="success" />;
      case 'cancelled': return <CancelledIcon color="error" />;
      default: return null;
    }
  };

  const getTypeIcon = (type: BOLO['type']) => {
    switch (type) {
      case 'person': return <PersonIcon />;
      case 'vehicle': return <VehicleIcon />;
      case 'property': return <PropertyIcon />;
      default: return null;
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 3, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (!bolo) {
    return (
      <Container maxWidth="lg" sx={{ mt: 3 }}>
        <Alert severity="error">BOLO not found</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 3, mb: 5 }}>
      <Grid container spacing={3}>
        {/* Header */}
        <Grid size={{ xs: 12 }}>
          <Paper sx={{ p: 2 }}>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box display="flex" alignItems="center">
                {!isPublic && (
                  <IconButton onClick={() => navigate('/bolo')} sx={{ mr: 2 }}>
                    <BackIcon />
                  </IconButton>
                )}
                <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                  {getTypeIcon(bolo.type)}
                </Avatar>
                <Box>
                  <Typography variant="h5">{bolo.title}</Typography>
                  <Typography variant="caption" color="textSecondary">
                    Case #{bolo.case_number} • {bolo.agency_name}
                  </Typography>
                </Box>
              </Box>
              <Box display="flex" alignItems="center" gap={1}>
                {getStatusIcon(bolo.status)}
                <Chip 
                  label={bolo.status.toUpperCase()} 
                  color={bolo.status === 'active' ? 'primary' : 'default'}
                />
                <Chip 
                  label={bolo.priority.toUpperCase()} 
                  color={bolo.priority === 'immediate' ? 'error' : bolo.priority === 'high' ? 'warning' : 'default'}
                />
                {canEdit && (
                  <IconButton onClick={() => setStatusDialogOpen(true)}>
                    <EditIcon />
                  </IconButton>
                )}
              </Box>
            </Box>
          </Paper>
        </Grid>

        {/* Main Content */}
        <Grid size={{ xs: 12, md: 8 }}>
          {/* Armed & Dangerous Alert */}
          {bolo.armed_dangerous && (
            <Alert severity="error" sx={{ mb: 2 }} icon={<WarningIcon />}>
              <Typography variant="subtitle1" fontWeight="bold">
                ARMED & DANGEROUS
              </Typography>
              {bolo.armed_dangerous_details && (
                <Typography variant="body2">
                  {bolo.armed_dangerous_details}
                </Typography>
              )}
            </Alert>
          )}

          {/* Media */}
          {bolo.media && bolo.media.length > 0 && (
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="h6" gutterBottom>Media</Typography>
              <Grid container spacing={1}>
                {bolo.media.map((media) => (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={media.id}>
                    <Card>
                      {media.type === 'image' && (
                        <CardMedia
                          component="img"
                          height="200"
                          image={media.url}
                          alt={media.caption || 'BOLO Media'}
                        />
                      )}
                      {media.caption && (
                        <CardContent>
                          <Typography variant="caption">{media.caption}</Typography>
                        </CardContent>
                      )}
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          )}

          {/* Summary & Narrative */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" gutterBottom>Summary</Typography>
            <Typography variant="body1" paragraph>{bolo.summary}</Typography>
            
            {bolo.narrative && (
              <>
                <Typography variant="h6" gutterBottom>Narrative</Typography>
                <Typography variant="body2" style={{ whiteSpace: 'pre-wrap' }}>
                  {bolo.narrative}
                </Typography>
              </>
            )}
          </Paper>

          {/* Subject/Vehicle Details */}
          {bolo.type === 'person' && (
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="h6" gutterBottom>Subject Information</Typography>
              <Grid container spacing={2}>
                {bolo.subject_name && (
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="body2"><strong>Name:</strong> {bolo.subject_name}</Typography>
                  </Grid>
                )}
                {bolo.date_of_birth && (
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="body2"><strong>DOB:</strong> {format(new Date(bolo.date_of_birth), 'MM/dd/yyyy')}</Typography>
                  </Grid>
                )}
                {bolo.height && (
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="body2"><strong>Height:</strong> {bolo.height}</Typography>
                  </Grid>
                )}
                {bolo.weight && (
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="body2"><strong>Weight:</strong> {bolo.weight}</Typography>
                  </Grid>
                )}
                {bolo.hair_color && (
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="body2"><strong>Hair:</strong> {bolo.hair_color}</Typography>
                  </Grid>
                )}
                {bolo.eye_color && (
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="body2"><strong>Eyes:</strong> {bolo.eye_color}</Typography>
                  </Grid>
                )}
                {bolo.distinguishing_features && (
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="body2"><strong>Distinguishing Features:</strong> {bolo.distinguishing_features}</Typography>
                  </Grid>
                )}
                {bolo.last_seen_wearing && (
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="body2"><strong>Last Seen Wearing:</strong> {bolo.last_seen_wearing}</Typography>
                  </Grid>
                )}
              </Grid>
            </Paper>
          )}

          {bolo.type === 'vehicle' && (
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="h6" gutterBottom>Vehicle Information</Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                  <Typography variant="body1">
                    <strong>
                      {bolo.vehicle_year} {bolo.vehicle_make} {bolo.vehicle_model}
                    </strong>
                  </Typography>
                </Grid>
                {bolo.vehicle_color && (
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="body2"><strong>Color:</strong> {bolo.vehicle_color}</Typography>
                  </Grid>
                )}
                {bolo.license_plate && (
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="body2"><strong>License Plate:</strong> {bolo.license_plate}</Typography>
                  </Grid>
                )}
                {bolo.vehicle_vin && (
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="body2"><strong>VIN:</strong> {bolo.vehicle_vin}</Typography>
                  </Grid>
                )}
                {bolo.vehicle_features && (
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="body2"><strong>Features:</strong> {bolo.vehicle_features}</Typography>
                  </Grid>
                )}
                {bolo.direction_of_travel && (
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="body2"><strong>Direction of Travel:</strong> {bolo.direction_of_travel}</Typography>
                  </Grid>
                )}
              </Grid>
            </Paper>
          )}

          {/* Officer Safety */}
          {(bolo.officer_safety_info || bolo.approach_instructions) && (
            <Paper sx={{ p: 2, mb: 2, bgcolor: 'warning.light' }}>
              <Typography variant="h6" gutterBottom>Officer Safety</Typography>
              {bolo.officer_safety_info && (
                <Typography variant="body2" paragraph>{bolo.officer_safety_info}</Typography>
              )}
              {bolo.approach_instructions && (
                <>
                  <Typography variant="subtitle2">Approach Instructions:</Typography>
                  <Typography variant="body2">{bolo.approach_instructions}</Typography>
                </>
              )}
            </Paper>
          )}

          {/* Comments Section */}
          {!isPublic && (
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom id="comments">
                Comments ({bolo.comment_count})
              </Typography>
              
              {/* Comment Input */}
              <Box mb={2}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  placeholder="Add a comment..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  sx={{ mb: 1 }}
                />
                <Box display="flex" justifyContent="space-between">
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={isInternal}
                        onChange={(e) => setIsInternal(e.target.checked)}
                      />
                    }
                    label="Internal comment (law enforcement only)"
                  />
                  <Button
                    variant="contained"
                    endIcon={<SendIcon />}
                    onClick={handleAddComment}
                    disabled={!commentText.trim()}
                  >
                    Comment
                  </Button>
                </Box>
              </Box>

              {/* Comments List */}
              <List>
                {bolo.comments?.map((comment) => (
                  <ListItem key={comment.id} alignItems="flex-start">
                    <ListItemAvatar>
                      <Avatar>{comment.username[0]}</Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center">
                          <Typography variant="subtitle2">{comment.username}</Typography>
                          {comment.agency_name && (
                            <Typography variant="caption" color="textSecondary" sx={{ ml: 1 }}>
                              • {comment.agency_name}
                            </Typography>
                          )}
                          {comment.is_internal && (
                            <Chip label="Internal" size="small" sx={{ ml: 1 }} />
                          )}
                        </Box>
                      }
                      secondary={
                        <>
                          <Typography variant="body2">{comment.content}</Typography>
                          <Typography variant="caption" color="textSecondary">
                            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                          </Typography>
                        </>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          )}
        </Grid>

        {/* Sidebar */}
        <Grid size={{ xs: 12, md: 4 }}>
          {/* Action Buttons */}
          {!isPublic && (
            <Paper sx={{ p: 2, mb: 2 }}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={bolo.is_saved ? <SavedIcon /> : <SaveIcon />}
                onClick={handleSave}
                sx={{ mb: 1 }}
                color={bolo.is_saved ? 'primary' : 'inherit'}
              >
                {bolo.is_saved ? 'Saved' : 'Save'}
              </Button>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<RepostIcon />}
                onClick={handleRepost}
                sx={{ mb: 1 }}
                color={bolo.is_reposted ? 'primary' : 'inherit'}
              >
                Repost ({bolo.repost_count})
              </Button>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<ShareIcon />}
                onClick={handleShare}
              >
                Share
              </Button>
            </Paper>
          )}

          {/* Incident Details */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" gutterBottom>Incident Details</Typography>
            
            {bolo.incident_date && (
              <Box display="flex" alignItems="center" mb={1}>
                <CalendarIcon fontSize="small" sx={{ mr: 1 }} />
                <Typography variant="body2">
                  {format(new Date(bolo.incident_date), 'PPpp')}
                </Typography>
              </Box>
            )}
            
            {bolo.incident_location && (
              <Box display="flex" alignItems="flex-start" mb={1}>
                <LocationIcon fontSize="small" sx={{ mr: 1 }} />
                <Typography variant="body2">{bolo.incident_location}</Typography>
              </Box>
            )}
            
            {bolo.last_known_location && (
              <Box display="flex" alignItems="flex-start" mb={1}>
                <LocationIcon fontSize="small" sx={{ mr: 1 }} />
                <Typography variant="body2">
                  <strong>Last Known:</strong> {bolo.last_known_location}
                </Typography>
              </Box>
            )}
            
            {bolo.jurisdiction && (
              <Typography variant="body2" gutterBottom>
                <strong>Jurisdiction:</strong> {bolo.jurisdiction}
              </Typography>
            )}
          </Paper>

          {/* Contact Information */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" gutterBottom>Contact Information</Typography>
            <Typography variant="body2" gutterBottom>
              <strong>Officer:</strong> {bolo.officer_name}
              {bolo.officer_badge && ` (Badge #${bolo.officer_badge})`}
            </Typography>
            <Typography variant="body2" gutterBottom>
              <strong>Agency:</strong> {bolo.agency_name}
            </Typography>
            {bolo.contact_info && (
              <Box display="flex" alignItems="center" mt={1}>
                <PhoneIcon fontSize="small" sx={{ mr: 1 }} />
                <Typography variant="body2">{bolo.contact_info}</Typography>
              </Box>
            )}
          </Paper>

          {/* Metadata */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Details</Typography>
            <Typography variant="body2" gutterBottom>
              <strong>Created:</strong> {format(new Date(bolo.created_at), 'PPp')}
            </Typography>
            {bolo.expires_at && (
              <Typography variant="body2" gutterBottom>
                <strong>Expires:</strong> {format(new Date(bolo.expires_at), 'PPp')}
              </Typography>
            )}
            <Typography variant="body2" gutterBottom>
              <strong>Views:</strong> {bolo.view_count}
            </Typography>
            <Typography variant="body2">
              <strong>Public:</strong> {bolo.is_public ? 'Yes' : 'No'}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Status Change Dialog */}
      <Dialog open={statusDialogOpen} onClose={() => setStatusDialogOpen(false)}>
        <DialogTitle>Update BOLO Status</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>New Status</InputLabel>
            <Select
              value={newStatus}
              label="New Status"
              onChange={(e) => setNewStatus(e.target.value as BOLO['status'])}
            >
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="resolved">Resolved</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
              <MenuItem value="expired">Expired</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleStatusChange} variant="contained">Update</Button>
        </DialogActions>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onClose={() => setShareDialogOpen(false)}>
        <DialogTitle>Share BOLO</DialogTitle>
        <DialogContent>
          {bolo.is_public ? (
            <>
              <Typography variant="body2" gutterBottom>
                Share this link to allow public viewing:
              </Typography>
              <TextField
                fullWidth
                value={shareLink}
                InputProps={{
                  readOnly: true,
                }}
                sx={{ mt: 2 }}
              />
            </>
          ) : (
            <Alert severity="info">
              This BOLO is not public. Only authenticated users can view it.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareDialogOpen(false)}>Close</Button>
          {bolo.is_public && (
            <Button onClick={handleCopyLink} variant="contained">Copy Link</Button>
          )}
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default BOLODetail;