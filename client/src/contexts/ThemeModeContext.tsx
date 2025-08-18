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
      // Apple-like grayscale palette
      primary: { main: mode === 'light' ? '#0A84FF' : '#5AC8F5' },
      secondary: { main: mode === 'light' ? '#636366' : '#8E8E93' },
      text: {
        primary: mode === 'light' ? '#1C1C1E' : '#F2F2F7',
        secondary: mode === 'light' ? '#3A3A3C' : '#C7C7CC'
      },
      background: {
        default: mode === 'light' ? '#F2F2F7' : '#000000',
        paper: mode === 'light' ? '#FFFFFF' : '#1C1C1E'
      },
      divider: mode === 'light' ? '#E5E5EA' : '#2C2C2E'
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      h5: { fontWeight: 600 },
      body1: { lineHeight: 1.7 }
    },
    components: {
      MuiAppBar: { styleOverrides: { 
        colorPrimary: { 
          backgroundColor: mode === 'light' ? '#FFFFFF' : '#1C1C1E', 
          color: mode === 'light' ? '#1C1C1E' : '#F2F2F7', 
          boxShadow: 'none',
          borderBottom: `1px solid ${mode === 'light' ? '#E5E5EA' : '#2C2C2E'}`
        } 
      } },
      MuiToolbar: { styleOverrides: { root: { minHeight: 64 } } },
      MuiIconButton: { styleOverrides: { root: { color: mode === 'light' ? '#1C1C1E' : '#F2F2F7' } } },
      MuiPaper: { styleOverrides: { elevation1: { boxShadow: mode === 'light' ? '0 1px 3px rgba(0,0,0,0.06)' : '0 1px 3px rgba(0,0,0,0.5)' } } },
      MuiCard: { styleOverrides: { root: { boxShadow: mode === 'light' ? '0 1px 3px rgba(0,0,0,0.06)' : '0 1px 3px rgba(0,0,0,0.5)' } } },
      MuiButton: { styleOverrides: { root: { textTransform: 'none', borderRadius: 10 } } }
    }
  }), [mode]);

  const value = useMemo(() => ({ mode, toggle: () => setMode(prev => prev === 'light' ? 'dark' : 'light') }), [mode]);

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </ThemeModeContext.Provider>
  );
};


