'use client';

import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  IconButton,
  Collapse,
  Tooltip,
} from '@mui/material';
import {
  ExpandMore,
  ExpandLess,
  CheckCircle,
  Error,
  Schedule,
  Router,
  SignalCellular4Bar,
  AccessTime,
} from '@mui/icons-material';

interface WebhookCardProps {
  deviceId: string;
  timestamp: string;
  payload: string;
  endpoint: string;
  fPort: number;
  rssi: number;
  processingTime: number;
  status: 'success' | 'error';
  onExpand?: () => void;
  expanded?: boolean;
}

const WebhookCard: React.FC<WebhookCardProps> = ({
  deviceId,
  timestamp,
  payload,
  endpoint,
  fPort,
  rssi,
  processingTime,
  status,
  onExpand,
  expanded = false,
}) => {
  const getStatusColor = () => {
    return status === 'success' ? 'success' : 'error';
  };

  const getStatusIcon = () => {
    return status === 'success' ? <CheckCircle /> : <Error />;
  };

  const formatPayload = (payload: string) => {
    if (payload.length > 50) {
      return `${payload.substring(0, 50)}...`;
    }
    return payload;
  };

  return (
    <Card
      sx={{
        mb: 2,
        position: 'relative',
        overflow: 'visible',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: status === 'success' 
            ? 'linear-gradient(90deg, #10b981, #34d399)' 
            : 'linear-gradient(90deg, #ef4444, #f87171)',
          borderRadius: '12px 12px 0 0',
        },
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box display="flex" alignItems="flex-start" justifyContent="space-between">
          <Box flex={1}>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <Typography variant="h6" fontWeight={600} color="text.primary">
                {deviceId}
              </Typography>
              <Chip
                icon={getStatusIcon()}
                label={status === 'success' ? 'Erfolgreich' : 'Fehler'}
                color={getStatusColor()}
                size="small"
                sx={{ fontWeight: 600 }}
              />
            </Box>

            <Typography variant="body2" color="text.secondary" mb={2}>
              {timestamp}
            </Typography>

            <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
              <Chip
                icon={<Router />}
                label={`Endpoint: ${endpoint}`}
                variant="outlined"
                size="small"
                sx={{ fontSize: '0.75rem' }}
              />
              <Chip
                icon={<SignalCellular4Bar />}
                label={`FPort: ${fPort}`}
                variant="outlined"
                size="small"
                sx={{ fontSize: '0.75rem' }}
              />
              <Chip
                icon={<SignalCellular4Bar />}
                label={`RSSI: ${rssi}`}
                variant="outlined"
                size="small"
                sx={{ fontSize: '0.75rem' }}
              />
              <Chip
                icon={<AccessTime />}
                label={`${processingTime}ms`}
                variant="outlined"
                size="small"
                sx={{ fontSize: '0.75rem' }}
              />
            </Box>

            <Collapse in={expanded}>
              <Box
                sx={{
                  p: 2,
                  backgroundColor: 'grey.50',
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'grey.200',
                }}
              >
                <Typography variant="body2" fontFamily="monospace" fontSize="0.75rem">
                  {payload}
                </Typography>
              </Box>
            </Collapse>

            {!expanded && (
              <Typography variant="body2" color="text.secondary" fontFamily="monospace">
                {formatPayload(payload)}
              </Typography>
            )}
          </Box>

          <Tooltip title={expanded ? 'Weniger anzeigen' : 'Mehr anzeigen'}>
            <IconButton
              onClick={onExpand}
              sx={{
                ml: 1,
                transition: 'transform 0.2s ease-in-out',
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            >
              {expanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Tooltip>
        </Box>
      </CardContent>
    </Card>
  );
};

export default WebhookCard; 