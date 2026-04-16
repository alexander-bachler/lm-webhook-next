import DeviceManager from '@/lib/device-manager';
import { dispatchDeviceOutputs } from '@/lib/dispatcher';
import { listWebhooksPendingDispatch, updateWebhookLineMetricsSent } from '@/lib/webhook-store';
import { insertJobRun } from '@/lib/job-runs';

export async function runResyncJob(): Promise<void> {
  DeviceManager.reloadDevices();
  const pending = listWebhooksPendingDispatch(40);
  let ok = 0;
  let fail = 0;
  for (const row of pending) {
    const lookbackMs = 48 * 60 * 60 * 1000;
    if (Date.now() - new Date(row.timestamp).getTime() > lookbackMs) continue;
    const eui = row.device_eui;
    if (!eui) continue;
    const device = DeviceManager.getDeviceByEUI(eui) as Record<string, unknown> | null;
    if (!device) continue;
    const res = schedulesResync(device);
    if (!res.enabled) continue;
    const decoded = row.decoded_data;
    if (!decoded) continue;
    const disp = await dispatchDeviceOutputs({
      webhookId: row.id,
      device,
      deviceEui: eui,
      decodedData: decoded,
      timestamp: row.timestamp,
    });
    if (disp.anySuccess) {
      updateWebhookLineMetricsSent(row.id, true);
      ok += 1;
    } else {
      fail += 1;
    }
  }
  if (ok + fail > 0) {
    insertJobRun({
      jobType: 'resync',
      status: 'ok',
      rowsProcessed: ok,
      metadata: { failed: fail },
    });
  }
}

function schedulesResync(device: Record<string, unknown>) {
  const s = (device.schedules || {}) as {
    resync?: { enabled?: boolean };
  };
  return { enabled: s.resync?.enabled === true };
}
