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
  Chip,
  Alert,
  CircularProgress,
  Divider
} from '@mui/material';
import { Security as SecurityIcon, ArrowBack as BackIcon, Add as AddIcon, Remove as RemoveIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

interface IntelReportFormProps {
  isModal?: boolean;
  onClose?: () => void;
}

const IntelReportFormSimple: React.FC<IntelReportFormProps> = ({ isModal = false, onClose }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Generate auto-incrementing Intel number
  const generateIntelNumber = () => {
    const currentYear = new Date().getFullYear();
    const currentDate = new Date();
    const startOfYear = new Date(currentYear, 0, 1);
    const daysSinceStart = Math.floor((currentDate.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
    
    // Format: YYYYDDDNNN (Year + Day of Year + Sequential Number)
    // For now, we'll use a simple approach with timestamp to ensure uniqueness
    const timestamp = Date.now().toString().slice(-4);
    return `${currentYear}${timestamp}`;
  };

  const [formData, setFormData] = useState({
    intelNumber: generateIntelNumber(),
    classification: '',
    date: new Date().toISOString().split('T')[0],
    agentName: '',
    caseNumber: '',
    subject: '',
    criminalActivity: '',
    summary: '',
    // Arrays for multiple subjects and organizations
    subjects: [{
      firstName: '',
      middleName: '',
      lastName: '',
      address: '',
      dateOfBirth: '',
      race: '',
      sex: '',
      phone: '',
      ssn: '',
      license: ''
    }],
    organizations: [{
      businessName: '',
      phone: '',
      address: ''
    }],
    // Source Information
    sourceId: '',
    sourceRating: '',
    sourceType: '', // Unknown Caller, CI/CS, etc.
    sourceReliability: '',
    sourceFirstName: '',
    sourceMiddleName: '',
    sourceLastName: '',
    sourcePhone: '',
    sourceAddress: ''
  });

  const classificationOptions = [
    { value: 'Sensitive', label: 'Sensitive', color: '#ff9800' },
    { value: 'Narcotics Only', label: 'Narcotics Only', color: '#e91e63' },
    { value: 'Classified', label: 'Classified', color: '#f44336' },
    { value: 'Law Enforcement Only', label: 'Law Enforcement Only', color: '#3f51b5' }
  ];

  const raceOptions = [
    'White', 'Black', 'Hispanic', 'Asian', 'Native American', 'Pacific Islander', 'Other', 'Unknown'
  ];

  const sexOptions = [
    { value: 'M', label: 'Male' },
    { value: 'F', label: 'Female' },
    { value: 'O', label: 'Other/Unknown' }
  ];

  const sourceTypeOptions = [
    'Unknown Caller', 'CI/CS', 'Witness', 'Victim', 'Officer', 'Other'
  ];

  const sourceRatingOptions = [
    'A - Completely Reliable', 'B - Usually Reliable', 'C - Fairly Reliable', 
    'D - Not Usually Reliable', 'E - Unreliable', 'F - Reliability Cannot Be Judged'
  ];

  const reliabilityOptions = [
    '1 - Confirmed by Other Sources', '2 - Probably True', '3 - Possibly True', 
    '4 - Doubtful', '5 - Improbable', '6 - Truth Cannot Be Judged'
  ];

  // Dark theme styling with readable text
  const fieldStyles = {
    mb: 2,
    '& .MuiInputLabel-root': { 
      color: '#E7E9EA',
      '&.Mui-focused': { color: '#1D9BF0' },
      '&.MuiInputLabel-shrink': { color: '#E7E9EA' }
    },
    '& .MuiOutlinedInput-root': { 
      backgroundColor: '#2a2a2a',
      '& .MuiInputBase-input': { 
        color: '#E7E9EA'
      },
      '& .MuiOutlinedInput-notchedOutline': { 
        borderColor: '#3a3a3a'
      },
      '&:hover .MuiOutlinedInput-notchedOutline': {
        borderColor: '#1D9BF0'
      },
      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
        borderColor: '#1D9BF0'
      }
    },
    '& .MuiFormHelperText-root': { color: '#E7E9EA' }
  };

  const selectStyles = {
    mb: 2,
    '& .MuiInputLabel-root': { 
      color: '#E7E9EA',
      '&.Mui-focused': { color: '#1D9BF0' },
      '&.MuiInputLabel-shrink': { color: '#E7E9EA' }
    },
    '& .MuiOutlinedInput-root': { 
      backgroundColor: '#2a2a2a',
      '& .MuiSelect-select': { 
        color: '#E7E9EA'
      },
      '& .MuiOutlinedInput-notchedOutline': { 
        borderColor: '#3a3a3a'
      },
      '&:hover .MuiOutlinedInput-notchedOutline': {
        borderColor: '#1D9BF0'
      },
      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
        borderColor: '#1D9BF0'
      }
    },
    '& .MuiSvgIcon-root': { color: '#E7E9EA' }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubjectChange = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      subjects: prev.subjects.map((subject, i) => 
        i === index ? { ...subject, [field]: value } : subject
      )
    }));
  };

  const handleOrganizationChange = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      organizations: prev.organizations.map((org, i) => 
        i === index ? { ...org, [field]: value } : org
      )
    }));
  };

  const addSubject = () => {
    setFormData(prev => ({
      ...prev,
      subjects: [...prev.subjects, {
        firstName: '',
        middleName: '',
        lastName: '',
        address: '',
        dateOfBirth: '',
        race: '',
        sex: '',
        phone: '',
        ssn: '',
        license: ''
      }]
    }));
  };

  const removeSubject = (index: number) => {
    if (formData.subjects.length > 1) {
      setFormData(prev => ({
        ...prev,
        subjects: prev.subjects.filter((_, i) => i !== index)
      }));
    }
  };

  const addOrganization = () => {
    setFormData(prev => ({
      ...prev,
      organizations: [...prev.organizations, {
        businessName: '',
        phone: '',
        address: ''
      }]
    }));
  };

  const removeOrganization = (index: number) => {
    if (formData.organizations.length > 1) {
      setFormData(prev => ({
        ...prev,
        organizations: prev.organizations.filter((_, i) => i !== index)
      }));
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Prepare data for API submission
      const submissionData = {
        intel_number: formData.intelNumber,
        classification: formData.classification,
        date: formData.date,
        agent_name: formData.agentName,
        case_number: formData.caseNumber,
        subject: formData.subject,
        criminal_activity: formData.criminalActivity,
        summary: formData.summary,
        status: 'pending',
        subjects: JSON.stringify(formData.subjects.map(subject => ({
          first_name: subject.firstName,
          middle_name: subject.middleName,
          last_name: subject.lastName,
          address: subject.address,
          date_of_birth: subject.dateOfBirth,
          race: subject.race,
          sex: subject.sex,
          phone: subject.phone,
          social_security_number: subject.ssn,
          license_number: subject.license
        }))),
        organizations: JSON.stringify(formData.organizations.map(org => ({
          business_name: org.businessName,
          phone: org.phone,
          address: org.address
        }))),
        source_info: JSON.stringify({
          source_id: formData.sourceId,
          rating: formData.sourceRating,
          source: formData.sourceType,
          information_reliable: formData.sourceReliability,
          unknown_caller: formData.sourceType === 'Unknown Caller',
          ci_cs: formData.sourceType === 'CI/CS',
          first_name: formData.sourceFirstName,
          middle_name: formData.sourceMiddleName,
          last_name: formData.sourceLastName,
          phone: formData.sourcePhone,
          address: formData.sourceAddress
        })
      };

      console.log('Submitting intel report:', submissionData);
      
      // Make actual API call
      const response = await fetch('/api/intel-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(submissionData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Report submitted successfully:', result);
      
      // Always set success first
      setSuccess(true);
      
      // Wait a moment to show success message
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      if (isModal && onClose) {
        // Close modal after showing success
        onClose();
      } else {
        // If not in modal, we're on a standalone page, so the success screen will show
        // The user can click "Create New Report" or navigate away
      }
      
      // Reset form for next use
      setFormData({
        intelNumber: generateIntelNumber(),
        classification: '',
        date: new Date().toISOString().split('T')[0],
        agentName: '',
        caseNumber: '',
        subject: '',
        criminalActivity: '',
        summary: '',
        // Arrays for multiple subjects and organizations
        subjects: [{
          firstName: '',
          middleName: '',
          lastName: '',
          address: '',
          dateOfBirth: '',
          race: '',
          sex: '',
          phone: '',
          ssn: '',
          license: ''
        }],
        organizations: [{
          businessName: '',
          phone: '',
          address: ''
        }],
        // Source Information
        sourceId: '',
        sourceRating: '',
        sourceType: '',
        sourceReliability: '',
        sourceFirstName: '',
        sourceMiddleName: '',
        sourceLastName: '',
        sourcePhone: '',
        sourceAddress: ''
      });
      
      // Reset success state
      setSuccess(false);
    } catch (error: any) {
      console.error('Error submitting report:', error);
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

  if (success) {
    return (
      <Box sx={{ 
        maxWidth: 800, 
        mx: 'auto', 
        p: 3, 
        backgroundColor: isModal ? 'transparent' : '#000000', 
        minHeight: isModal ? 'auto' : '100vh',
        color: '#E7E9EA'
      }}>
        <Paper sx={{ 
          p: 4, 
          textAlign: 'center', 
          backgroundColor: '#1f1f1f',
          border: '1px solid #2F3336'
        }}>
          <Typography variant="h4" sx={{ color: '#4caf50', mb: 2 }} gutterBottom>
            ✓ Report Submitted Successfully
          </Typography>
          <Typography variant="body1" sx={{ mb: 3, color: '#E7E9EA' }}>
            Your intelligence report has been submitted and is now under review.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Button 
              variant="outlined"
              startIcon={<BackIcon />}
              onClick={() => navigate('/intel-reports')}
              sx={{ 
                borderColor: '#1D9BF0',
                color: '#1D9BF0',
                '&:hover': { 
                  borderColor: '#1a8cd8',
                  backgroundColor: 'rgba(29, 155, 240, 0.1)'
                }
              }}
            >
              Back to Reports
            </Button>
            <Button 
              variant="contained" 
              onClick={() => {
                setSuccess(false);
                // Reset form data
                setFormData({
                  intelNumber: generateIntelNumber(),
                  classification: '',
                  date: new Date().toISOString().split('T')[0],
                  agentName: '',
                  caseNumber: '',
                  subject: '',
                  criminalActivity: '',
                  summary: '',
                  // Arrays for multiple subjects and organizations
                  subjects: [{
                    firstName: '',
                    middleName: '',
                    lastName: '',
                    address: '',
                    dateOfBirth: '',
                    race: '',
                    sex: '',
                    phone: '',
                    ssn: '',
                    license: ''
                  }],
                  organizations: [{
                    businessName: '',
                    phone: '',
                    address: ''
                  }],
                  // Source Information
                  sourceId: '',
                  sourceRating: '',
                  sourceType: '',
                  sourceReliability: '',
                  sourceFirstName: '',
                  sourceMiddleName: '',
                  sourceLastName: '',
                  sourcePhone: '',
                  sourceAddress: ''
                });
              }}
              sx={{ 
                backgroundColor: '#1D9BF0',
                color: '#ffffff',
                '&:hover': { backgroundColor: '#1a8cd8' }
              }}
            >
              Create New Report
            </Button>
          </Box>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      maxWidth: isModal ? '100%' : 1200, 
      mx: 'auto', 
      p: { xs: 2, md: 3 },
      backgroundColor: isModal ? 'transparent' : '#000000',
      minHeight: isModal ? 'auto' : '100vh',
      color: '#E7E9EA'
    }}>
      <Paper sx={{ 
        p: { xs: 2, md: 4 }, 
        backgroundColor: '#1f1f1f',
        border: '1px solid #2F3336'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <SecurityIcon sx={{ fontSize: 40, color: '#1D9BF0' }} />
            <Typography variant="h4" component="h1" sx={{ color: '#E7E9EA' }}>
              Intelligence Report
            </Typography>
          </Box>
          {!isModal && (
            <Button
              variant="outlined"
              startIcon={<BackIcon />}
              onClick={() => navigate('/intel-reports')}
              sx={{ 
                borderColor: '#1D9BF0',
                color: '#1D9BF0',
                '&:hover': { 
                  borderColor: '#1a8cd8',
                  backgroundColor: 'rgba(29, 155, 240, 0.1)'
                }
              }}
            >
              Back to Reports
            </Button>
          )}
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Basic Information */}
        <Typography variant="h5" sx={{ mb: 3 }}>Basic Information</Typography>
        
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
          <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
            <TextField
              fullWidth
              label="Intel #"
              type="text"
              value={formData.intelNumber}
              InputProps={{
                readOnly: true
              }}
              sx={{ 
                mb: 2,
                '& .MuiInputLabel-root': { 
                  color: '#E7E9EA',
                  '&.Mui-focused': { color: '#1D9BF0' },
                  '&.MuiInputLabel-shrink': { color: '#E7E9EA' }
                },
                '& .MuiOutlinedInput-root': { 
                  backgroundColor: '#2a2a2a',
                  '& .MuiInputBase-input': { 
                    color: '#E7E9EA'
                  },
                  '& .MuiOutlinedInput-notchedOutline': { 
                    borderColor: '#3a3a3a'
                  }
                },
                '& .MuiFormHelperText-root': { color: '#E7E9EA' }
              }}
              helperText="Auto-generated Intel number"
            />
          </Box>
          <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
            <FormControl fullWidth required sx={selectStyles}>
              <InputLabel>Classification</InputLabel>
              <Select
                value={formData.classification}
                onChange={(e) => handleInputChange('classification', e.target.value)}
                label="Classification"
                MenuProps={{
                  PaperProps: {
                    sx: {
                      backgroundColor: '#2a2a2a',
                      border: '1px solid #3a3a3a',
                      '& .MuiMenuItem-root': {
                        color: '#E7E9EA',
                        '&:hover': { backgroundColor: '#3a3a3a' }
                      }
                    }
                  }
                }}
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
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
          <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
            <TextField
              fullWidth
              label="Date"
              type="date"
              value={formData.date}
              onChange={(e) => handleInputChange('date', e.target.value)}
              required
              InputLabelProps={{ shrink: true }}
              sx={fieldStyles}
            />
          </Box>
          <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
            <TextField
              fullWidth
              label="Agent Name"
              value={formData.agentName}
              onChange={(e) => handleInputChange('agentName', e.target.value)}
              required
              sx={fieldStyles}
            />
          </Box>
        </Box>

        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            label="Case #"
            value={formData.caseNumber}
            onChange={(e) => handleInputChange('caseNumber', e.target.value)}
            helperText="Put the associated case # if applicable"
            sx={fieldStyles}
          />
        </Box>

        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            label="Subject"
            value={formData.subject}
            onChange={(e) => handleInputChange('subject', e.target.value)}
            required
            sx={fieldStyles}
          />
        </Box>

        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            label="Describe Criminal Activity"
            multiline
            rows={4}
            value={formData.criminalActivity}
            onChange={(e) => handleInputChange('criminalActivity', e.target.value)}
            sx={fieldStyles}
          />
        </Box>

        <Box sx={{ mb: 4 }}>
          <TextField
            fullWidth
            label="Summary"
            multiline
            rows={6}
            value={formData.summary}
            onChange={(e) => handleInputChange('summary', e.target.value)}
            sx={fieldStyles}
          />
        </Box>

        {/* Subject Information Section */}
        <Divider sx={{ my: 3 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h5" sx={{ color: '#E7E9EA' }}>Subject Information</Typography>
          <Button
            startIcon={<AddIcon />}
            onClick={addSubject}
            sx={{ color: '#1D9BF0', '&:hover': { backgroundColor: 'rgba(29, 155, 240, 0.1)' } }}
          >
            Add Subject
          </Button>
        </Box>
        
        {formData.subjects.map((subject, index) => (
          <Paper key={index} sx={{ p: 3, mb: 3, backgroundColor: '#2a2a2a', border: '1px solid #3a3a3a' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" sx={{ color: '#E7E9EA' }}>Subject {index + 1}</Typography>
              {formData.subjects.length > 1 && (
                <Button
                  startIcon={<RemoveIcon />}
                  onClick={() => removeSubject(index)}
                  sx={{ color: '#f44336', '&:hover': { backgroundColor: 'rgba(244, 67, 54, 0.1)' } }}
                >
                  Remove
                </Button>
              )}
            </Box>
            
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
              <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
                <TextField
                  fullWidth
                  label="First Name"
                  value={subject.firstName}
                  onChange={(e) => handleSubjectChange(index, 'firstName', e.target.value)}
                  sx={fieldStyles}
                />
              </Box>
              <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
                <TextField
                  fullWidth
                  label="Middle Name"
                  value={subject.middleName}
                  onChange={(e) => handleSubjectChange(index, 'middleName', e.target.value)}
                  sx={fieldStyles}
                />
              </Box>
              <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
                <TextField
                  fullWidth
                  label="Last Name"
                  value={subject.lastName}
                  onChange={(e) => handleSubjectChange(index, 'lastName', e.target.value)}
                  sx={fieldStyles}
                />
              </Box>
            </Box>

            <Box sx={{ mb: 3 }}>
              <TextField
                fullWidth
                label="Address"
                value={subject.address}
                onChange={(e) => handleSubjectChange(index, 'address', e.target.value)}
                sx={fieldStyles}
              />
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
              <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
                <TextField
                  fullWidth
                  label="Date of Birth"
                  type="date"
                  value={subject.dateOfBirth}
                  onChange={(e) => handleSubjectChange(index, 'dateOfBirth', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={fieldStyles}
                />
              </Box>
              <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
                <FormControl fullWidth sx={selectStyles}>
                  <InputLabel>Race</InputLabel>
                  <Select
                    value={subject.race}
                    onChange={(e) => handleSubjectChange(index, 'race', e.target.value)}
                    label="Race"
                    MenuProps={{
                      PaperProps: {
                        sx: {
                          backgroundColor: '#2a2a2a',
                          border: '1px solid #3a3a3a',
                          '& .MuiMenuItem-root': {
                            color: '#E7E9EA',
                            '&:hover': { backgroundColor: '#3a3a3a' }
                          }
                        }
                      }
                    }}
                  >
                    {raceOptions.map((race) => (
                      <MenuItem key={race} value={race}>{race}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
                <FormControl fullWidth sx={selectStyles}>
                  <InputLabel>Sex</InputLabel>
                  <Select
                    value={subject.sex}
                    onChange={(e) => handleSubjectChange(index, 'sex', e.target.value)}
                    label="Sex"
                    MenuProps={{
                      PaperProps: {
                        sx: {
                          backgroundColor: '#2a2a2a',
                          border: '1px solid #3a3a3a',
                          '& .MuiMenuItem-root': {
                            color: '#E7E9EA',
                            '&:hover': { backgroundColor: '#3a3a3a' }
                          }
                        }
                      }
                    }}
                  >
                    {sexOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
                <TextField
                  fullWidth
                  label="Phone"
                  value={subject.phone}
                  onChange={(e) => handleSubjectChange(index, 'phone', e.target.value)}
                  sx={fieldStyles}
                />
              </Box>
              <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
                <TextField
                  fullWidth
                  label="Social Security Number"
                  value={subject.ssn}
                  onChange={(e) => handleSubjectChange(index, 'ssn', e.target.value)}
                  sx={fieldStyles}
                />
              </Box>
              <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
                <TextField
                  fullWidth
                  label="License Number & State"
                  value={subject.license}
                  onChange={(e) => handleSubjectChange(index, 'license', e.target.value)}
                  sx={fieldStyles}
                />
              </Box>
            </Box>
          </Paper>
        ))}

        {/* Organization/Business Section */}
        <Divider sx={{ my: 3 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h5" sx={{ color: '#E7E9EA' }}>Organization/Business Information</Typography>
          <Button
            startIcon={<AddIcon />}
            onClick={addOrganization}
            sx={{ color: '#1D9BF0', '&:hover': { backgroundColor: 'rgba(29, 155, 240, 0.1)' } }}
          >
            Add Organization
          </Button>
        </Box>
        
        {formData.organizations.map((org, index) => (
          <Paper key={index} sx={{ p: 3, mb: 3, backgroundColor: '#2a2a2a', border: '1px solid #3a3a3a' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" sx={{ color: '#E7E9EA' }}>Organization {index + 1}</Typography>
              {formData.organizations.length > 1 && (
                <Button
                  startIcon={<RemoveIcon />}
                  onClick={() => removeOrganization(index)}
                  sx={{ color: '#f44336', '&:hover': { backgroundColor: 'rgba(244, 67, 54, 0.1)' } }}
                >
                  Remove
                </Button>
              )}
            </Box>
            
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
              <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
                <TextField
                  fullWidth
                  label="Business/Organization Name"
                  value={org.businessName}
                  onChange={(e) => handleOrganizationChange(index, 'businessName', e.target.value)}
                  sx={fieldStyles}
                />
              </Box>
              <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
                <TextField
                  fullWidth
                  label="Phone"
                  value={org.phone}
                  onChange={(e) => handleOrganizationChange(index, 'phone', e.target.value)}
                  sx={fieldStyles}
                />
              </Box>
            </Box>

            <Box sx={{ mb: 3 }}>
              <TextField
                fullWidth
                label="Address"
                value={org.address}
                onChange={(e) => handleOrganizationChange(index, 'address', e.target.value)}
                sx={fieldStyles}
              />
            </Box>
          </Paper>
        ))}

        {/* Source Information Section */}
        <Divider sx={{ my: 3 }} />
        <Typography variant="h5" sx={{ mb: 3 }}>Source Information</Typography>
        
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
          <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
            <TextField
              fullWidth
              label="Source ID"
              value={formData.sourceId}
              onChange={(e) => handleInputChange('sourceId', e.target.value)}
              sx={fieldStyles}
            />
          </Box>
          <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
            <FormControl fullWidth sx={selectStyles}>
              <InputLabel>Source Type</InputLabel>
              <Select
                value={formData.sourceType}
                onChange={(e) => handleInputChange('sourceType', e.target.value)}
                label="Source Type"
                MenuProps={{
                  PaperProps: {
                    sx: {
                      backgroundColor: '#2a2a2a',
                      border: '1px solid #3a3a3a',
                      '& .MuiMenuItem-root': {
                        color: '#E7E9EA',
                        '&:hover': { backgroundColor: '#3a3a3a' }
                      }
                    }
                  }
                }}
              >
                {sourceTypeOptions.map((type) => (
                  <MenuItem key={type} value={type}>{type}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
          <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
            <FormControl fullWidth sx={selectStyles}>
              <InputLabel>Source Rating</InputLabel>
              <Select
                value={formData.sourceRating}
                onChange={(e) => handleInputChange('sourceRating', e.target.value)}
                label="Source Rating"
                MenuProps={{
                  PaperProps: {
                    sx: {
                      backgroundColor: '#2a2a2a',
                      border: '1px solid #3a3a3a',
                      '& .MuiMenuItem-root': {
                        color: '#E7E9EA',
                        '&:hover': { backgroundColor: '#3a3a3a' }
                      }
                    }
                  }
                }}
              >
                {sourceRatingOptions.map((rating) => (
                  <MenuItem key={rating} value={rating}>{rating}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
            <FormControl fullWidth sx={selectStyles}>
              <InputLabel>Information Reliability</InputLabel>
              <Select
                value={formData.sourceReliability}
                onChange={(e) => handleInputChange('sourceReliability', e.target.value)}
                label="Information Reliability"
                MenuProps={{
                  PaperProps: {
                    sx: {
                      backgroundColor: '#2a2a2a',
                      border: '1px solid #3a3a3a',
                      '& .MuiMenuItem-root': {
                        color: '#E7E9EA',
                        '&:hover': { backgroundColor: '#3a3a3a' }
                      }
                    }
                  }
                }}
              >
                {reliabilityOptions.map((reliability) => (
                  <MenuItem key={reliability} value={reliability}>{reliability}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Box>

        <Typography variant="h6" sx={{ mb: 2 }}>Source Contact Information (if applicable)</Typography>
        
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
          <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
            <TextField
              fullWidth
              label="First Name"
              value={formData.sourceFirstName}
              onChange={(e) => handleInputChange('sourceFirstName', e.target.value)}
              sx={fieldStyles}
            />
          </Box>
          <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
            <TextField
              fullWidth
              label="Middle Name"
              value={formData.sourceMiddleName}
              onChange={(e) => handleInputChange('sourceMiddleName', e.target.value)}
              sx={fieldStyles}
            />
          </Box>
          <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
            <TextField
              fullWidth
              label="Last Name"
              value={formData.sourceLastName}
              onChange={(e) => handleInputChange('sourceLastName', e.target.value)}
              sx={fieldStyles}
            />
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
          <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
            <TextField
              fullWidth
              label="Phone"
              value={formData.sourcePhone}
              onChange={(e) => handleInputChange('sourcePhone', e.target.value)}
              sx={fieldStyles}
            />
          </Box>
          <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
            <TextField
              fullWidth
              label="Address"
              value={formData.sourceAddress}
              onChange={(e) => handleInputChange('sourceAddress', e.target.value)}
              sx={fieldStyles}
            />
          </Box>
        </Box>

        {/* Review Section */}
        <Divider sx={{ my: 3 }} />
        <Typography variant="h6" sx={{ mb: 2, color: '#E7E9EA' }}>Review Report</Typography>
        
        {formData.classification && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ color: '#E7E9EA' }}>Classification:</Typography>
            {getClassificationChip(formData.classification)}
          </Box>
        )}

        <Paper sx={{ p: 2, backgroundColor: '#2a2a2a', border: '1px solid #3a3a3a', mb: 3 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ flex: '1 1 200px' }}>
              <Typography variant="body2" sx={{ color: '#E7E9EA' }}>Intel #:</Typography>
              <Typography variant="body1" sx={{ color: '#E7E9EA' }}>{formData.intelNumber || 'Not specified'}</Typography>
            </Box>
            <Box sx={{ flex: '1 1 200px' }}>
              <Typography variant="body2" sx={{ color: '#E7E9EA' }}>Agent:</Typography>
              <Typography variant="body1" sx={{ color: '#E7E9EA' }}>{formData.agentName || 'Not specified'}</Typography>
            </Box>
            <Box sx={{ flex: '1 1 200px' }}>
              <Typography variant="body2" sx={{ color: '#E7E9EA' }}>Date:</Typography>
              <Typography variant="body1" sx={{ color: '#E7E9EA' }}>{formData.date || 'Not specified'}</Typography>
            </Box>
            <Box sx={{ flex: '1 1 100%' }}>
              <Typography variant="body2" sx={{ color: '#E7E9EA' }}>Subject:</Typography>
              <Typography variant="body1" sx={{ color: '#E7E9EA' }}>{formData.subject || 'Not specified'}</Typography>
            </Box>
          </Box>
        </Paper>

        {/* Submit Button */}
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Button 
            variant="contained" 
            size="large"
            onClick={handleSubmit}
            disabled={loading || !formData.classification || !formData.agentName || !formData.subject}
            startIcon={loading ? <CircularProgress size={16} /> : null}
            sx={{ 
              px: 6, 
              py: 2,
              backgroundColor: '#1D9BF0',
              color: '#ffffff',
              '&:hover': { backgroundColor: '#1a8cd8' },
              '&:disabled': { backgroundColor: '#2F3336', color: '#71767B' }
            }}
          >
            {loading ? 'Submitting...' : 'Submit Report'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default IntelReportFormSimple;