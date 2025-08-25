import React, { useState, useEffect } from 'react';
import {
  Container,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import TwoFactorSetup from '../components/TwoFactor/TwoFactorSetup';
import TwoFactorVerification from '../components/TwoFactor/TwoFactorVerification';
import apiService from '../services/api';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSetup2FA, setShowSetup2FA] = useState(false);
  const [showVerify2FA, setShowVerify2FA] = useState(false);
  const [twoFactorStatus, setTwoFactorStatus] = useState<{ enabled: boolean; required: boolean } | null>(null);

  // Debug state changes
  useEffect(() => {
    console.log('showSetup2FA state changed to:', showSetup2FA);
  }, [showSetup2FA]);
  const { login, complete2FA } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(username, password);
      
      if (result.requires2FA) {
        // User needs 2FA setup - complete login first, then show setup
        console.log('2FA required, completing login and showing setup component');
        console.log('Setting showSetup2FA to true');
        setShowSetup2FA(true);
        console.log('showSetup2FA state after set:', true);
      } else {
        navigate('/');
      }
    } catch (error: any) {
      setError(error.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handle2FASetupComplete = async () => {
    try {
      await complete2FA();
      navigate('/');
    } catch (error) {
      setError('Failed to complete setup. Please try logging in again.');
      setShowSetup2FA(false);
    }
  };

  const handle2FAVerificationSuccess = async () => {
    try {
      await complete2FA();
      navigate('/');
    } catch (error) {
      setError('Failed to complete verification. Please try logging in again.');
      setShowVerify2FA(false);
    }
  };

  const handleCancel2FA = () => {
    console.log('handleCancel2FA called - resetting 2FA state');
    setShowSetup2FA(false);
    setShowVerify2FA(false);
    setTwoFactorStatus(null);
    // Clear any stored token
    apiService.clearToken();
  };

  // Show 2FA setup if required
  if (showSetup2FA) {
    console.log('Rendering TwoFactorSetup component');
    console.log('showSetup2FA state:', showSetup2FA);
    console.log('About to render 2FA setup UI...');
    
    // Simple fallback 2FA setup UI for debugging
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
        <Container component="main" maxWidth="sm">
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: 4,
              backgroundColor: '#1f1f1f',
              borderRadius: 3,
              border: '2px solid #444444',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.7)'
            }}
          >
            <Typography variant="h4" sx={{ color: '#ffffff', mb: 3 }}>
              🔐 Two-Factor Authentication Setup
            </Typography>
            
            <Typography variant="body1" sx={{ color: '#cccccc', mb: 4, textAlign: 'center' }}>
              Your account requires 2FA setup. This is a simplified setup interface for debugging.
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                onClick={() => {
                  console.log('2FA setup completed (debug mode)');
                  handle2FASetupComplete();
                }}
                sx={{
                  backgroundColor: '#1D9BF0',
                  color: '#ffffff',
                  '&:hover': { backgroundColor: '#1a8cd8' }
                }}
              >
                Complete 2FA Setup (Debug)
              </Button>
              
              <Button
                variant="outlined"
                onClick={handleCancel2FA}
                sx={{
                  borderColor: '#444444',
                  color: '#cccccc',
                  '&:hover': { borderColor: '#666666' }
                }}
              >
                Cancel
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>
    );
    }
    
    console.log('2FA setup component rendered successfully');

  // Show 2FA verification if enabled
  if (showVerify2FA) {
    return <TwoFactorVerification onSuccess={handle2FAVerificationSuccess} onCancel={handleCancel2FA} />;
  }

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
      <Container component="main" maxWidth="xs">
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: 4,
            backgroundColor: '#1f1f1f',
            borderRadius: 3,
            border: '2px solid #444444',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.7)'
          }}
        >
          <Typography 
            component="h1" 
            variant="h3" 
            sx={{ 
              fontWeight: 700,
              color: '#ffffff',
              mb: 4,
              textAlign: 'center',
              fontSize: '2.5rem',
              textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
              letterSpacing: '0.02em'
            }}
          >
            Vector
          </Typography>

          {error && (
            <Alert 
              severity="error" 
              sx={{ 
                mb: 3,
                width: '100%',
                backgroundColor: '#2d1b1b',
                color: '#ff6b6b',
                border: '1px solid #ff6b6b',
                borderRadius: 2,
                '& .MuiAlert-icon': {
                  color: '#ff6b6b'
                }
              }}
            >
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} noValidate sx={{ width: '100%' }}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="username"
              label="Username"
              name="username"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              sx={{ 
                mb: 2,
                '& .MuiOutlinedInput-root': {
                  backgroundColor: '#333333',
                  color: '#ffffff',
                  fontSize: '16px',
                  fontWeight: 500,
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
                  },
                  '& input': {
                    color: '#ffffff',
                    fontSize: '16px',
                    fontWeight: 500,
                    padding: '14px 16px',
                    '&::placeholder': {
                      color: '#cccccc',
                      opacity: 1
                    },
                    '&:-webkit-autofill': {
                      WebkitBoxShadow: '0 0 0 1000px #333333 inset',
                      WebkitTextFillColor: '#ffffff',
                      transition: 'background-color 5000s ease-in-out 0s'
                    }
                  }
                },
                '& .MuiInputLabel-root': {
                  color: '#cccccc',
                  fontSize: '16px',
                  fontWeight: 500
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: '#ffffff',
                  fontWeight: 600
                },
                '& .MuiInputLabel-root.MuiInputLabel-shrink': {
                  color: '#ffffff'
                }
              }}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type="password"
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              sx={{ 
                mb: 3,
                '& .MuiOutlinedInput-root': {
                  backgroundColor: '#333333',
                  color: '#ffffff',
                  fontSize: '16px',
                  fontWeight: 500,
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
                  },
                  '& input': {
                    color: '#ffffff',
                    fontSize: '16px',
                    fontWeight: 500,
                    padding: '14px 16px',
                    '&::placeholder': {
                      color: '#cccccc',
                      opacity: 1
                    },
                    '&:-webkit-autofill': {
                      WebkitBoxShadow: '0 0 0 1000px #333333 inset',
                      WebkitTextFillColor: '#ffffff',
                      transition: 'background-color 5000s ease-in-out 0s'
                    }
                  }
                },
                '& .MuiInputLabel-root': {
                  color: '#cccccc',
                  fontSize: '16px',
                  fontWeight: 500
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: '#ffffff',
                  fontWeight: 600
                },
                '& .MuiInputLabel-root.MuiInputLabel-shrink': {
                  color: '#ffffff'
                }
              }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              sx={{ 
                mt: 2, 
                py: 2,
                fontSize: '1.1rem',
                fontWeight: 700,
                backgroundColor: '#ffffff',
                color: '#000000',
                borderRadius: 2,
                textTransform: 'none',
                letterSpacing: '0.5px',
                boxShadow: '0 4px 12px rgba(255, 255, 255, 0.2)',
                '&:hover': {
                  backgroundColor: '#f0f0f0',
                  boxShadow: '0 6px 16px rgba(255, 255, 255, 0.3)',
                  transform: 'translateY(-1px)'
                },
                '&:disabled': {
                  backgroundColor: '#555555',
                  color: '#aaaaaa',
                  boxShadow: 'none'
                },
                transition: 'all 0.2s ease-in-out'
              }}
              disabled={loading || !username || !password}
            >
              {loading ? <CircularProgress size={24} sx={{ color: '#000000' }} /> : 'Sign In'}
            </Button>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default Login;