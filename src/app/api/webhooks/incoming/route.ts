import { NextRequest, NextResponse } from 'next/server';
import DeviceManager from '@/lib/device-manager';
import LineMetricsClient from '@/lib/line-metrics-client';
import { decodePayload } from '@/lib/decode-payload';
import {
  buildDeviceMap,
  extractUplinkInfoFromActilityContent,
  resolveLocalDeviceForUplink,
} from '@/lib/webhook-processing';
import { storeWebhook, type ProcessingStatus } from '@/lib/webhook-store';

export const runtime = 'nodejs';

function verifyWebhookSecret(request: NextRequest): boolean {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    return true;
  }
  const auth = request.headers.get('authorization');
  const header = request.headers.get('x-webhook-secret');
  if (auth === `Bearer ${secret}`) {
    return true;
  }
  if (header === secret) {
    return true;
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

  const allDevices = DeviceManager.reloadDevices();
  const deviceMap = buildDeviceMap(allDevices as Record<string, unknown>[]);

  const deviceInfo = extractUplinkInfoFromActilityContent(body);
  const localDevice = resolveLocalDeviceForUplink(deviceInfo, deviceMap);

  const decodeResult = await decodePayload(
    deviceInfo.deviceEUI,
    deviceInfo.payload,
    deviceInfo.fPort
  );

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

  if (
    localDevice?.lineMetrics &&
    (localDevice.lineMetrics as { enabled?: boolean }).enabled &&
    decodeResult.decodedData
  ) {
    try {
      const lineMetricsClient = new LineMetricsClient();
      const lmResult = (await lineMetricsClient.sendData(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- runtime shape from devices.json
        localDevice.lineMetrics as any,
        decodeResult.decodedData as Record<string, unknown>,
        deviceInfo.deviceEUI,
        deviceInfo.timestamp
      )) as { success?: boolean; error?: string };
      lineMetricsOk = Boolean(lmResult.success);
      if (!lmResult.success && lmResult.error) {
        lineMetricsError = String(lmResult.error);
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
