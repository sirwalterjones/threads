import React from 'react';
import { Card, CardContent, Typography, Box, Avatar } from '@mui/material';
import { SvgIconComponent } from '@mui/icons-material';

interface DashboardCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative';
  period?: string;
  icon: SvgIconComponent;
  iconColor: string;
  iconBgColor: string;
}

const DashboardCard: React.FC<DashboardCardProps> = ({
  title,
  value,
  change,
  changeType = 'positive',
  period,
  icon: Icon,
  iconColor,
  iconBgColor
}) => {
  return (
    <Card
      sx={{
        borderRadius: 3,
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        backgroundColor: 'white',
        border: '1px solid #E5E7EB',
        overflow: 'visible',
        position: 'relative',
        borderLeft: `4px solid ${iconColor}`,
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
        }
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography
              variant="caption"
              sx={{
                color: '#6B7280',
                fontWeight: 600,
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
            >
              {title}
            </Typography>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                color: '#111827',
                mt: 1,
                mb: 1
              }}
            >
              {value}
            </Typography>
            {change && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography
                  variant="body2"
                  sx={{
                    color: changeType === 'positive' ? '#10B981' : '#EF4444',
                    fontWeight: 600,
                    fontSize: '0.875rem'
                  }}
                >
                  {changeType === 'positive' ? '▲' : '▼'} {change}
                </Typography>
                {period && (
                  <Typography
                    variant="body2"
                    sx={{
                      color: '#6B7280',
                      fontSize: '0.875rem'
                    }}
                  >
                    {period}
                  </Typography>
                )}
              </Box>
            )}
          </Box>
          
          <Avatar
            sx={{
              backgroundColor: iconBgColor,
              color: iconColor,
              width: 56,
              height: 56,
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}
          >
            <Icon sx={{ fontSize: 28 }} />
          </Avatar>
        </Box>
      </CardContent>
    </Card>
  );
};

export default DashboardCard;