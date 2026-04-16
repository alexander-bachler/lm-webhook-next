import DeviceManager from '@/lib/device-manager';
import { dispatchDeviceOutputs } from '@/lib/dispatcher';
import { queryWebhooksInWindow } from '@/lib/webhook-store';
import { insertJobRun } from '@/lib/job-runs';

type AggMethod = 'sum' | 'avg' | 'min' | 'max' | 'last';

function schedules(device: Record<string, unknown>) {
  return (device.schedules || {}) as {
    aggregation?: {
      enabled?: boolean;
      windowMinutes?: number;
      method?: AggMethod;
      field?: string;
    };
  };
}

function aggregateValues(values: number[], method: AggMethod): number | null {
  if (values.length === 0) return null;
  if (method === 'last') return values[values.length - 1];
  if (method === 'sum') return values.reduce((a, b) => a + b, 0);
  if (method === 'avg') return values.reduce((a, b) => a + b, 0) / values.length;
  if (method === 'min') return Math.min(...values);
  if (method === 'max') return Math.max(...values);
  return null;
}

export async function runAggregateJob(): Promise<void> {
  DeviceManager.reloadDevices();
  const devices = DeviceManager.getAllDevices() as Record<string, unknown>[];
  let processed = 0;
  const end = new Date();
  for (const device of devices) {
    if (device.archived) continue;
    const agg = schedules(device).aggregation;
    if (!agg?.enabled) continue;
    const windowMin = Math.max(5, Number(agg.windowMinutes ?? 60));
    const method = (agg.method || 'last') as AggMethod;
    const field = String(agg.field || 'meterVolume');
    const start = new Date(end.getTime() - windowMin * 60 * 1000);
    const eui = String(device.deviceEUI || '');
    if (!eui) continue;
    const rows = queryWebhooksInWindow(eui, start.toISOString(), end.toISOString());
    const nums: number[] = [];
    for (const r of rows) {
      const d = r.decoded_data;
      if (!d || typeof d !== 'object') continue;
      const v = (d as Record<string, unknown>)[field];
      if (typeof v === 'number' && !Number.isNaN(v)) nums.push(v);
    }
    const val = aggregateValues(nums, method);
    if (val == null) continue;
    const decodedData = { [field]: val, _aggregated: true, _windowMinutes: windowMin };
    const wid = `aggregate-${eui}-${end.toISOString()}`;
    await dispatchDeviceOutputs({
      webhookId: wid,
      device,
      deviceEui: eui,
      decodedData,
      timestamp: end.toISOString(),
    });
    processed += 1;
  }
  if (processed > 0) {
    insertJobRun({ jobType: 'aggregation', status: 'ok', rowsProcessed: processed });
  }
}
