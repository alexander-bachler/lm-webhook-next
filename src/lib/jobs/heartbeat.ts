import DeviceManager from '@/lib/device-manager';
import { dispatchDeviceOutputs } from '@/lib/dispatcher';
import { getLatestWebhookForEui } from '@/lib/webhook-store';
import { insertJobRun } from '@/lib/job-runs';

function schedules(device: Record<string, unknown>) {
  return (device.schedules || {}) as {
    heartbeat?: { enabled?: boolean; maxQuietMinutes?: number };
  };
}

export async function runHeartbeatJob(): Promise<void> {
  DeviceManager.reloadDevices();
  const devices = DeviceManager.getAllDevices() as Record<string, unknown>[];
  let n = 0;
  for (const device of devices) {
    if (device.archived) continue;
    const hb = schedules(device).heartbeat;
    if (!hb?.enabled) continue;
    const maxQuiet = Math.max(5, Number(hb.maxQuietMinutes ?? 60));
    const eui = String(device.deviceEUI || '');
    if (!eui) continue;
    const last = getLatestWebhookForEui(eui);
    if (!last?.timestamp) continue;
    const lastMs = new Date(last.timestamp).getTime();
    const quietMin = (Date.now() - lastMs) / 60000;
    if (quietMin < maxQuiet) continue;
    const decoded = last.decoded_data;
    if (!decoded) continue;
    const wid = `heartbeat-${eui}-${Date.now()}`;
    await dispatchDeviceOutputs({
      webhookId: wid,
      device,
      deviceEui: eui,
      decodedData: decoded,
      timestamp: new Date().toISOString(),
    });
    n += 1;
  }
  if (n > 0) {
    insertJobRun({ jobType: 'heartbeat', status: 'ok', rowsProcessed: n });
  }
}
