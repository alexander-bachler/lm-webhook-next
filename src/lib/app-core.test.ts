import { describe, it, expect, afterAll } from 'vitest';
import { decodePayloadCore } from './payload-decode';
import { storeWebhook, queryWebhooks, closeWebhookDb } from './webhook-store';
import { dispatchDeviceOutputs } from './dispatcher';

describe('decodePayloadCore', () => {
  it('raw decoder round-trip', async () => {
    const r = await decodePayloadCore({ payload: '010203', decoder: 'raw', fPort: 1 });
    expect(r.success).toBe(true);
    expect(r.decodedData.raw_hex).toBe('010203');
    expect(Array.isArray(r.decodedData.raw_bytes)).toBe(true);
  });
});

describe('webhook-store', () => {
  afterAll(() => {
    closeWebhookDb();
  });

  it('storeWebhook and queryWebhooks persist rows', () => {
    const ts = new Date().toISOString();
    const id = storeWebhook({
      timestamp: ts,
      deviceEui: 'AABBCCDDEEFF0011',
      payloadHex: '01',
      fPort: 1,
      decodedData: { level: 1.2 },
      rawContent: { test: true },
      processingStatus: 'ok',
    });
    expect(id).toBeTruthy();

    const rows = queryWebhooks({ deviceEui: 'AABBCCDDEEFF0011', limit: 10 });
    expect(rows.length).toBeGreaterThan(0);
    const hit = rows.find((r) => r.id === id);
    expect(hit?.decoded_data?.level).toBe(1.2);
  });
});

describe('dispatcher', () => {
  it('fan-out to log-only adapter', async () => {
    const r = await dispatchDeviceOutputs({
      webhookId: 'test-webhook-id',
      device: {
        deviceId: 'dev-1',
        outputs: [{ adapterId: 'log-only', enabled: true, config: {} }],
      },
      deviceEui: '0011223344556677',
      decodedData: { temperature: 21.5 },
      timestamp: new Date().toISOString(),
    });
    expect(r.anySuccess).toBe(true);
    expect(r.errors.length).toBe(0);
  });
});
