import cron from 'node-cron';
import { setSchedulerRunning } from '@/lib/scheduler-state';
import { runHeartbeatJob } from '@/lib/jobs/heartbeat';
import { runAggregateJob } from '@/lib/jobs/aggregate';
import { runResyncJob } from '@/lib/jobs/resync';

declare global {
  // eslint-disable-next-line no-var
  var __lmWebhookSchedulerStarted: boolean | undefined;
}

export function startScheduler(): void {
  if (globalThis.__lmWebhookSchedulerStarted) return;
  if (process.env.SCHEDULER_DISABLED === '1') {
    console.info('[scheduler] disabled via SCHEDULER_DISABLED=1');
    return;
  }
  globalThis.__lmWebhookSchedulerStarted = true;
  setSchedulerRunning(true);
  console.info('[scheduler] started (heartbeat + aggregate + resync)');

  cron.schedule('*/2 * * * *', () => {
    void runHeartbeatJob().catch((e) => console.error('[scheduler] heartbeat', e));
  });

  cron.schedule('*/5 * * * *', () => {
    void runAggregateJob().catch((e) => console.error('[scheduler] aggregate', e));
    void runResyncJob().catch((e) => console.error('[scheduler] resync', e));
  });
}
