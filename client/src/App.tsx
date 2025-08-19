import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeModeProvider } from './contexts/ThemeModeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout/Layout';
import Login from './pages/Login';
import Home from './pages/HomeSimple';
import Dashboard from './components/Dashboard/Dashboard';
import CategoriesManage from './pages/CategoriesManage';
import UsersManage from './pages/UsersManage';
import AuditLog from './pages/AuditLog';
import SystemTools from './pages/SystemTools';
import Profile from './pages/Profile';
import NewPost from './pages/NewPost';
import { CircularProgress, Box } from '@mui/material';

// Theme is now controlled by ThemeModeProvider

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Routes>
      <Route 
        path="/login" 
        element={user ? <Navigate to="/" replace /> : <Login />} 
      />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/search" element={<Home />} />
                <Route path="/my-threads" element={<Home />} />
                <Route path="/categories" element={<CategoriesManage />} />
                <Route path="/users" element={<UsersManage />} />
                <Route path="/audit" element={<AuditLog />} />
                <Route path="/tools" element={<SystemTools />} />
                <Route path="/sync" element={<SystemTools />} />
                <Route path="/purge" element={<SystemTools />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/settings" element={<SystemTools />} />
                <Route path="/tables" element={<Home />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <ThemeModeProvider>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </ThemeModeProvider>
  );
};

export default App;
