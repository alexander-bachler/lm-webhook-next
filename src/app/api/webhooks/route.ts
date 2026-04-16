/* eslint-disable @typescript-eslint/no-explicit-any -- Actility / webhook.site payloads are dynamic */
import { NextRequest, NextResponse } from 'next/server';
import DeviceManager from '@/lib/device-manager';
import LineMetricsClient from '@/lib/line-metrics-client';
import { decodePayload } from '@/lib/decode-payload';
import {
  queryWebhooks,
  type StoredWebhookRow,
} from '@/lib/webhook-store';

export const runtime = 'nodejs';

function getWebhookSiteToken(): string | undefined {
  return process.env.WEBHOOK_SITE_TOKEN;
}

function getWebhookSiteApiKey(): string | undefined {
  return process.env.WEBHOOK_SITE_API_KEY;
}

function getWebhookSource(): 'local' | 'webhooksite' {
  const s = process.env.WEBHOOK_SOURCE;
  if (s === 'webhooksite') {
    return 'webhooksite';
  }
  return 'local';
}

async function fetchWebhookSiteHistory(
  limit: number,
  startDate?: string,
  endDate?: string
) {
  const token = getWebhookSiteToken();
  if (!token) {
    console.warn('WEBHOOK_SITE_TOKEN is not set; webhook.site fetch skipped');
    return [];
  }

  const url = `https://webhook.site/token/${token}/requests`;
  const headers: Record<string, string> = {
    'User-Agent': 'LineMetrics-Webhook-Server/1.0',
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  const apiKey = getWebhookSiteApiKey();
  if (apiKey) {
    headers['Api-Key'] = apiKey;
  }

  const maxPages = startDate && endDate ? 10 : 1;
  const perPage = Math.min(limit, 100);

  const allWebhooks: any[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const params: Record<string, string> = {
      sorting: 'newest',
      per_page: perPage.toString(),
      page: page.toString(),
    };

    try {
      const response = await fetch(`${url}?${new URLSearchParams(params)}`, {
        headers,
        method: 'GET',
      });

      if (!response.ok) {
        console.warn(
          `Webhook.site API Warnung (Seite ${page}): ${response.status} ${response.statusText}`
        );
        break;
      }

      const data = await response.json();

      let webhooks: any[] = [];
      if (Array.isArray(data)) {
        webhooks = data;
      } else if (data.data && Array.isArray(data.data)) {
        webhooks = data.data;
      } else if (data.requests && Array.isArray(data.requests)) {
        webhooks = data.requests;
      }

      if (webhooks.length === 0) {
        console.log(`Keine weiteren Daten auf Seite ${page}`);
        break;
      }

      allWebhooks.push(...webhooks);
      console.log(
        `Seite ${page}: ${webhooks.length} Webhooks geladen, Total: ${allWebhooks.length}`
      );

      if (startDate && endDate) {
        const start = new Date(startDate);
        const oldestWebhook = webhooks[webhooks.length - 1];
        const oldestDate = new Date(oldestWebhook.created_at);

        console.log(
          `Seite ${page}: Ältester Webhook vom ${oldestDate.toISOString()}, Ziel: ${start.toISOString()}`
        );

        if (oldestDate < start) {
          console.log(`Genug historische Daten gesammelt, stoppe bei Seite ${page}`);
          break;
        }
      } else {
        console.log(`Standard-Modus: Nur eine Seite geladen`);
        break;
      }

      if (page < maxPages) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    } catch (error) {
      console.error(`Fehler beim Laden von Seite ${page}:`, error);
      break;
    }
  }

  return allWebhooks;
}

function extractDeviceInfo(webhook: any) {
  if (webhook.content) {
    try {
      const content = JSON.parse(webhook.content);
      if (content.DevEUI_uplink) {
        const uplink = content.DevEUI_uplink;
        return {
          deviceEUI: uplink.DevEUI,
          fPort: uplink.FPort,
          payload: uplink.payload_hex,
          rssi: uplink.LrrRSSI,
          snr: uplink.LrrSNR,
          customerName: uplink.CustomerData?.name,
          timestamp: uplink.Time,
          success:
            uplink.payload_hex &&
            uplink.payload_hex.length > 0 &&
            uplink.payload_hex.length % 2 === 0,
          frequency: uplink.Frequency,
          txPower: uplink.TxPower,
          spFact: uplink.SpFact,
          subBand: uplink.SubBand,
          channel: uplink.Channel,
          devAddr: uplink.DevAddr,
          fCntUp: uplink.FCntUp,
          fCntDn: uplink.FCntDn,
          mType: uplink.MType,
          adrBit: uplink.ADRbit,
          nbTrans: uplink.NbTrans,
          dynamicClass: uplink.DynamicClass,
          instantPER: uplink.InstantPER,
          meanPER: uplink.MeanPER,
          lostUplinksAS: uplink.LostUplinksAS,
          gatewayId: uplink.Lrrid,
          gatewayLat: uplink.LrrLAT,
          gatewayLon: uplink.LrrLON,
          deviceType: uplink.CustomerData?.alr?.pro,
          deviceLocation: uplink.CustomerData?.loc,
          payloadDecodedError: uplink.payloadDecodedError,
        };
      }
    } catch {
      // Ignore parsing errors
    }
  }

  return {
    deviceEUI: 'Unbekannt',
    fPort: null,
    payload: 'Kein Payload',
    rssi: null,
    snr: null,
    customerName: 'Unbekannt',
    timestamp: webhook.created_at,
    success: false,
    frequency: null,
    txPower: null,
    spFact: null,
    subBand: null,
    channel: null,
    devAddr: null,
    fCntUp: null,
    fCntDn: null,
    mType: null,
    adrBit: null,
    nbTrans: null,
    dynamicClass: null,
    instantPER: null,
    meanPER: null,
    lostUplinksAS: null,
    gatewayId: null,
    gatewayLat: null,
    gatewayLon: null,
    deviceType: null,
    deviceLocation: null,
    payloadDecodedError: null,
  };
}

function mapStoredRowToDashboard(row: StoredWebhookRow) {
  const meta = (row.metadata || {}) as Record<string, unknown>;
  const details =
    (meta.details as Record<string, unknown> | undefined) || {};

  return {
    id: row.id,
    timestamp: row.timestamp,
    deviceId: (meta.deviceDisplayName as string) || row.device_eui,
    deviceEUI: row.device_eui,
    payload: row.payload_hex,
    fPort: row.fport,
    rssi: meta.rssi ?? null,
    snr: meta.snr ?? null,
    gatewayId: meta.gatewayId || 'incoming',
    endpoint: '/api/webhooks/incoming',
    success: row.processing_status !== 'error',
    processingTime: (meta.processingTime as number) || 0,
    decodedData: row.decoded_data,
    metadata: {
      usedDecoder: meta.usedDecoder,
      detectedFormat: row.decoded_data ? 'decoded' : 'unknown',
      processingTime: meta.processingTime,
      customerName: meta.customerName,
      deviceInfo: meta.deviceInfo,
      warnings: meta.warnings,
      errors: meta.errors,
    },
    details,
    content: JSON.stringify(row.raw_content),
  };
}

function calculateRealStats(processedData: any[]) {
  if (processedData.length === 0) {
    return {
      totalWebhooks: 0,
      activeDevices: 0,
      successRate: 0,
      avgProcessingTime: 0,
      todayWebhooks: 0,
      weeklyGrowth: 0,
    };
  }

  const totalWebhooks = processedData.length;
  const activeDevices = new Set(processedData.map((w) => w.deviceId)).size;

  const successfulWebhooks = processedData.filter((w) => w.success).length;
  const successRate =
    totalWebhooks > 0 ? (successfulWebhooks / totalWebhooks) * 100 : 0;

  const avgProcessingTime = Math.floor(
    processedData.reduce((sum, w) => {
      const payloadSize = w.payload?.length || 0;
      const processingTime = Math.max(50, Math.min(200, payloadSize * 2));
      return sum + processingTime;
    }, 0) / totalWebhooks
  );

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const todayWebhooks = processedData.filter((w) => {
    const webhookDate = new Date(w.timestamp || w.created_at);
    return webhookDate >= oneDayAgo;
  }).length;

  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const thisWeekWebhooks = processedData.filter((w) => {
    const webhookDate = new Date(w.timestamp || w.created_at);
    return webhookDate >= oneWeekAgo;
  }).length;

  const lastWeekWebhooks = processedData.filter((w) => {
    const webhookDate = new Date(w.timestamp || w.created_at);
    return webhookDate >= twoWeeksAgo && webhookDate < oneWeekAgo;
  }).length;

  const weeklyGrowth =
    lastWeekWebhooks > 0
      ? ((thisWeekWebhooks - lastWeekWebhooks) / lastWeekWebhooks) * 100
      : thisWeekWebhooks > 0
        ? 100
        : 0;

  return {
    totalWebhooks,
    activeDevices,
    successRate: Math.round(successRate * 10) / 10,
    avgProcessingTime,
    todayWebhooks,
    weeklyGrowth: Math.round(weeklyGrowth * 10) / 10,
  };
}

async function handleGetLocal(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;
  const deviceId = searchParams.get('deviceId') || undefined;
  const endpoint = searchParams.get('endpoint') || undefined;

  const rows = queryWebhooks({
    limit: Math.min(limit, 500),
    startDate,
    endDate,
  });

  let processedData = rows.map(mapStoredRowToDashboard);

  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    processedData = processedData.filter((w) => {
      const webhookDate = new Date(w.timestamp);
      return webhookDate >= start && webhookDate <= end;
    });
  }

  if (deviceId && deviceId !== 'all') {
    processedData = processedData.filter(
      (w) => w.deviceId === deviceId || w.deviceEUI === deviceId
    );
  }

  if (endpoint) {
    processedData = processedData.filter((w) => w.endpoint === endpoint);
  }

  const stats = calculateRealStats(processedData);

  return NextResponse.json({
    success: true,
    count: processedData.length,
    data: processedData,
    stats,
    source: 'local',
  });
}

