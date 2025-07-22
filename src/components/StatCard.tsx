'use client';

import React from 'react';
import { Card, CardContent, Typography, Box, Skeleton } from '@mui/material';
import { TrendingUp, TrendingDown, Remove } from '@mui/icons-material';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: number;
  loading?: boolean;
  color?: 'primary' | 'success' | 'error' | 'warning' | 'info';
  icon?: React.ReactNode;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  loading = false,
  color = 'primary',
  icon,
}) => {
  const getColorValue = () => {
    switch (color) {
      case 'success':
        return '#10b981';
      case 'error':
        return '#ef4444';
      case 'warning':
        return '#f59e0b';
      case 'info':
        return '#3b82f6';
      default:
        return '#6366f1';
    }
  };

  const getTrendIcon = () => {
    if (!trend) return <Remove sx={{ fontSize: 16, color: 'text.secondary' }} />;
    if (trend > 0) return <TrendingUp sx={{ fontSize: 16, color: 'success.main' }} />;
    return <TrendingDown sx={{ fontSize: 16, color: 'error.main' }} />;
  };

  if (loading) {
    return (
      <Card sx={{ height: '100%' }}>
        <CardContent>
          <Skeleton variant="text" width="60%" height={24} />
          <Skeleton variant="text" width="40%" height={32} sx={{ mt: 1 }} />
          <Skeleton variant="text" width="80%" height={16} sx={{ mt: 1 }} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      sx={{ 
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: `linear-gradient(90deg, ${getColorValue()}, ${getColorValue()}80)`,
        },
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="body2" color="text.secondary" fontWeight={500}>
            {title}
          </Typography>
          {icon && (
            <Box
              sx={{
                p: 1,
                borderRadius: 2,
                backgroundColor: `${getColorValue()}15`,
                color: getColorValue(),
              }}
            >
              {icon}
            </Box>
          )}
        </Box>
        
        <Typography 
          variant="h3" 
          component="div" 
          fontWeight={700}
          sx={{ 
            color: getColorValue(),
            mb: 1,
            fontSize: { xs: '1.75rem', sm: '2rem', md: '2.5rem' }
          }}
        >
          {value}
        </Typography>
        
        {(subtitle || trend !== undefined) && (
          <Box display="flex" alignItems="center" gap={1}>
            {trend !== undefined && getTrendIcon()}
            <Typography variant="body2" color="text.secondary">
              {subtitle || (trend !== undefined ? `${trend > 0 ? '+' : ''}${trend}%` : '')}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default StatCard; 