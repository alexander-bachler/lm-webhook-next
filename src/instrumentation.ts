export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.SCHEDULER_DISABLED !== '1') {
    try {
      const { startScheduler } = await import('@/lib/scheduler');
      startScheduler();
    } catch (e) {
      console.error('[instrumentation] failed to start scheduler:', e);
    }
  }
}
