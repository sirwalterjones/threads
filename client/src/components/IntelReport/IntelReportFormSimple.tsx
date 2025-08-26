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
import { Security as SecurityIcon } from '@mui/icons-material';

interface IntelReportFormProps {
  isModal?: boolean;
  onClose?: () => void;
}

const IntelReportFormSimple: React.FC<IntelReportFormProps> = ({ isModal = false, onClose }) => {
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
    // Subject Information
    subjectFirstName: '',
    subjectMiddleName: '',
    subjectLastName: '',
    subjectAddress: '',
    subjectDateOfBirth: '',
    subjectRace: '',
    subjectSex: '',
    subjectPhone: '',
    subjectSSN: '',
    subjectLicense: '',
    // Organization/Business
    businessName: '',
    businessPhone: '',
    businessAddress: '',
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
    'Male', 'Female', 'Unknown'
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

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
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
        case_number: formData.caseNumber,
        subject: formData.subject,
        criminal_activity: formData.criminalActivity,
        summary: formData.summary,
        subjects: JSON.stringify([{
          first_name: formData.subjectFirstName,
          middle_name: formData.subjectMiddleName,
          last_name: formData.subjectLastName,
          address: formData.subjectAddress,
          date_of_birth: formData.subjectDateOfBirth,
          race: formData.subjectRace,
          sex: formData.subjectSex,
          phone: formData.subjectPhone,
          social_security_number: formData.subjectSSN,
          license_number: formData.subjectLicense
        }]),
        organizations: JSON.stringify([{
          business_name: formData.businessName,
          phone: formData.businessPhone,
          address: formData.businessAddress
        }]),
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
        // Subject Information
        subjectFirstName: '',
        subjectMiddleName: '',
        subjectLastName: '',
        subjectAddress: '',
        subjectDateOfBirth: '',
        subjectRace: '',
        subjectSex: '',
        subjectPhone: '',
        subjectSSN: '',
        subjectLicense: '',
        // Organization/Business
        businessName: '',
        businessPhone: '',
        businessAddress: '',
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
                // Subject Information
                subjectFirstName: '',
                subjectMiddleName: '',
                subjectLastName: '',
                subjectAddress: '',
                subjectDateOfBirth: '',
                subjectRace: '',
                subjectSex: '',
                subjectPhone: '',
                subjectSSN: '',
                subjectLicense: '',
                // Organization/Business
                businessName: '',
                businessPhone: '',
                businessAddress: '',
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
          border: '1px solid #2F3336',
          '& .MuiInputLabel-root': { 
            color: '#E7E9EA !important',
            '&.Mui-focused': { color: '#1D9BF0 !important' }
          }, 
          '& .MuiOutlinedInput-root': { 
            color: '#E7E9EA !important',
            backgroundColor: '#1A1A1A',
            '& .MuiOutlinedInput-notchedOutline': { 
              borderColor: '#2F3336',
              '&:hover': { borderColor: '#4A4A4A' }
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: '#1D9BF0'
            }
          },
          '& .MuiSvgIcon-root': { color: '#E7E9EA !important' },
          '& .MuiMenuItem-root': { 
            color: '#E7E9EA !important', 
            backgroundColor: '#1A1A1A',
            '&:hover': { backgroundColor: '#2F3336' }
          },
          '& .MuiFormHelperText-root': { 
            color: '#71767B !important' 
          },
          '& .MuiInputBase-input': { 
            color: '#E7E9EA !important' 
          },
          '& .MuiSelect-select': { 
            color: '#E7E9EA !important' 
          },
          '& .MuiChip-root': { 
            color: '#E7E9EA !important' 
          },
          '& .MuiDivider-root': { 
            borderColor: '#2F3336' 
          },
          '& .MuiTypography-root': { 
            color: '#E7E9EA !important' 
          },
          '& .MuiFormLabel-root': { 
            color: '#E7E9EA !important' 
          },
          '& .MuiInputBase-root': { 
            color: '#E7E9EA !important' 
          },
          '& .MuiSelect-root': { 
            color: '#E7E9EA !important' 
          },
          '& .MuiTextField-root': { 
            '& .MuiInputBase-input': { color: '#E7E9EA !important' },
            '& .MuiInputLabel-root': { color: '#E7E9EA !important' }
          },
          '& .MuiFormControl-root': {
            '& .MuiInputLabel-root': { color: '#E7E9EA !important' },
            '& .MuiInputBase-input': { color: '#E7E9EA !important' }
          },
          '& .MuiInputBase-root': {
            '& .MuiInputBase-input': { color: '#E7E9EA !important' }
          },
          '& .MuiSelect-root': {
            '& .MuiSelect-select': { color: '#E7E9EA !important' }
          },
          '& .MuiInputLabel-shrink': {
            color: '#E7E9EA !important'
          },
          '& .MuiInputLabel-formControl': {
            color: '#E7E9EA !important'
          },
          '& .MuiInputLabel-outlined': {
            color: '#E7E9EA !important'
          }
        }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
          <SecurityIcon sx={{ fontSize: 40, color: '#1D9BF0' }} />
          <Typography variant="h4" component="h1" sx={{ color: '#E7E9EA' }}>
            Intelligence Report
          </Typography>
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
                readOnly: true,
                sx: { 
                  backgroundColor: '#2F3336',
                  color: '#E7E9EA',
                  '& .MuiInputBase-input': { color: '#E7E9EA' }
                }
              }}
              sx={{ 
                mb: 2,
                '& .MuiInputLabel-root': { color: '#E7E9EA !important' },
                '& .MuiFormHelperText-root': { color: '#71767B !important' },
                '& .MuiInputBase-input': { color: '#E7E9EA !important' }
              }}
              helperText="Auto-generated Intel number"
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
        </Box>

        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            label="Case #"
            value={formData.caseNumber}
            onChange={(e) => handleInputChange('caseNumber', e.target.value)}
            helperText="Put the associated case # if applicable"
            sx={{ mb: 2 }}
          />
        </Box>

        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            label="Subject"
            value={formData.subject}
            onChange={(e) => handleInputChange('subject', e.target.value)}
            required
            sx={{ mb: 2 }}
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
            sx={{ mb: 2 }}
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
            sx={{ mb: 2 }}
          />
        </Box>

        {/* Subject Information Section */}
        <Divider sx={{ my: 3 }} />
        <Typography variant="h5" sx={{ mb: 3 }}>Subject Information</Typography>
        
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
          <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
            <TextField
              fullWidth
              label="First Name"
              value={formData.subjectFirstName}
              onChange={(e) => handleInputChange('subjectFirstName', e.target.value)}
              sx={{ mb: 2 }}
            />
          </Box>
          <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
            <TextField
              fullWidth
              label="Middle Name"
              value={formData.subjectMiddleName}
              onChange={(e) => handleInputChange('subjectMiddleName', e.target.value)}
              sx={{ mb: 2 }}
            />
          </Box>
          <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
            <TextField
              fullWidth
              label="Last Name"
              value={formData.subjectLastName}
              onChange={(e) => handleInputChange('subjectLastName', e.target.value)}
              sx={{ mb: 2 }}
            />
          </Box>
        </Box>

        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            label="Address"
            value={formData.subjectAddress}
            onChange={(e) => handleInputChange('subjectAddress', e.target.value)}
            sx={{ mb: 2 }}
          />
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
          <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
            <TextField
              fullWidth
              label="Date of Birth"
              type="date"
              value={formData.subjectDateOfBirth}
              onChange={(e) => handleInputChange('subjectDateOfBirth', e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ mb: 2 }}
            />
          </Box>
          <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Race</InputLabel>
              <Select
                value={formData.subjectRace}
                onChange={(e) => handleInputChange('subjectRace', e.target.value)}
                label="Race"
              >
                {raceOptions.map((race) => (
                  <MenuItem key={race} value={race}>{race}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Sex</InputLabel>
              <Select
                value={formData.subjectSex}
                onChange={(e) => handleInputChange('subjectSex', e.target.value)}
                label="Sex"
              >
                {sexOptions.map((sex) => (
                  <MenuItem key={sex} value={sex}>{sex}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
          <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
            <TextField
              fullWidth
              label="Phone"
              value={formData.subjectPhone}
              onChange={(e) => handleInputChange('subjectPhone', e.target.value)}
              sx={{ mb: 2 }}
            />
          </Box>
          <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
            <TextField
              fullWidth
              label="Social Security Number"
              value={formData.subjectSSN}
              onChange={(e) => handleInputChange('subjectSSN', e.target.value)}
              sx={{ mb: 2 }}
            />
          </Box>
          <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
            <TextField
              fullWidth
              label="License Number & State"
              value={formData.subjectLicense}
              onChange={(e) => handleInputChange('subjectLicense', e.target.value)}
              sx={{ mb: 2 }}
            />
          </Box>
        </Box>

        {/* Organization/Business Section */}
        <Divider sx={{ my: 3 }} />
        <Typography variant="h5" sx={{ mb: 3 }}>Organization/Business Information</Typography>
        
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
          <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
            <TextField
              fullWidth
              label="Business/Organization Name"
              value={formData.businessName}
              onChange={(e) => handleInputChange('businessName', e.target.value)}
              sx={{ mb: 2 }}
            />
          </Box>
          <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
            <TextField
              fullWidth
              label="Phone"
              value={formData.businessPhone}
              onChange={(e) => handleInputChange('businessPhone', e.target.value)}
              sx={{ mb: 2 }}
            />
          </Box>
        </Box>

        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            label="Address"
            value={formData.businessAddress}
            onChange={(e) => handleInputChange('businessAddress', e.target.value)}
            sx={{ mb: 2 }}
          />
        </Box>

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
              sx={{ mb: 2 }}
            />
          </Box>
          <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Source Type</InputLabel>
              <Select
                value={formData.sourceType}
                onChange={(e) => handleInputChange('sourceType', e.target.value)}
                label="Source Type"
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
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Source Rating</InputLabel>
              <Select
                value={formData.sourceRating}
                onChange={(e) => handleInputChange('sourceRating', e.target.value)}
                label="Source Rating"
              >
                {sourceRatingOptions.map((rating) => (
                  <MenuItem key={rating} value={rating}>{rating}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Information Reliability</InputLabel>
              <Select
                value={formData.sourceReliability}
                onChange={(e) => handleInputChange('sourceReliability', e.target.value)}
                label="Information Reliability"
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
              sx={{ mb: 2 }}
            />
          </Box>
          <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
            <TextField
              fullWidth
              label="Middle Name"
              value={formData.sourceMiddleName}
              onChange={(e) => handleInputChange('sourceMiddleName', e.target.value)}
              sx={{ mb: 2 }}
            />
          </Box>
          <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
            <TextField
              fullWidth
              label="Last Name"
              value={formData.sourceLastName}
              onChange={(e) => handleInputChange('sourceLastName', e.target.value)}
              sx={{ mb: 2 }}
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
              sx={{ mb: 2 }}
            />
          </Box>
          <Box sx={{ flex: '1 1 300px', minWidth: '250px' }}>
            <TextField
              fullWidth
              label="Address"
              value={formData.sourceAddress}
              onChange={(e) => handleInputChange('sourceAddress', e.target.value)}
              sx={{ mb: 2 }}
            />
          </Box>
        </Box>

        {/* Review Section */}
        <Divider sx={{ my: 3 }} />
        <Typography variant="h6" sx={{ mb: 2 }}>Review Report</Typography>
        
        {formData.classification && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="textSecondary">Classification:</Typography>
            {getClassificationChip(formData.classification)}
          </Box>
        )}

        <Paper sx={{ p: 2, backgroundColor: 'action.hover', mb: 3 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ flex: '1 1 200px' }}>
              <Typography variant="body2" color="textSecondary">Intel #:</Typography>
              <Typography variant="body1">{formData.intelNumber || 'Not specified'}</Typography>
            </Box>
            <Box sx={{ flex: '1 1 200px' }}>
              <Typography variant="body2" color="textSecondary">Agent:</Typography>
              <Typography variant="body1">{formData.agentName || 'Not specified'}</Typography>
            </Box>
            <Box sx={{ flex: '1 1 200px' }}>
              <Typography variant="body2" color="textSecondary">Date:</Typography>
              <Typography variant="body1">{formData.date || 'Not specified'}</Typography>
            </Box>
            <Box sx={{ flex: '1 1 100%' }}>
              <Typography variant="body2" color="textSecondary">Subject:</Typography>
              <Typography variant="body1">{formData.subject || 'Not specified'}</Typography>
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