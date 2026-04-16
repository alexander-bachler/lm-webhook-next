import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import DeviceManager from '@/lib/device-manager';
import { decodePayload } from '@/lib/decode-payload';
import { dispatchDeviceOutputs } from '@/lib/dispatcher';
import {
  buildDeviceMap,
  extractUplinkInfoFromActilityContent,
  resolveLocalDeviceForUplink,
} from '@/lib/webhook-processing';
import { checkRateLimit, rateLimitKeyForRequest } from '@/lib/rate-limit';
import { storeWebhook, type ProcessingStatus } from '@/lib/webhook-store';

export const runtime = 'nodejs';

function getClientIp(request: NextRequest): string | null {
  const xf = request.headers.get('x-forwarded-for');
  if (xf) {
    return xf.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip');
}

function verifyWebhookSecret(request: NextRequest): boolean {
  const raw = process.env.WEBHOOK_SECRET;
  if (!raw) {
    return true;
  }
  const secrets = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const auth = request.headers.get('authorization');
  const header = request.headers.get('x-webhook-secret');
  for (const secret of secrets) {
    if (auth === `Bearer ${secret}`) return true;
    if (header === secret) return true;
  }
  return false;
}

export async function POST(request: NextRequest) {
  if (!verifyWebhookSecret(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const uplinkForLimit = body.DevEUI_uplink as { DevEUI?: unknown } | undefined;
  const euiForLimit =
    uplinkForLimit?.DevEUI != null ? String(uplinkForLimit.DevEUI) : undefined;
  const rateKey = rateLimitKeyForRequest(getClientIp(request), euiForLimit);
  if (!checkRateLimit(rateKey)) {
    return NextResponse.json({ success: false, error: 'Too Many Requests' }, { status: 429 });
  }

  const allDevices = DeviceManager.reloadDevices();
  const deviceMap = buildDeviceMap(allDevices as Record<string, unknown>[]);

  const deviceInfo = extractUplinkInfoFromActilityContent(body);
  const localDevice = resolveLocalDeviceForUplink(deviceInfo, deviceMap);

  const decodeResult = await decodePayload(
    deviceInfo.deviceEUI,
    deviceInfo.payload,
    deviceInfo.fPort
  );

  const webhookRecordId = randomUUID();

  const finalDeviceInfo =
    decodeResult.deviceInfo ||
    (localDevice
      ? {
          name: String(localDevice.name || deviceInfo.deviceEUI),
          manufacturer: String(localDevice.manufacturer || 'Unknown'),
          model: String(localDevice.model || 'Unknown'),
          decoder: String(localDevice.decoder || decodeResult.decoder),
        }
      : null);

  let lineMetricsOk = false;
  let lineMetricsError: string | undefined;

  if (localDevice && decodeResult.decodedData) {
    try {
      const disp = await dispatchDeviceOutputs({
        webhookId: webhookRecordId,
        device: localDevice as Record<string, unknown>,
        deviceEui: deviceInfo.deviceEUI,
        decodedData: decodeResult.decodedData as Record<string, unknown>,
        timestamp: deviceInfo.timestamp,
      });
      lineMetricsOk = disp.anySuccess;
      if (disp.errors.length) {
        lineMetricsError = disp.errors.join('; ');
      }
    } catch (e) {
      lineMetricsError = e instanceof Error ? e.message : String(e);
    }
  }

  let processingStatus: ProcessingStatus = 'ok';
  if (!decodeResult.success && deviceInfo.success) {
    processingStatus = 'partial';
  }
  if (!deviceInfo.success || decodeResult.errors.length > 0) {
    processingStatus = decodeResult.success ? 'partial' : 'error';
  }

  const payloadSize = deviceInfo.payload?.length || 0;
  const processingTime = Math.max(50, Math.min(200, payloadSize * 2));

  const deviceDisplayName = finalDeviceInfo?.name || deviceInfo.deviceEUI;

  const id = storeWebhook({
    id: webhookRecordId,
    timestamp: deviceInfo.timestamp,
    deviceEui: deviceInfo.deviceEUI,
    payloadHex: deviceInfo.payload !== 'Kein Payload' ? deviceInfo.payload : null,
    fPort: deviceInfo.fPort,
    decodedData: decodeResult.decodedData,
    rawContent: body,
    processingStatus,
    lineMetricsSent: lineMetricsOk,
    metadata: {
      deviceDisplayName,
      usedDecoder: finalDeviceInfo?.decoder || decodeResult.decoder,
      warnings: decodeResult.warnings,
      errors: decodeResult.errors,
      lineMetricsError,
      processingTime,
      customerName: deviceInfo.customerName,
      deviceInfo: finalDeviceInfo,
      rssi: deviceInfo.rssi,
      snr: deviceInfo.snr,
      gatewayId: deviceInfo.gatewayId,
      details: {
        frequency: deviceInfo.frequency,
        txPower: deviceInfo.txPower,
        spFact: deviceInfo.spFact,
        subBand: deviceInfo.subBand,
        channel: deviceInfo.channel,
        devAddr: deviceInfo.devAddr,
        fCntUp: deviceInfo.fCntUp,
        fCntDn: deviceInfo.fCntDn,
        mType: deviceInfo.mType,
        adrBit: deviceInfo.adrBit,
        nbTrans: deviceInfo.nbTrans,
        dynamicClass: deviceInfo.dynamicClass,
        instantPER: deviceInfo.instantPER,
        meanPER: deviceInfo.meanPER,
        lostUplinksAS: deviceInfo.lostUplinksAS,
        gatewayLat: deviceInfo.gatewayLat,
        gatewayLon: deviceInfo.gatewayLon,
        deviceType: deviceInfo.deviceType,
        deviceLocation: deviceInfo.deviceLocation,
        payloadDecodedError: deviceInfo.payloadDecodedError,
      },
    },
  });

  return NextResponse.json({
    success: true,
    id,
    processingStatus,
    deviceEUI: deviceInfo.deviceEUI,
    decoded: decodeResult.success,
    lineMetrics: lineMetricsOk,
    lineMetricsError,
    timestamp: new Date().toISOString(),
  });
}
