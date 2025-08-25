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

const IntelReportFormSimple: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    intelNumber: '',
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

  if (success) {
    return (
      <Box sx={{ maxWidth: 800, mx: 'auto', p: 3, backgroundColor: 'background.default', minHeight: '100vh' }}>
        <Paper sx={{ p: 4, textAlign: 'center', backgroundColor: 'background.paper' }}>
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
              // Reset form data
              setFormData({
                intelNumber: '',
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
          >
            Create New Report
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      maxWidth: 1200, 
      mx: 'auto', 
      p: { xs: 2, md: 3 },
      backgroundColor: 'background.default',
      minHeight: '100vh'
    }}>
      <Paper sx={{ p: { xs: 2, md: 4 }, backgroundColor: 'background.paper' }}>
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

        {/* Basic Information */}
        <Typography variant="h5" sx={{ mb: 3 }}>Basic Information</Typography>
        
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
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
            disabled={loading || !formData.intelNumber || !formData.classification || !formData.agentName || !formData.subject}
            startIcon={loading ? <CircularProgress size={16} /> : null}
            sx={{ px: 6, py: 2 }}
          >
            {loading ? 'Submitting...' : 'Submit Report'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default IntelReportFormSimple;