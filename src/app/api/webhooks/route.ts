import { NextRequest, NextResponse } from 'next/server';
import DeviceManager from '@/lib/device-manager';
import LineMetricsClient from '@/lib/line-metrics-client';

// Webhook.site Konfiguration
const WEBHOOK_SITE_TOKEN = 'fbd2d5a5-d00d-4129-b533-edbc9f438088';
const WEBHOOK_SITE_API_KEY = '52e69666-a1da-478f-b060-7b029a5f5634';

async function fetchWebhookSiteHistory(limit: number, startDate?: string, endDate?: string) {
  const url = `https://webhook.site/token/${WEBHOOK_SITE_TOKEN}/requests`;
  const headers: Record<string, string> = {
    'User-Agent': 'LineMetrics-Webhook-Server/1.0',
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };

  // Füge API Key hinzu wenn verfügbar
  if (WEBHOOK_SITE_API_KEY) {
    headers['Api-Key'] = WEBHOOK_SITE_API_KEY;
  }

  // Bei Datumsauswahl mehrere Seiten laden um mehr historische Daten zu sammeln
  const maxPages = startDate && endDate ? 10 : 1; // Bis zu 10 Seiten für historische Daten
  const perPage = Math.min(limit, 100);
  
  let allWebhooks: any[] = [];
  
  for (let page = 1; page <= maxPages; page++) {
    const params: Record<string, string> = {
      sorting: 'newest',
      per_page: perPage.toString(),
      page: page.toString()
    };

    try {
      const response = await fetch(`${url}?${new URLSearchParams(params)}`, {
        headers,
        method: 'GET'
      });

      if (!response.ok) {
        console.warn(`Webhook.site API Warnung (Seite ${page}): ${response.status} ${response.statusText}`);
        break; // Stoppe bei Fehlern
      }

      const data = await response.json();
      
      // Verarbeite verschiedene Response-Formate
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
        break; // Keine weiteren Daten verfügbar
      }
      
      allWebhooks.push(...webhooks);
      console.log(`Seite ${page}: ${webhooks.length} Webhooks geladen, Total: ${allWebhooks.length}`);
      
      // Bei Datumsauswahl prüfe ob wir genug historische Daten haben
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        // Prüfe ob die ältesten Webhooks im gewünschten Zeitraum liegen
        const oldestWebhook = webhooks[webhooks.length - 1];
        const oldestDate = new Date(oldestWebhook.created_at);
        
        console.log(`Seite ${page}: Ältester Webhook vom ${oldestDate.toISOString()}, Ziel: ${start.toISOString()}`);
        
        if (oldestDate < start) {
          console.log(`Genug historische Daten gesammelt, stoppe bei Seite ${page}`);
          break;
        }
      } else {
        // Ohne Datumsauswahl nur eine Seite laden
        console.log(`Standard-Modus: Nur eine Seite geladen`);
        break;
      }
      
      // Kurze Pause zwischen API-Aufrufen
      if (page < maxPages) {
        await new Promise(resolve => setTimeout(resolve, 200));
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
          // Erfolg basierend auf Payload-Gültigkeit, nicht auf Dekodierungsfehler
          success: uplink.payload_hex && uplink.payload_hex.length > 0 && uplink.payload_hex.length % 2 === 0,
          // Zusätzliche Details
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
          // Gateway-Informationen
          gatewayId: uplink.Lrrid,
          gatewayLat: uplink.LrrLAT,
          gatewayLon: uplink.LrrLON,
          // Device-spezifische Informationen
          deviceType: uplink.CustomerData?.alr?.pro,
          deviceLocation: uplink.CustomerData?.loc,
          // Dekodierungsfehler (für Referenz)
          payloadDecodedError: uplink.payloadDecodedError
        };
      }
    } catch (e) {
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
    payloadDecodedError: null
  };
}

