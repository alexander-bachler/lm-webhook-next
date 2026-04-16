import { NextResponse } from 'next/server';
import { pingWebhookDb } from '@/lib/webhook-store';
import { isSchedulerRunning } from '@/lib/scheduler-state';

export const runtime = 'nodejs';

const startedAt = Date.now();

export async function GET() {
  const dbOk = pingWebhookDb();
  const schedulerExpected = process.env.SCHEDULER_ENABLED === '1';
  const schedulerOk =
    !schedulerExpected || isSchedulerRunning() || process.env.SCHEDULER_DISABLED === '1';
  const ok = dbOk && schedulerOk;

  return NextResponse.json(
    {
      status: ok ? 'ok' : 'degraded',
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      dbOk,
      schedulerOk,
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 }
  );
}
