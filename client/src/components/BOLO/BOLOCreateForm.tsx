import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  FormControlLabel,
  Checkbox,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  IconButton,
  Chip,
  Alert,
  Card,
  CardMedia,
  CardActions,
  LinearProgress
} from '@mui/material';
import Grid from '@mui/material/Grid';
import {
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  ArrowBack as BackIcon,
  Send as SendIcon,
  Person as PersonIcon,
  DirectionsCar as VehicleIcon,
  HomeWork as PropertyIcon,
  Category as OtherIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { BOLOFormData } from '../../types/bolo';
import boloApi from '../../services/boloApi';
import { useAuth } from '../../contexts/AuthContext';

const BOLOCreateForm: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  
  const [formData, setFormData] = useState<BOLOFormData>({
    type: 'person',
    priority: 'medium',
    title: '',
    summary: '',
    is_public: false
  });

  const steps = [
    'Basic Information',
    'Subject/Vehicle Details',
    'Incident Information',
    'Officer Safety',
    'Media & Review'
  ];

  const handleChange = (field: keyof BOLOFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | any
  ) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (files.length + selectedFiles.length > 10) {
      setError('Maximum 10 files allowed');
      return;
    }

    const newFiles = [...files, ...selectedFiles];
    setFiles(newFiles);

    // Create preview URLs for images
    const newPreviewUrls = newFiles.map(file => {
      if (file.type.startsWith('image/')) {
        return URL.createObjectURL(file);
      }
      return '';
    });
    setPreviewUrls(newPreviewUrls);
  };

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    const newPreviewUrls = previewUrls.filter((_, i) => i !== index);
    
    // Clean up object URLs
    if (previewUrls[index]) {
      URL.revokeObjectURL(previewUrls[index]);
    }
    
    setFiles(newFiles);
    setPreviewUrls(newPreviewUrls);
  };

  const handleNext = () => {
    setActiveStep(prev => prev + 1);
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      const bolo = await boloApi.createBOLO(formData, files);
      
      // Clean up preview URLs
      previewUrls.forEach(url => {
        if (url) URL.revokeObjectURL(url);
      });

      navigate(`/bolo/${bolo.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create BOLO');
      setLoading(false);
    }
  };

  const renderBasicInfo = () => (
    <Box>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <FormControl fullWidth required>
            <InputLabel>BOLO Type</InputLabel>
            <Select
              value={formData.type}
              label="BOLO Type"
              onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
            >
              <MenuItem value="person">
                <Box display="flex" alignItems="center">
                  <PersonIcon sx={{ mr: 1 }} /> Person
                </Box>
              </MenuItem>
              <MenuItem value="vehicle">
                <Box display="flex" alignItems="center">
                  <VehicleIcon sx={{ mr: 1 }} /> Vehicle
                </Box>
              </MenuItem>
              <MenuItem value="property">
                <Box display="flex" alignItems="center">
                  <PropertyIcon sx={{ mr: 1 }} /> Property
                </Box>
              </MenuItem>
              <MenuItem value="other">
                <Box display="flex" alignItems="center">
                  <OtherIcon sx={{ mr: 1 }} /> Other
                </Box>
              </MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <FormControl fullWidth required>
            <InputLabel>Priority</InputLabel>
            <Select
              value={formData.priority}
              label="Priority"
              onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as any }))}
            >
              <MenuItem value="immediate">
                <Chip label="Immediate" color="error" size="small" />
              </MenuItem>
              <MenuItem value="high">
                <Chip label="High" color="warning" size="small" />
              </MenuItem>
              <MenuItem value="medium">
                <Chip label="Medium" color="info" size="small" />
              </MenuItem>
              <MenuItem value="low">
                <Chip label="Low" size="small" />
              </MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid size={12}>
          <TextField
            fullWidth
            required
            label="Title"
            placeholder="Brief, descriptive title for this BOLO"
            value={formData.title}
            onChange={handleChange('title')}
          />
        </Grid>

        <Grid size={12}>
          <TextField
            fullWidth
            required
            multiline
            rows={3}
            label="Summary"
            placeholder="Concise summary of what officers should be looking for"
            value={formData.summary}
            onChange={handleChange('summary')}
          />
        </Grid>

        <Grid size={12}>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Detailed Narrative"
            placeholder="Full details of the incident, circumstances, and relevant background"
            value={formData.narrative}
            onChange={handleChange('narrative')}
          />
        </Grid>
      </Grid>
    </Box>
  );

  const renderSubjectDetails = () => (
    <Box>
      {formData.type === 'person' && (
        <Grid container spacing={2}>
          <Grid size={12}>
            <Typography variant="h6" gutterBottom>
              Subject Information
            </Typography>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="Subject Name"
              value={formData.subject_name}
              onChange={handleChange('subject_name')}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="Aliases"
              placeholder="Known aliases, nicknames"
              value={formData.subject_aliases}
              onChange={handleChange('subject_aliases')}
            />
          </Grid>

          <Grid size={12}>
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Physical Description"
              placeholder="Detailed physical description"
              value={formData.subject_description}
              onChange={handleChange('subject_description')}
            />
          </Grid>

          <Grid size={{ xs: 6, md: 3 }}>
            <TextField
              fullWidth
              label="Date of Birth"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={formData.date_of_birth}
              onChange={handleChange('date_of_birth')}
            />
          </Grid>

          <Grid size={{ xs: 6, md: 3 }}>
            <TextField
              fullWidth
              label="Age Range"
              placeholder="e.g., 25-30"
              value={formData.age_range}
              onChange={handleChange('age_range')}
            />
          </Grid>

          <Grid size={{ xs: 6, md: 3 }}>
            <TextField
              fullWidth
              label="Height"
              placeholder={'e.g., 5\'10"'}
              value={formData.height}
              onChange={handleChange('height')}
            />
          </Grid>

          <Grid size={{ xs: 6, md: 3 }}>
            <TextField
              fullWidth
              label="Weight"
              placeholder="e.g., 180 lbs"
              value={formData.weight}
              onChange={handleChange('weight')}
            />
          </Grid>

          <Grid size={{ xs: 6, md: 3 }}>
            <TextField
              fullWidth
              label="Hair Color"
              value={formData.hair_color}
              onChange={handleChange('hair_color')}
            />
          </Grid>

          <Grid size={{ xs: 6, md: 3 }}>
            <TextField
              fullWidth
              label="Eye Color"
              value={formData.eye_color}
              onChange={handleChange('eye_color')}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="Distinguishing Features"
              placeholder="Tattoos, scars, etc."
              value={formData.distinguishing_features}
              onChange={handleChange('distinguishing_features')}
            />
          </Grid>

          <Grid size={12}>
            <TextField
              fullWidth
              label="Last Seen Wearing"
              placeholder="Clothing description"
              value={formData.last_seen_wearing}
              onChange={handleChange('last_seen_wearing')}
            />
          </Grid>
        </Grid>
      )}

      {formData.type === 'vehicle' && (
        <Grid container spacing={2}>
          <Grid size={12}>
            <Typography variant="h6" gutterBottom>
              Vehicle Information
            </Typography>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="Make"
              value={formData.vehicle_make}
              onChange={handleChange('vehicle_make')}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="Model"
              value={formData.vehicle_model}
              onChange={handleChange('vehicle_model')}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="Year"
              value={formData.vehicle_year}
              onChange={handleChange('vehicle_year')}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="Color"
              value={formData.vehicle_color}
              onChange={handleChange('vehicle_color')}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="License Plate"
              value={formData.license_plate}
              onChange={handleChange('license_plate')}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="VIN"
              value={formData.vehicle_vin}
              onChange={handleChange('vehicle_vin')}
            />
          </Grid>

          <Grid size={12}>
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Vehicle Features"
              placeholder="Damage, modifications, stickers, etc."
              value={formData.vehicle_features}
              onChange={handleChange('vehicle_features')}
            />
          </Grid>

          <Grid size={12}>
            <TextField
              fullWidth
              label="Direction of Travel"
              placeholder="Last known direction"
              value={formData.direction_of_travel}
              onChange={handleChange('direction_of_travel')}
            />
          </Grid>
        </Grid>
      )}

      {formData.type === 'property' && (
        <Grid container spacing={2}>
          <Grid size={12}>
            <Typography variant="h6" gutterBottom>
              Property Details
            </Typography>
          </Grid>
          <Grid size={12}>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Property Description"
              placeholder="Detailed description of the property"
              value={formData.narrative}
              onChange={handleChange('narrative')}
            />
          </Grid>
        </Grid>
      )}
    </Box>
  );

  const renderIncidentInfo = () => (
    <Box>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            fullWidth
            label="Incident Date/Time"
            type="datetime-local"
            InputLabelProps={{ shrink: true }}
            value={formData.incident_date}
            onChange={handleChange('incident_date')}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            fullWidth
            label="Jurisdiction"
            value={formData.jurisdiction}
            onChange={handleChange('jurisdiction')}
          />
        </Grid>

        <Grid size={12}>
          <TextField
            fullWidth
            label="Incident Location"
            placeholder="Address or area where incident occurred"
            value={formData.incident_location}
            onChange={handleChange('incident_location')}
          />
        </Grid>

        <Grid size={12}>
          <TextField
            fullWidth
            label="Last Known Location"
            placeholder="Most recent sighting or known location"
            value={formData.last_known_location}
            onChange={handleChange('last_known_location')}
          />
        </Grid>

        <Grid size={12}>
          <TextField
            fullWidth
            label="Contact Information"
            placeholder="Phone, email, or radio for officers to report sightings"
            value={formData.contact_info}
            onChange={handleChange('contact_info')}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            fullWidth
            label="Expires At"
            type="datetime-local"
            InputLabelProps={{ shrink: true }}
            value={formData.expires_at}
            onChange={handleChange('expires_at')}
            helperText="When should this BOLO automatically expire?"
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={formData.is_public}
                onChange={handleChange('is_public')}
              />
            }
            label="Make publicly shareable"
          />
        </Grid>
      </Grid>
    </Box>
  );

  const renderOfficerSafety = () => (
    <Box>
      <Alert severity="warning" sx={{ mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Officer Safety Information
        </Typography>
        Include any information that could affect officer safety when approaching or apprehending.
      </Alert>

      <Grid container spacing={2}>
        <Grid size={12}>
          <FormControlLabel
            control={
              <Checkbox
                checked={formData.armed_dangerous}
                onChange={handleChange('armed_dangerous')}
                color="error"
              />
            }
            label={
              <Box display="flex" alignItems="center">
                <WarningIcon color="error" sx={{ mr: 1 }} />
                <Typography color="error">Subject is Armed & Dangerous</Typography>
              </Box>
            }
          />
        </Grid>

        {formData.armed_dangerous && (
          <Grid size={12}>
            <TextField
              fullWidth
              required
              multiline
              rows={2}
              label="Armed & Dangerous Details"
              placeholder="Weapon type, threats made, etc."
              value={formData.armed_dangerous_details}
              onChange={handleChange('armed_dangerous_details')}
              error={!formData.armed_dangerous_details}
              helperText={!formData.armed_dangerous_details ? 'Required when Armed & Dangerous is checked' : ''}
            />
          </Grid>
        )}

        <Grid size={12}>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Officer Safety Information"
            placeholder="Any additional safety concerns or cautions"
            value={formData.officer_safety_info}
            onChange={handleChange('officer_safety_info')}
          />
        </Grid>

        <Grid size={12}>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Approach Instructions"
            placeholder="Recommended approach tactics or special instructions"
            value={formData.approach_instructions}
            onChange={handleChange('approach_instructions')}
          />
        </Grid>
      </Grid>
    </Box>
  );

  const renderMediaReview = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Media Upload
      </Typography>
      
      <Box
        sx={{
          border: '2px dashed',
          borderColor: 'divider',
          borderRadius: 1,
          p: 2,
          mb: 2,
          textAlign: 'center'
        }}
      >
        <input
          accept="image/*,video/*,.pdf,.doc,.docx"
          style={{ display: 'none' }}
          id="file-upload"
          multiple
          type="file"
          onChange={handleFileSelect}
        />
        <label htmlFor="file-upload">
          <Button
            variant="outlined"
            component="span"
            startIcon={<UploadIcon />}
          >
            Upload Files (Max 10)
          </Button>
        </label>
        <Typography variant="caption" display="block" sx={{ mt: 1 }}>
          Supported: Images, Videos, PDFs, Documents (Max 50MB each)
        </Typography>
      </Box>

      {files.length > 0 && (
        <Grid container spacing={1}>
          {files.map((file, index) => (
            <Grid size={{ xs: 6, md: 3 }} key={index}>
              <Card>
                {file.type.startsWith('image/') && previewUrls[index] ? (
                  <CardMedia
                    component="img"
                    height="100"
                    image={previewUrls[index]}
                    alt={file.name}
                  />
                ) : (
                  <Box sx={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'grey.100' }}>
                    <Typography variant="caption">{file.name}</Typography>
                  </Box>
                )}
                <CardActions>
                  <IconButton size="small" onClick={() => removeFile(index)}>
                    <DeleteIcon />
                  </IconButton>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Box mt={3}>
        <Typography variant="h6" gutterBottom>
          Review Information
        </Typography>
        <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
          <Typography variant="subtitle2" gutterBottom>
            <strong>Type:</strong> {formData.type}
          </Typography>
          <Typography variant="subtitle2" gutterBottom>
            <strong>Priority:</strong> {formData.priority}
          </Typography>
          <Typography variant="subtitle2" gutterBottom>
            <strong>Title:</strong> {formData.title}
          </Typography>
          <Typography variant="subtitle2" gutterBottom>
            <strong>Summary:</strong> {formData.summary}
          </Typography>
          {formData.armed_dangerous && (
            <Alert severity="error" sx={{ mt: 1 }}>
              Armed & Dangerous
            </Alert>
          )}
        </Paper>
      </Box>
    </Box>
  );

  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        return renderBasicInfo();
      case 1:
        return renderSubjectDetails();
      case 2:
        return renderIncidentInfo();
      case 3:
        return renderOfficerSafety();
      case 4:
        return renderMediaReview();
      default:
        return null;
    }
  };

  const isStepValid = () => {
    switch (activeStep) {
      case 0:
        return formData.title && formData.summary;
      case 3:
        return !formData.armed_dangerous || formData.armed_dangerous_details;
      default:
        return true;
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 3, mb: 5 }}>
      <Paper sx={{ p: 3 }}>
        <Box display="flex" alignItems="center" mb={3}>
          <IconButton onClick={() => navigate('/bolo')} sx={{ mr: 2 }}>
            <BackIcon />
          </IconButton>
          <Typography variant="h4" component="h1">
            Create BOLO
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Stepper activeStep={activeStep} orientation="vertical">
          {steps.map((label, index) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
              <StepContent>
                <Box sx={{ mb: 2 }}>
                  {getStepContent(index)}
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Button
                    variant="contained"
                    onClick={index === steps.length - 1 ? handleSubmit : handleNext}
                    disabled={!isStepValid() || (index === steps.length - 1 && loading)}
                    sx={{ mt: 1, mr: 1 }}
                    startIcon={index === steps.length - 1 ? <SendIcon /> : null}
                  >
                    {index === steps.length - 1 ? 'Create BOLO' : 'Continue'}
                  </Button>
                  <Button
                    disabled={index === 0}
                    onClick={handleBack}
                    sx={{ mt: 1, mr: 1 }}
                  >
                    Back
                  </Button>
                </Box>
              </StepContent>
            </Step>
          ))}
        </Stepper>

        {loading && <LinearProgress />}
      </Paper>
    </Container>
  );
};

export default BOLOCreateForm;