async function handleGetWebhookSite(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;
  const deviceId = searchParams.get('deviceId') || undefined;
  const endpoint = searchParams.get('endpoint') || undefined;

  try {
    const allDevices = DeviceManager.reloadDevices();
    const deviceMap = new Map();

    Object.values(allDevices).forEach((device: any) => {
      if (device.deviceEUI) {
        deviceMap.set(device.deviceEUI, device);
        deviceMap.set(device.deviceEUI.toLowerCase(), device);
      }
      if (device.deviceId) {
        deviceMap.set(device.deviceId, device);
      }
    });

    console.log(
      `Device-Verbindung: ${deviceMap.size} Devices aus lokaler Datenbank geladen`
    );

    const webhookData = await fetchWebhookSiteHistory(limit, startDate, endDate);

    console.log(
      `Webhook.site API: ${webhookData.length} Webhooks geladen (Limit: ${limit}, StartDate: ${startDate}, EndDate: ${endDate})`
    );

    const processedDataPromises = webhookData.map(async (webhook: any) => {
      const deviceInfo = extractDeviceInfo(webhook);
      const payloadSize = deviceInfo.payload?.length || 0;
      const processingTime = Math.max(50, Math.min(200, payloadSize * 2));

      let localDevice =
        deviceMap.get(deviceInfo.deviceEUI) ||
        deviceMap.get(deviceInfo.deviceEUI?.toLowerCase());

      if (
        !localDevice &&
        deviceInfo.payload &&
        deviceInfo.payload.length >= 70 &&
        deviceInfo.payload.length <= 160
      ) {
        const buffer = Buffer.from(deviceInfo.payload, 'hex');
        if (buffer.length >= 35 && buffer.length <= 80) {
          localDevice = {
            deviceId: `LORA/Generic_${deviceInfo.deviceEUI}`,
            deviceEUI: deviceInfo.deviceEUI,
            name: `LORA/Generic_${deviceInfo.deviceEUI}`,
            description: 'Auto-generated device from webhook data',
            decoder: 'harvy2',
            manufacturer: 'Dezem',
            model: 'Harvy2',
            image: '/images/devices/default.svg',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastSeen: deviceInfo.timestamp || new Date().toISOString(),
            dataCount: 0,
            metadata: {},
          };

          console.log(`Automatisch Harvy2-Device erkannt: ${deviceInfo.deviceEUI}`);
        }
      }

      const decodeResult = await decodePayload(
        deviceInfo.deviceEUI,
        deviceInfo.payload,
        deviceInfo.fPort != null ? Number(deviceInfo.fPort) : null
      );

      const finalDeviceInfo =
        decodeResult.deviceInfo ||
        (localDevice
          ? {
              name: localDevice.name || deviceInfo.deviceEUI,
              manufacturer: localDevice.manufacturer || 'Unknown',
              model: localDevice.model || 'Unknown',
              decoder: localDevice.decoder || decodeResult.decoder,
            }
          : null);

      if (localDevice?.lineMetrics?.enabled && decodeResult.decodedData) {
        try {
          const lineMetricsClient = new LineMetricsClient();
          const lineMetricsResult: any = await lineMetricsClient.sendData(
            localDevice.lineMetrics,
            decodeResult.decodedData,
            deviceInfo.deviceEUI,
            deviceInfo.timestamp
          );

          if (lineMetricsResult.success) {
            console.log(
              `LineMetrics: ${lineMetricsResult.measurementsSent} measurements sent for device ${deviceInfo.deviceEUI}`
            );
          } else {
            console.warn(
              `LineMetrics error for device ${deviceInfo.deviceEUI}: ${lineMetricsResult.error}`
            );
          }
        } catch (error) {
          console.error(
            `LineMetrics integration error for device ${deviceInfo.deviceEUI}:`,
            error
          );
        }
      }

      console.log(`Webhook-Verarbeitung für Device ${deviceInfo.deviceEUI}:`, {
        localDevice: localDevice ? localDevice.name : 'nicht gefunden',
        payloadDeviceInfo: decodeResult.deviceInfo
          ? decodeResult.deviceInfo.name
          : 'nicht verfügbar',
        finalDeviceInfo: finalDeviceInfo ? finalDeviceInfo.name : 'nicht verfügbar',
        decoder: finalDeviceInfo?.decoder || decodeResult.decoder,
      });

      return {
        id: webhook.uuid,
        timestamp: deviceInfo.timestamp || webhook.created_at,
        deviceId: finalDeviceInfo?.name || deviceInfo.deviceEUI,
        deviceEUI: deviceInfo.deviceEUI,
        payload: deviceInfo.payload,
        fPort: deviceInfo.fPort,
        rssi: deviceInfo.rssi,
        snr: deviceInfo.snr,
        gatewayId: deviceInfo.gatewayId || 'webhook.site',
        endpoint: '/webhook/site',
        success: deviceInfo.success,
        processingTime: processingTime,
        decodedData: decodeResult.decodedData,
        metadata: {
          usedDecoder: finalDeviceInfo?.decoder || decodeResult.decoder,
          detectedFormat: decodeResult.success ? 'decoded' : 'unknown',
          processingTime: processingTime,
          customerName: deviceInfo.customerName,
          deviceInfo: finalDeviceInfo,
          warnings: decodeResult.warnings,
          errors: decodeResult.errors,
        },
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
        content: webhook.content,
      };
    });

    const processedData = await Promise.all(processedDataPromises);

    let filteredData = processedData;

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      filteredData = filteredData.filter((w) => {
        const webhookDate = new Date(w.timestamp);
        return webhookDate >= start && webhookDate <= end;
      });
      console.log(
        `Datumsfilterung: ${processedData.length} → ${filteredData.length} Webhooks (${startDate} bis ${endDate})`
      );
    }

    if (deviceId && deviceId !== 'all') {
      filteredData = filteredData.filter((w) => w.deviceId === deviceId);
    }

    if (endpoint) {
      filteredData = filteredData.filter((w) => w.endpoint === endpoint);
    }

    const stats = calculateRealStats(filteredData);

    return NextResponse.json({
      success: true,
      count: filteredData.length,
      data: filteredData,
      stats,
      source: 'webhooksite',
    });
  } catch (error) {
    console.error('Fehler beim Laden der Webhook-Daten:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Fehler beim Laden der Webhook-Daten',
        count: 0,
        data: [],
        stats: {
          totalWebhooks: 0,
          activeDevices: 0,
          successRate: 0,
          avgProcessingTime: 0,
          todayWebhooks: 0,
          weeklyGrowth: 0,
        },
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  if (getWebhookSource() === 'local') {
    return handleGetLocal(request);
  }
  return handleGetWebhookSite(request);
}

export async function POST(request: NextRequest) {
  try {
    await request.json();

    const processingTime = Math.floor(Math.random() * 150) + 50;

    return NextResponse.json({
      success: true,
      message: 'Webhook erfolgreich verarbeitet',
      processingTime: processingTime,
      timestamp: new Date().toISOString(),
      hint: 'For LoRa uplinks use POST /api/webhooks/incoming',
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: 'Fehler bei der Webhook-Verarbeitung',
      },
      { status: 400 }
    );
  }
}
