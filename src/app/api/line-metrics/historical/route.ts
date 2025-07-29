import { NextRequest, NextResponse } from 'next/server';
import LineMetricsClient from '@/lib/line-metrics-client';
import DeviceManager from '@/lib/device-manager';

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

  if (WEBHOOK_SITE_API_KEY) {
    headers['Api-Key'] = WEBHOOK_SITE_API_KEY;
  }

  const params: Record<string, string> = {
    sorting: 'newest',
    per_page: Math.min(limit, 100).toString()
  };

  if (startDate) {
    params['created_after'] = new Date(startDate).toISOString();
  }
  if (endDate) {
    params['created_before'] = new Date(endDate).toISOString();
  }

  const response = await fetch(`${url}?${new URLSearchParams(params)}`, {
    headers,
    method: 'GET'
  });

  if (!response.ok) {
    throw new Error(`Webhook.site API Fehler: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  if (Array.isArray(data)) {
    return data;
  } else if (data.data && Array.isArray(data.data)) {
    return data.data;
  } else if (data.requests && Array.isArray(data.requests)) {
    return data.requests;
  }
  
  return [];
}

// Payload-Dekodierung (vereinfacht für historische Daten)
function decodePayload(payload: string, deviceType?: string) {
  try {
    if (!payload) return { data: {}, errors: [], warnings: [] };

    // Integra Topas Sonic
    if (deviceType?.includes('TOPWASLW') || deviceType?.includes('INTE')) {
      return decodeIntegraTopasSonic(payload);
    }
    
    // H200
    if (deviceType?.includes('RCMH200') || deviceType?.includes('GWF')) {
      return decodeH200(payload);
    }
    
    // Harvy2
    if (deviceType?.includes('HARVY') || deviceType?.includes('deZem')) {
      return decodeHarvy2(payload);
    }
    
    // Auto-Detection basierend auf Payload
    const bytes = Buffer.from(payload, 'hex');
    if (bytes[0] === bytes.length - 1 && bytes[1] === 0x44) {
      return decodeIntegraTopasSonic(payload);
    } else if (payload.length === 22 || payload.length === 26) {
      return decodeH200(payload);
    }
    
    return { data: {}, errors: [], warnings: [] };
  } catch (error: any) {
    return { data: {}, errors: [error.message], warnings: [] };
  }
}

// Integra Topas Sonic Dekodierung
function decodeIntegraTopasSonic(payload: string) {
  try {
    const bytes = Buffer.from(payload, 'hex');
    const data: any = {};
    
    if (bytes[0] === bytes.length - 1 && bytes[1] === 0x44) {
      // Decode BCD
      function decodeBCD(digits: number, bcd: Buffer) {
        let sign = 1;
        if (bcd[digits / 2 - 1] >> 4 > 9) {
          bcd[digits / 2 - 1] &= 0b00001111;
          sign = -1;
        }
        let val = 0;
        for (let i = 0; i < digits / 2; i++) {
          val += ((bcd[i] & 0x0f) + (((bcd[i] & 0xf0) >> 4) * 10)) * Math.pow(100, i);
        }
        return parseInt((sign * val).toString());
      }
      
      // Manufacturer ID zu ASCII
      function manId2ascii(idhex: number) {
        return (String.fromCharCode((idhex >> 10) + 64) + 
                String.fromCharCode(((idhex >> 5) & 0x1f) + 64) + 
                String.fromCharCode((idhex & 0x1f) + 64)).toUpperCase();
      }
      
      // Read UInt16LE
      function readUInt16LE(bytes: Buffer) {
        return (0xFFFF & (bytes[1] << 8 | bytes[0]));
      }
      
      // Read Int32LE
      function readInt32LE(bytes: Buffer) {
        const res = (0xFFFFFFFF & (bytes[3] << 24 | bytes[2] << 16 | bytes[1] << 8 | bytes[0]));
        return res > 0x7FFFFFFF ? res - 0x100000000 : res;
      }
      
      // Read Int16LE
      function readInt16LE(bytes: Buffer) {
        const res = readUInt16LE(bytes);
        return res > 0x7FFF ? res - 0x10000 : res;
      }
      
      const header = {
        id: decodeBCD(8, bytes.slice(4)),
        man: manId2ascii(readUInt16LE(bytes.slice(2))),
        gen: bytes[8],
        med: bytes[9],
        ci: bytes[10],
        acc: bytes[11],
        sts: bytes[12],
        conf: readUInt16LE(bytes.slice(13))
      };
      
      if (header.ci === 0x7A && header.conf === 0x2000) {
        const values = bytes.slice(15);
        
        if (values[0] === 0x04 && values[1] === 0x13) {
          data.volume = readInt32LE(values.slice(2)) / 1e3;
        }
        if (values[6] === 0x84 && values[8] === 0x13) {
          data.reverseVolume = readInt32LE(values.slice(9)) / 1e3;
        }
        if (values[13] === 0x02 && values[14] === 0x5A) {
          data.waterTemperature = readInt16LE(values.slice(15)) / 10;
        }
        if (values[17] === 0x02 && values[19] === 0x17) {
          data.errorCode = readUInt16LE(values.slice(20));
        }
        if (values[22] === 0x02 && values[24] === 0x74) {
          data.battery = readUInt16LE(values.slice(25));
        }
        
        data.header = header;
        
        let sparte = "X";
        if (header.med === 7) {
          sparte = "8";
        } else if (header.med === 6) {
          sparte = "9";
        }
        data.meter_id = sparte + header.man + header.gen.toString(10).padStart(2, '0') + 
                       header.id.toString(10).padStart(8, '0');
      }
    }
    
    return {
      data,
      errors: [],
      warnings: []
    };
    
  } catch (error: any) {
    return {
      data: {},
      errors: [error.message],
      warnings: []
    };
  }
}

// H200 Dekodierung
function decodeH200(payload: string) {
  try {
    const data: any = {};
    
    if (payload.length === 22 || payload.length === 26) {
      const bytes = Buffer.from(payload, 'hex');
      
      function decodeMedium(code: number) {
        if (code < 5 && code > 2) {
          code = code - 3;
        } else if (code < 7 && code > 4) {
          code = code - 5;
        }
        if (code === 0) return "water";
        if (code === 1) return "warm water";
        if (code === 2) return "gas";
        return "unknown";
      }
      
      function decodeUnits(code: number) {
        if (code < 3) return "m3";
        if (code < 5) return "galons";
        if (code < 7) return "feet3";
        return "unknown";
      }
      
      function decodeMultiplier(code: number) {
        if (code == 0) return 0.001;
        if (code == 1) return 0.01;
        if (code == 2) return 0.1;
        if (code == 3) return 1;
        if (code == 4) return 10;
        return "unknown";
      }
      
      const meter_volume = ((bytes[3] & 0b111) << 24 | bytes[2] << 16 | bytes[1] << 8 | bytes[0]);
      const meter_unit = decodeUnits(bytes[4] & 0xF);
      const meter_multiplier = decodeMultiplier(bytes[4] >> 4);
      
      data.meterVolume = meter_volume * (typeof meter_multiplier === 'number' ? meter_multiplier : 1);
      data.lifetimeSemester = (bytes[3] >> 3) + " semester(s)";
      data.medium = decodeMedium(bytes[4] & 0xF) + " " + meter_unit;
      data.meterSerialNumber = ((bytes[8] & 0b111) << 24 | bytes[7] << 16 | bytes[6] << 8 | bytes[5]);
      data.actualityDuration = getActualityDuration(bytes[10]);
      data.meterNoResponse = ((bytes[8] >> 3) & 0x01) == 1;
      data.meterEcoFrameError = ((bytes[8] >> 4) & 0x01) == 1;
      data.meterRollError = ((bytes[8] >> 5) & 0x01) == 1;
      data.brokenPipe = ((bytes[8] >> 6) & 0x01) == 1;
      data.lowBattery = ((bytes[8] >> 7) & 0x01) == 1;
      data.backflow = ((bytes[9]) & 0x01) == 1;
      data.continuousFlow = ((bytes[9] >> 1) & 0x01) == 1;
      data.noUsage = ((bytes[9] >> 2) & 0x01) == 1;
      data.linkError = ((bytes[9] >> 3) & 0x01) == 1;
      
      if (payload.length == 26) {
        const keydate = ((bytes[12] << 8) | bytes[11]);
        const keydate_day = keydate & 0x1f;
        const keydate_month = (keydate & 0xf00) >> 8;
        const keydate_year = ((keydate & 0xe0) >> 5) + ((keydate & 0xf000) >> 9);
        data.keyDate = "" + keydate_day + "." + keydate_month + "." + keydate_year;
      }
    }
    
    return {
      data,
      errors: [],
      warnings: []
    };
    
  } catch (error: any) {
    return {
      data: {},
      errors: [error.message],
      warnings: []
    };
  }
}

function getActualityDuration(input: number) {
  if (input < 0 || input > 255) return "unknown";
  if (input <= 59) return input + " minutes";
  if (input > 59 && input < 152) {
    const durationMin = (((input - 60) * 15) % 60);
    const durationHour = Math.floor(((input - 60) * 15) / 60) + 1;
    return durationHour + "h " + durationMin + "m";
  }
  if (152 <= input && input < 200) {
    const durationDays = input - 152 + 1;
    return durationDays + " days";
  }
  if (200 <= input && input < 245) {
    const durationWeeks = input - 200 + 7;
    return durationWeeks + " weeks";
  }
  if (245 <= input) return "more than 1 years";
  return "unknown";
}

// Harvy2 Dekodierung
function decodeHarvy2(payload: string) {
  try {
    const data: any = {};
    
    // Verwende eingebaute Harvy2-Dekodierung
    const LoRaWANDecoder = require('@/lib/lorawan-decoder.js');
    const decodedResult = LoRaWANDecoder.decode(payload, 'harvy2', 'harvy2', 6);
    
    return {
      data: decodedResult,
      errors: [],
      warnings: []
    };
  } catch (error: any) {
    return {
      data: {
        raw_hex: payload,
        raw_bytes: Array.from(Buffer.from(payload, 'hex')),
        length: payload.length / 2,
        error: `Harvy2 Dekodierungsfehler: ${error.message}`
      },
      errors: [`Harvy2 Dekodierungsfehler: ${error.message}`],
      warnings: []
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      deviceId, 
      limit = 50, 
      startDate, 
      endDate,
      force = false 
    } = body;

    if (!deviceId) {
      return NextResponse.json({
        success: false,
        error: 'Device ID ist erforderlich'
      }, { status: 400 });
    }

    // Lade Device-Konfiguration
    const deviceManager = require('@/lib/device-manager');
    const allDevices = deviceManager.reloadDevices();
    const selectedDevice = allDevices.find((d: any) => d.deviceId === deviceId);
    
    console.log(`Requested Device ID: ${deviceId}`);
    console.log(`Selected Device: ${selectedDevice?.deviceId}, DeviceEUI: ${selectedDevice?.deviceEUI}`);
    
    if (!selectedDevice) {
      return NextResponse.json({
        success: false,
        error: 'Device nicht gefunden'
      }, { status: 404 });
    }

    if (!selectedDevice.lineMetrics?.enabled) {
      return NextResponse.json({
        success: false,
        error: 'LineMetrics ist für dieses Device nicht aktiviert'
      }, { status: 400 });
    }
    
    // Lade historische Daten von webhook.site
    const webhookData = await fetchWebhookSiteHistory(limit, startDate, endDate);
    
    // Verwende das ausgewählte Device (nicht überschreiben!)
    const correctDevice = selectedDevice;

    if (!correctDevice) {
      return NextResponse.json({
        success: false,
        error: 'Device nicht gefunden'
      }, { status: 404 });
    }

    if (!correctDevice.lineMetrics?.enabled) {
      return NextResponse.json({
        success: false,
        error: 'LineMetrics ist für dieses Device nicht aktiviert'
      }, { status: 400 });
    }
    
    // Filtere Daten für das spezifische Device
    console.log(`Filtering webhooks for device: ${correctDevice.deviceId} (${correctDevice.deviceEUI})`);
    console.log(`Total webhooks available: ${webhookData.length}`);
    
    const deviceWebhooks = webhookData.filter((webhook: any) => {
      if (!webhook.content) return false;
      
      try {
        const content = JSON.parse(webhook.content);
        if (content.DevEUI_uplink) {
          const webhookDeviceEUI = content.DevEUI_uplink.DevEUI;
          const isMatch = webhookDeviceEUI === correctDevice.deviceEUI || 
                         webhookDeviceEUI === correctDevice.deviceEUI?.toLowerCase();
          
          console.log(`Webhook DeviceEUI: ${webhookDeviceEUI}, Device DeviceEUI: ${correctDevice.deviceEUI}, Match: ${isMatch}`);
          return isMatch;
        }
      } catch (e) {
        // Ignore parsing errors
      }
      return false;
    });
    
    console.log(`Filtered webhooks for device: ${deviceWebhooks.length}`);

    if (deviceWebhooks.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Keine historischen Daten für dieses Device gefunden',
        dataSent: 0,
        totalWebhooks: webhookData.length,
        deviceWebhooks: 0
      });
    }

    // Verarbeite und sende Daten an LineMetrics
    const lineMetricsClient = new LineMetricsClient();
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const webhook of deviceWebhooks) {
      try {
        const content = JSON.parse(webhook.content);
        const uplink = content.DevEUI_uplink;
        
        if (!uplink?.payload_hex) continue;

        // Dekodiere Payload
        const decodedResult = decodePayload(uplink.payload_hex, uplink.CustomerData?.alr?.pro);
        
        if (decodedResult.errors.length > 0) {
          errorCount++;
          errors.push(`Webhook ${webhook.uuid}: ${decodedResult.errors.join(', ')}`);
          continue;
        }

        // Debug: Log Webhook-Zeitstempel
        console.log(`Webhook Time: ${uplink.Time}`);
        console.log(`Webhook UUID: ${webhook.uuid}`);
        console.log(`Decoded Data: ${JSON.stringify(decodedResult.data)}`);
        
        // Sende an LineMetrics
        const lineMetricsResult = await lineMetricsClient.sendData(
          correctDevice.lineMetrics,
          decodedResult.data,
          correctDevice.deviceId,
          uplink.Time
        );

        if ((lineMetricsResult as any).success) {
          successCount++;
        } else {
          errorCount++;
          errors.push(`LineMetrics Fehler für Webhook ${webhook.uuid}: ${(lineMetricsResult as any).error}`);
        }

        // Kurze Pause zwischen API-Aufrufen
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error: any) {
        errorCount++;
        errors.push(`Verarbeitungsfehler für Webhook ${webhook.uuid}: ${error.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Historische Daten erfolgreich an LineMetrics gesendet`,
      dataSent: successCount,
      errors: errorCount,
      totalWebhooks: webhookData.length,
      deviceWebhooks: deviceWebhooks.length,
      errorDetails: errors.slice(0, 10) // Zeige nur die ersten 10 Fehler
    });

  } catch (error: any) {
    console.error('Fehler beim Pushen historischer Daten:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
} 