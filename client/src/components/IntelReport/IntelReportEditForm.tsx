import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';

interface Subject {
  id?: number;
  first_name: string;
  middle_name: string;
  last_name: string;
  date_of_birth: string;
  race: string;
  sex: string;
  phone: string;
  address: string;
  license_number: string;
  social_security_number: string;
}

interface Organization {
  id?: number;
  business_name: string;
  phone: string;
  address: string;
}

interface Source {
  id?: number;
  source_id: string;
  source: string;
  rating: string;
  information_reliable: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  phone: string;
  address: string;
  unknown_caller: boolean;
  ci_cs: boolean;
}

interface IntelReport {
  id: string;
  intelNumber: string;
  classification: string;
  date: string;
  agentName: string;
  agent_id?: number;
  caseNumber?: string;
  subject: string;
  criminalActivity: string;
  summary: string;
  status: 'pending' | 'approved' | 'rejected';
  subjectsData?: Subject[];
  organizationsData?: Organization[];
  sourcesData?: Source[];
}

interface IntelReportEditFormProps {
  report: IntelReport;
  open: boolean;
  onClose: () => void;
  onSave: (updatedReport: IntelReport) => void;
}

const IntelReportEditForm: React.FC<IntelReportEditFormProps> = ({
  report,
  open,
  onClose,
  onSave
}) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState<IntelReport>(report);
  const [subjects, setSubjects] = useState<Subject[]>(report.subjectsData || []);
  const [organizations, setOrganizations] = useState<Organization[]>(report.organizationsData || []);
  const [sources, setSources] = useState<Source[]>(report.sourcesData || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && report) {
      setFormData(report);
      setSubjects(report.subjectsData || []);
      setOrganizations(report.organizationsData || []);
      setSources(report.sourcesData || []);
    }
  }, [open, report]);

  const handleBasicInfoChange = (field: keyof IntelReport, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addSubject = () => {
    const newSubject: Subject = {
      first_name: '',
      middle_name: '',
      last_name: '',
      date_of_birth: '',
      race: '',
      sex: '',
      phone: '',
      address: '',
      license_number: '',
      social_security_number: ''
    };
    setSubjects(prev => [...prev, newSubject]);
  };

  const updateSubject = (index: number, field: keyof Subject, value: string | boolean) => {
    setSubjects(prev => prev.map((subject, i) => 
      i === index ? { ...subject, [field]: value } : subject
    ));
  };

  const removeSubject = (index: number) => {
    setSubjects(prev => prev.filter((_, i) => i !== index));
  };

  const addOrganization = () => {
    const newOrg: Organization = {
      business_name: '',
      phone: '',
      address: ''
    };
    setOrganizations(prev => [...prev, newOrg]);
  };

  const updateOrganization = (index: number, field: keyof Organization, value: string) => {
    setOrganizations(prev => prev.map((org, i) => 
      i === index ? { ...org, [field]: value } : org
    ));
  };

  const removeOrganization = (index: number) => {
    setOrganizations(prev => prev.filter((_, i) => i !== index));
  };

  const addSource = () => {
    const newSource: Source = {
      source_id: '',
      source: '',
      rating: '',
      information_reliable: '',
      first_name: '',
      middle_name: '',
      last_name: '',
      phone: '',
      address: '',
      unknown_caller: false,
      ci_cs: false
    };
    setSources(prev => [...prev, newSource]);
  };

  const updateSource = (index: number, field: keyof Source, value: string | boolean) => {
    setSources(prev => prev.map((source, i) => 
      i === index ? { ...source, [field]: value } : source
    ));
  };

  const removeSource = (index: number) => {
    setSources(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Prepare the updated report data
      const updatedReport = {
        ...formData,
        subjectsData: subjects,
        organizationsData: organizations,
        sourcesData: sources
      };

      // Call the API to update the report
      const response = await fetch(`/api/intel-reports/${report.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          subject: formData.subject,
          criminal_activity: formData.criminalActivity,
          summary: formData.summary,
          case_number: formData.caseNumber,
          classification: formData.classification,
          date: formData.date,
          subjects: subjects,
          organizations: organizations,
          sources: sources
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update report');
      }

      const result = await response.json();
      console.log('Report updated successfully:', result);

      // Call the onSave callback with the updated report
      onSave(updatedReport);
      onClose();
    } catch (error) {
      console.error('Error updating report:', error);
      setError(error instanceof Error ? error.message : 'Failed to update report');
    } finally {
      setLoading(false);
    }
  };

  const canEdit = (user?.id === report.agent_id || user?.role === 'admin' || user?.super_admin) && 
                  report.status !== 'approved';

  if (!canEdit) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ backgroundColor: '#1f1f1f', color: '#E7E9EA' }}>
          Access Denied
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: '#1f1f1f', color: '#E7E9EA' }}>
          <Typography>
            You do not have permission to edit this report. Only the author or an admin can edit reports, and approved reports cannot be modified.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#1f1f1f' }}>
          <Button onClick={onClose} sx={{ color: '#1D9BF0' }}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="xl" 
      fullWidth 
      fullScreen
      PaperProps={{
        sx: {
          backgroundColor: '#1f1f1f',
          color: '#E7E9EA'
        }
      }}
    >
      <DialogTitle sx={{ backgroundColor: '#1f1f1f', color: '#E7E9EA', borderBottom: '1px solid #2F3336' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ color: '#E7E9EA' }}>
            Edit Intel Report #{report.intelNumber}
          </Typography>
          <IconButton onClick={() => onClose()} sx={{ color: '#E7E9EA' }}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ backgroundColor: '#1f1f1f', color: '#E7E9EA', p: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3, backgroundColor: '#2a2a2a', color: '#f44336' }}>
            {error}
          </Alert>
        )}

        {/* Basic Information */}
        <Paper sx={{ p: 3, mb: 3, backgroundColor: '#2a2a2a', border: '1px solid #3a3a3a' }}>
          <Typography variant="h6" sx={{ color: '#E7E9EA', mb: 3, borderBottom: '1px solid #2F3336', pb: 1 }}>
            Basic Information
          </Typography>
          
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 3 }}>
            <Box>
              <TextField
                fullWidth
                label="Subject"
                value={formData.subject}
                onChange={(e) => handleBasicInfoChange('subject', e.target.value)}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#1A1A1A',
                    '& .MuiInputBase-input': { color: '#E7E9EA' },
                    '& .MuiInputBase-notchedOutline': { borderColor: '#3a3a3a' },
                    '&:hover .MuiInputBase-notchedOutline': { borderColor: '#1D9BF0' },
                    '&.Mui-focused .MuiInputBase-notchedOutline': { borderColor: '#1D9BF0' }
                  },
                  '& .MuiInputLabel-root': { color: '#E7E9EA' }
                }}
              />
            </Box>
            <Box>
              <TextField
                fullWidth
                label="Case Number"
                value={formData.caseNumber || ''}
                onChange={(e) => handleBasicInfoChange('caseNumber', e.target.value)}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#1A1A1A',
                    '& .MuiInputBase-input': { color: '#E7E9EA' },
                    '& .MuiInputBase-notchedOutline': { borderColor: '#3a3a3a' },
                    '&:hover .MuiInputBase-notchedOutline': { borderColor: '#1D9BF0' },
                    '&.Mui-focused .MuiInputBase-notchedOutline': { borderColor: '#1D9BF0' }
                  },
                  '& .MuiInputLabel-root': { color: '#E7E9EA' }
                }}
              />
            </Box>
            <Box>
              <FormControl fullWidth>
                <InputLabel sx={{ color: '#E7E9EA' }}>Classification</InputLabel>
                <Select
                  value={formData.classification}
                  onChange={(e) => handleBasicInfoChange('classification', e.target.value)}
                  sx={{
                    backgroundColor: '#1A1A1A',
                    color: '#E7E9EA',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#3a3a3a' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#1D9BF0' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1D9BF0' }
                  }}
                >
                  <MenuItem value="Sensitive" sx={{ color: '#E7E9EA', bgcolor: '#1A1A1A' }}>Sensitive</MenuItem>
                  <MenuItem value="Narcotics Only" sx={{ color: '#E7E9EA', bgcolor: '#1A1A1A' }}>Narcotics Only</MenuItem>
                  <MenuItem value="Classified" sx={{ color: '#E7E9EA', bgcolor: '#1A1A1A' }}>Classified</MenuItem>
                  <MenuItem value="Law Enforcement Only" sx={{ color: '#E7E9EA', bgcolor: '#1A1A1A' }}>Law Enforcement Only</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Box>
              <TextField
                fullWidth
                label="Date"
                type="date"
                value={formData.date}
                onChange={(e) => handleBasicInfoChange('date', e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#1A1A1A',
                    '& .MuiInputBase-input': { color: '#E7E9EA' },
                    '& .MuiInputBase-notchedOutline': { borderColor: '#3a3a3a' },
                    '&:hover .MuiInputBase-notchedOutline': { borderColor: '#1D9BF0' },
                    '&.Mui-focused .MuiInputBase-notchedOutline': { borderColor: '#1D9BF0' }
                  },
                  '& .MuiInputLabel-root': { color: '#E7E9EA' }
                }}
              />
            </Box>
            <Box sx={{ gridColumn: '1 / -1' }}>
              <TextField
                fullWidth
                label="Criminal Activity"
                multiline
                rows={3}
                value={formData.criminalActivity}
                onChange={(e) => handleBasicInfoChange('criminalActivity', e.target.value)}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#1A1A1A',
                    '& .MuiInputBase-input': { color: '#E7E9EA' },
                    '& .MuiInputBase-notchedOutline': { borderColor: '#3a3a3a' },
                    '&:hover .MuiInputBase-notchedOutline': { borderColor: '#1D9BF0' },
                    '&.Mui-focused .MuiInputBase-notchedOutline': { borderColor: '#1D9BF0' }
                  },
                  '& .MuiInputLabel-root': { color: '#E7E9EA' }
                }}
              />
            </Box>
            <Box sx={{ gridColumn: '1 / -1' }}>
              <TextField
                fullWidth
                label="Summary"
                multiline
                rows={4}
                value={formData.summary}
                onChange={(e) => handleBasicInfoChange('summary', e.target.value)}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#1A1A1A',
                    '& .MuiInputBase-input': { color: '#E7E9EA' },
                    '& .MuiInputBase-notchedOutline': { borderColor: '#3a3a3a' },
                    '&:hover .MuiInputBase-notchedOutline': { borderColor: '#1D9BF0' },
                    '&.Mui-focused .MuiInputBase-notchedOutline': { borderColor: '#1D9BF0' }
                  },
                  '& .MuiInputLabel-root': { color: '#E7E9EA' }
                }}
              />
            </Box>
          </Box>
        </Paper>

        {/* Subjects */}
        <Paper sx={{ p: 3, mb: 3, backgroundColor: '#2a2a2a', border: '1px solid #3a3a3a' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" sx={{ color: '#E7E9EA', borderBottom: '1px solid #2F3336', pb: 1 }}>
              Subjects ({subjects.length})
            </Typography>
            <Button
              startIcon={<AddIcon />}
              onClick={addSubject}
              sx={{
                backgroundColor: '#1D9BF0',
                color: '#ffffff',
                '&:hover': { backgroundColor: '#1a8cd8' }
              }}
            >
              Add Subject
            </Button>
          </Box>

          {subjects.map((subject, index) => (
            <Box key={index} sx={{ mb: 3, p: 2, backgroundColor: '#1A1A1A', border: '1px solid #3a3a3a', borderRadius: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ color: '#1D9BF0' }}>
                  Subject {index + 1}
                </Typography>
                <IconButton
                  onClick={() => removeSubject(index)}
                  sx={{ color: '#f44336' }}
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
              
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 2 }}>
                <Box>
                  <TextField
                    fullWidth
                    label="First Name"
                    value={subject.first_name}
                    onChange={(e) => updateSubject(index, 'first_name', e.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#2a2a2a',
                        '& .MuiInputBase-input': { color: '#E7E9EA' },
                        '& .MuiInputBase-notchedOutline': { borderColor: '#3a3a3a' }
                      },
                      '& .MuiInputLabel-root': { color: '#E7E9EA' }
                    }}
                  />
                </Box>
                <Box>
                  <TextField
                    fullWidth
                    label="Middle Name"
                    value={subject.middle_name}
                    onChange={(e) => updateSubject(index, 'middle_name', e.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#2a2a2a',
                        '& .MuiInputBase-input': { color: '#E7E9EA' },
                        '& .MuiInputBase-notchedOutline': { borderColor: '#3a3a3a' }
                      },
                      '& .MuiInputLabel-root': { color: '#E7E9EA' }
                    }}
                  />
                </Box>
                <Box>
                  <TextField
                    fullWidth
                    label="Last Name"
                    value={subject.last_name}
                    onChange={(e) => updateSubject(index, 'last_name', e.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#2a2a2a',
                        '& .MuiInputBase-input': { color: '#E7E9EA' },
                        '& .MuiInputBase-notchedOutline': { borderColor: '#3a3a3a' }
                      },
                      '& .MuiInputLabel-root': { color: '#E7E9EA' }
                    }}
                  />
                </Box>
                <Box>
                  <TextField
                    fullWidth
                    label="Date of Birth"
                    type="date"
                    value={subject.date_of_birth}
                    onChange={(e) => updateSubject(index, 'date_of_birth', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#2a2a2a',
                        '& .MuiInputBase-input': { color: '#E7E9EA' },
                        '& .MuiInputBase-notchedOutline': { borderColor: '#3a3a3a' }
                      },
                      '& .MuiInputLabel-root': { color: '#E7E9EA' }
                    }}
                  />
                </Box>
                <Box>
                  <TextField
                    fullWidth
                    label="Phone"
                    value={subject.phone}
                    onChange={(e) => updateSubject(index, 'phone', e.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#2a2a2a',
                        '& .MuiInputBase-input': { color: '#E7E9EA' },
                        '& .MuiInputBase-notchedOutline': { borderColor: '#3a3a3a' }
                      },
                      '& .MuiInputLabel-root': { color: '#E7E9EA' }
                    }}
                  />
                </Box>
                <Box>
                  <TextField
                    fullWidth
                    label="Race"
                    value={subject.race}
                    onChange={(e) => updateSubject(index, 'race', e.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#2a2a2a',
                        '& .MuiInputBase-input': { color: '#E7E9EA' },
                        '& .MuiInputBase-notchedOutline': { borderColor: '#3a3a3a' }
                      },
                      '& .MuiInputLabel-root': { color: '#E7E9EA' }
                    }}
                  />
                </Box>
                <Box>
                  <TextField
                    fullWidth
                    label="Sex"
                    value={subject.sex}
                    onChange={(e) => updateSubject(index, 'sex', e.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#2a2a2a',
                        '& .MuiInputBase-input': { color: '#E7E9EA' },
                        '& .MuiInputBase-notchedOutline': { borderColor: '#3a3a3a' }
                      },
                      '& .MuiInputLabel-root': { color: '#E7E9EA' }
                    }}
                  />
                </Box>
                <Box sx={{ gridColumn: '1 / -1' }}>
                  <TextField
                    fullWidth
                    label="Address"
                    value={subject.address}
                    onChange={(e) => updateSubject(index, 'address', e.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#2a2a2a',
                        '& .MuiInputBase-input': { color: '#E7E9EA' },
                        '& .MuiInputBase-notchedOutline': { borderColor: '#3a3a3a' }
                      },
                      '& .MuiInputLabel-root': { color: '#E7E9EA' }
                    }}
                  />
                </Box>
                <Box>
                  <TextField
                    fullWidth
                    label="License Number"
                    value={subject.license_number}
                    onChange={(e) => updateSubject(index, 'license_number', e.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#2a2a2a',
                        '& .MuiInputBase-input': { color: '#E7E9EA' },
                        '& .MuiInputBase-notchedOutline': { borderColor: '#3a3a3a' }
                      },
                      '& .MuiInputLabel-root': { color: '#E7E9EA' }
                    }}
                  />
                </Box>
                <Box>
                  <TextField
                    fullWidth
                    label="Social Security Number"
                    value={subject.social_security_number}
                    onChange={(e) => updateSubject(index, 'social_security_number', e.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#2a2a2a',
                        '& .MuiInputBase-input': { color: '#E7E9EA' },
                        '& .MuiInputBase-notchedOutline': { borderColor: '#3a3a3a' }
                      },
                      '& .MuiInputLabel-root': { color: '#E7E9EA' }
                    }}
                  />
                </Box>
              </Box>
            </Box>
          ))}
        </Paper>

        {/* Organizations */}
        <Paper sx={{ p: 3, mb: 3, backgroundColor: '#2a2a2a', border: '1px solid #3a3a3a' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" sx={{ color: '#E7E9EA', borderBottom: '1px solid #2F3336', pb: 1 }}>
              Organizations ({organizations.length})
            </Typography>
            <Button
              startIcon={<AddIcon />}
              onClick={addOrganization}
              sx={{
                backgroundColor: '#1D9BF0',
                color: '#ffffff',
                '&:hover': { backgroundColor: '#1a8cd8' }
              }}
            >
              Add Organization
            </Button>
          </Box>

          {organizations.map((org, index) => (
            <Box key={index} sx={{ mb: 3, p: 2, backgroundColor: '#1A1A1A', border: '1px solid #3a3a3a', borderRadius: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ color: '#1D9BF0' }}>
                  Organization {index + 1}
                </Typography>
                <IconButton
                  onClick={() => removeOrganization(index)}
                  sx={{ color: '#f44336' }}
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
              
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 2 }}>
                <Box>
                  <TextField
                    fullWidth
                    label="Business Name"
                    value={org.business_name}
                    onChange={(e) => updateOrganization(index, 'business_name', e.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#2a2a2a',
                        '& .MuiInputBase-input': { color: '#E7E9EA' },
                        '& .MuiInputBase-notchedOutline': { borderColor: '#3a3a3a' }
                      },
                      '& .MuiInputLabel-root': { color: '#E7E9EA' }
                    }}
                  />
                </Box>
                <Box>
                  <TextField
                    fullWidth
                    label="Phone"
                    value={org.phone}
                    onChange={(e) => updateOrganization(index, 'phone', e.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#2a2a2a',
                        '& .MuiInputBase-input': { color: '#E7E9EA' },
                        '& .MuiInputBase-notchedOutline': { borderColor: '#3a3a3a' }
                      },
                      '& .MuiInputLabel-root': { color: '#E7E9EA' }
                    }}
                  />
                </Box>
                <Box sx={{ gridColumn: '1 / -1' }}>
                  <TextField
                    fullWidth
                    label="Address"
                    value={org.address}
                    onChange={(e) => updateOrganization(index, 'address', e.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#2a2a2a',
                        '& .MuiInputBase-input': { color: '#E7E9EA' },
                        '& .MuiInputBase-notchedOutline': { borderColor: '#3a3a3a' }
                      },
                      '& .MuiInputLabel-root': { color: '#E7E9EA' }
                    }}
                  />
                </Box>
              </Box>
            </Box>
          ))}
        </Paper>

        {/* Sources */}
        <Paper sx={{ p: 3, mb: 3, backgroundColor: '#2a2a2a', border: '1px solid #3a3a3a' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" sx={{ color: '#E7E9EA', borderBottom: '1px solid #2F3336', pb: 1 }}>
              Source Information ({sources.length})
            </Typography>
            <Button
              startIcon={<AddIcon />}
              onClick={addSource}
              sx={{
                backgroundColor: '#1D9BF0',
                color: '#ffffff',
                '&:hover': { backgroundColor: '#1a8cd8' }
              }}
            >
              Add Source
            </Button>
          </Box>

          {sources.map((source, index) => (
            <Box key={index} sx={{ mb: 3, p: 2, backgroundColor: '#1A1A1A', border: '1px solid #3a3a3a', borderRadius: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ color: '#1D9BF0' }}>
                  Source {index + 1}
                </Typography>
                <IconButton
                  onClick={() => removeSource(index)}
                  sx={{ color: '#f44336' }}
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
              
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 2 }}>
                <Box>
                  <TextField
                    fullWidth
                    label="Source ID"
                    value={source.source_id}
                    onChange={(e) => updateSource(index, 'source_id', e.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#2a2a2a',
                        '& .MuiInputBase-input': { color: '#E7E9EA' },
                        '& .MuiInputBase-notchedOutline': { borderColor: '#3a3a3a' }
                      },
                      '& .MuiInputLabel-root': { color: '#E7E9EA' }
                    }}
                  />
                </Box>
                <Box>
                  <TextField
                    fullWidth
                    label="Source Type"
                    value={source.source}
                    onChange={(e) => updateSource(index, 'source', e.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#2a2a2a',
                        '& .MuiInputBase-input': { color: '#E7E9EA' },
                        '& .MuiInputBase-notchedOutline': { borderColor: '#3a3a3a' }
                      },
                      '& .MuiInputLabel-root': { color: '#E7E9EA' }
                    }}
                  />
                </Box>
                <Box>
                  <TextField
                    fullWidth
                    label="Rating"
                    value={source.rating}
                    onChange={(e) => updateSource(index, 'rating', e.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#2a2a2a',
                        '& .MuiInputBase-input': { color: '#E7E9EA' },
                        '& .MuiInputBase-notchedOutline': { borderColor: '#3a3a3a' }
                      },
                      '& .MuiInputLabel-root': { color: '#E7E9EA' }
                    }}
                  />
                </Box>
                <Box>
                  <TextField
                    fullWidth
                    label="Information Reliable"
                    value={source.information_reliable}
                    onChange={(e) => updateSource(index, 'information_reliable', e.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#2a2a2a',
                        '& .MuiInputBase-input': { color: '#E7E9EA' },
                        '& .MuiInputBase-notchedOutline': { borderColor: '#3a3a3a' }
                      },
                      '& .MuiInputLabel-root': { color: '#E7E9EA' }
                    }}
                  />
                </Box>
                <Box>
                  <TextField
                    fullWidth
                    label="First Name"
                    value={source.first_name}
                    onChange={(e) => updateSource(index, 'first_name', e.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#2a2a2a',
                        '& .MuiInputBase-input': { color: '#E7E9EA' },
                        '& .MuiInputBase-notchedOutline': { borderColor: '#3a3a3a' }
                      },
                      '& .MuiInputLabel-root': { color: '#E7E9EA' }
                    }}
                  />
                </Box>
                <Box>
                  <TextField
                    fullWidth
                    label="Middle Name"
                    value={source.middle_name}
                    onChange={(e) => updateSource(index, 'middle_name', e.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#2a2a2a',
                        '& .MuiInputBase-input': { color: '#E7E9EA' },
                        '& .MuiInputBase-notchedOutline': { borderColor: '#3a3a3a' }
                      },
                      '& .MuiInputLabel-root': { color: '#E7E9EA' }
                    }}
                  />
                </Box>
                <Box>
                  <TextField
                    fullWidth
                    label="Last Name"
                    value={source.last_name}
                    onChange={(e) => updateSource(index, 'last_name', e.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#2a2a2a',
                        '& .MuiInputBase-input': { color: '#E7E9EA' },
                        '& .MuiInputBase-notchedOutline': { borderColor: '#3a3a3a' }
                      },
                      '& .MuiInputLabel-root': { color: '#E7E9EA' }
                    }}
                  />
                </Box>
                <Box>
                  <TextField
                    fullWidth
                    label="Phone"
                    value={source.phone}
                    onChange={(e) => updateSource(index, 'phone', e.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#2a2a2a',
                        '& .MuiInputBase-input': { color: '#E7E9EA' },
                        '& .MuiInputBase-notchedOutline': { borderColor: '#3a3a3a' }
                      },
                      '& .MuiInputLabel-root': { color: '#E7E9EA' }
                    }}
                  />
                </Box>
                <Box sx={{ gridColumn: '1 / -1' }}>
                  <TextField
                    fullWidth
                    label="Address"
                    value={source.address}
                    onChange={(e) => updateSource(index, 'address', e.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#2a2a2a',
                        '& .MuiInputBase-input': { color: '#E7E9EA' },
                        '& .MuiInputBase-notchedOutline': { borderColor: '#3a3a3a' }
                      },
                      '& .MuiInputLabel-root': { color: '#E7E9EA' }
                    }}
                  />
                </Box>
                <Box sx={{ gridColumn: '1 / -1' }}>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Chip
                      label="Unknown Caller"
                      color={source.unknown_caller ? "warning" : "default"}
                      onClick={() => updateSource(index, 'unknown_caller', !source.unknown_caller)}
                      sx={{ cursor: 'pointer' }}
                    />
                    <Chip
                      label="CI/CS"
                      color={source.ci_cs ? "info" : "default"}
                      onClick={() => updateSource(index, 'ci_cs', !source.ci_cs)}
                      sx={{ cursor: 'pointer' }}
                    />
                  </Box>
                </Box>
              </Box>
            </Box>
          ))}
        </Paper>
      </DialogContent>

      <DialogActions sx={{ backgroundColor: '#1f1f1f', borderTop: '1px solid #2F3336', p: 2 }}>
        <Button 
          onClick={onClose} 
          sx={{ color: '#71767B' }}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          startIcon={<SaveIcon />}
          disabled={loading}
          sx={{
            backgroundColor: '#1D9BF0',
            color: '#ffffff',
            '&:hover': { backgroundColor: '#1a8cd8' },
            '&:disabled': { backgroundColor: '#71767B' }
          }}
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default IntelReportEditForm;
