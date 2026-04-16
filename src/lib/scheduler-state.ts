/**
 * Scheduler health flag. Stored on globalThis so it survives Next.js
 * module chunk duplication between the instrumentation bundle and the
 * route bundles.
 */
declare global {
  // eslint-disable-next-line no-var
  var __lmWebhookSchedulerRunning: boolean | undefined;
}

export function setSchedulerRunning(running: boolean): void {
  globalThis.__lmWebhookSchedulerRunning = running;
}

export function isSchedulerRunning(): boolean {
  return globalThis.__lmWebhookSchedulerRunning === true;
}
