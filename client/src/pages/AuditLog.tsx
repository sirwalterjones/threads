import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Typography, 
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
  InputAdornment,
  Divider,
  Collapse,
  Link,
  Avatar,
  Stack,
  Badge,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { 
  Search as SearchIcon, 
  FileDownload as ExportIcon, 
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Person as PersonIcon,
  Computer as SystemIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Login as LoginIcon,
  Logout as LogoutIcon,
  Security as SecurityIcon,
  Article as ArticleIcon,
  Comment as CommentIcon,
  Category as CategoryIcon,
  Settings as SettingsIcon,
  Info as InfoIcon
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
  const [itemsPerPage] = useState(20);
  const [expandedEntries, setExpandedEntries] = useState<Set<number>>(new Set());
  const [detailDialog, setDetailDialog] = useState<{ open: boolean; entry: any }>({ open: false, entry: null });

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

  const uniqueActions = Array.from(new Set(entries.map(e => e.action).filter(Boolean)));
  const uniqueUsers = Array.from(new Set(entries.map(e => e.username).filter(Boolean)));

  const paginatedEntries = filteredEntries.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  const totalPages = Math.ceil(filteredEntries.length / itemsPerPage);

  const toggleExpanded = (entryId: number) => {
    const newExpanded = new Set(expandedEntries);
    if (newExpanded.has(entryId)) {
      newExpanded.delete(entryId);
    } else {
      newExpanded.add(entryId);
    }
    setExpandedEntries(newExpanded);
  };

  const getActionIcon = (action: string) => {
    if (action?.includes('VIEW')) return <ViewIcon />;
    if (action?.includes('CREATE') || action?.includes('ADD')) return <AddIcon />;
    if (action?.includes('UPDATE') || action?.includes('EDIT')) return <EditIcon />;
    if (action?.includes('DELETE') || action?.includes('REMOVE')) return <DeleteIcon />;
    if (action?.includes('LOGIN')) return <LoginIcon />;
    if (action?.includes('LOGOUT')) return <LogoutIcon />;
    return <InfoIcon />;
  };

  const getActionColor = (action: string) => {
    if (action?.includes('CREATE') || action?.includes('ADD')) return '#10B981';
    if (action?.includes('UPDATE') || action?.includes('EDIT')) return '#F59E0B';
    if (action?.includes('DELETE') || action?.includes('REMOVE')) return '#EF4444';
    if (action?.includes('LOGIN')) return '#3B82F6';
    if (action?.includes('VIEW')) return '#6B7280';
    return '#8B5CF6';
  };

  const getResourceIcon = (tableName: string) => {
    if (tableName === 'posts') return <ArticleIcon />;
    if (tableName === 'comments') return <CommentIcon />;
    if (tableName === 'categories') return <CategoryIcon />;
    if (tableName === 'users') return <PersonIcon />;
    return <SettingsIcon />;
  };

  const openDetailDialog = (entry: any) => {
    setDetailDialog({ open: true, entry });
  };

  const closeDetailDialog = () => {
    setDetailDialog({ open: false, entry: null });
  };

  const renderPostLink = (postId: string | number, title?: string) => {
    if (!postId) return null;
    return (
      <Link
        href={`#/post/${postId}`}
        onClick={(e) => {
          e.preventDefault();
          // Dispatch event to open post detail modal
          const evt = new CustomEvent('open-post-detail', { detail: { postId } });
          window.dispatchEvent(evt);
        }}
        sx={{ color: '#1D9BF0', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
      >
        {title || `Post #${postId}`}
      </Link>
    );
  };

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
        <Typography variant="h4" sx={{ color: '#E7E9EA', fontWeight: 700 }}>
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
      <Card sx={{ mb: 3, backgroundColor: '#16181C', border: '1px solid #2F3336' }}>
        <CardContent sx={{ color: '#E7E9EA' }}>
          <Stack spacing={3}>
            {/* Search Field */}
            <TextField
              fullWidth
              variant="outlined"
              label="Search"
              placeholder="Search users, actions, IPs, or resources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputLabelProps={{ sx: { color: '#9CA3AF' } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#9CA3AF' }} />
                  </InputAdornment>
                ),
                endAdornment: searchQuery && (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setSearchQuery('')} size="small" sx={{ color: '#E5E7EB' }}>
                      <ClearIcon />
                    </IconButton>
                  </InputAdornment>
                )
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: '#0F1115',
                  color: '#E7E9EA',
                  '& fieldset': { borderColor: '#2F3336' },
                  '&:hover fieldset': { borderColor: '#1D9BF0' },
                  '&.Mui-focused fieldset': { borderColor: '#1D9BF0' }
                },
                '& .MuiInputLabel-root': { color: '#9CA3AF' },
                '& .MuiInputLabel-root.Mui-focused': { color: '#1D9BF0' },
                '& .MuiInputBase-input': { color: '#E7E9EA' }
              }}
            />

            {/* Filter Controls */}
            <Box sx={{ 
              display: 'flex', 
              gap: { xs: 2, sm: 3 },
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { xs: 'stretch', sm: 'center' }
            }}>
              <FormControl sx={{ flex: 1, minWidth: { xs: '100%', sm: 200 } }}>
                <InputLabel sx={{ color: '#9CA3AF' }}>Action Filter</InputLabel>
                <Select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  label="Action Filter"
                  sx={{ 
                    color: '#E7E9EA',
                    backgroundColor: '#0F1115',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#2F3336' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#1D9BF0' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1D9BF0' }
                  }}
                >
                  <MenuItem value="">All Actions</MenuItem>
                  {uniqueActions.map(action => (
                    <MenuItem key={action} value={action}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getActionIcon(action)}
                        {action}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl sx={{ flex: 1, minWidth: { xs: '100%', sm: 200 } }}>
                <InputLabel sx={{ color: '#9CA3AF' }}>User Filter</InputLabel>
                <Select
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                  label="User Filter"
                  sx={{ 
                    color: '#E7E9EA',
                    backgroundColor: '#0F1115',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#2F3336' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#1D9BF0' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1D9BF0' }
                  }}
                >
                  <MenuItem value="">All Users</MenuItem>
                  {uniqueUsers.map(user => (
                    <MenuItem key={user} value={user}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PersonIcon fontSize="small" />
                        {user}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Button
                variant="outlined"
                onClick={clearFilters}
                sx={{ 
                  height: '56px',
                  minWidth: { xs: '100%', sm: 140 },
                  borderColor: '#2F3336',
                  color: '#E7E9EA',
                  '&:hover': { borderColor: '#1D9BF0' }
                }}
              >
                Clear Filters
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="body2" sx={{ color: '#6B7280' }}>
          Showing {paginatedEntries.length} of {filteredEntries.length} entries
          {filteredEntries.length !== entries.length && ` (filtered from ${entries.length} total)`}
        </Typography>
      </Box>

      {/* Audit Entries - Card Based Layout */}
      <Stack spacing={2}>
        {paginatedEntries.map((entry: any) => {
          let details: any = null;
          try { 
            details = entry.new_values ? JSON.parse(entry.new_values) : null; 
          } catch {}

          const isExpanded = expandedEntries.has(entry.id);
          const actionColor = getActionColor(entry.action);
          
          return (
            <Card 
              key={entry.id}
              sx={{ 
                backgroundColor: '#16181C',
                border: '1px solid #2F3336',
                borderRadius: 2,
                transition: 'all 0.2s ease',
                '&:hover': {
                  backgroundColor: '#1C1F23',
                  borderColor: '#1D9BF0',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 4px 12px rgba(29, 155, 240, 0.15)'
                }
              }}
            >
              <CardContent sx={{ p: 3 }}>
                {/* Header Row */}
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                  {/* Action Icon */}
                  <Avatar 
                    sx={{ 
                      bgcolor: actionColor, 
                      width: 40, 
                      height: 40,
                      color: 'white'
                    }}
                  >
                    {getActionIcon(entry.action)}
                  </Avatar>

                  {/* Main Content */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    {/* Primary Info Row */}
                    <Box sx={{ 
                      display: 'flex', 
                      flexDirection: { xs: 'column', sm: 'row' },
                      alignItems: { xs: 'flex-start', sm: 'center' }, 
                      gap: { xs: 1, sm: 2 },
                      mb: 1
                    }}>
                      <Chip
                        icon={getActionIcon(entry.action)}
                        label={entry.action || 'UNKNOWN'}
                        size="small"
                        sx={{
                          backgroundColor: `${actionColor}20`,
                          color: actionColor,
                          border: `1px solid ${actionColor}40`,
                          fontWeight: 600,
                          '& .MuiChip-icon': { color: actionColor }
                        }}
                      />
                      
                      <Chip
                        icon={entry.username ? <PersonIcon /> : <SystemIcon />}
                        label={entry.username || 'System'}
                        size="small"
                        variant="outlined"
                        sx={{
                          borderColor: entry.username ? '#1D9BF0' : '#6B7280',
                          color: entry.username ? '#1D9BF0' : '#6B7280',
                          '& .MuiChip-icon': { color: entry.username ? '#1D9BF0' : '#6B7280' }
                        }}
                      />

                      <Typography 
                        variant="caption" 
                        sx={{ 
                          color: '#71767B',
                          fontFamily: 'monospace',
                          ml: { xs: 0, sm: 'auto' }
                        }}
                      >
                        {format(new Date(entry.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                      </Typography>
                    </Box>

                    {/* Resource Info */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1, flexWrap: 'wrap' }}>
                      {entry.table_name && (
                        <Chip
                          icon={getResourceIcon(entry.table_name)}
                          label={entry.table_name}
                          size="small"
                          variant="outlined"
                          sx={{
                            borderColor: '#2F3336',
                            color: '#E7E9EA',
                            backgroundColor: '#0F1115'
                          }}
                        />
                      )}
                      
                      {entry.record_id && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="caption" sx={{ color: '#71767B' }}>
                            ID:
                          </Typography>
                          {entry.table_name === 'posts' ? 
                            renderPostLink(entry.record_id, details?.meta?.title) :
                            <Typography variant="caption" sx={{ color: '#E7E9EA', fontWeight: 500 }}>
                              {entry.record_id}
                            </Typography>
                          }
                        </Box>
                      )}

                      {entry.ip_address && (
                        <Tooltip title="IP Address">
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              color: '#71767B',
                              fontFamily: 'monospace',
                              backgroundColor: '#2F3336',
                              px: 1,
                              py: 0.5,
                              borderRadius: 1
                            }}
                          >
                            {entry.ip_address}
                          </Typography>
                        </Tooltip>
                      )}
                    </Box>

                    {/* Quick Summary */}
                    {details?.meta && (
                      <Typography variant="body2" sx={{ color: '#71767B', mb: 2 }}>
                        {details.meta.method && details.meta.path && (
                          <>API: {details.meta.method} {details.meta.path}</>
                        )}
                        {details.meta.status && (
                          <> • Status: {details.meta.status}</>
                        )}
                        {details.meta.durationMs && (
                          <> • {details.meta.durationMs}ms</>
                        )}
                        {details.meta.title && (
                          <> • {details.meta.title}</>
                        )}
                      </Typography>
                    )}

                    {/* Action Buttons */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
                      {(details?.body || details?.meta?.changes || details?.meta?.data) && (
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          onClick={() => toggleExpanded(entry.id)}
                          sx={{
                            borderColor: '#2F3336',
                            color: '#E7E9EA',
                            '&:hover': { borderColor: '#1D9BF0' }
                          }}
                        >
                          {isExpanded ? 'Less' : 'Details'}
                        </Button>
                      )}

                      <Button
                        size="small"
                        variant="text"
                        onClick={() => openDetailDialog(entry)}
                        sx={{ color: '#1D9BF0' }}
                      >
                        Full Details
                      </Button>
                    </Box>
                  </Box>
                </Box>

                {/* Expandable Details Section */}
                <Collapse in={isExpanded}>
                  <Divider sx={{ my: 2, borderColor: '#2F3336' }} />
                  <Box sx={{ pl: { xs: 0, sm: 7 } }}>
                    {/* Edit Changes */}
                    {details?.meta?.changes && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" sx={{ color: '#E7E9EA', mb: 1, fontWeight: 600 }}>
                          Changes Made:
                        </Typography>
                        <Card sx={{ backgroundColor: '#0F1115', border: '1px solid #2F3336' }}>
                          <CardContent sx={{ p: 2 }}>
                            <pre style={{ 
                              color: '#E7E9EA', 
                              fontSize: '0.875rem', 
                              fontFamily: 'monospace',
                              whiteSpace: 'pre-wrap',
                              margin: 0
                            }}>
                              {JSON.stringify(details.meta.changes, null, 2)}
                            </pre>
                          </CardContent>
                        </Card>
                      </Box>
                    )}

                    {/* Request Body */}
                    {details?.body && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" sx={{ color: '#E7E9EA', mb: 1, fontWeight: 600 }}>
                          Request Payload:
                        </Typography>
                        <Card sx={{ backgroundColor: '#0F1115', border: '1px solid #2F3336' }}>
                          <CardContent sx={{ p: 2 }}>
                            <Stack spacing={1}>
                              {Object.entries(details.body).map(([key, value]) => (
                                <Box key={key} sx={{ display: 'flex', gap: 2 }}>
                                  <Typography 
                                    variant="caption" 
                                    sx={{ 
                                      color: '#1D9BF0', 
                                      fontWeight: 600,
                                      minWidth: 100,
                                      fontFamily: 'monospace'
                                    }}
                                  >
                                    {key}:
                                  </Typography>
                                  <Typography 
                                    variant="caption" 
                                    sx={{ 
                                      color: '#E7E9EA',
                                      fontFamily: 'monospace',
                                      wordBreak: 'break-all'
                                    }}
                                  >
                                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                  </Typography>
                                </Box>
                              ))}
                            </Stack>
                          </CardContent>
                        </Card>
                      </Box>
                    )}

                    {/* Creation Data */}
                    {details?.meta?.data && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" sx={{ color: '#E7E9EA', mb: 1, fontWeight: 600 }}>
                          Created Data:
                        </Typography>
                        <Card sx={{ backgroundColor: '#0F1115', border: '1px solid #2F3336' }}>
                          <CardContent sx={{ p: 2 }}>
                            <pre style={{ 
                              color: '#E7E9EA', 
                              fontSize: '0.875rem', 
                              fontFamily: 'monospace',
                              whiteSpace: 'pre-wrap',
                              margin: 0
                            }}>
                              {JSON.stringify(details.meta.data, null, 2)}
                            </pre>
                          </CardContent>
                        </Card>
                      </Box>
                    )}
                  </Box>
                </Collapse>
              </CardContent>
            </Card>
          );
        })}

        {/* Empty State */}
        {paginatedEntries.length === 0 && (
          <Card sx={{ 
            backgroundColor: '#16181C', 
            border: '1px solid #2F3336',
            textAlign: 'center',
            py: 6
          }}>
            <CardContent>
              <SecurityIcon sx={{ fontSize: 48, color: '#71767B', mb: 2 }} />
              <Typography variant="h6" sx={{ color: '#E7E9EA', mb: 1 }}>
                No Audit Entries Found
              </Typography>
              <Typography variant="body2" sx={{ color: '#71767B' }}>
                {filteredEntries.length === 0 && entries.length > 0 
                  ? 'Try adjusting your filters to see more results.'
                  : 'No audit log entries have been recorded yet.'
                }
              </Typography>
            </CardContent>
          </Card>
        )}
      </Stack>

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
            sx={{
              '& .MuiPaginationItem-root': {
                color: '#E7E9EA',
                borderColor: '#2F3336',
                '&:hover': {
                  backgroundColor: '#2F3336'
                }
              },
              '& .Mui-selected': {
                backgroundColor: '#1D9BF0 !important',
                color: 'white'
              }
            }}
          />
        </Box>
      )}

      {/* Detail Dialog */}
      <Dialog
        open={detailDialog.open}
        onClose={closeDetailDialog}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#16181C',
            border: '1px solid #2F3336'
          }
        }}
      >
        <DialogTitle sx={{ color: '#E7E9EA', borderBottom: '1px solid #2F3336' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {detailDialog.entry && (
              <>
                <Avatar sx={{ bgcolor: getActionColor(detailDialog.entry.action), width: 32, height: 32 }}>
                  {getActionIcon(detailDialog.entry.action)}
                </Avatar>
                Audit Entry Details - {detailDialog.entry.action}
              </>
            )}
          </Box>
        </DialogTitle>
        <DialogContent sx={{ color: '#E7E9EA', pt: 3 }}>
          {detailDialog.entry && (
            <Stack spacing={3}>
              {/* Basic Information */}
              <Card sx={{ backgroundColor: '#0F1115', border: '1px solid #2F3336' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#E7E9EA', mb: 2 }}>
                    Basic Information
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={6}>
                      <Typography variant="caption" sx={{ color: '#71767B' }}>Timestamp</Typography>
                      <Typography variant="body2" sx={{ color: '#E7E9EA' }}>
                        {format(new Date(detailDialog.entry.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                      </Typography>
                    </Grid>
                    <Grid size={6}>
                      <Typography variant="caption" sx={{ color: '#71767B' }}>User</Typography>
                      <Typography variant="body2" sx={{ color: '#E7E9EA' }}>
                        {detailDialog.entry.username || 'System'}
                      </Typography>
                    </Grid>
                    <Grid size={6}>
                      <Typography variant="caption" sx={{ color: '#71767B' }}>Action</Typography>
                      <Typography variant="body2" sx={{ color: '#E7E9EA' }}>
                        {detailDialog.entry.action}
                      </Typography>
                    </Grid>
                    <Grid size={6}>
                      <Typography variant="caption" sx={{ color: '#71767B' }}>Resource</Typography>
                      <Typography variant="body2" sx={{ color: '#E7E9EA' }}>
                        {detailDialog.entry.table_name} #{detailDialog.entry.record_id}
                      </Typography>
                    </Grid>
                    <Grid size={12}>
                      <Typography variant="caption" sx={{ color: '#71767B' }}>IP Address</Typography>
                      <Typography variant="body2" sx={{ color: '#E7E9EA', fontFamily: 'monospace' }}>
                        {detailDialog.entry.ip_address}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {/* Raw Data */}
              {detailDialog.entry.new_values && (
                <Card sx={{ backgroundColor: '#0F1115', border: '1px solid #2F3336' }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ color: '#E7E9EA', mb: 2 }}>
                      Raw Audit Data
                    </Typography>
                    <Box sx={{ 
                      backgroundColor: '#000', 
                      border: '1px solid #2F3336',
                      borderRadius: 1,
                      p: 2,
                      overflow: 'auto'
                    }}>
                      <pre style={{ 
                        color: '#E7E9EA', 
                        fontSize: '0.875rem', 
                        fontFamily: 'monospace',
                        whiteSpace: 'pre-wrap',
                        margin: 0,
                        lineHeight: 1.5
                      }}>
                        {JSON.stringify(detailDialog.entry.new_values || {}, null, 2)}
                      </pre>
                    </Box>
                  </CardContent>
                </Card>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid #2F3336' }}>
          <Button onClick={closeDetailDialog} sx={{ color: '#E7E9EA' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AuditLog;