async function decodePayload(deviceEUI: string, payload: string, fPort: number) {
  try {
    // Finde Device und dessen Decoder
    const device = DeviceManager.getDeviceByEUI(deviceEUI);
    let decoder = 'auto';
    let deviceType = '';
    let deviceInfo = {
      name: deviceEUI,
      manufacturer: 'Unknown',
      model: 'Unknown',
      decoder: 'auto'
    };
    
    if (device && device.decoder) {
      decoder = device.decoder;
      deviceInfo = {
        name: device.name || deviceEUI,
        manufacturer: device.manufacturer || 'Unknown',
        model: device.model || 'Unknown',
        decoder: device.decoder || 'auto'
      };
    }
    
    // Versuche Payload-Dekodierung mit der zentralen API
    if (payload && payload.length > 0 && payload.length % 2 === 0) {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/payload/decode`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            payload: payload,
            decoder: decoder,
            deviceType: deviceType,
            fPort: fPort,
            deviceEUI: deviceEUI,
            deviceInfo: deviceInfo
          }),
        });
        
        if (response.ok) {
          const result = await response.json();
          
          // Verwende Device-Informationen aus der Payload-API-Response falls verfügbar
          const finalDeviceInfo = result.deviceInfo || (device ? {
            name: device.name,
            manufacturer: device.manufacturer,
            model: device.model,
            decoder: device.decoder
          } : null);
          
          console.log(`Payload-Dekodierung erfolgreich für Device ${deviceEUI}:`, {
            decoder: result.decoder,
            deviceInfo: finalDeviceInfo,
            success: result.success
          });
          
          return {
            success: result.success,
            decoder: result.decoder,
            decodedData: result.decodedData,
            warnings: result.warnings || [],
            errors: result.errors || [],
            deviceInfo: finalDeviceInfo
          };
        }
      } catch (error) {
        console.error('Fehler bei Payload-Dekodierung:', error);
      }
    }
    
    return {
      success: false,
      decoder: decoder,
      decodedData: null,
      warnings: [],
      errors: ['Ungültiger Payload oder Dekodierungsfehler'],
      deviceInfo: device ? {
        name: device.name,
        manufacturer: device.manufacturer,
        model: device.model,
        decoder: device.decoder
      } : null
    };
  } catch (error) {
    console.error('Fehler bei Payload-Dekodierung:', error);
    return {
      success: false,
      decoder: 'auto',
      decodedData: null,
      warnings: [],
      errors: [`Dekodierungsfehler: ${error}`],
      deviceInfo: null
    };
  }
}

function calculateRealStats(processedData: any[]) {
  if (processedData.length === 0) {
    return {
      totalWebhooks: 0,
      activeDevices: 0,
      successRate: 0,
      avgProcessingTime: 0,
      todayWebhooks: 0,
      weeklyGrowth: 0
    };
  }

  const totalWebhooks = processedData.length;
  const activeDevices = new Set(processedData.map(w => w.deviceId)).size;
  
  // Berechne echte Erfolgsrate basierend auf Payload-Gültigkeit
  const successfulWebhooks = processedData.filter(w => w.success).length;
  const successRate = totalWebhooks > 0 ? (successfulWebhooks / totalWebhooks) * 100 : 0;
  
  // Berechne durchschnittliche Verarbeitungszeit (basierend auf Payload-Größe)
  const avgProcessingTime = Math.floor(
    processedData.reduce((sum, w) => {
      const payloadSize = w.payload?.length || 0;
      // Simuliere Verarbeitungszeit basierend auf Payload-Größe
      const processingTime = Math.max(50, Math.min(200, payloadSize * 2));
      return sum + processingTime;
    }, 0) / totalWebhooks
  );

  // Berechne heutige Webhooks (letzte 24 Stunden)
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const todayWebhooks = processedData.filter(w => {
    const webhookDate = new Date(w.timestamp || w.created_at);
    return webhookDate >= oneDayAgo;
  }).length;

  // Berechne wöchentliches Wachstum (Vergleich mit vorheriger Woche)
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  
  const thisWeekWebhooks = processedData.filter(w => {
    const webhookDate = new Date(w.timestamp || w.created_at);
    return webhookDate >= oneWeekAgo;
  }).length;
  
  const lastWeekWebhooks = processedData.filter(w => {
    const webhookDate = new Date(w.timestamp || w.created_at);
    return webhookDate >= twoWeeksAgo && webhookDate < oneWeekAgo;
  }).length;

  const weeklyGrowth = lastWeekWebhooks > 0 
    ? ((thisWeekWebhooks - lastWeekWebhooks) / lastWeekWebhooks) * 100 
    : thisWeekWebhooks > 0 ? 100 : 0;

  return {
    totalWebhooks,
    activeDevices,
    successRate: Math.round(successRate * 10) / 10,
    avgProcessingTime,
    todayWebhooks,
    weeklyGrowth: Math.round(weeklyGrowth * 10) / 10
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50');
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;
  const deviceId = searchParams.get('deviceId') || undefined;
  const endpoint = searchParams.get('endpoint') || undefined;
  
  try {
    // Lade alle Devices aus der lokalen Datenbank für Verknüpfung (neu laden)
    const allDevices = DeviceManager.reloadDevices();
    const deviceMap = new Map();
    
    // Erstelle eine Map für schnelle Device-Suche
    Object.values(allDevices).forEach((device: any) => {
      if (device.deviceEUI) {
        deviceMap.set(device.deviceEUI, device);
        deviceMap.set(device.deviceEUI.toLowerCase(), device);
      }
      if (device.deviceId) {
        deviceMap.set(device.deviceId, device);
      }
    });
    
    console.log(`Device-Verbindung: ${deviceMap.size} Devices aus lokaler Datenbank geladen`);
    
    // Lade Daten von webhook.site mit Datumsfilterung
    const webhookData = await fetchWebhookSiteHistory(limit, startDate, endDate);
    
    console.log(`Webhook.site API: ${webhookData.length} Webhooks geladen (Limit: ${limit}, StartDate: ${startDate}, EndDate: ${endDate})`);
    console.log(`API-Parameter: maxPages=${startDate && endDate ? 10 : 1}, perPage=${Math.min(limit, 100)}`);
    
    // Verarbeite und filtere die Daten
    const processedDataPromises = webhookData.map(async (webhook: any) => {
      const deviceInfo = extractDeviceInfo(webhook);
      const payloadSize = deviceInfo.payload?.length || 0;
      const processingTime = Math.max(50, Math.min(200, payloadSize * 2));
      
      // Suche Device in der lokalen Datenbank
      let localDevice = deviceMap.get(deviceInfo.deviceEUI) || deviceMap.get(deviceInfo.deviceEUI?.toLowerCase());
      
      // Automatische Harvy2-Device-Erkennung für unbekannte Devices
      if (!localDevice && deviceInfo.payload && deviceInfo.payload.length >= 70 && deviceInfo.payload.length <= 160) {
        // Prüfe ob es sich um einen Harvy2-Payload handelt (typische Länge für Port 6)
        const buffer = Buffer.from(deviceInfo.payload, 'hex');
        if (buffer.length >= 35 && buffer.length <= 80) {
          // Erstelle temporäres Harvy2-Device
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
            metadata: {}
          };
          
          console.log(`Automatisch Harvy2-Device erkannt: ${deviceInfo.deviceEUI}`);
        }
      }
      
      // Dekodiere Payload mit der zentralen API
      const decodeResult = await decodePayload(
        deviceInfo.deviceEUI, 
        deviceInfo.payload, 
        deviceInfo.fPort
      );
      
      // Verwende Device-Informationen aus der Payload-API falls verfügbar, sonst lokale Daten
      const finalDeviceInfo = decodeResult.deviceInfo || (localDevice ? {
        name: localDevice.name || deviceInfo.deviceEUI,
        manufacturer: localDevice.manufacturer || 'Unknown',
        model: localDevice.model || 'Unknown',
        decoder: localDevice.decoder || decodeResult.decoder
      } : null);

      // LineMetrics Integration
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
            console.log(`LineMetrics: ${lineMetricsResult.measurementsSent} measurements sent for device ${deviceInfo.deviceEUI}`);
          } else {
            console.warn(`LineMetrics error for device ${deviceInfo.deviceEUI}: ${lineMetricsResult.error}`);
          }
        } catch (error) {
          console.error(`LineMetrics integration error for device ${deviceInfo.deviceEUI}:`, error);
        }
      }
      
      console.log(`Webhook-Verarbeitung für Device ${deviceInfo.deviceEUI}:`, {
        localDevice: localDevice ? localDevice.name : 'nicht gefunden',
        payloadDeviceInfo: decodeResult.deviceInfo ? decodeResult.deviceInfo.name : 'nicht verfügbar',
        finalDeviceInfo: finalDeviceInfo ? finalDeviceInfo.name : 'nicht verfügbar',
        decoder: finalDeviceInfo?.decoder || decodeResult.decoder
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
            errors: decodeResult.errors
          },
        // Erweiterte Details
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
          payloadDecodedError: deviceInfo.payloadDecodedError
        },
        content: webhook.content
      };
    });
    
    const processedData = await Promise.all(processedDataPromises);
    
    // Filtere Daten basierend auf Parametern
    let filteredData = processedData;
    
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      filteredData = filteredData.filter(w => {
        const webhookDate = new Date(w.timestamp);
        return webhookDate >= start && webhookDate <= end;
      });
      console.log(`Datumsfilterung: ${processedData.length} → ${filteredData.length} Webhooks (${startDate} bis ${endDate})`);
    }
    
    if (deviceId && deviceId !== 'all') {
      filteredData = filteredData.filter(w => w.deviceId === deviceId);
    }
    
    if (endpoint) {
      filteredData = filteredData.filter(w => w.endpoint === endpoint);
    }
    
    // Berechne Statistiken
    const stats = calculateRealStats(filteredData);
    
    return NextResponse.json({
      success: true,
      count: filteredData.length,
      data: filteredData,
      stats: stats
    });
    
  } catch (error) {
    console.error('Fehler beim Laden der Webhook-Daten:', error);
    return NextResponse.json({
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
        weeklyGrowth: 0
      }
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Simuliere Webhook-Verarbeitung
    const processingTime = Math.floor(Math.random() * 150) + 50;
    
    return NextResponse.json({
      success: true,
      message: 'Webhook erfolgreich verarbeitet',
      processingTime: processingTime,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Fehler bei der Webhook-Verarbeitung'
    }, { status: 400 });
  }
} 