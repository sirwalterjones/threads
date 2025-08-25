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
  // Initialize state from sessionStorage to persist across re-renders
  const [showSetup2FA, setShowSetup2FA] = useState(() => {
    const saved = sessionStorage.getItem('showSetup2FA');
    console.log('Initialize showSetup2FA from sessionStorage:', saved);
    return saved === 'true';
  });
  const [showVerify2FA, setShowVerify2FA] = useState(() => {
    const saved = sessionStorage.getItem('showVerify2FA');
    console.log('Initialize showVerify2FA from sessionStorage:', saved);
    return saved === 'true';
  });

  // Custom setters that persist to sessionStorage
  const setShowSetup2FAWithPersist = (value: boolean) => {
    console.log('Setting showSetup2FA to:', value);
    sessionStorage.setItem('showSetup2FA', value.toString());
    setShowSetup2FA(value);
  };

  const setShowVerify2FAWithPersist = (value: boolean) => {
    console.log('Setting showVerify2FA to:', value);
    sessionStorage.setItem('showVerify2FA', value.toString());
    setShowVerify2FA(value);
  };

  // Debug state changes
  useEffect(() => {
    console.log('showSetup2FA changed to:', showSetup2FA);
  }, [showSetup2FA]);

  useEffect(() => {
    console.log('showVerify2FA changed to:', showVerify2FA);
  }, [showVerify2FA]);
  const [twoFactorStatus, setTwoFactorStatus] = useState<{ enabled: boolean; required: boolean } | null>(null);
  const [pendingLogin, setPendingLogin] = useState(false);

  const { login, complete2FA } = useAuth();
  const navigate = useNavigate();

  // Prevent navigation away from login when in 2FA mode
  useEffect(() => {
    if (showSetup2FA || showVerify2FA) {
      console.log('In 2FA mode, preventing navigation');
      // Store in sessionStorage to persist across potential redirects
      sessionStorage.setItem('inTwoFactorFlow', 'true');
    } else {
      sessionStorage.removeItem('inTwoFactorFlow');
    }
  }, [showSetup2FA, showVerify2FA]);

  // Check for 2FA flow on component mount
  useEffect(() => {
    console.log('useEffect mount - checking for existing 2FA flow');
    const inTwoFactorFlow = sessionStorage.getItem('inTwoFactorFlow');
    const hasToken = localStorage.getItem('token');
    
    console.log('Mount check - inTwoFactorFlow:', inTwoFactorFlow, 'hasToken:', !!hasToken);
    
    if (inTwoFactorFlow && hasToken) {
      console.log('Detected 2FA flow in progress, checking status...');
      // Re-check 2FA status
      apiService.get2FAStatus().then(status => {
        console.log('Restored 2FA status:', status);
        setTwoFactorStatus(status);
        if (!status.enabled && status.required) {
          console.log('Restoring 2FA setup state');
          setShowSetup2FAWithPersist(true);
        } else if (status.enabled) {
          console.log('Restoring 2FA verification state');
          setShowVerify2FAWithPersist(true);
        }
      }).catch(error => {
        console.error('Error checking 2FA status on mount:', error);
        sessionStorage.removeItem('inTwoFactorFlow');
      });
    } else {
      console.log('No existing 2FA flow detected on mount');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(username, password);
      
      if (result.requires2FA) {
        console.log('2FA required, checking user status...');
        setPendingLogin(true); // Flag that we're in 2FA flow
        
        // Check if user needs to set up 2FA or just verify
        try {
          const status = await apiService.get2FAStatus();
          console.log('2FA status:', status);
          setTwoFactorStatus(status);
          
          if (!status.enabled && status.required) {
            console.log('User needs 2FA setup - setting showSetup2FA to true');
            // Set sessionStorage IMMEDIATELY before setting state
            sessionStorage.setItem('showSetup2FA', 'true');
            sessionStorage.setItem('inTwoFactorFlow', 'true');
            console.log('SessionStorage set before state update');
            setShowSetup2FAWithPersist(true);
            console.log('showSetup2FA state after setting:', true);
            console.log('Current showSetup2FA state:', showSetup2FA);
          } else if (status.enabled) {
            console.log('User has 2FA enabled - setting showVerify2FA to true');
            // Set sessionStorage IMMEDIATELY before setting state
            sessionStorage.setItem('showVerify2FA', 'true');
            sessionStorage.setItem('inTwoFactorFlow', 'true');
            setShowVerify2FAWithPersist(true);
          }
        } catch (error) {
          console.error('Failed to get 2FA status:', error);
          // Set sessionStorage IMMEDIATELY before setting state
          sessionStorage.setItem('showSetup2FA', 'true');
          sessionStorage.setItem('inTwoFactorFlow', 'true');
          setShowSetup2FAWithPersist(true); // Default to setup if status check fails
        }
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
      // Clear 2FA state
      setShowSetup2FAWithPersist(false);
      sessionStorage.removeItem('inTwoFactorFlow');
      sessionStorage.removeItem('showSetup2FA');
      sessionStorage.removeItem('showVerify2FA');
      navigate('/');
    } catch (error) {
      setError('Failed to complete setup. Please try logging in again.');
      setShowSetup2FAWithPersist(false);
    }
  };

  const handle2FAVerificationSuccess = async () => {
    try {
      await complete2FA();
      // Clear 2FA state
      setShowVerify2FAWithPersist(false);
      sessionStorage.removeItem('inTwoFactorFlow');
      sessionStorage.removeItem('showSetup2FA');
      sessionStorage.removeItem('showVerify2FA');
      navigate('/');
    } catch (error) {
      setError('Failed to complete verification. Please try logging in again.');
      setShowVerify2FAWithPersist(false);
    }
  };

  const handleCancel2FA = () => {
    console.log('handleCancel2FA called - resetting 2FA state');
    setShowSetup2FAWithPersist(false);
    setShowVerify2FAWithPersist(false);
    setTwoFactorStatus(null);
    setPendingLogin(false);
    sessionStorage.removeItem('inTwoFactorFlow');
    sessionStorage.removeItem('showSetup2FA');
    sessionStorage.removeItem('showVerify2FA');
    // Clear any stored token
    apiService.clearToken();
  };

  // Clear stale 2FA state on fresh page load if user is not actually in 2FA flow
  useEffect(() => {
    const hasToken = localStorage.getItem('token');
    if (!hasToken) {
      console.log('No token found, clearing any stale 2FA state');
      sessionStorage.removeItem('inTwoFactorFlow');
      sessionStorage.removeItem('showSetup2FA');
      sessionStorage.removeItem('showVerify2FA');
    }
  }, []);

  console.log('Login component render - showSetup2FA:', showSetup2FA, 'showVerify2FA:', showVerify2FA);

  // Show 2FA setup if required
  if (showSetup2FA) {
    console.log('Rendering 2FA setup component');
    return <TwoFactorSetup onComplete={handle2FASetupComplete} onCancel={handleCancel2FA} />;
  }

  // Show 2FA verification if enabled
  if (showVerify2FA) {
    console.log('Rendering 2FA verification component');
    return <TwoFactorVerification onSuccess={handle2FAVerificationSuccess} onCancel={handleCancel2FA} />;
  }

  // Default login form
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