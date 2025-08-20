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
  Assessment,
  Category,
  Description,
  Schedule,
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

  // Recent intelligence activity
  const recentActivity = [
    { type: 'Case Report', count: 156, priority: 'High', status: 'Active' },
    { type: 'Intelligence Brief', count: 89, priority: 'Medium', status: 'Review' },
    { type: 'Field Report', count: 234, priority: 'Low', status: 'Closed' },
    { type: 'Threat Assessment', count: 45, priority: 'Critical', status: 'Urgent' },
    { type: 'Surveillance Log', count: 178, priority: 'Medium', status: 'Active' }
  ];

  // Category breakdown
  const categoryBreakdown = [
    { category: 'Intel Quick Updates', count: 1480, percentage: 60 },
    { category: 'Threat Intelligence', count: 548, percentage: 23 },
    { category: 'Field Operations', count: 448, percentage: 18 },
    { category: 'Surveillance', count: 324, percentage: 13 }
  ];

  return (
    <Box>
      {/* Intelligence Dashboard Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <DashboardCard
            title="TOTAL REPORTS"
            value={loading ? "..." : stats.totalPosts.toLocaleString()}
            change="3.48%"
            changeType="positive"
            period="Since last month"
            icon={Description}
            iconColor="#EF4444"
            iconBgColor="#FEE2E2"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <DashboardCard
            title="ACTIVE CASES"
            value={loading ? "..." : stats.recentPosts.toLocaleString()}
            change="2.1%"
            changeType="positive"
            period="Since last week"
            icon={Assessment}
            iconColor="#F97316"
            iconBgColor="#FED7AA"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <DashboardCard
            title="CATEGORIES"
            value={loading ? "..." : stats.totalCategories}
            change="1.10%"
            changeType="negative"
            period="Since yesterday"
            icon={Category}
            iconColor="#EC4899"
            iconBgColor="#FCE7F3"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <DashboardCard
            title="THIS WEEK"
            value={loading ? "..." : `${stats.recentPosts}`}
            change="12%"
            changeType="positive"
            period="New reports"
            icon={Schedule}
            iconColor="#3B82F6"
            iconBgColor="#DBEAFE"
          />
        </Grid>
      </Grid>

      {/* Charts and Tables Row */}
      <Grid container spacing={3}>
        {/* Page Visits Table */}
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card sx={{ borderRadius: 3, height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                  Recent Activity
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
                        REPORT TYPE
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                        COUNT
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                        PRIORITY
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                        STATUS
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentActivity.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell sx={{ py: 2 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {row.type}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ py: 2 }}>
                          <Typography variant="body2">
                            {row.count}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ py: 2 }}>
                          <Chip 
                            label={row.priority} 
                            size="small"
                            color={row.priority === 'Critical' ? 'error' : row.priority === 'High' ? 'warning' : 'default'}
                          />
                        </TableCell>
                        <TableCell sx={{ py: 2 }}>
                          <Chip 
                            label={row.status} 
                            size="small"
                            color={row.status === 'Active' ? 'success' : row.status === 'Urgent' ? 'error' : 'default'}
                          />
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
        <Grid size={{ xs: 12, lg: 5 }}>
          <Card sx={{ borderRadius: 3, height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                  Category Breakdown
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
                        CATEGORY
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                        REPORTS
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>
                        PERCENTAGE
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {categoryBreakdown.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell sx={{ py: 2 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {row.category}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ py: 2 }}>
                          <Typography variant="body2">
                            {row.count.toLocaleString()}
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