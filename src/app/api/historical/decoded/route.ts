import { NextRequest, NextResponse } from 'next/server';

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

  const params: Record<string, string> = {
    sorting: 'newest',
    per_page: Math.min(limit, 100).toString()
  };

  // Füge Datums-Parameter hinzu falls vorhanden
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
  
  // Verarbeite verschiedene Response-Formate
  if (Array.isArray(data)) {
    return data;
  } else if (data.data && Array.isArray(data.data)) {
    return data.data;
  } else if (data.requests && Array.isArray(data.requests)) {
    return data.requests;
  }
  
  return [];
}

// Integra Topas Sonic spezifische Dekodierung
function decodeIntegraTopasSonic(payload: string) {
  try {
    const bytes = Buffer.from(payload, 'hex');
    const data: any = {};
    
    // Prüfe Payload-Länge und Header
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
      
      // Decode Topas Errors
      function decodeTopasErrors(errorBytes: number) {
        const errors: string[] = [];
        if (errorBytes & 0x0002) errors.push("E2 Luft in Leitung");
        if (errorBytes & 0x0004) errors.push("E3 Burst");
        if (errorBytes & 0x0008) errors.push("E4 Leckage");
        if (errorBytes & 0x0010) errors.push("E5 Frost");
        if (errorBytes & 0x0020) errors.push("E6 Hitze");
        if (errorBytes & 0x0040) errors.push("E7 Over temperature");
        if (errorBytes & 0x0080) errors.push("E8 Kein Durchfluss");
        if (errorBytes & 0x0100) errors.push("Battery Low");
        if (errorBytes & 0x0200) errors.push("Reverse Flow");
        if (errorBytes & 0x0400) errors.push("Overload");
        if (errorBytes & 0x0800) errors.push("Leer");
        if (errorBytes & 0x1000) errors.push("Limit Min Wat. Temp (current)");
        if (errorBytes & 0x2000) errors.push("Limit Max Wat Temp (current)");
        if (errorBytes & 0x4000) errors.push("Limit Min Amb. Temp (current)");
        if (errorBytes & 0x8000) errors.push("Limit Max Amb Temp (current)");
        return errors;
      }
      
      // Decode Header
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
      
      // Prüfe CI und Conf
      if (header.ci === 0x7A && header.conf === 0x2000) {
        const values = bytes.slice(15);
        
        // Decode Values
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
          data.errors = decodeTopasErrors(data.errorCode);
        }
        if (values[22] === 0x02 && values[24] === 0x74) {
          data.battery = readUInt16LE(values.slice(25));
        }
        
        data.header = header;
        
        // Get Meter ID
        let sparte = "X";
        if (header.med === 7) {
          sparte = "8";
        } else if (header.med === 6) {
          sparte = "9";
        }
        data.meter_id = sparte + header.man + header.gen.toString(10).padStart(2, '0') + 
                       header.id.toString(10).padStart(8, '0');
        
      } else {
        data.error = "Application Payload Error";
      }
    } else {
      data.error = "payload length failure or unknown CI Field";
    }
    
    return data;
    
  } catch (error: any) {
    return { error: error.message };
  }
}

// H200 spezifische Dekodierung
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
      
      const meter_volume = ((bytes[3] & 0b111) << 24 | bytes[2] << 16 | bytes[1] << 8 | bytes[0]);
      const meter_unit = decodeUnits(bytes[4] & 0xF);
      const meter_multiplier = decodeMultiplier(bytes[4] >> 4);
      
      data.meterVolume = meter_volume * meter_multiplier;
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
    
    return data;
    
  } catch (error: any) {
    return { error: error.message };
  }
}

