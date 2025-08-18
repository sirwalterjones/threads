import React, { useEffect, useState } from 'react';
import { Box, Typography, Table, TableHead, TableRow, TableCell, TableBody, Paper, TableContainer, Alert, Chip } from '@mui/material';
import apiService from '../services/api';

const AuditLog: React.FC = () => {
  const [entries, setEntries] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    apiService.getAuditLog({ page:1, limit:50 }).then((d:any)=> setEntries(d.auditEntries || [])).catch((e:any)=> setError(e?.response?.data?.error || 'Failed to load audit log'));
  }, []);

  return (
    <Box sx={{ p:2 }}>
      <Typography variant="h5" sx={{ mb:2 }}>Audit Log</Typography>
      {error && <Alert severity="error" sx={{ mb:2 }}>{error}</Alert>}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Time</TableCell>
              <TableCell>User</TableCell>
              <TableCell>Action</TableCell>
              <TableCell>Table</TableCell>
              <TableCell>Record</TableCell>
              <TableCell>IP</TableCell>
              <TableCell>Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {entries.map((e:any)=> {
              let details: any = null;
              try { details = e.new_values ? JSON.parse(e.new_values) : null; } catch {}
              const summary = details?.meta ? `${details.meta.method} ${details.meta.path} • ${details.meta.status} • ${details.meta.durationMs}ms` : '';
              return (
                <TableRow key={e.id}>
                  <TableCell>{e.timestamp}</TableCell>
                  <TableCell>{e.username}</TableCell>
                  <TableCell>{e.action}</TableCell>
                  <TableCell>{e.table_name}</TableCell>
                  <TableCell>{e.record_id}</TableCell>
                  <TableCell>{e.ip_address}</TableCell>
                  <TableCell>
                    {summary && <Typography variant="caption">{summary}</Typography>}
                    {details?.body && (
                      <Box sx={{ mt: 0.5 }}>
                        <Chip size="small" label={`payload: ${Object.keys(details.body).join(', ').slice(0, 40)}`} />
                      </Box>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default AuditLog;


