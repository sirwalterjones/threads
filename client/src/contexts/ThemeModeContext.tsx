import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createTheme, ThemeProvider } from '@mui/material/styles';

type Mode = 'light' | 'dark';

interface ThemeModeContextValue {
  mode: Mode;
  toggle: () => void;
}

const ThemeModeContext = createContext<ThemeModeContextValue | undefined>(undefined);

export const useThemeMode = () => {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) throw new Error('useThemeMode must be used within ThemeModeProvider');
  return ctx;
};

export const ThemeModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<Mode>(() => (localStorage.getItem('themeMode') as Mode) || 'light');

  useEffect(() => {
    localStorage.setItem('themeMode', mode);
  }, [mode]);

  const theme = useMemo(() => createTheme({
    palette: {
      mode,
      // Modern blue-based palette inspired by the screenshot
      primary: { 
        main: mode === 'light' ? '#1E88E5' : '#42A5F5', // True blue
        light: mode === 'light' ? '#42A5F5' : '#64B5F6',
        dark: mode === 'light' ? '#1565C0' : '#1976D2'
      },
      secondary: { 
        main: mode === 'light' ? '#64748B' : '#94A3B8', // Slate
        light: mode === 'light' ? '#94A3B8' : '#CBD5E1',
        dark: mode === 'light' ? '#475569' : '#64748B'
      },
      text: {
        primary: mode === 'light' ? '#0F172A' : '#F8FAFC',
        secondary: mode === 'light' ? '#475569' : '#CBD5E1'
      },
      background: {
        default: mode === 'light' ? '#F8FAFC' : '#0F172A', // Deep dark blue for dark mode
        paper: mode === 'light' ? '#FFFFFF' : '#1E293B' // Slate for cards/papers
      },
      divider: mode === 'light' ? '#E2E8F0' : '#334155',
      // Custom colors for the modern look
      info: { main: mode === 'light' ? '#0EA5E9' : '#38BDF8' }, // Sky blue
      success: { main: mode === 'light' ? '#10B981' : '#34D399' }, // Emerald
      warning: { main: mode === 'light' ? '#F59E0B' : '#FBBF24' }, // Amber
      error: { main: mode === 'light' ? '#EF4444' : '#F87171' } // Red
    },
    shape: { borderRadius: 16 }, // More rounded corners
    typography: {
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      h1: { fontWeight: 800, fontSize: '2.5rem', letterSpacing: '-0.025em' },
      h2: { fontWeight: 700, fontSize: '2rem', letterSpacing: '-0.025em' },
      h3: { fontWeight: 700, fontSize: '1.5rem', letterSpacing: '-0.025em' },
      h4: { fontWeight: 600, fontSize: '1.25rem', letterSpacing: '-0.025em' },
      h5: { fontWeight: 600, fontSize: '1.125rem' },
      h6: { fontWeight: 600, fontSize: '1rem' },
      body1: { lineHeight: 1.75, fontSize: '1rem' },
      body2: { lineHeight: 1.6, fontSize: '0.875rem' },
      button: { fontWeight: 500, textTransform: 'none' }
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            background: mode === 'light' 
              ? 'linear-gradient(180deg, #F8FAFC 0%, #F1F5F9 100%)'
              : 'linear-gradient(180deg, #0F172A 0%, #1E293B 100%)',
            minHeight: '100vh'
          }
        }
      },
      MuiAppBar: { 
        styleOverrides: { 
          colorPrimary: { 
            backgroundColor: mode === 'light' ? 'rgba(255, 255, 255, 0.8)' : 'rgba(30, 41, 59, 0.8)', 
            backdropFilter: 'blur(12px)',
            borderBottom: `1px solid ${mode === 'light' ? '#E2E8F0' : '#334155'}`,
            boxShadow: mode === 'light' 
              ? '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)' 
              : '0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px 0 rgba(0, 0, 0, 0.2)'
          } 
        } 
      },
      MuiToolbar: { styleOverrides: { root: { minHeight: 72 } } },
      MuiPaper: { 
        styleOverrides: { 
          root: {
            backgroundImage: 'none',
            backgroundColor: mode === 'light' ? '#FFFFFF' : '#1E293B',
            border: `1px solid ${mode === 'light' ? '#E2E8F0' : '#334155'}`
          },
          elevation1: { 
            boxShadow: mode === 'light' 
              ? '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' 
              : '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.3)' 
          },
          elevation3: {
            boxShadow: mode === 'light'
              ? '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
              : '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.3)'
          }
        } 
      },
      MuiCard: { 
        styleOverrides: { 
          root: { 
            backgroundImage: 'none',
            backgroundColor: mode === 'light' ? '#FFFFFF' : '#1E293B',
            border: `1px solid ${mode === 'light' ? '#E2E8F0' : '#334155'}`,
            boxShadow: mode === 'light' 
              ? '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' 
              : '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.3)' 
          } 
        } 
      },
      MuiButton: { 
        styleOverrides: { 
          root: { 
            textTransform: 'none', 
            borderRadius: 12,
            fontWeight: 500,
            fontSize: '0.875rem',
            padding: '0.625rem 1.25rem'
          },
          containedPrimary: {
            background: mode === 'light' 
              ? 'linear-gradient(135deg, #1E88E5 0%, #42A5F5 100%)'
              : 'linear-gradient(135deg, #42A5F5 0%, #64B5F6 100%)',
            boxShadow: mode === 'light'
              ? '0 4px 14px 0 rgba(30, 136, 229, 0.39)'
              : '0 4px 14px 0 rgba(66, 165, 245, 0.39)',
            '&:hover': {
              background: mode === 'light'
                ? 'linear-gradient(135deg, #1565C0 0%, #1E88E5 100%)'
                : 'linear-gradient(135deg, #1976D2 0%, #42A5F5 100%)',
              boxShadow: mode === 'light'
                ? '0 6px 20px 0 rgba(30, 136, 229, 0.49)'
                : '0 6px 20px 0 rgba(66, 165, 245, 0.49)'
            }
          }
        } 
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 12,
              backgroundColor: mode === 'light' ? '#F8FAFC' : '#0F172A',
              '& fieldset': {
                borderColor: mode === 'light' ? '#E2E8F0' : '#334155'
              },
              '&:hover fieldset': {
                borderColor: mode === 'light' ? '#CBD5E1' : '#475569'
              },
              '&.Mui-focused fieldset': {
                borderColor: mode === 'light' ? '#1E88E5' : '#42A5F5'
              }
            }
          }
        }
      },
      MuiIconButton: { 
        styleOverrides: { 
          root: { 
            borderRadius: 12,
            padding: '0.75rem',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              backgroundColor: mode === 'light' ? '#F1F5F9' : '#334155',
              transform: 'scale(1.05)'
            }
          } 
        } 
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 20,
            fontSize: '0.75rem',
            fontWeight: 500
          }
        }
      }
    }
  }), [mode]);

  const value = useMemo(() => ({ mode, toggle: () => setMode(prev => prev === 'light' ? 'dark' : 'light') }), [mode]);

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </ThemeModeContext.Provider>
  );
};


