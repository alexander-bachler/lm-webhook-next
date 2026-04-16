import type { AdapterSendContext, DispatchResult, OutputAdapter } from './types';

export const logOnlyAdapter: OutputAdapter = {
  id: 'log-only',
  name: 'Log only (debug)',
  async send(ctx: AdapterSendContext): Promise<DispatchResult> {
    console.info('[log-only adapter]', {
      webhookId: ctx.webhookId,
      deviceEui: ctx.deviceEui,
      fieldCount: Object.keys(ctx.decodedData || {}).length,
    });
    return { success: true, metadata: { logged: true } };
  },
};
