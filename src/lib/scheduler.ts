import cron from 'node-cron';
import { setSchedulerRunning } from '@/lib/scheduler-state';
import { runHeartbeatJob } from '@/lib/jobs/heartbeat';
import { runAggregateJob } from '@/lib/jobs/aggregate';
import { runResyncJob } from '@/lib/jobs/resync';

let started = false;

export function startScheduler(): void {
  if (started) return;
  if (process.env.SCHEDULER_DISABLED === '1') {
    return;
  }
  started = true;
  setSchedulerRunning(true);

  cron.schedule('*/2 * * * *', () => {
    void runHeartbeatJob().catch((e) => console.error('[scheduler] heartbeat', e));
  });

  cron.schedule('*/5 * * * *', () => {
    void runAggregateJob().catch((e) => console.error('[scheduler] aggregate', e));
    void runResyncJob().catch((e) => console.error('[scheduler] resync', e));
  });
}
