import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Paper,
  Alert,
  CircularProgress,
  Link
} from '@mui/material';
import { Security, Shield, Backup } from '@mui/icons-material';
import apiService from '../../services/api';

interface TwoFactorVerificationProps {
  onSuccess: () => void;
  onCancel?: () => void;
}

const TwoFactorVerification: React.FC<TwoFactorVerificationProps> = ({ onSuccess, onCancel }) => {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);

  const handleVerify = async () => {
    if (!token || (useBackupCode ? token.length < 6 : token.length !== 6)) {
      setError(useBackupCode ? 'Please enter a valid backup code' : 'Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      await apiService.verify2FA(token, useBackupCode);
      onSuccess();
    } catch (error: any) {
      setError(error.response?.data?.error || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleTokenChange = (value: string) => {
    if (useBackupCode) {
      setToken(value.toUpperCase().slice(0, 12));
    } else {
      setToken(value.replace(/\D/g, '').slice(0, 6));
    }
  };

  return (
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
          maxWidth: 450,
          width: '100%',
          p: 4,
          backgroundColor: '#1f1f1f',
          borderRadius: 3,
          border: '2px solid #444444',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.7)',
          textAlign: 'center'
        }}
      >
        <Typography 
          variant="h4" 
          sx={{ 
            color: '#ffffff', 
            fontWeight: 700, 
            mb: 2 
          }}
        >
          Two-Factor Authentication
        </Typography>

        <Typography variant="body1" sx={{ color: '#cccccc', mb: 4 }}>
          Enter the verification code to continue
        </Typography>

        {useBackupCode ? (
          <>
            <Backup sx={{ fontSize: 60, color: '#ffffff', mb: 3 }} />
            <Typography variant="h6" sx={{ color: '#ffffff', mb: 3 }}>
              Enter Backup Code
            </Typography>
            <Typography variant="body2" sx={{ color: '#cccccc', mb: 3 }}>
              Enter one of your saved backup codes
            </Typography>
          </>
        ) : (
          <>
            <Shield sx={{ fontSize: 60, color: '#ffffff', mb: 3 }} />
            <Typography variant="h6" sx={{ color: '#ffffff', mb: 3 }}>
              Enter Authenticator Code
            </Typography>
            <Typography variant="body2" sx={{ color: '#cccccc', mb: 3 }}>
              Open your authenticator app and enter the 6-digit code
            </Typography>
          </>
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

        <TextField
          value={token}
          onChange={(e) => handleTokenChange(e.target.value)}
          placeholder={useBackupCode ? "ABCD123456" : "000000"}
          fullWidth
          inputProps={{
            maxLength: useBackupCode ? 12 : 6,
            style: { 
              textAlign: 'center', 
              fontSize: '24px', 
              fontWeight: 'bold',
              letterSpacing: useBackupCode ? '2px' : '8px',
              fontFamily: useBackupCode ? 'monospace' : 'inherit'
            }
          }}
          sx={{
            mb: 3,
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

        <Button
          variant="contained"
          size="large"
          fullWidth
          onClick={handleVerify}
          disabled={loading || !token || (useBackupCode ? token.length < 6 : token.length !== 6)}
          sx={{
            mb: 3,
            py: 1.5,
            fontSize: '1.1rem',
            fontWeight: 700,
            backgroundColor: '#ffffff',
            color: '#000000',
            '&:hover': {
              backgroundColor: '#f0f0f0'
            },
            '&:disabled': {
              backgroundColor: '#555555',
              color: '#aaaaaa'
            }
          }}
        >
          {loading ? <CircularProgress size={24} sx={{ color: '#000000' }} /> : 'Verify'}
        </Button>

        <Box sx={{ mb: 3 }}>
          <Link
            component="button"
            variant="body2"
            onClick={() => {
              setUseBackupCode(!useBackupCode);
              setToken('');
              setError('');
            }}
            sx={{
              color: '#cccccc',
              textDecoration: 'underline',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              '&:hover': {
                color: '#ffffff'
              }
            }}
          >
            {useBackupCode ? 'Use authenticator code instead' : 'Use backup code instead'}
          </Link>
        </Box>

        {onCancel && (
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
            Cancel
          </Button>
        )}
      </Paper>
    </Box>
  );
};

export default TwoFactorVerification;