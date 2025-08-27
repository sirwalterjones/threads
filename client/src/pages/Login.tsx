import React, { useState, useEffect, useRef } from 'react';
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showSetup2FA, setShowSetup2FA] = useState(() => {
    return sessionStorage.getItem('showSetup2FA') === 'true';
  });
  const [showVerify2FA, setShowVerify2FA] = useState(() => {
    return sessionStorage.getItem('showVerify2FA') === 'true';
  });
  const [twoFactorStatus, setTwoFactorStatus] = useState<{ enabled: boolean; required: boolean } | null>(null);

  const { login, complete2FA, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Clear stale 2FA state if no token exists
  useEffect(() => {
    const hasToken = localStorage.getItem('token');
    if (!hasToken) {
      sessionStorage.removeItem('showSetup2FA');
      sessionStorage.removeItem('showVerify2FA');
      setShowSetup2FA(false);
      setShowVerify2FA(false);
    }
  }, []);

  // Particle background behind the login card
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let DPR = Math.max(1, window.devicePixelRatio || 1);
    let animationFrame = 0;

    type Particle = { x: number; y: number; vx: number; vy: number; r: number };
    let particles: Particle[] = [];
    const mouse: { x: number | null; y: number | null; active: boolean } = { x: null, y: null, active: false };

    const config = {
      particleColor: '255,255,255',
      maxParticles: 120,
      baseSpeed: 0.3,
      linkDistance: 140,
      particleRadius: { min: 1.6, max: 3.8 }
    };

    const rand = (a: number, b: number) => a + Math.random() * (b - a);

    const setupParticles = () => {
      particles = [];
      const area = window.innerWidth * window.innerHeight;
      const target = Math.min(config.maxParticles, Math.max(30, Math.floor(area / 12000)));
      for (let i = 0; i < target; i++) {
        particles.push({
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          vx: rand(-config.baseSpeed, config.baseSpeed),
          vy: rand(-config.baseSpeed, config.baseSpeed),
          r: rand(config.particleRadius.min, config.particleRadius.max)
        });
      }
    };

    const resize = () => {
      DPR = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.floor(window.innerWidth * DPR);
      canvas.height = Math.floor(window.innerHeight * DPR);
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      setupParticles();
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.active = true;
    };
    const onMouseLeave = () => {
      mouse.x = null;
      mouse.y = null;
      mouse.active = false;
    };
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      const rect = canvas.getBoundingClientRect();
      mouse.x = t.clientX - rect.left;
      mouse.y = t.clientY - rect.top;
      mouse.active = true;
    };
    const onTouchEnd = () => {
      mouse.x = null;
      mouse.y = null;
      mouse.active = false;
    };

    const updateParticles = (delta: number) => {
      for (const p of particles) {
        p.x += p.vx * delta;
        p.y += p.vy * delta;
        if (p.x < -10) p.x = window.innerWidth + 10;
        if (p.x > window.innerWidth + 10) p.x = -10;
        if (p.y < -10) p.y = window.innerHeight + 10;
        if (p.y > window.innerHeight + 10) p.y = -10;
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = `rgba(${config.particleColor},0.95)`;
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      let nodes: Array<{ x: number; y: number; r: number }> = particles as any;
      if (mouse.active && mouse.x != null && mouse.y != null) {
        nodes = particles.concat([{ x: mouse.x, y: mouse.y, r: 0 }] as any);
      }

      const thresh = config.linkDistance;
      const threshSq = thresh * thresh;
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 <= threshSq) {
            const alpha = Math.max(0, (thresh - Math.sqrt(d2)) / thresh) * 0.7;
            ctx.strokeStyle = `rgba(${config.particleColor},${alpha.toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
    };

    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(40, now - last);
      last = now;
      updateParticles(dt * 0.06);
      draw();
      animationFrame = requestAnimationFrame(loop);
    };

    // Init
    resize();
    animationFrame = requestAnimationFrame(loop);
    window.addEventListener('resize', resize, { passive: true });
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('touchmove', onTouchMove, { passive: true });
    canvas.addEventListener('touchend', onTouchEnd);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', resize as any);
      canvas.removeEventListener('mousemove', onMouseMove as any);
      canvas.removeEventListener('mouseleave', onMouseLeave as any);
      canvas.removeEventListener('touchmove', onTouchMove as any);
      canvas.removeEventListener('touchend', onTouchEnd as any);
    };
  }, []);

  // Sync state with sessionStorage changes
  useEffect(() => {
    const checkSessionStorage = () => {
      const setup = sessionStorage.getItem('showSetup2FA') === 'true';
      const verify = sessionStorage.getItem('showVerify2FA') === 'true';
      console.log('Syncing with sessionStorage - setup:', setup, 'verify:', verify);
      if (setup !== showSetup2FA) {
        console.log('Updating showSetup2FA to:', setup);
        setShowSetup2FA(setup);
      }
      if (verify !== showVerify2FA) {
        console.log('Updating showVerify2FA to:', verify);
        setShowVerify2FA(verify);
      }
    };

    // Check immediately
    checkSessionStorage();
    
    // Set up interval to check periodically (in case of async timing issues)
    const interval = setInterval(checkSessionStorage, 100);
    
    return () => clearInterval(interval);
  }, [showSetup2FA, showVerify2FA]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    console.log('handleSubmit called, authLoading:', authLoading);
    
    // Prevent multiple submissions
    if (authLoading) {
      console.log('Already loading, ignoring submission');
      return;
    }

    try {
      console.log('Login form submitted, calling login...');
      const result = await login(username, password);
      console.log('Login result:', result);
      
      if (result.requires2FA) {
        console.log('2FA required, checking status...');
        // Use setTimeout to ensure state update happens after AuthContext is done
        setTimeout(async () => {
          const status = await apiService.get2FAStatus();
          console.log('2FA status:', status);
          setTwoFactorStatus(status);
          
          if (!status.enabled && status.required) {
            console.log('Setting showSetup2FA to true');
            sessionStorage.setItem('showSetup2FA', 'true');
            sessionStorage.setItem('showVerify2FA', 'false');
            setShowSetup2FA(true);
            setShowVerify2FA(false);
            console.log('showSetup2FA state should now be true');
          } else if (status.enabled) {
            console.log('Setting showVerify2FA to true');
            sessionStorage.setItem('showVerify2FA', 'true');
            sessionStorage.setItem('showSetup2FA', 'false');
            setShowVerify2FA(true);
            setShowSetup2FA(false);
            console.log('showVerify2FA state should now be true');
          }
        }, 0);
      } else {
        console.log('No 2FA required, navigating to home');
        navigate('/');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setError(error.response?.data?.error || 'Login failed');
    }
  };

  const handle2FASetupComplete = async () => {
    try {
      await complete2FA();
      sessionStorage.removeItem('showSetup2FA');
      sessionStorage.removeItem('showVerify2FA');
      setShowSetup2FA(false);
      navigate('/');
    } catch (error) {
      setError('Failed to complete setup. Please try logging in again.');
      sessionStorage.removeItem('showSetup2FA');
      sessionStorage.removeItem('showVerify2FA');
      setShowSetup2FA(false);
    }
  };

  const handle2FAVerificationSuccess = async () => {
    try {
      await complete2FA();
      sessionStorage.removeItem('showSetup2FA');
      sessionStorage.removeItem('showVerify2FA');
      setShowVerify2FA(false);
      navigate('/');
    } catch (error) {
      setError('Failed to complete verification. Please try logging in again.');
      sessionStorage.removeItem('showSetup2FA');
      sessionStorage.removeItem('showVerify2FA');
      setShowVerify2FA(false);
    }
  };

  const handleCancel2FA = () => {
    sessionStorage.removeItem('showSetup2FA');
    sessionStorage.removeItem('showVerify2FA');
    setShowSetup2FA(false);
    setShowVerify2FA(false);
    setTwoFactorStatus(null);
    apiService.clearToken();
  };

  console.log('Login component render - showSetup2FA:', showSetup2FA, 'showVerify2FA:', showVerify2FA, 'authLoading:', authLoading);

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

  console.log('Rendering default login form');

  // Default login form
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000000',
        px: 2,
        position: 'relative'
      }}
    >
      {/* Background canvas */}
      <canvas
        ref={canvasRef}
        id="bg"
        style={{ position: 'fixed', inset: 0, display: 'block', zIndex: 0 }}
      />
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
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.7)',
            position: 'relative',
            zIndex: 10
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
              disabled={authLoading}
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
              disabled={authLoading}
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
              onClick={(e) => {
                console.log('Button clicked, disabled:', authLoading || !username || !password, 'authLoading:', authLoading);
              }}
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
              disabled={authLoading || !username || !password}
            >
              {authLoading ? <CircularProgress size={24} sx={{ color: '#000000' }} /> : 'Sign In'}
            </Button>
          </Box>

          {/* Brand definition */}
          <Box sx={{ mt: 4, width: '100%', textAlign: 'center' }}>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                letterSpacing: '0.08em',
                color: '#E7E9EA',
                mb: 1
              }}
            >
              <span style={{ color: '#1D9BF0' }}>V</span>ECTOR
            </Typography>
            <Typography variant="subtitle2" sx={{ color: '#9CA3AF', fontStyle: 'italic', mb: 1 }}>
              *\ˈvek-tər*
            </Typography>
            <Typography variant="caption" sx={{ color: '#A1A7AD', letterSpacing: '0.02em' }}>
              noun (intel)
            </Typography>
            <Typography variant="body2" sx={{ color: '#C7CDD3', mt: 1, lineHeight: 1.6 }}>
              a directional pattern linking motive, capability, and access — the axis along which
              events unfold and decisions are made.
            </Typography>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default Login;