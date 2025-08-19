import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Chip
} from '@mui/material';
import {
  TrendingUp,
  Group,
  ShoppingCart,
  Speed,
  Visibility,
  Facebook,
  Twitter,
  Instagram,
  LinkedIn
} from '@mui/icons-material';
import DashboardCard from './DashboardCard';
import apiService from '../../services/api';

interface DashboardStats {
  totalPosts: number;
  totalUsers: number;
  totalCategories: number;
  recentPosts: number;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalPosts: 0,
    totalUsers: 0,
    totalCategories: 0,
    recentPosts: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Get posts data
      const postsResponse = await apiService.getPosts({ limit: 1 });
      const totalPosts = postsResponse.pagination?.total || 0;
      
      // Get categories
      const categoriesResponse = await apiService.getCategories();
      const totalCategories = categoriesResponse?.length || 0;
      
      // Calculate recent posts (this week)
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const recentPostsResponse = await apiService.getPosts({ 
        limit: 100,
        dateFrom: oneWeekAgo.toISOString().split('T')[0]
      });
      const recentPosts = recentPostsResponse.posts?.length || 0;

      setStats({
        totalPosts,
        totalUsers: 45, // Mock data for now
        totalCategories,
        recentPosts
      });
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Mock data for page visits table
  const pageVisits = [
    { page: '/dashboard', visitors: 4569, uniqueUsers: 340, bounceRate: '46,53%' },
    { page: '/search', visitors: 3985, uniqueUsers: 319, bounceRate: '46,53%' },
    { page: '/categories', visitors: 3513, uniqueUsers: 294, bounceRate: '36,49%' },
    { page: '/my-threads', visitors: 2050, uniqueUsers: 147, bounceRate: '50,87%' },
    { page: '/new-post', visitors: 1795, uniqueUsers: 190, bounceRate: '46,53%' }
  ];

  // Mock data for social traffic
  const socialTraffic = [
    { platform: 'Facebook', referral: 'facebook.com', visitors: 1480, percentage: 60 },
    { platform: 'Twitter', referral: 'twitter.com', visitors: 5480, percentage: 70 },
    { platform: 'Instagram', referral: 'instagram.com', visitors: 4480, percentage: 80 },
    { platform: 'LinkedIn', referral: 'linkedin.com', visitors: 4480, percentage: 75 }
  ];

  return (
    <Box>
      {/* Dashboard Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <DashboardCard
            title="TRAFFIC"
            value={loading ? "..." : stats.totalPosts.toLocaleString()}
            change="3.48%"
            changeType="positive"
            period="Since last month"
            icon={TrendingUp}
            iconColor="#EF4444"
            iconBgColor="#FEE2E2"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <DashboardCard
            title="NEW USERS"
            value={loading ? "..." : stats.totalUsers.toLocaleString()}
            change="3.48%"
            changeType="negative"
            period="Since last week"
            icon={Group}
            iconColor="#F97316"
            iconBgColor="#FED7AA"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <DashboardCard
            title="SALES"
            value={loading ? "..." : stats.totalCategories}
            change="1.10%"
            changeType="negative"
            period="Since yesterday"
            icon={ShoppingCart}
            iconColor="#EC4899"
            iconBgColor="#FCE7F3"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <DashboardCard
            title="PERFORMANCE"
            value={loading ? "..." : `${((stats.recentPosts / stats.totalPosts) * 100 || 0).toFixed(1)}%`}
            change="12%"
            changeType="positive"
            period="Since last month"
            icon={Speed}
            iconColor="#3B82F6"
            iconBgColor="#DBEAFE"
          />
        </Grid>
      </Grid>

      {/* Charts and Tables Row */}
      <Grid container spacing={3}>
        {/* Page Visits Table */}
        <Grid item xs={12} lg={7}>
          <Card sx={{ borderRadius: 3, height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                  Page visits
                </Typography>
                <Button size="small" sx={{ textTransform: 'none', color: '#3B82F6' }}>
                  SEE ALL
                </Button>
              </Box>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                        PAGE NAME
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                        VISITORS
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                        UNIQUE USERS
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                        BOUNCE RATE
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pageVisits.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell sx={{ py: 2 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {row.page}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ py: 2 }}>
                          <Typography variant="body2">
                            {row.visitors.toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ py: 2 }}>
                          <Typography variant="body2">
                            {row.uniqueUsers}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ py: 2 }}>
                          <Typography variant="body2">
                            {row.bounceRate}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Social Traffic */}
        <Grid item xs={12} lg={5}>
          <Card sx={{ borderRadius: 3, height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                  Social traffic
                </Typography>
                <Button size="small" sx={{ textTransform: 'none', color: '#3B82F6' }}>
                  SEE ALL
                </Button>
              </Box>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                        REFERRAL
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                        VISITORS
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                        
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {socialTraffic.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell sx={{ py: 2 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {row.referral}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ py: 2 }}>
                          <Typography variant="body2">
                            {row.visitors.toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ py: 2 }}>
                          <Typography variant="body2" sx={{ color: '#10B981', fontWeight: 600 }}>
                            {row.percentage}%
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;