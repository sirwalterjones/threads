import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Divider,
  List,
  ListItem,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
} from '@mui/material';
import {
  Close as CloseIcon,
  Security,
  AssignmentInd,
  DateRange,
  Badge,
  Business,
  Person
} from '@mui/icons-material';
import { format } from 'date-fns';
import apiService from '../services/api';

interface IntelReport {
  id: number;
  intel_number: string;
  classification: string;
  date: string;
  agent_id: number;
  agent_name: string;
  case_number?: string;
  subject: string;
  criminal_activity?: string;
  summary: string;
  status: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
  reviewed_by?: number;
  reviewed_by_name?: string;
  reviewed_at?: string;
  review_comments?: string;
  subjects?: Array<{
    first_name?: string;
    middle_name?: string;
    last_name?: string;
    address?: string;
    date_of_birth?: string;
    race?: string;
    sex?: string;
    phone?: string;
    social_security_number?: string;
    license_number?: string;
  }>;
  organizations?: Array<{
    business_name: string;
    phone?: string;
    address?: string;
  }>;
  sources?: Array<{
    source_id?: string;
    rating?: string;
    source?: string;
    information_reliable?: boolean;
    unknown_caller?: boolean;
    ci_cs?: string;
    first_name?: string;
    middle_name?: string;
    last_name?: string;
    phone?: string;
    address?: string;
  }>;
}

interface IntelReportDetailModalProps {
  open: boolean;
  onClose: () => void;
  reportId: number | null;
}

