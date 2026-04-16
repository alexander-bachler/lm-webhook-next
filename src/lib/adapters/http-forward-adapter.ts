import type { AdapterSendContext, DispatchResult, OutputAdapter } from './types';

export const httpForwardAdapter: OutputAdapter = {
  id: 'http-forward',
  name: 'HTTP forward (POST JSON)',
  async send(ctx: AdapterSendContext): Promise<DispatchResult> {
    const url = ctx.config.url != null ? String(ctx.config.url) : '';
    if (!url) {
      return { success: false, error: 'http-forward: missing config.url' };
    }
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(typeof ctx.config.headers === 'object' && ctx.config.headers !== null
        ? (ctx.config.headers as Record<string, string>)
        : {}),
    };
    const body = {
      webhookId: ctx.webhookId,
      deviceId: ctx.deviceId,
      deviceEui: ctx.deviceEui,
      timestamp: ctx.timestamp,
      decodedData: ctx.decodedData,
    };
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) {
        const t = await r.text();
        return { success: false, error: `HTTP ${r.status}: ${t.slice(0, 200)}` };
      }
      return { success: true, metadata: { status: r.status } };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};
