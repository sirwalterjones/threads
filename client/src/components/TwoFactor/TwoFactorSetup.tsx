import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Paper,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { QrCode, Smartphone, Security, CheckCircle, Shield, Download } from '@mui/icons-material';
import apiService from '../../services/api';
import auditService from '../../services/auditService';

interface TwoFactorSetupProps {
  onComplete: () => void;
  onCancel?: () => void;
}

const TwoFactorSetup: React.FC<TwoFactorSetupProps> = ({ onComplete, onCancel }) => {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [backupCodesDialogOpen, setBackupCodesDialogOpen] = useState(false);

  const steps = ['Download App', 'Scan QR Code', 'Verify Setup', 'Save Backup Codes'];

  const setup2FA = async () => {
    setLoading(true);
    setError('');
    
    try {
      console.log('Calling setup2FA API...');
      const response = await apiService.setup2FA();
      console.log('setup2FA response:', response);
      setQrCode(response.qrCode);
      setSecret(response.manualEntryKey);
      setStep(1);
    } catch (error: any) {
      console.error('setup2FA error:', error);
      setError(error.response?.data?.error || 'Failed to setup 2FA');
    } finally {
      setLoading(false);
    }
  };

  const verifySetup = async () => {
    if (!verificationToken || verificationToken.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const response = await apiService.verify2FASetup(verificationToken);
      setBackupCodes(response.backupCodes);
      
      // Track successful 2FA setup
      await auditService.track2FASetup(true, 'TOTP');
      
      setStep(3);
      setBackupCodesDialogOpen(true);
    } catch (error: any) {
      // Track failed 2FA setup
      await auditService.track2FASetup(false, 'TOTP');
      
      setError(error.response?.data?.error || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    setBackupCodesDialogOpen(false);
    onComplete();
  };

  const downloadBackupCodesCSV = () => {
    const csvContent = "Backup Code\n" + backupCodes.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'vector-2fa-backup-codes.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <Box textAlign="center">
            <Smartphone sx={{ fontSize: 80, color: '#ffffff', mb: 3 }} />
            <Typography variant="h5" gutterBottom sx={{ color: '#ffffff', fontWeight: 600 }}>
              Download Authenticator App
            </Typography>
            <Typography variant="body1" sx={{ color: '#cccccc', mb: 4, maxWidth: 400, mx: 'auto' }}>
              Download Microsoft Authenticator, Google Authenticator, or any compatible TOTP app on your mobile device.
            </Typography>
            <Button
              variant="contained"
              size="large"
              onClick={setup2FA}
              disabled={loading}
              sx={{
                backgroundColor: '#ffffff',
                color: '#000000',
                fontWeight: 700,
                px: 4,
                py: 1.5,
                '&:hover': {
                  backgroundColor: '#f0f0f0'
                }
              }}
            >
              {loading ? <CircularProgress size={24} sx={{ color: '#000000' }} /> : 'Continue'}
            </Button>
          </Box>
        );

      case 1:
        return (
          <Box textAlign="center">
            <QrCode sx={{ fontSize: 80, color: '#ffffff', mb: 3 }} />
            <Typography variant="h5" gutterBottom sx={{ color: '#ffffff', fontWeight: 600 }}>
              Scan QR Code
            </Typography>
            
            {qrCode && (
              <Paper sx={{ 
                p: 2, 
                mb: 3, 
                backgroundColor: '#ffffff', 
                display: 'inline-block',
                borderRadius: 2
              }}>
                <img src={qrCode} alt="2FA QR Code" style={{ width: 200, height: 200 }} />
              </Paper>
            )}
            
            <Typography variant="body2" sx={{ color: '#cccccc', mb: 2 }}>
              Or enter this code manually:
            </Typography>
            <Paper sx={{ 
              p: 2, 
              mb: 4, 
              backgroundColor: '#333333', 
              border: '1px solid #555555',
              borderRadius: 2,
              maxWidth: 400,
              mx: 'auto'
            }}>
              <Typography 
                variant="body2" 
                sx={{ 
                  color: '#ffffff', 
                  fontFamily: 'monospace',
                  fontSize: '14px',
                  wordBreak: 'break-all'
                }}
              >
                {secret}
              </Typography>
            </Paper>
            
            <Button
              variant="contained"
              size="large"
              onClick={() => setStep(2)}
              sx={{
                backgroundColor: '#ffffff',
                color: '#000000',
                fontWeight: 700,
                px: 4,
                py: 1.5,
                '&:hover': {
                  backgroundColor: '#f0f0f0'
                }
              }}
            >
              I've Added the Account
            </Button>
          </Box>
        );

      case 2:
        return (
          <Box textAlign="center">
            <Shield sx={{ fontSize: 80, color: '#ffffff', mb: 3 }} />
            <Typography variant="h5" gutterBottom sx={{ color: '#ffffff', fontWeight: 600 }}>
              Verify Setup
            </Typography>
            <Typography variant="body1" sx={{ color: '#cccccc', mb: 4 }}>
              Enter the 6-digit code from your authenticator app to complete setup.
            </Typography>
            
            <TextField
              value={verificationToken}
              onChange={(e) => setVerificationToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              inputProps={{
                maxLength: 6,
                style: { 
                  textAlign: 'center', 
                  fontSize: '24px', 
                  fontWeight: 'bold',
                  letterSpacing: '8px'
                }
              }}
              sx={{
                mb: 4,
                '& .MuiOutlinedInput-root': {
                  backgroundColor: '#333333',
                  color: '#ffffff',
                  '& fieldset': {
                    borderColor: '#555555',
                    borderWidth: '2px'
                  },
                  '&:hover fieldset': {
                    borderColor: '#777777'
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#ffffff',
                    borderWidth: '2px'
                  }
                }
              }}
            />
            
            <Box>
              <Button
                variant="contained"
                size="large"
                onClick={verifySetup}
                disabled={loading || verificationToken.length !== 6}
                sx={{
                  backgroundColor: '#ffffff',
                  color: '#000000',
                  fontWeight: 700,
                  px: 4,
                  py: 1.5,
                  mr: 2,
                  '&:hover': {
                    backgroundColor: '#f0f0f0'
                  }
                }}
              >
                {loading ? <CircularProgress size={24} sx={{ color: '#000000' }} /> : 'Verify & Enable'}
              </Button>
              
              <Button
                variant="outlined"
                size="large"
                onClick={() => setStep(1)}
                sx={{
                  color: '#ffffff',
                  borderColor: '#555555',
                  '&:hover': {
                    borderColor: '#777777',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)'
                  }
                }}
              >
                Back
              </Button>
            </Box>
          </Box>
        );

      case 3:
        return (
          <Box textAlign="center">
            <CheckCircle sx={{ fontSize: 80, color: '#4caf50', mb: 3 }} />
            <Typography variant="h5" gutterBottom sx={{ color: '#ffffff', fontWeight: 600 }}>
              Setup Complete!
            </Typography>
            <Typography variant="body1" sx={{ color: '#cccccc', mb: 4 }}>
              Two-factor authentication has been enabled for your account. Make sure to save your backup codes!
            </Typography>
            
            <Button
              variant="contained"
              size="large"
              onClick={() => setBackupCodesDialogOpen(true)}
              sx={{
                backgroundColor: '#ffffff',
                color: '#000000',
                fontWeight: 700,
                px: 4,
                py: 1.5,
                mr: 2,
                '&:hover': {
                  backgroundColor: '#f0f0f0'
                }
              }}
            >
              View Backup Codes
            </Button>
            
            <Button
              variant="outlined"
              size="large"
              onClick={handleComplete}
              sx={{
                color: '#ffffff',
                borderColor: '#555555',
                '&:hover': {
                  borderColor: '#777777',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)'
                }
              }}
            >
              Continue to Vector
            </Button>
          </Box>
        );

      default:
        return null;
    }
  };

  useEffect(() => {
    if (step === 0) {
      setup2FA();
    }
  }, []);

  return (
    <>
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#000000',
          px: 2
        }}
      >
        <Paper
          sx={{
            maxWidth: 600,
            width: '100%',
            p: 4,
            backgroundColor: '#1f1f1f',
            borderRadius: 3,
            border: '2px solid #444444',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.7)'
          }}
        >
          <Typography 
            variant="h4" 
            sx={{ 
              color: '#ffffff', 
              fontWeight: 700, 
              textAlign: 'center', 
              mb: 4 
            }}
          >
            Setup Two-Factor Authentication
          </Typography>

          {step < 3 && (
            <Stepper 
              activeStep={step} 
              sx={{ 
                mb: 4,
                '& .MuiStepLabel-label': {
                  color: '#cccccc'
                },
                '& .MuiStepLabel-label.Mui-active': {
                  color: '#ffffff'
                },
                '& .MuiStepIcon-root': {
                  color: '#555555'
                },
                '& .MuiStepIcon-root.Mui-active': {
                  color: '#ffffff'
                }
              }}
            >
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
          )}

          {error && (
            <Alert 
              severity="error" 
              sx={{ 
                mb: 3,
                backgroundColor: '#2d1b1b',
                color: '#ff6b6b',
                border: '1px solid #ff6b6b',
                '& .MuiAlert-icon': {
                  color: '#ff6b6b'
                }
              }}
            >
              {error}
            </Alert>
          )}

          {renderStep()}

          {onCancel && step === 0 && (
            <Box textAlign="center" mt={3}>
              <Button
                variant="text"
                onClick={onCancel}
                sx={{
                  color: '#cccccc',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.05)'
                  }
                }}
              >
                Skip for now
              </Button>
            </Box>
          )}
        </Paper>
      </Box>

      {/* Backup Codes Dialog */}
      <Dialog 
        open={backupCodesDialogOpen} 
        onClose={() => setBackupCodesDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#1f1f1f',
            border: '2px solid #444444'
          }
        }}
      >
        <DialogTitle sx={{ color: '#ffffff', fontWeight: 600 }}>
          Save Your Backup Codes
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#cccccc', mb: 3 }}>
            These backup codes can be used to access your account if you lose your phone. 
            Each code can only be used once. Store them in a safe place.
          </Typography>
          
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(2, 1fr)', 
            gap: 1 
          }}>
            {backupCodes.map((code, index) => (
              <Chip
                key={index}
                label={code}
                sx={{
                  backgroundColor: '#333333',
                  color: '#ffffff',
                  fontFamily: 'monospace',
                  fontSize: '14px',
                  '& .MuiChip-label': {
                    px: 2
                  }
                }}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between' }}>
          <Button
            onClick={downloadBackupCodesCSV}
            startIcon={<Download />}
            sx={{
              color: '#1D9BF0',
              '&:hover': {
                backgroundColor: 'rgba(29, 155, 240, 0.1)'
              }
            }}
          >
            Download CSV
          </Button>
          <Button
            onClick={() => setBackupCodesDialogOpen(false)}
            sx={{
              color: '#ffffff',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.05)'
              }
            }}
          >
            I've Saved These Codes
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default TwoFactorSetup;