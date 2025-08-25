import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Chip,
  Alert,
  CircularProgress,
  Divider
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Security as SecurityIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  Assignment as AssignmentIcon,
  CloudUpload as CloudUploadIcon
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

interface SubjectInfo {
  firstName: string;
  middleName: string;
  lastName: string;
  address: string;
  dateOfBirth: string;
  race: string;
  sex: string;
  phone: string;
  socialSecurityNumber: string;
  licenseNumber: string;
}

interface OrganizationInfo {
  businessName: string;
  phone: string;
  address: string;
}

interface SourceInfo {
  sourceId: string;
  rating: string;
  source: string;
  informationReliable: string;
  unknownCaller: boolean;
  ciCs: boolean;
  firstName: string;
  middleName: string;
  lastName: string;
  phone: string;
  address: string;
}

interface IntelReportData {
  intelNumber: string;
  classification: string;
  date: string;
  agentName: string;
  caseNumber: string;
  subject: string;
  criminalActivity: string;
  subjects: SubjectInfo[];
  organizations: OrganizationInfo[];
  summary: string;
  sourceInfo: SourceInfo;
  files: File[];
}

const IntelReportForm: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState<IntelReportData>({
    intelNumber: '',
    classification: '',
    date: new Date().toISOString().split('T')[0],
    agentName: '',
    caseNumber: '',
    subject: '',
    criminalActivity: '',
    subjects: [],
    organizations: [],
    summary: '',
    sourceInfo: {
      sourceId: '',
      rating: '',
      source: '',
      informationReliable: '',
      unknownCaller: false,
      ciCs: false,
      firstName: '',
      middleName: '',
      lastName: '',
      phone: '',
      address: ''
    },
    files: []
  });

  const classificationOptions = [
    { value: 'Sensitive', label: 'Sensitive', color: '#ff9800' },
    { value: 'Narcotics Only', label: 'Narcotics Only', color: '#e91e63' },
    { value: 'Classified', label: 'Classified', color: '#f44336' },
    { value: 'Law Enforcement Only', label: 'Law Enforcement Only', color: '#3f51b5' }
  ];

  const ratingOptions = [
    'A - Completely reliable',
    'B - Usually reliable',
    'C - Fairly reliable',
    'D - Not usually reliable',
    'E - Unreliable',
    'F - Reliability cannot be judged'
  ];

  const sourceOptions = [
    '1 - Reliable',
    '2 - Usually reliable',
    '3 - Fairly reliable',
    '4 - Not usually reliable',
    '5 - Unreliable',
    '6 - Cannot be judged'
  ];

  const steps = [
    {
      label: 'Basic Information',
      icon: <SecurityIcon />,
      description: 'Report details and classification'
    },
    {
      label: 'Subject Information',
      icon: <PersonIcon />,
      description: 'People involved in the report'
    },
    {
      label: 'Organization Information',
      icon: <BusinessIcon />,
      description: 'Businesses or organizations'
    },
    {
      label: 'Summary & Source',
      icon: <AssignmentIcon />,
      description: 'Report summary and source details'
    },
    {
      label: 'Files & Review',
      icon: <CloudUploadIcon />,
      description: 'Upload files and review report'
    }
  ];

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSourceChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      sourceInfo: {
        ...prev.sourceInfo,
        [field]: value
      }
    }));
  };

  const addSubject = () => {
    const newSubject: SubjectInfo = {
      firstName: '',
      middleName: '',
      lastName: '',
      address: '',
      dateOfBirth: '',
      race: '',
      sex: '',
      phone: '',
      socialSecurityNumber: '',
      licenseNumber: ''
    };
    setFormData(prev => ({
      ...prev,
      subjects: [...prev.subjects, newSubject]
    }));
  };

  const updateSubject = (index: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      subjects: prev.subjects.map((subject, i) => 
        i === index ? { ...subject, [field]: value } : subject
      )
    }));
  };

  const removeSubject = (index: number) => {
    setFormData(prev => ({
      ...prev,
      subjects: prev.subjects.filter((_, i) => i !== index)
    }));
  };

  const addOrganization = () => {
    const newOrg: OrganizationInfo = {
      businessName: '',
      phone: '',
      address: ''
    };
    setFormData(prev => ({
      ...prev,
      organizations: [...prev.organizations, newOrg]
    }));
  };

  const updateOrganization = (index: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      organizations: prev.organizations.map((org, i) => 
        i === index ? { ...org, [field]: value } : org
      )
    }));
  };

  const removeOrganization = (index: number) => {
    setFormData(prev => ({
      ...prev,
      organizations: prev.organizations.filter((_, i) => i !== index)
    }));
  };

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    
    try {
      // TODO: Implement API call to submit intel report
      console.log('Submitting intel report:', formData);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setSuccess(true);
    } catch (error: any) {
      setError(error.message || 'Failed to submit intelligence report');
    } finally {
      setLoading(false);
    }
  };

  const getClassificationChip = (classification: string) => {
    const option = classificationOptions.find(opt => opt.value === classification);
    return option ? (
      <Chip 
        label={option.label}
        sx={{ 
          backgroundColor: option.color,
          color: 'white',
          fontWeight: 'bold'
        }}
        size="small"
      />
    ) : null;
  };

  const renderBasicInformation = () => (
    <Box sx={{ mt: 2 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
          <TextField
            fullWidth
            label="Intel #"
            type="number"
            value={formData.intelNumber}
            onChange={(e) => handleInputChange('intelNumber', e.target.value)}
            required
            sx={{ mb: 2 }}
          />
        </Box>
        <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
          <FormControl fullWidth required sx={{ mb: 2 }}>
            <InputLabel>Classification</InputLabel>
            <Select
              value={formData.classification}
              onChange={(e) => handleInputChange('classification', e.target.value)}
              label="Classification"
            >
              {classificationOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        backgroundColor: option.color
                      }}
                    />
                    {option.label}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
          <TextField
            fullWidth
            label="Date"
            type="date"
            value={formData.date}
            onChange={(e) => handleInputChange('date', e.target.value)}
            required
            InputLabelProps={{ shrink: true }}
            sx={{ mb: 2 }}
          />
        </Box>
        <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
          <TextField
            fullWidth
            label="Agent Name"
            value={formData.agentName}
            onChange={(e) => handleInputChange('agentName', e.target.value)}
            required
            sx={{ mb: 2 }}
          />
        </Box>
        <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
          <TextField
            fullWidth
            label="Case #"
            value={formData.caseNumber}
            onChange={(e) => handleInputChange('caseNumber', e.target.value)}
            helperText="Put the associated case # if applicable"
            sx={{ mb: 2 }}
          />
        </Box>
        <Box sx={{ flex: '1 1 100%' }}>
          <TextField
            fullWidth
            label="Subject"
            value={formData.subject}
            onChange={(e) => handleInputChange('subject', e.target.value)}
            required
            sx={{ mb: 2 }}
          />
        </Box>
        <Box sx={{ flex: '1 1 100%' }}>
          <TextField
            fullWidth
            label="Describe Criminal Activity"
            multiline
            rows={4}
            value={formData.criminalActivity}
            onChange={(e) => handleInputChange('criminalActivity', e.target.value)}
            sx={{ mb: 2 }}
          />
        </Box>
      </Box>
    </Box>
  );

  const renderSubjectInformation = () => (
    <Box sx={{ mt: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Subject Information</Typography>
        <Button 
          variant="outlined" 
          onClick={addSubject}
          size="small"
        >
          Add Subject
        </Button>
      </Box>
      
      {formData.subjects.map((subject, index) => (
        <Accordion key={index} sx={{ mb: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography>
              Subject {index + 1}
              {subject.firstName || subject.lastName ? 
                `: ${subject.firstName} ${subject.lastName}` : 
                ''
              }
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="First Name"
                  value={subject.firstName}
                  onChange={(e) => updateSubject(index, 'firstName', e.target.value)}
                  sx={{ mb: 2 }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Middle Name"
                  value={subject.middleName}
                  onChange={(e) => updateSubject(index, 'middleName', e.target.value)}
                  sx={{ mb: 2 }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Last Name"
                  value={subject.lastName}
                  onChange={(e) => updateSubject(index, 'lastName', e.target.value)}
                  sx={{ mb: 2 }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Address"
                  value={subject.address}
                  onChange={(e) => updateSubject(index, 'address', e.target.value)}
                  sx={{ mb: 2 }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Date of Birth"
                  type="date"
                  value={subject.dateOfBirth}
                  onChange={(e) => updateSubject(index, 'dateOfBirth', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ mb: 2 }}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  fullWidth
                  label="Race"
                  value={subject.race}
                  onChange={(e) => updateSubject(index, 'race', e.target.value)}
                  sx={{ mb: 2 }}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Sex</InputLabel>
                  <Select
                    value={subject.sex}
                    onChange={(e) => updateSubject(index, 'sex', e.target.value)}
                    label="Sex"
                  >
                    <MenuItem value="M">Male</MenuItem>
                    <MenuItem value="F">Female</MenuItem>
                    <MenuItem value="O">Other</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Phone"
                  value={subject.phone}
                  onChange={(e) => updateSubject(index, 'phone', e.target.value)}
                  sx={{ mb: 2 }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Social Security Number"
                  value={subject.socialSecurityNumber}
                  onChange={(e) => updateSubject(index, 'socialSecurityNumber', e.target.value)}
                  sx={{ mb: 2 }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="License Number & State"
                  value={subject.licenseNumber}
                  onChange={(e) => updateSubject(index, 'licenseNumber', e.target.value)}
                  sx={{ mb: 2 }}
                />
              </Grid>
            </Grid>
            <Button
              color="error"
              onClick={() => removeSubject(index)}
              size="small"
              sx={{ mt: 1 }}
            >
              Remove Subject
            </Button>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );

  const renderOrganizationInformation = () => (
    <Box sx={{ mt: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Organization or Business</Typography>
        <Button 
          variant="outlined" 
          onClick={addOrganization}
          size="small"
        >
          Add Organization
        </Button>
      </Box>
      
      {formData.organizations.map((org, index) => (
        <Accordion key={index} sx={{ mb: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography>
              Organization {index + 1}
              {org.businessName ? `: ${org.businessName}` : ''}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Business/Organization Name"
                  value={org.businessName}
                  onChange={(e) => updateOrganization(index, 'businessName', e.target.value)}
                  sx={{ mb: 2 }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Phone"
                  value={org.phone}
                  onChange={(e) => updateOrganization(index, 'phone', e.target.value)}
                  sx={{ mb: 2 }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Address"
                  value={org.address}
                  onChange={(e) => updateOrganization(index, 'address', e.target.value)}
                  sx={{ mb: 2 }}
                />
              </Grid>
            </Grid>
            <Button
              color="error"
              onClick={() => removeOrganization(index)}
              size="small"
              sx={{ mt: 1 }}
            >
              Remove Organization
            </Button>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );

  const renderSummaryAndSource = () => (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>Summary/Criminal Activity</Typography>
      <TextField
        fullWidth
        label="Summary"
        multiline
        rows={6}
        value={formData.summary}
        onChange={(e) => handleInputChange('summary', e.target.value)}
        sx={{ mb: 3 }}
      />

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6" sx={{ mb: 2 }}>Source Information</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Source ID"
            value={formData.sourceInfo.sourceId}
            onChange={(e) => handleSourceChange('sourceId', e.target.value)}
            sx={{ mb: 2 }}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Rating</InputLabel>
            <Select
              value={formData.sourceInfo.rating}
              onChange={(e) => handleSourceChange('rating', e.target.value)}
              label="Rating"
            >
              {ratingOptions.map((option) => (
                <MenuItem key={option} value={option}>{option}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Source</InputLabel>
            <Select
              value={formData.sourceInfo.source}
              onChange={(e) => handleSourceChange('source', e.target.value)}
              label="Source"
            >
              {sourceOptions.map((option) => (
                <MenuItem key={option} value={option}>{option}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Information (Is it Reliable based on Criminal Nexus?)"
            multiline
            rows={3}
            value={formData.sourceInfo.informationReliable}
            onChange={(e) => handleSourceChange('informationReliable', e.target.value)}
            sx={{ mb: 2 }}
          />
        </Grid>
        
        {/* CI/CS Information */}
        <Grid item xs={12}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>CI/CS Information</Typography>
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            label="First Name"
            value={formData.sourceInfo.firstName}
            onChange={(e) => handleSourceChange('firstName', e.target.value)}
            sx={{ mb: 2 }}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            label="Middle Name"
            value={formData.sourceInfo.middleName}
            onChange={(e) => handleSourceChange('middleName', e.target.value)}
            sx={{ mb: 2 }}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            label="Last Name"
            value={formData.sourceInfo.lastName}
            onChange={(e) => handleSourceChange('lastName', e.target.value)}
            sx={{ mb: 2 }}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Phone"
            value={formData.sourceInfo.phone}
            onChange={(e) => handleSourceChange('phone', e.target.value)}
            sx={{ mb: 2 }}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Address"
            value={formData.sourceInfo.address}
            onChange={(e) => handleSourceChange('address', e.target.value)}
            sx={{ mb: 2 }}
          />
        </Grid>
      </Grid>
    </Box>
  );

  const renderFilesAndReview = () => (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>File Upload</Typography>
      <Box
        sx={{
          border: '2px dashed #ccc',
          borderRadius: 2,
          p: 4,
          textAlign: 'center',
          mb: 3,
          cursor: 'pointer',
          '&:hover': {
            borderColor: '#999'
          }
        }}
      >
        <CloudUploadIcon sx={{ fontSize: 48, color: '#ccc', mb: 2 }} />
        <Typography>Click or drag files here to upload</Typography>
        <Typography variant="caption" color="textSecondary">
          Supported formats: PDF, DOC, DOCX, JPG, PNG
        </Typography>
      </Box>

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6" sx={{ mb: 2 }}>Review Report</Typography>
      <Paper sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="textSecondary">Intel #:</Typography>
            <Typography variant="body1">{formData.intelNumber || 'Not specified'}</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="textSecondary">Classification:</Typography>
            <Box sx={{ mt: 0.5 }}>
              {formData.classification ? 
                getClassificationChip(formData.classification) : 
                <Typography variant="body1">Not specified</Typography>
              }
            </Box>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="textSecondary">Agent:</Typography>
            <Typography variant="body1">{formData.agentName || 'Not specified'}</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="textSecondary">Date:</Typography>
            <Typography variant="body1">{formData.date || 'Not specified'}</Typography>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="body2" color="textSecondary">Subject:</Typography>
            <Typography variant="body1">{formData.subject || 'Not specified'}</Typography>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="body2" color="textSecondary">Subjects:</Typography>
            <Typography variant="body1">{formData.subjects.length} subject(s)</Typography>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="body2" color="textSecondary">Organizations:</Typography>
            <Typography variant="body1">{formData.organizations.length} organization(s)</Typography>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );

  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        return renderBasicInformation();
      case 1:
        return renderSubjectInformation();
      case 2:
        return renderOrganizationInformation();
      case 3:
        return renderSummaryAndSource();
      case 4:
        return renderFilesAndReview();
      default:
        return 'Unknown step';
    }
  };

  if (success) {
    return (
      <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h4" color="primary" gutterBottom>
            Report Submitted Successfully
          </Typography>
          <Typography variant="body1" sx={{ mb: 3 }}>
            Your intelligence report has been submitted and is now under review.
          </Typography>
          <Button 
            variant="contained" 
            onClick={() => {
              setSuccess(false);
              setActiveStep(0);
              // Reset form data
            }}
          >
            Create New Report
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: { xs: 2, md: 3 } }}>
      <Paper sx={{ p: { xs: 2, md: 4 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
          <SecurityIcon sx={{ fontSize: 40, color: 'primary.main' }} />
          <Typography variant="h4" component="h1">
            Intelligence Report
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Stepper 
          activeStep={activeStep} 
          orientation={isMobile ? 'vertical' : 'horizontal'}
          sx={{ mb: 4 }}
        >
          {steps.map((step, index) => (
            <Step key={step.label}>
              <StepLabel
                icon={step.icon}
                optional={
                  <Typography variant="caption">{step.description}</Typography>
                }
              >
                {step.label}
              </StepLabel>
              {isMobile && (
                <StepContent>
                  {getStepContent(index)}
                  <Box sx={{ mt: 2 }}>
                    <Button
                      disabled={activeStep === 0}
                      onClick={handleBack}
                      sx={{ mr: 1 }}
                    >
                      Back
                    </Button>
                    {activeStep === steps.length - 1 ? (
                      <Button 
                        variant="contained" 
                        onClick={handleSubmit}
                        disabled={loading}
                        startIcon={loading ? <CircularProgress size={16} /> : null}
                      >
                        {loading ? 'Submitting...' : 'Submit Report'}
                      </Button>
                    ) : (
                      <Button variant="contained" onClick={handleNext}>
                        Next
                      </Button>
                    )}
                  </Box>
                </StepContent>
              )}
            </Step>
          ))}
        </Stepper>

        {!isMobile && (
          <>
            {getStepContent(activeStep)}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
              <Button
                disabled={activeStep === 0}
                onClick={handleBack}
              >
                Back
              </Button>
              {activeStep === steps.length - 1 ? (
                <Button 
                  variant="contained" 
                  onClick={handleSubmit}
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={16} /> : null}
                >
                  {loading ? 'Submitting...' : 'Submit Report'}
                </Button>
              ) : (
                <Button variant="contained" onClick={handleNext}>
                  Next
                </Button>
              )}
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
};

export default IntelReportForm;