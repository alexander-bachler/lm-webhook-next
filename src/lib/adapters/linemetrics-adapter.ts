// eslint-disable-next-line @typescript-eslint/no-require-imports
const LineMetricsClient = require('../line-metrics-client') as new () => {
  sendData: (
    config: Record<string, unknown>,
    decodedData: Record<string, unknown>,
    deviceId: string,
    timestamp: string
  ) => Promise<{ success?: boolean; error?: string; message?: string }>;
};
import { decryptSecretIfNeeded } from '@/lib/credential-crypto';
import type { AdapterSendContext, DispatchResult, OutputAdapter } from './types';

export const linemetricsAdapter: OutputAdapter = {
  id: 'linemetrics',
  name: 'LineMetrics Cloud',
  async send(ctx: AdapterSendContext): Promise<DispatchResult> {
    try {
      const client = new LineMetricsClient();
      const cfg = { ...ctx.config };
      if (typeof cfg.clientSecret === 'string') {
        cfg.clientSecret = decryptSecretIfNeeded(cfg.clientSecret) ?? cfg.clientSecret;
      }
      const res = await client.sendData(
        cfg,
        ctx.decodedData,
        ctx.deviceEui,
        ctx.timestamp
      );
      if (res.success) {
        return { success: true, metadata: { message: res.message } };
      }
      return {
        success: false,
        error: res.error || res.message || 'LineMetrics send failed',
      };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};
