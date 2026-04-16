export interface DispatchResult {
  success: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface AdapterSendContext {
  webhookId: string;
  deviceId: string;
  deviceEui: string;
  decodedData: Record<string, unknown>;
  timestamp: string;
  config: Record<string, unknown>;
}

export interface OutputAdapter {
  id: string;
  name: string;
  send(ctx: AdapterSendContext): Promise<DispatchResult>;
}

export interface DeviceOutputSpec {
  adapterId: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
}
