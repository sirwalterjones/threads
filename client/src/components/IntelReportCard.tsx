import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Avatar
} from '@mui/material';
import { Security, AssignmentInd } from '@mui/icons-material';
import { format } from 'date-fns';

interface IntelReport {
  id: number;
  intel_number: string;
  title: string;
  content: string;
  excerpt: string;
  agent_name: string;
  wp_published_date: string;
  classification: string;
  status: string;
  result_type: 'intel_report';
}

interface IntelReportCardProps {
  report: IntelReport;
  onClick: (reportId: number) => void;
  highlightText?: (text: string) => React.ReactNode;
}

const IntelReportCard: React.FC<IntelReportCardProps> = ({
  report,
  onClick,
  highlightText = (text) => text
}) => {
  const getClassificationColor = (classification: string) => {
    switch (classification.toLowerCase()) {
      case 'classified':
        return '#ef4444'; // Red
      case 'confidential':
        return '#f59e0b'; // Orange
      case 'restricted':
        return '#eab308'; // Yellow
      default:
        return '#10b981'; // Green for unclassified
    }
  };

  return (
    <Card
      sx={{
        height: '100%',
        backgroundColor: '#16181C',
        border: '3px solid #f97316', // Distinctive orange border for intel reports
        borderRadius: 2,
        cursor: 'pointer',
        transition: 'all 0.2s ease-in-out',
        position: 'relative',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 10px 15px -3px rgba(249, 115, 22, 0.3), 0 4px 6px -2px rgba(249, 115, 22, 0.1)',
          borderColor: '#ea580c',
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: 'linear-gradient(90deg, #f97316, #ea580c, #dc2626)',
          borderRadius: '4px 4px 0 0'
        }
      }}
      onClick={() => onClick(report.id)}
    >
      <CardContent>
        {/* Intel Report Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
          <Avatar
            sx={{
              backgroundColor: '#f97316',
              color: 'white',
              width: 32,
              height: 32,
            }}
          >
            <Security sx={{ fontSize: 18 }} />
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography
              variant="caption"
              sx={{
                color: '#f97316',
                fontWeight: 600,
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                display: 'flex',
                alignItems: 'center',
                gap: 0.5
              }}
            >
              Intel Report • {report.intel_number}
            </Typography>
          </Box>
          <Chip
            label={report.classification}
            size="small"
            sx={{
              backgroundColor: getClassificationColor(report.classification),
              color: 'white',
              fontWeight: 600,
              fontSize: '0.7rem',
              height: 20
            }}
          />
        </Box>

        {/* Title */}
        <Typography
          variant="h6"
          component="h2"
          gutterBottom
          sx={{
            color: '#E7E9EA',
            fontSize: '1rem',
            mb: 1,
            fontWeight: 600
          }}
        >
          {highlightText(report.title)}
        </Typography>

        {/* Summary/Content */}
        {(() => {
          const text = report.content || report.excerpt || '';
          if (!text) return null;
          return (
            <Typography
              variant="body2"
              sx={{
                color: '#6B7280',
                mb: 2,
                fontSize: '0.875rem',
                lineHeight: 1.4
              }}
            >
              {highlightText(text.substring(0, 200))}
              {text.length > 200 ? '...' : ''}
            </Typography>
          );
        })()}

        {/* Footer */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mt: 2,
            pt: 1,
            borderTop: '1px solid #2F3336'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AssignmentInd sx={{ fontSize: 14, color: '#71767B' }} />
            <Typography variant="caption" sx={{ color: '#71767B', fontSize: '0.75rem' }}>
              Agent: {report.agent_name}
            </Typography>
          </Box>
          
          <Typography variant="caption" sx={{ color: '#71767B', fontSize: '0.75rem' }}>
            {format(new Date(report.wp_published_date), 'MMM d, yyyy')}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default IntelReportCard;