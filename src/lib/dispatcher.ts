import { getOutputAdapter } from './adapters/registry';
import type { DeviceOutputSpec } from './adapters/types';
import { insertDispatchLog } from './dispatch-log';

function getTimeoutMs(): number {
  return Math.min(60000, Math.max(3000, parseInt(process.env.ADAPTER_TIMEOUT_MS || '15000', 10) || 15000));
}

function normalizeOutputs(device: Record<string, unknown>): DeviceOutputSpec[] {
  const raw = device.outputs;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw
      .filter((o) => o && typeof o === 'object' && (o as DeviceOutputSpec).adapterId)
      .map((o) => {
        const x = o as DeviceOutputSpec;
        return {
          adapterId: String(x.adapterId),
          enabled: x.enabled !== false,
          config: (x.config || {}) as Record<string, unknown>,
        };
      })
      .filter((o) => o.enabled);
  }
  const lm = device.lineMetrics as { enabled?: boolean } | undefined;
  if (lm && lm.enabled) {
    return [{ adapterId: 'linemetrics', enabled: true, config: lm as Record<string, unknown> }];
  }
  return [];
}

export interface DispatchParams {
  webhookId: string;
  device: Record<string, unknown>;
  deviceEui: string;
  decodedData: Record<string, unknown> | null;
  timestamp: string;
}

export async function dispatchDeviceOutputs(params: DispatchParams): Promise<{
  anySuccess: boolean;
  errors: string[];
}> {
  const { webhookId, device, deviceEui, decodedData, timestamp } = params;
  const errors: string[] = [];
  if (!decodedData) {
    return { anySuccess: false, errors: ['No decoded data'] };
  }

  const outputs = normalizeOutputs(device);
  if (outputs.length === 0) {
    return { anySuccess: false, errors: [] };
  }

  const deviceId = String(device.deviceId ?? device.deviceEUI ?? deviceEui);
  let anySuccess = false;
  const timeoutMs = getTimeoutMs();

  await Promise.all(
    outputs.map(async (spec) => {
      const adapter = getOutputAdapter(spec.adapterId);
      if (!adapter) {
        errors.push(`Unknown adapter: ${spec.adapterId}`);
        insertDispatchLog({
          webhookId,
          deviceId,
          adapterId: spec.adapterId,
          status: 'error',
          error: 'unknown adapter',
        });
        return;
      }

      try {
        const result = await Promise.race([
          adapter.send({
            webhookId,
            deviceId,
            deviceEui,
            decodedData,
            timestamp,
            config: spec.config || {},
          }),
          new Promise<{ success: false; error: string }>((resolve) =>
            setTimeout(() => resolve({ success: false, error: 'adapter timeout' }), timeoutMs)
          ),
        ]);

        const ok = Boolean(result.success);
        if (ok) {
          anySuccess = true;
        }
        if (!result.success && 'error' in result && result.error) {
          errors.push(`${adapter.id}: ${result.error}`);
        }
        insertDispatchLog({
          webhookId,
          deviceId,
          adapterId: adapter.id,
          status: ok ? 'ok' : 'error',
          error: ok ? undefined : 'error' in result ? result.error : 'failed',
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${spec.adapterId}: ${msg}`);
        insertDispatchLog({
          webhookId,
          deviceId,
          adapterId: spec.adapterId,
          status: 'error',
          error: msg,
        });
      }
    })
  );

  return { anySuccess, errors };
}
