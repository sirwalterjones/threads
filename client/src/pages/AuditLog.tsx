import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Typography, 
  Table, 
  TableHead, 
  TableRow, 
  TableCell, 
  TableBody, 
  Paper, 
  TableContainer, 
  Alert, 
  Chip,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
  Pagination,
  IconButton,
  InputAdornment
} from '@mui/material';
import { 
  Search as SearchIcon, 
  FileDownload as ExportIcon, 
  Clear as ClearIcon 
} from '@mui/icons-material';
import apiService from '../services/api';
import { format } from 'date-fns';

const AuditLog: React.FC = () => {
  const [entries, setEntries] = useState<any[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [page, setPage] = useState(1);
  const [itemsPerPage] = useState(25);

  useEffect(() => {
    loadAuditLog();
  }, []);

  useEffect(() => {
    filterEntries();
  }, [entries, searchQuery, actionFilter, userFilter]);

  const loadAuditLog = async () => {
    try {
      setLoading(true);
      const response = await apiService.getAuditLog({ page: 1, limit: 1000 });
      setEntries(response.auditEntries || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  };

  const filterEntries = () => {
    let filtered = entries;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(entry => 
        entry.username?.toLowerCase().includes(query) ||
        entry.action?.toLowerCase().includes(query) ||
        entry.table_name?.toLowerCase().includes(query) ||
        entry.ip_address?.toLowerCase().includes(query) ||
        entry.new_values?.toLowerCase().includes(query)
      );
    }

    if (actionFilter) {
      filtered = filtered.filter(entry => entry.action === actionFilter);
    }

    if (userFilter) {
      filtered = filtered.filter(entry => entry.username === userFilter);
    }

    setFilteredEntries(filtered);
    setPage(1);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setActionFilter('');
    setUserFilter('');
  };

  const exportToCSV = () => {
    const headers = ['Timestamp', 'User', 'Action', 'Table', 'Record ID', 'IP Address', 'Details'];
    const csvData = [headers];

    filteredEntries.forEach(entry => {
      let details = '';
      try {
        const parsed = entry.new_values ? JSON.parse(entry.new_values) : null;
        if (parsed?.meta) {
          details = `${parsed.meta.method} ${parsed.meta.path} • ${parsed.meta.status} • ${parsed.meta.durationMs}ms`;
        }
        if (parsed?.body) {
          details += ` | payload: ${Object.keys(parsed.body).join(', ')}`;
        }
      } catch {}

      csvData.push([
        format(new Date(entry.timestamp), 'yyyy-MM-dd HH:mm:ss'),
        entry.username || '',
        entry.action || '',
        entry.table_name || '',
        entry.record_id || '',
        entry.ip_address || '',
        details
      ]);
    });

    const csvContent = csvData.map(row => 
      row.map(field => `"${String(field).replace(/"/g, '""')}`).join(',')
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `audit_log_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const uniqueActions = [...new Set(entries.map(e => e.action).filter(Boolean))];
  const uniqueUsers = [...new Set(entries.map(e => e.username).filter(Boolean))];

  const paginatedEntries = filteredEntries.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  const totalPages = Math.ceil(filteredEntries.length / itemsPerPage);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <Typography>Loading audit log...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ color: '#1F2937', fontWeight: 600 }}>
          Audit Log
        </Typography>
        <Button
          variant="contained"
          startIcon={<ExportIcon />}
          onClick={exportToCSV}
          disabled={filteredEntries.length === 0}
          sx={{
            backgroundColor: '#10B981',
            '&:hover': { backgroundColor: '#059669' }
          }}
        >
          Export CSV
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {/* Search and Filter Section */}
      <Card sx={{ mb: 3, backgroundColor: 'white', border: '1px solid #E5E7EB' }}>
        <CardContent>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                variant="outlined"
                label="Search"
                placeholder="Search users, actions, IPs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: '#6B7280' }} />
                    </InputAdornment>
                  ),
                  endAdornment: searchQuery && (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setSearchQuery('')} size="small">
                        <ClearIcon />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <FormControl fullWidth>
                <InputLabel>Action</InputLabel>
                <Select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  label="Action"
                >
                  <MenuItem value="">All Actions</MenuItem>
                  {uniqueActions.map(action => (
                    <MenuItem key={action} value={action}>{action}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <FormControl fullWidth>
                <InputLabel>User</InputLabel>
                <Select
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                  label="User"
                >
                  <MenuItem value="">All Users</MenuItem>
                  {uniqueUsers.map(user => (
                    <MenuItem key={user} value={user}>{user}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <Button
                fullWidth
                variant="outlined"
                onClick={clearFilters}
                sx={{ height: '56px' }}
              >
                Clear Filters
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="body2" sx={{ color: '#6B7280' }}>
          Showing {paginatedEntries.length} of {filteredEntries.length} entries
          {filteredEntries.length !== entries.length && ` (filtered from ${entries.length} total)`}
        </Typography>
      </Box>

      <TableContainer component={Paper} sx={{ backgroundColor: 'white', border: '1px solid #E5E7EB' }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: '#F9FAFB' }}>
              <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Time</TableCell>
              <TableCell sx={{ fontWeight: 600, color: '#374151' }}>User</TableCell>
              <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Action</TableCell>
              <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Table</TableCell>
              <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Record</TableCell>
              <TableCell sx={{ fontWeight: 600, color: '#374151' }}>IP Address</TableCell>
              <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedEntries.map((e: any) => {
              let details: any = null;
              try { details = e.new_values ? JSON.parse(e.new_values) : null; } catch {}
              const summary = details?.meta ? `${details.meta.method} ${details.meta.path} • ${details.meta.status} • ${details.meta.durationMs}ms` : '';
              return (
                <TableRow 
                  key={e.id}
                  sx={{ 
                    '&:hover': { backgroundColor: '#F9FAFB' },
                    borderBottom: '1px solid #E5E7EB'
                  }}
                >
                  <TableCell sx={{ color: '#374151' }}>
                    <Typography variant="body2">
                      {format(new Date(e.timestamp), 'MMM dd, yyyy')}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#6B7280' }}>
                      {format(new Date(e.timestamp), 'HH:mm:ss')}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ color: '#374151' }}>
                    <Chip 
                      size="small" 
                      label={e.username || 'System'} 
                      variant="outlined"
                      sx={{ 
                        backgroundColor: e.username ? '#EFF6FF' : '#F3F4F6',
                        borderColor: e.username ? '#3B82F6' : '#9CA3AF',
                        color: e.username ? '#1E40AF' : '#6B7280'
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ color: '#374151' }}>
                    <Chip 
                      size="small" 
                      label={e.action} 
                      color={e.action?.includes('CREATE') ? 'success' : 
                             e.action?.includes('DELETE') ? 'error' :
                             e.action?.includes('UPDATE') ? 'warning' : 'default'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell sx={{ color: '#6B7280' }}>{e.table_name}</TableCell>
                  <TableCell sx={{ color: '#6B7280' }}>{e.record_id}</TableCell>
                  <TableCell sx={{ color: '#374151' }}>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {e.ip_address}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ maxWidth: '300px' }}>
                    {summary && (
                      <Typography variant="caption" sx={{ color: '#6B7280', display: 'block', mb: 0.5 }}>
                        {summary}
                      </Typography>
                    )}
                    {details?.body && (
                      <Chip 
                        size="small" 
                        label={`payload: ${Object.keys(details.body).join(', ').slice(0, 40)}`} 
                        variant="outlined"
                        sx={{ backgroundColor: '#FEF3C7', borderColor: '#F59E0B', color: '#92400E' }}
                      />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, value) => setPage(value)}
            color="primary"
            showFirstButton
            showLastButton
          />
        </Box>
      )}
    </Box>
  );
};

export default AuditLog;