const IntelReportDetailModal: React.FC<IntelReportDetailModalProps> = ({ open, onClose, reportId }) => {
  const [report, setReport] = useState<IntelReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchReport = async (id: number) => {
    setLoading(true);
    setError('');
    try {
      const response = await apiService.get(`/intel-reports/${id}`);
      setReport(response.data.report);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to load intel report details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && reportId) {
      fetchReport(reportId);
    }
  }, [open, reportId]);

  const handleClose = () => {
    setReport(null);
    setError('');
    onClose();
  };

  const getClassificationColor = (classification?: string) => {
    if (!classification) return '#10b981';
    switch (classification.toLowerCase()) {
      case 'classified':
        return '#ef4444'; // Red
      case 'confidential':
        return '#f59e0b'; // Orange
      case 'restricted':
        return '#eab308'; // Yellow
      default:
        return '#10b981'; // Green
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return '#10b981'; // Green
      case 'rejected':
        return '#ef4444'; // Red
      case 'pending':
        return '#f59e0b'; // Orange
      default:
        return '#6b7280'; // Gray
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: '#16181C',
          border: '3px solid #f97316',
          borderRadius: 3,
          maxHeight: '90vh'
        }
      }}
    >
      <DialogTitle
        sx={{
          backgroundColor: '#0F1115',
          borderBottom: '1px solid #2F3336',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          py: 2
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Security sx={{ color: '#f97316', fontSize: 28 }} />
          <Box>
            <Typography variant="h6" sx={{ color: '#E7E9EA', fontWeight: 600 }}>
              Intel Report Details
            </Typography>
            {report && (
              <Typography variant="body2" sx={{ color: '#71767B' }}>
                {report.intel_number}
              </Typography>
            )}
          </Box>
        </Box>
        <IconButton onClick={handleClose} sx={{ color: '#71767B' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ backgroundColor: '#16181C', p: 3 }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress sx={{ color: '#f97316' }} />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2, backgroundColor: '#2D1B1B', color: '#F87171' }}>
            {error}
          </Alert>
        )}

        {report && (
          <Box sx={{ color: '#E7E9EA' }}>
            {/* Header Information */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                <Chip
                  icon={<Security />}
                  label={report.classification}
                  sx={{
                    backgroundColor: getClassificationColor(report.classification),
                    color: 'white',
                    fontWeight: 600
                  }}
                />
                <Chip
                  icon={<Badge />}
                  label={report.status.toUpperCase()}
                  sx={{
                    backgroundColor: getStatusColor(report.status),
                    color: 'white',
                    fontWeight: 600
                  }}
                />
                {report.case_number && (
                  <Chip
                    label={`Case: ${report.case_number}`}
                    variant="outlined"
                    sx={{
                      borderColor: '#2F3336',
                      color: '#E7E9EA'
                    }}
                  />
                )}
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 4, mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AssignmentInd sx={{ color: '#71767B', fontSize: 16 }} />
                  <Typography variant="body2" sx={{ color: '#71767B' }}>
                    Agent: {report.agent_name}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <DateRange sx={{ color: '#71767B', fontSize: 16 }} />
                  <Typography variant="body2" sx={{ color: '#71767B' }}>
                    Date: {format(new Date(report.date), 'MMM dd, yyyy')}
                  </Typography>
                </Box>
              </Box>

              {report.expires_at && (
                <Typography variant="body2" sx={{ color: '#F59E0B', fontWeight: 500 }}>
                  Expires: {format(new Date(report.expires_at), 'MMM dd, yyyy')}
                </Typography>
              )}
            </Box>

            <Divider sx={{ borderColor: '#2F3336', my: 3 }} />

            {/* Subject */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ color: '#E7E9EA', mb: 1, fontWeight: 600 }}>
                Subject
              </Typography>
              <Typography variant="body1" sx={{ color: '#E7E9EA', lineHeight: 1.6 }}>
                {report.subject}
              </Typography>
            </Box>

            {/* Criminal Activity */}
            {report.criminal_activity && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ color: '#E7E9EA', mb: 1, fontWeight: 600 }}>
                  Criminal Activity
                </Typography>
                <Typography variant="body1" sx={{ color: '#E7E9EA', lineHeight: 1.6 }}>
                  {report.criminal_activity}
                </Typography>
              </Box>
            )}

            {/* Summary */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ color: '#E7E9EA', mb: 1, fontWeight: 600 }}>
                Summary
              </Typography>
              <Typography variant="body1" sx={{ color: '#E7E9EA', lineHeight: 1.6 }}>
                {report.summary}
              </Typography>
            </Box>

            {/* Subjects */}
            {report.subjects && report.subjects.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ color: '#E7E9EA', mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Person sx={{ fontSize: 20 }} />
                  Subjects ({report.subjects.length})
                </Typography>
                <TableContainer component={Paper} sx={{ backgroundColor: '#0F1115', border: '1px solid #2F3336' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ color: '#71767B', fontWeight: 600 }}>Name</TableCell>
                        <TableCell sx={{ color: '#71767B', fontWeight: 600 }}>DOB</TableCell>
                        <TableCell sx={{ color: '#71767B', fontWeight: 600 }}>Race/Sex</TableCell>
                        <TableCell sx={{ color: '#71767B', fontWeight: 600 }}>Phone</TableCell>
                        <TableCell sx={{ color: '#71767B', fontWeight: 600 }}>Address</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {report.subjects.map((subject, index) => (
                        <TableRow key={index}>
                          <TableCell sx={{ color: '#E7E9EA' }}>
                            {[subject.first_name, subject.middle_name, subject.last_name].filter(Boolean).join(' ') || 'N/A'}
                          </TableCell>
                          <TableCell sx={{ color: '#E7E9EA' }}>
                            {subject.date_of_birth ? format(new Date(subject.date_of_birth), 'MM/dd/yyyy') : 'N/A'}
                          </TableCell>
                          <TableCell sx={{ color: '#E7E9EA' }}>
                            {[subject.race, subject.sex].filter(Boolean).join('/') || 'N/A'}
                          </TableCell>
                          <TableCell sx={{ color: '#E7E9EA' }}>
                            {subject.phone || 'N/A'}
                          </TableCell>
                          <TableCell sx={{ color: '#E7E9EA' }}>
                            {subject.address || 'N/A'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}

            {/* Organizations */}
            {report.organizations && report.organizations.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ color: '#E7E9EA', mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Business sx={{ fontSize: 20 }} />
                  Organizations ({report.organizations.length})
                </Typography>
                <List sx={{ backgroundColor: '#0F1115', border: '1px solid #2F3336', borderRadius: 1 }}>
                  {report.organizations.map((org, index) => (
                    <ListItem key={index} divider={index < report.organizations!.length - 1}>
                      <ListItemText
                        primary={org.business_name}
                        secondary={
                          <Box>
                            {org.phone && <Typography variant="body2" sx={{ color: '#71767B' }}>Phone: {org.phone}</Typography>}
                            {org.address && <Typography variant="body2" sx={{ color: '#71767B' }}>Address: {org.address}</Typography>}
                          </Box>
                        }
                        primaryTypographyProps={{ color: '#E7E9EA', fontWeight: 500 }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            {/* Review Information */}
            {report.reviewed_by_name && (
              <Box sx={{ mt: 4, p: 2, backgroundColor: '#0F1115', border: '1px solid #2F3336', borderRadius: 1 }}>
                <Typography variant="h6" sx={{ color: '#E7E9EA', mb: 1, fontWeight: 600 }}>
                  Review Information
                </Typography>
                <Typography variant="body2" sx={{ color: '#71767B', mb: 1 }}>
                  Reviewed by: {report.reviewed_by_name}
                </Typography>
                {report.reviewed_at && (
                  <Typography variant="body2" sx={{ color: '#71767B', mb: 1 }}>
                    Review Date: {format(new Date(report.reviewed_at), 'MMM dd, yyyy HH:mm')}
                  </Typography>
                )}
                {report.review_comments && (
                  <Typography variant="body2" sx={{ color: '#E7E9EA', mt: 1 }}>
                    Comments: {report.review_comments}
                  </Typography>
                )}
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ backgroundColor: '#0F1115', borderTop: '1px solid #2F3336', p: 2 }}>
        <Button 
          onClick={handleClose} 
          sx={{ 
            color: '#E7E9EA',
            borderColor: '#2F3336',
            '&:hover': {
              borderColor: '#f97316',
              backgroundColor: 'rgba(249, 115, 22, 0.1)'
            }
          }}
          variant="outlined"
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default IntelReportDetailModal;