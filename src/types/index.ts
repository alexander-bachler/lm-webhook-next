// Webhook Types
export interface WebhookData {
  id: string;
  timestamp: string;
  deviceId?: string;
  deviceEUI?: string;
  payload: string;
  fPort?: number;
  rssi?: number;
  snr?: number;
  gatewayId?: string;
  endpoint: string;
  success: boolean;
  processingTime?: number;
  decodedData?: any;
  metadata?: {
    usedDecoder?: string;
    detectedFormat?: string;
    processingTime?: number;
    deviceFound?: boolean;
    decoderUsed?: string;
  };
}

// Device Types
export interface Device {
  id: string;
  name: string;
  deviceEUI?: string;
  manufacturer?: string;
  model?: string;
  description?: string;
  decoder: string;
  image?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// Decoder Types
export interface Decoder {
  id: string;
  name: string;
  manufacturer?: string;
  model?: string;
  description?: string;
  category: string;
  icon?: string;
  repository: 'builtin' | 'os2iot' | 'ttn' | 'rakwireless' | 'ttn-community';
  version?: string;
  author?: string;
  license?: string;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: any;
}

// Configuration Types
export interface LineMetricsConfig {
  apiUrl: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
}

export interface WebhookSiteConfig {
  token: string;
  apiKey?: string;
  enabled: boolean;
}

export interface AppConfig {
  lineMetrics: LineMetricsConfig;
  webhookSite: WebhookSiteConfig;
  server: {
    port: number;
    host: string;
  };
}

// Log Types
export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  service?: string;
  metadata?: any;
}

// Navigation Types
export interface NavItem {
  id: string;
  href: string;
  icon: string;
  title: string;
  subtitle: string;
  description: string;
}

// Payload Test Types
export interface PayloadTestRequest {
  payload: string;
  decoder: string;
  fPort?: number;
}

export interface PayloadTestResponse {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    usedDecoder: string;
    detectedFormat?: string;
    processingTime: number;
  };
}

// Historical Data Types
export interface HistoricalDataRequest {
  source: 'local' | 'webhook.site' | 'combined';
  limit?: number;
  startDate?: string;
  endDate?: string;
}

export interface HistoricalDataResponse {
  success: boolean;
  data: WebhookData[];
  metadata: {
    total: number;
    source: string;
    timeRange?: {
      start: string;
      end: string;
    };
  };
} 