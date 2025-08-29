import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  LinearProgress,
  CircularProgress
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
import { BOLOFormData, BOLO } from '../../types/bolo';
import boloApi from '../../services/boloApi';
import { useAuth } from '../../contexts/AuthContext';
import './BOLOCreateForm.css';

const BOLOEditForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingBOLO, setLoadingBOLO] = useState(true);
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

  const [originalBOLO, setOriginalBOLO] = useState<BOLO | null>(null);

  // Dark theme form field styles
  const darkFormFieldSx = {
    '& .MuiInputLabel-root': { 
      color: '#a9b0b6',
      '&.Mui-focused': { color: '#2fa9ff' }
    },
    '& .MuiOutlinedInput-root': { 
      color: '#ffffff',
      backgroundColor: '#1f2226',
      '& fieldset': { 
        borderColor: 'rgba(255, 255, 255, 0.2)' 
      },
      '&:hover fieldset': { 
        borderColor: 'rgba(255, 255, 255, 0.3)' 
      },
      '&.Mui-focused fieldset': { 
        borderColor: '#2fa9ff' 
      }
    },
    '& .MuiSelect-icon': { 
      color: '#a9b0b6' 
    }
  };

  const darkTypographySx = {
    color: '#ffffff',
    '&.MuiTypography-h6': {
      fontWeight: 600,
      mb: 2
    }
  };

  const steps = [
    'Basic Information',
    'Subject/Vehicle Details',
    'Incident Information',
    'Officer Safety',
    'Media & Review'
  ];

  useEffect(() => {
    if (id) {
      loadBOLO();
    }
  }, [id]);

  const loadBOLO = async () => {
    try {
      setLoadingBOLO(true);
      const bolo = await boloApi.getBOLOById(parseInt(id!));
      setOriginalBOLO(bolo);
      
      // Convert BOLO to form data
      const boloFormData: BOLOFormData = {
        type: bolo.type,
        priority: bolo.priority,
        title: bolo.title,
        summary: bolo.summary,
        narrative: bolo.narrative,
        subject_name: bolo.subject_name,
        subject_aliases: Array.isArray(bolo.subject_aliases) ? bolo.subject_aliases.join(', ') : bolo.subject_aliases,
        subject_description: bolo.subject_description,
        date_of_birth: bolo.date_of_birth,
        age_range: bolo.age_range,
        height: bolo.height,
        weight: bolo.weight,
        hair_color: bolo.hair_color,
        eye_color: bolo.eye_color,
        distinguishing_features: bolo.distinguishing_features,
        last_seen_wearing: bolo.last_seen_wearing,
        armed_dangerous: bolo.armed_dangerous,
        armed_dangerous_details: bolo.armed_dangerous_details,
        vehicle_make: bolo.vehicle_make,
        vehicle_model: bolo.vehicle_model,
        vehicle_year: bolo.vehicle_year?.toString(),
        vehicle_color: bolo.vehicle_color,
        license_plate: bolo.license_plate,
        vehicle_vin: bolo.vehicle_vin,
        vehicle_features: bolo.vehicle_features,
        direction_of_travel: bolo.direction_of_travel,
        incident_date: bolo.incident_date,
        incident_location: bolo.incident_location,
        last_known_location: bolo.last_known_location,
        jurisdiction: bolo.jurisdiction,
        officer_safety_info: bolo.officer_safety_info,
        approach_instructions: bolo.approach_instructions,
        contact_info: bolo.contact_info,
        is_public: bolo.is_public,
        expires_at: bolo.expires_at
      };
      
      setFormData(boloFormData);
    } catch (error) {
      console.error('Error loading BOLO:', error);
      setError('Failed to load BOLO for editing');
    } finally {
      setLoadingBOLO(false);
    }
  };

  const handleChange = (field: keyof BOLOFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | any
  ) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNext = () => {
    setActiveStep(prevActiveStep => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep(prevActiveStep => prevActiveStep - 1);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      // Prepare form data for submission
      const submitData: any = { ...formData };
      // Convert subject_aliases string to array for API
      if (submitData.subject_aliases && typeof submitData.subject_aliases === 'string') {
        submitData.subject_aliases = submitData.subject_aliases.split(',').map((s: string) => s.trim()).filter((s: string) => s);
      }

      const updatedBOLO = await boloApi.updateBOLO(parseInt(id!), submitData);
      navigate(`/bolo/${updatedBOLO.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update BOLO');
      setLoading(false);
    }
  };

  // Copy the render functions from BOLOCreateForm but use the dark theme styles
  const renderBasicInfo = () => (
    <Box>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <FormControl fullWidth required sx={darkFormFieldSx}>
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
          <FormControl fullWidth required sx={darkFormFieldSx}>
            <InputLabel>Priority</InputLabel>
            <Select
              value={formData.priority}
              label="Priority"
              onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as any }))}
            >
              <MenuItem value="immediate">
                <Chip label="Immediate" sx={{ bgcolor: 'rgba(255, 71, 87, 0.2)', color: '#ff4757' }} size="small" />
              </MenuItem>
              <MenuItem value="high">
                <Chip label="High" sx={{ bgcolor: 'rgba(255, 165, 2, 0.2)', color: '#ffa502' }} size="small" />
              </MenuItem>
              <MenuItem value="medium">
                <Chip label="Medium" sx={{ bgcolor: 'rgba(47, 169, 255, 0.2)', color: '#2fa9ff' }} size="small" />
              </MenuItem>
              <MenuItem value="low">
                <Chip label="Low" sx={{ bgcolor: 'rgba(169, 176, 182, 0.2)', color: '#a9b0b6' }} size="small" />
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
            sx={darkFormFieldSx}
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
            sx={darkFormFieldSx}
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
            sx={darkFormFieldSx}
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
            <Typography variant="h6" gutterBottom sx={darkTypographySx}>
              Subject Information
            </Typography>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="Subject Name"
              value={formData.subject_name}
              onChange={handleChange('subject_name')}
              sx={darkFormFieldSx}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="Aliases"
              placeholder="Comma-separated aliases"
              value={formData.subject_aliases}
              onChange={handleChange('subject_aliases')}
              sx={darkFormFieldSx}
            />
          </Grid>

          <Grid size={12}>
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Physical Description"
              value={formData.subject_description}
              onChange={handleChange('subject_description')}
              sx={darkFormFieldSx}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="Date of Birth"
              type="date"
              value={formData.date_of_birth}
              onChange={handleChange('date_of_birth')}
              InputLabelProps={{ shrink: true }}
              sx={darkFormFieldSx}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="Age Range"
              placeholder="e.g., 25-30"
              value={formData.age_range}
              onChange={handleChange('age_range')}
              sx={darkFormFieldSx}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="Height"
              placeholder="e.g., 5'10&quot;"
              value={formData.height}
              onChange={handleChange('height')}
              sx={darkFormFieldSx}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="Weight"
              placeholder="e.g., 170 lbs"
              value={formData.weight}
              onChange={handleChange('weight')}
              sx={darkFormFieldSx}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="Hair Color"
              value={formData.hair_color}
              onChange={handleChange('hair_color')}
              sx={darkFormFieldSx}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="Eye Color"
              value={formData.eye_color}
              onChange={handleChange('eye_color')}
              sx={darkFormFieldSx}
            />
          </Grid>

          <Grid size={12}>
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Distinguishing Features"
              placeholder="Tattoos, scars, piercings, etc."
              value={formData.distinguishing_features}
              onChange={handleChange('distinguishing_features')}
              sx={darkFormFieldSx}
            />
          </Grid>

          <Grid size={12}>
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Last Seen Wearing"
              value={formData.last_seen_wearing}
              onChange={handleChange('last_seen_wearing')}
              sx={darkFormFieldSx}
            />
          </Grid>

          <Grid size={12}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.armed_dangerous || false}
                  onChange={handleChange('armed_dangerous')}
                  sx={{ color: '#a9b0b6', '&.Mui-checked': { color: '#ff4757' } }}
                />
              }
              label={
                <Box display="flex" alignItems="center">
                  <WarningIcon sx={{ color: '#ff4757', mr: 1 }} />
                  <Typography sx={{ color: '#a9b0b6' }}>Armed & Dangerous</Typography>
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
                rows={3}
                label="Armed & Dangerous Details"
                placeholder="Describe weapons, threat level, and approach precautions"
                value={formData.armed_dangerous_details}
                onChange={handleChange('armed_dangerous_details')}
                sx={darkFormFieldSx}
              />
            </Grid>
          )}
        </Grid>
      )}

      {formData.type === 'vehicle' && (
        <Grid container spacing={2}>
          <Grid size={12}>
            <Typography variant="h6" gutterBottom sx={darkTypographySx}>
              Vehicle Information
            </Typography>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="Make"
              value={formData.vehicle_make}
              onChange={handleChange('vehicle_make')}
              sx={darkFormFieldSx}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="Model"
              value={formData.vehicle_model}
              onChange={handleChange('vehicle_model')}
              sx={darkFormFieldSx}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="Year"
              value={formData.vehicle_year}
              onChange={handleChange('vehicle_year')}
              sx={darkFormFieldSx}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="Color"
              value={formData.vehicle_color}
              onChange={handleChange('vehicle_color')}
              sx={darkFormFieldSx}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="License Plate"
              value={formData.license_plate}
              onChange={handleChange('license_plate')}
              sx={darkFormFieldSx}
            />
          </Grid>

          <Grid size={12}>
            <TextField
              fullWidth
              label="VIN"
              value={formData.vehicle_vin}
              onChange={handleChange('vehicle_vin')}
              sx={darkFormFieldSx}
            />
          </Grid>

          <Grid size={12}>
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Vehicle Features"
              placeholder="Damage, modifications, distinctive features"
              value={formData.vehicle_features}
              onChange={handleChange('vehicle_features')}
              sx={darkFormFieldSx}
            />
          </Grid>

          <Grid size={12}>
            <TextField
              fullWidth
              label="Direction of Travel"
              placeholder="Last known direction"
              value={formData.direction_of_travel}
              onChange={handleChange('direction_of_travel')}
              sx={darkFormFieldSx}
            />
          </Grid>
        </Grid>
      )}
    </Box>
  );

  const renderIncidentInfo = () => (
    <Box>
      <Grid container spacing={2}>
        <Grid size={12}>
          <Typography variant="h6" gutterBottom sx={darkTypographySx}>
            Incident Information
          </Typography>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            fullWidth
            label="Incident Date"
            type="datetime-local"
            value={formData.incident_date}
            onChange={handleChange('incident_date')}
            InputLabelProps={{ shrink: true }}
            sx={darkFormFieldSx}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            fullWidth
            label="Jurisdiction"
            value={formData.jurisdiction}
            onChange={handleChange('jurisdiction')}
            sx={darkFormFieldSx}
          />
        </Grid>

        <Grid size={12}>
          <TextField
            fullWidth
            label="Incident Location"
            value={formData.incident_location}
            onChange={handleChange('incident_location')}
            sx={darkFormFieldSx}
          />
        </Grid>

        <Grid size={12}>
          <TextField
            fullWidth
            label="Last Known Location"
            value={formData.last_known_location}
            onChange={handleChange('last_known_location')}
            sx={darkFormFieldSx}
          />
        </Grid>
      </Grid>
    </Box>
  );

  const renderOfficerSafety = () => (
    <Box>
      <Grid container spacing={2}>
        <Grid size={12}>
          <Typography variant="h6" gutterBottom sx={darkTypographySx}>
            Officer Safety Information
          </Typography>
        </Grid>

        <Grid size={12}>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Officer Safety Information"
            placeholder="Known hazards, weapons, aggressive behavior, etc."
            value={formData.officer_safety_info}
            onChange={handleChange('officer_safety_info')}
            sx={darkFormFieldSx}
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
            sx={darkFormFieldSx}
          />
        </Grid>
      </Grid>
    </Box>
  );

  const renderMediaReview = () => (
    <Box>
      <Typography variant="h6" gutterBottom sx={darkTypographySx}>
        Review Information
      </Typography>
      <Paper className="review-section" sx={{ p: 2, bgcolor: '#1f2226', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <Typography variant="subtitle2" gutterBottom sx={{ color: '#ffffff' }}>
          <strong>Type:</strong> {formData.type}
        </Typography>
        <Typography variant="subtitle2" gutterBottom sx={{ color: '#ffffff' }}>
          <strong>Priority:</strong> {formData.priority}
        </Typography>
        <Typography variant="subtitle2" gutterBottom sx={{ color: '#ffffff' }}>
          <strong>Title:</strong> {formData.title}
        </Typography>
        <Typography variant="subtitle2" gutterBottom sx={{ color: '#ffffff' }}>
          <strong>Summary:</strong> {formData.summary}
        </Typography>
        {formData.armed_dangerous && (
          <Alert severity="error" sx={{ mt: 1, backgroundColor: 'rgba(255, 71, 87, 0.1)', color: '#ff4757' }}>
            Armed & Dangerous
          </Alert>
        )}
      </Paper>
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

  if (loadingBOLO) {
    return (
      <div className="bolo-create-form" style={{ 
        backgroundColor: '#0b0d10', 
        minHeight: '100vh', 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <CircularProgress sx={{ color: '#2fa9ff' }} />
      </div>
    );
  }

  return (
    <div className="bolo-create-form" style={{ 
      backgroundColor: '#0b0d10', 
      minHeight: '100vh', 
      padding: '24px 0' 
    }}>
      <Container maxWidth="lg">
        <Paper sx={{ 
          p: 3,
          backgroundColor: '#16181b',
          borderRadius: '16px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <Box display="flex" alignItems="center" mb={3}>
            <IconButton 
              onClick={() => navigate(`/bolo/${id}`)} 
              sx={{ 
                mr: 2,
                color: '#a9b0b6',
                backgroundColor: '#1f2226',
                '&:hover': { backgroundColor: '#2a2d31' }
              }}
            >
              <BackIcon />
            </IconButton>
            <Typography 
              variant="h4" 
              component="h1"
              sx={{
                color: '#ffffff',
                fontWeight: 700
              }}
            >
              Edit BOLO {originalBOLO?.case_number}
            </Typography>
          </Box>

          {error && (
            <Alert 
              severity="error" 
              sx={{ 
                mb: 2,
                backgroundColor: 'rgba(255, 71, 87, 0.1)',
                color: '#ff4757',
                border: '1px solid rgba(255, 71, 87, 0.2)'
              }} 
              onClose={() => setError(null)}
            >
              {error}
            </Alert>
          )}

          <Stepper 
            activeStep={activeStep} 
            orientation="vertical"
            sx={{
              '& .MuiStepLabel-root': {
                color: '#a9b0b6'
              },
              '& .MuiStepLabel-label.Mui-active': {
                color: '#2fa9ff',
                fontWeight: 600
              },
              '& .MuiStepLabel-label.Mui-completed': {
                color: '#28c76f'
              },
              '& .MuiStepIcon-root': {
                color: '#2f3336'
              },
              '& .MuiStepIcon-root.Mui-active': {
                color: '#2fa9ff'
              },
              '& .MuiStepIcon-root.Mui-completed': {
                color: '#28c76f'
              },
              '& .MuiStepConnector-line': {
                borderColor: '#2f3336'
              }
            }}
          >
            {steps.map((label, index) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
                <StepContent
                  sx={{
                    borderLeft: '1px solid #2f3336',
                    ml: 2,
                    pl: 2
                  }}
                >
                  <Box sx={{ mb: 2 }}>
                    {getStepContent(index)}
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Button
                      variant="contained"
                      onClick={index === steps.length - 1 ? handleSubmit : handleNext}
                      disabled={!isStepValid() || (index === steps.length - 1 && loading)}
                      sx={{ 
                        mt: 1, 
                        mr: 1,
                        backgroundColor: '#2fa9ff',
                        '&:hover': { backgroundColor: '#2090e0' },
                        '&:disabled': { backgroundColor: 'rgba(47, 169, 255, 0.3)' }
                      }}
                      startIcon={index === steps.length - 1 ? <SendIcon /> : null}
                    >
                      {index === steps.length - 1 ? 'Update BOLO' : 'Continue'}
                    </Button>
                    <Button
                      disabled={index === 0}
                      onClick={handleBack}
                      sx={{ 
                        mt: 1, 
                        mr: 1,
                        color: '#a9b0b6',
                        '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.05)' }
                      }}
                    >
                      Back
                    </Button>
                  </Box>
                </StepContent>
              </Step>
            ))}
          </Stepper>

          {loading && <LinearProgress sx={{ 
            backgroundColor: '#2f3336',
            '& .MuiLinearProgress-bar': {
              backgroundColor: '#2fa9ff'
            }
          }} />}
        </Paper>
      </Container>
    </div>
  );
};

export default BOLOEditForm;