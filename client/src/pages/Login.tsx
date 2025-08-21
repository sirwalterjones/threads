import React, { useState } from 'react';
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

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      navigate('/');
    } catch (error: any) {
      setError(error.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
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
      <Container component="main" maxWidth="xs">
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: 4,
            backgroundColor: '#1a1a1a',
            borderRadius: 3,
            border: '1px solid #333',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
          }}
        >
          <Typography 
            component="h1" 
            variant="h4" 
            sx={{ 
              fontWeight: 600,
              color: '#ffffff',
              mb: 4,
              textAlign: 'center'
            }}
          >
            Threads
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
                  backgroundColor: '#2a2a2a',
                  color: '#ffffff',
                  '& fieldset': {
                    borderColor: '#444'
                  },
                  '&:hover fieldset': {
                    borderColor: '#666'
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#ffffff'
                  }
                },
                '& .MuiInputLabel-root': {
                  color: '#aaa'
                },
                '& .MuiInputLabel-root.Mui-focused': {
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
                  backgroundColor: '#2a2a2a',
                  color: '#ffffff',
                  '& fieldset': {
                    borderColor: '#444'
                  },
                  '&:hover fieldset': {
                    borderColor: '#666'
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#ffffff'
                  }
                },
                '& .MuiInputLabel-root': {
                  color: '#aaa'
                },
                '& .MuiInputLabel-root.Mui-focused': {
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
                mt: 1, 
                py: 1.5,
                fontSize: '1rem',
                fontWeight: 600,
                backgroundColor: '#ffffff',
                color: '#000000',
                '&:hover': {
                  backgroundColor: '#f0f0f0'
                },
                '&:disabled': {
                  backgroundColor: '#666',
                  color: '#999'
                }
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