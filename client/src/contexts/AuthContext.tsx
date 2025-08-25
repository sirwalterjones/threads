import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthContextType } from '../types';
import apiService from '../services/api';
import auditService from '../services/auditService';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        try {
          apiService.setToken(storedToken);
          const profile = await apiService.getProfile();
          setUser(profile);
          setToken(storedToken);
        } catch (error) {
          console.error('Failed to restore session:', error);
          localStorage.removeItem('token');
          apiService.clearToken();
        }
      }
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (username: string, password: string): Promise<{ requires2FA?: boolean; user?: User; token?: string }> => {
    setIsLoading(true);
    try {
      const response = await apiService.login(username, password);
      
      // If 2FA is required, don't set user/token yet
      if (response.requires2FA) {
        // Store token temporarily for 2FA verification
        apiService.setToken(response.token);
        return { requires2FA: true };
      }
      
      // Normal login flow
      setUser(response.user);
      setToken(response.token);
      apiService.setToken(response.token);
      localStorage.setItem('token', response.token);
      
      // Track successful login
      await auditService.trackLogin(username);
      
      return { user: response.user, token: response.token };
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    const currentUser = user?.username;
    
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    apiService.clearToken();
    
    // Track logout
    if (currentUser) {
      await auditService.trackLogout(currentUser);
    }
  };

  const complete2FA = async (): Promise<void> => {
    try {
      const profile = await apiService.getProfile();
      setUser(profile);
      const currentToken = apiService.getToken();
      setToken(currentToken);
      if (currentToken) {
        localStorage.setItem('token', currentToken);
      }
    } catch (error) {
      console.error('Failed to complete 2FA login:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    token,
    login,
    logout,
    complete2FA,
    isLoading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};