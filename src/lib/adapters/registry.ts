import type { OutputAdapter } from './types';
import { linemetricsAdapter } from './linemetrics-adapter';
import { httpForwardAdapter } from './http-forward-adapter';
import { logOnlyAdapter } from './log-only-adapter';

const map = new Map<string, OutputAdapter>([
  [linemetricsAdapter.id, linemetricsAdapter],
  [httpForwardAdapter.id, httpForwardAdapter],
  [logOnlyAdapter.id, logOnlyAdapter],
]);

export function getOutputAdapter(id: string): OutputAdapter | undefined {
  return map.get(id);
}

export function listOutputAdapters(): OutputAdapter[] {
  return Array.from(map.values());
}
