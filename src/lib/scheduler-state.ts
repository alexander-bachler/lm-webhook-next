/**
 * Scheduler health flag (set by scheduler when running).
 */
let schedulerRunning = false;

export function setSchedulerRunning(running: boolean): void {
  schedulerRunning = running;
}

export function isSchedulerRunning(): boolean {
  return schedulerRunning;
}
