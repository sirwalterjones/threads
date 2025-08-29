import React from 'react';
import { Card, CardContent, Typography, Box, Chip } from '@mui/material';
import { Campaign as BOLOIcon, LocationOn, Warning } from '@mui/icons-material';
import { format } from 'date-fns';

interface BOLOSearchCardProps {
  bolo: any;
  onClick: (bolo: any) => void;
  highlightText?: (text: string) => React.ReactNode;
}

const BOLOSearchCard: React.FC<BOLOSearchCardProps> = ({ bolo, onClick, highlightText }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#28c76f';
      case 'pending': return '#ffa502';
      case 'resolved': return '#a9b0b6';
      case 'cancelled': return '#ff4757';
      case 'expired': return '#7d8388';
      default: return '#a9b0b6';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'immediate': return '#ff4757';
      case 'high': return '#ffa502';
      case 'medium': return '#2fa9ff';
      case 'low': return '#a9b0b6';
      default: return '#a9b0b6';
    }
  };

  const displayText = (text: string) => {
    if (highlightText && text) {
      return highlightText(text);
    }
    return text || '';
  };

  return (
    <Card
      sx={{
        height: '100%',
        backgroundColor: '#16181C',
        border: '3px solid #2fa9ff', // Blue border for BOLOs
        borderRadius: 2,
        cursor: 'pointer',
        transition: 'all 0.2s ease-in-out',
        position: 'relative',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 10px 30px rgba(47, 169, 255, 0.3)', // Blue shadow on hover
          borderColor: '#1D9BF0',
        },
      }}
      onClick={() => onClick(bolo)}
    >
      <CardContent>
        {/* BOLO Badge */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <BOLOIcon sx={{ color: '#2fa9ff', fontSize: 20 }} />
          <Typography variant="caption" sx={{ color: '#2fa9ff', fontWeight: 600 }}>
            BOLO #{bolo.case_number}
          </Typography>
          <Chip 
            label={bolo.status} 
            size="small" 
            sx={{ 
              ml: 'auto',
              backgroundColor: 'transparent',
              color: getStatusColor(bolo.status),
              border: `1px solid ${getStatusColor(bolo.status)}`,
              fontSize: '0.7rem'
            }} 
          />
        </Box>

        {/* Title */}
        <Typography 
          variant="h6" 
          sx={{ 
            color: '#E7E9EA',
            fontWeight: 600,
            mb: 1,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            fontSize: '1rem'
          }}
        >
          {displayText(bolo.title)}
        </Typography>

        {/* Priority */}
        {bolo.priority && (
          <Chip 
            label={bolo.priority.toUpperCase()} 
            size="small" 
            sx={{ 
              mb: 1,
              backgroundColor: `${getPriorityColor(bolo.priority)}20`,
              color: getPriorityColor(bolo.priority),
              border: `1px solid ${getPriorityColor(bolo.priority)}`,
              fontSize: '0.7rem',
              fontWeight: 600
            }} 
          />
        )}

        {/* Subject Info */}
        {bolo.subject_name && (
          <Box sx={{ mb: 1 }}>
            <Typography variant="body2" sx={{ color: '#8B98A5', fontSize: '0.85rem' }}>
              Subject: <span style={{ color: '#E7E9EA' }}>{displayText(bolo.subject_name)}</span>
            </Typography>
          </Box>
        )}

        {/* Location */}
        {bolo.incident_location && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
            <LocationOn sx={{ color: '#8B98A5', fontSize: 16 }} />
            <Typography variant="body2" sx={{ color: '#8B98A5', fontSize: '0.85rem' }}>
              {displayText(bolo.incident_location)}
            </Typography>
          </Box>
        )}

        {/* Vehicle Info */}
        {bolo.vehicle_description && (
          <Typography variant="body2" sx={{ color: '#8B98A5', fontSize: '0.85rem', mb: 1 }}>
            Vehicle: <span style={{ color: '#E7E9EA' }}>{displayText(bolo.vehicle_description)}</span>
          </Typography>
        )}

        {/* Description */}
        {bolo.subject_description && (
          <Typography 
            variant="body2" 
            sx={{ 
              color: '#71767B',
              mb: 2,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              fontSize: '0.85rem'
            }}
          >
            {displayText(bolo.subject_description)}
          </Typography>
        )}

        {/* Footer */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          pt: 1,
          borderTop: '1px solid #2F3336'
        }}>
          <Typography variant="caption" sx={{ color: '#71767B' }}>
            {bolo.incident_date ? format(new Date(bolo.incident_date), 'MMM dd, yyyy') : 
             format(new Date(bolo.created_at), 'MMM dd, yyyy')}
          </Typography>
          <Typography variant="caption" sx={{ color: '#71767B' }}>
            by {bolo.creator_username || 'Unknown'}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default BOLOSearchCard;