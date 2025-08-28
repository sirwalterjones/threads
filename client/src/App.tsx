import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeModeProvider } from './contexts/ThemeModeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DashboardProvider } from './contexts/DashboardContext';
import Layout from './components/Layout/Layout';
import Login from './pages/Login';
import Home from './pages/HomeSimple';
import Dashboard from './components/Dashboard/Dashboard';
import CategoriesManage from './pages/CategoriesManage';
import UsersManage from './pages/UsersManage';
import AuditLog from './pages/AuditLog';
import PostExpiration from './pages/PostExpiration';
import Profile from './pages/Profile';
import HotList from './pages/HotList';
import IntelReportsSimple from './pages/IntelReportsSimple';
import IntelReportsApprovalSimple from './pages/IntelReportsApprovalSimple';
import IntelReportFormSimple from './components/IntelReport/IntelReportFormSimple';
import SecurityDashboard from './components/SecurityDashboard';
import TagPosts from './pages/TagPosts';
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

  // Check if we have a token but no user (might be in 2FA flow)
  const hasToken = localStorage.getItem('token');
  if (!user && !hasToken) {
    return <Navigate to="/login" replace />;
  }

  // If we have a token but no user, redirect to login for 2FA
  if (!user && hasToken) {
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
        element={<Login />} 
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
                <Route path="/expiration" element={<PostExpiration />} />
                <Route path="/audit" element={<AuditLog />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/hotlist" element={<HotList />} />
                <Route path="/intel-reports" element={<IntelReportsSimple />} />
                <Route path="/intel-reports/new" element={<IntelReportFormSimple />} />
                <Route path="/intel-reports/:id/edit" element={<IntelReportFormSimple />} />
                <Route path="/intel-reports/approval" element={<IntelReportsApprovalSimple />} />
                <Route path="/security" element={<SecurityDashboard />} />
                <Route path="/tags/:tagName" element={<TagPosts />} />
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
        <DashboardProvider>
          <Router>
            <AppRoutes />
          </Router>
        </DashboardProvider>
      </AuthProvider>
    </ThemeModeProvider>
  );
};

export default App;
