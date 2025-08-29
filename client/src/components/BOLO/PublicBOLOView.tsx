import React from 'react';
import { Container, Paper, Typography, Box } from '@mui/material';
import BOLODetail from './BOLODetail';

const PublicBOLOView: React.FC = () => {
  return (
    <Container maxWidth="lg" sx={{ mt: 3 }}>
      <Paper sx={{ p: 2, mb: 2, bgcolor: 'primary.main', color: 'white' }}>
        <Box textAlign="center">
          <Typography variant="h4" component="h1" gutterBottom>
            Vector Intelligence
          </Typography>
          <Typography variant="subtitle1">
            Law Enforcement Intelligence Platform
          </Typography>
        </Box>
      </Paper>
      
      <BOLODetail isPublic={true} />
      
      <Paper sx={{ p: 2, mt: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="textSecondary">
          This BOLO has been shared publicly. For more information, contact the issuing agency.
        </Typography>
        <Typography variant="caption" color="textSecondary" display="block" sx={{ mt: 1 }}>
          Powered by Vector Intelligence • Cherokee Sheriff's Office
        </Typography>
      </Paper>
    </Container>
  );
};

export default PublicBOLOView;