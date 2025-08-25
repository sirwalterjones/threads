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
    summary: ''
  });

  const classificationOptions = [
    { value: 'Sensitive', label: 'Sensitive', color: '#ff9800' },
    { value: 'Narcotics Only', label: 'Narcotics Only', color: '#e91e63' },
    { value: 'Classified', label: 'Classified', color: '#f44336' },
    { value: 'Law Enforcement Only', label: 'Law Enforcement Only', color: '#3f51b5' }
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
              // Reset form data
              setFormData({
                intelNumber: '',
                classification: '',
                date: new Date().toISOString().split('T')[0],
                agentName: '',
                caseNumber: '',
                subject: '',
                criminalActivity: '',
                summary: ''
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

        {/* Review Section */}
        <Divider sx={{ my: 3 }} />
        <Typography variant="h6" sx={{ mb: 2 }}>Review Report</Typography>
        
        {formData.classification && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="textSecondary">Classification:</Typography>
            {getClassificationChip(formData.classification)}
          </Box>
        )}

        <Paper sx={{ p: 2, backgroundColor: '#f5f5f5', mb: 3 }}>
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