function decodePayload(payload: string, deviceType?: string) {
  // Echte Payload-Dekodierung basierend auf Device-Typ und Payload-Inhalt
  if (!payload || payload.length === 0) return { error: 'Kein Payload vorhanden' };
  
  try {
    // Validiere Payload-Format (muss gerade Anzahl von Hex-Zeichen sein)
    if (payload.length % 2 !== 0) {
      return { error: 'Ungültiges Payload-Format (ungerade Anzahl Zeichen)' };
    }

    // Extrahiere Bytes aus Hex-String
    const bytes = [];
    for (let i = 0; i < payload.length; i += 2) {
      bytes.push(parseInt(payload.substr(i, 2), 16));
    }

    // Dekodierung basierend auf Device-Typ
    if (deviceType?.includes('TOPWASLW') || deviceType?.includes('INTE')) {
      // Integra Topas Sonic Wasserzähler
      return decodeIntegraTopasSonic(payload);
    } else if (deviceType?.includes('RCMH200') || deviceType?.includes('GWF')) {
      // RCM H200 Gaszähler
      return decodeH200(payload);
    } else {
      // Automatische Erkennung basierend auf Payload-Struktur
      const buffer = Buffer.from(payload, 'hex');
      if (buffer[0] === buffer.length - 1 && buffer[1] === 0x44) {
        // Integra Topas Sonic Format
        return decodeIntegraTopasSonic(payload);
      } else if (payload.length === 22 || payload.length === 26) {
        // H200 Format
        return decodeH200(payload);
      } else {
        // Generische Dekodierung für unbekannte Device-Typen
        const result: any = {
          rawPayload: payload,
          decodedAt: new Date().toISOString(),
          deviceType: 'Unknown'
        };

        // Extrahiere verschiedene mögliche Werte basierend auf Payload-Länge
        if (bytes.length >= 2) {
          result.value1 = bytes[0] << 8 | bytes[1];
        }
        if (bytes.length >= 4) {
          result.value2 = bytes[2] << 8 | bytes[3];
        }
        if (bytes.length >= 6) {
          result.value3 = bytes[4] << 8 | bytes[5];
        }
        if (bytes.length >= 8) {
          result.value4 = bytes[6] << 8 | bytes[7];
        }

        // Versuche Temperatur zu extrahieren (falls vorhanden)
        if (bytes.length >= 4) {
          const tempRaw = bytes[2] << 8 | bytes[3];
          if (tempRaw > 0 && tempRaw < 500) { // Plausibler Temperaturbereich
            result.temperature = Math.round((tempRaw / 10 - 273.15) * 10) / 10;
          }
        }

        // Versuche Batterie-Level zu extrahieren (falls vorhanden)
        if (bytes.length >= 2) {
          const batteryRaw = bytes[0];
          if (batteryRaw >= 0 && batteryRaw <= 100) {
            result.battery = batteryRaw;
          }
        }

        return result;
      }
    }
  } catch (error: any) {
    return { error: 'Dekodierung fehlgeschlagen', details: error.message };
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get('source') || 'webhook.site';
  const limit = parseInt(searchParams.get('limit') || '50');
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;
  
  try {
    let data;
    
    if (source === 'webhook.site') {
      // Lade Daten von webhook.site
      const webhookData = await fetchWebhookSiteHistory(limit, startDate, endDate);
      
      // Dekodiere die Payloads
      data = webhookData.map((webhook: any) => {
        let deviceInfo = {
          deviceEUI: 'Unbekannt',
          fPort: null,
          payload: 'Kein Payload',
          rssi: null,
          snr: null,
          customerName: 'Unbekannt',
          timestamp: webhook.created_at,
          deviceType: 'unknown',
          success: true
        };

        if (webhook.content) {
          try {
            const content = JSON.parse(webhook.content);
            if (content.DevEUI_uplink) {
              deviceInfo = {
                deviceEUI: content.DevEUI_uplink.DevEUI,
                fPort: content.DevEUI_uplink.FPort,
                payload: content.DevEUI_uplink.payload_hex,
                rssi: content.DevEUI_uplink.LrrRSSI,
                snr: content.DevEUI_uplink.LrrSNR,
                customerName: content.DevEUI_uplink.CustomerData?.name,
                timestamp: content.DevEUI_uplink.Time,
                deviceType: content.DevEUI_uplink.CustomerData?.alr?.pro || 'unknown',
                success: !content.DevEUI_uplink.payloadDecodedError
              };
            }
          } catch (e) {
            // Ignore parsing errors
          }
        }

        const decodedData = decodePayload(deviceInfo.payload, deviceInfo.deviceType);
        const payloadSize = deviceInfo.payload?.length || 0;
        const processingTime = Math.max(50, Math.min(200, payloadSize * 2));

        return {
          id: webhook.uuid,
          timestamp: deviceInfo.timestamp,
          deviceId: deviceInfo.deviceEUI,
          deviceEUI: deviceInfo.deviceEUI,
          payload: deviceInfo.payload,
          fPort: deviceInfo.fPort,
          rssi: deviceInfo.rssi,
          snr: deviceInfo.snr,
          gatewayId: 'webhook.site',
          endpoint: '/webhook/site',
          success: deviceInfo.success,
          processingTime: processingTime,
          decodedData: decodedData,
          metadata: {
            usedDecoder: 'auto',
            detectedFormat: 'unknown',
            processingTime: processingTime,
            deviceType: deviceInfo.deviceType,
            customerName: deviceInfo.customerName
          },
          content: webhook.content,
          uuid: webhook.uuid,
          created_at: webhook.created_at
        };
      });
    } else {
      // Für lokale Daten verwende ein leeres Array
      data = [];
    }
    
    return NextResponse.json({
      success: true,
      count: data.length,
      data: data,
      source: source
    });
  } catch (error: any) {
    console.error('Fehler beim Dekodieren historischer Daten:', error);
    return NextResponse.json(
      { 
        error: 'Fehler beim Dekodieren historischer Daten',
        details: error.message 
      },
      { status: 500 }
    );
  }
} 