/**
 * Core payload decoding logic (shared by /api/payload/decode and decode-payload.ts).
 */
import { promises as fs } from 'fs';
import path from 'path';

async function loadDecoder(decoderName: string) {
  try {
    const decoderPath = path.join(process.cwd(), 'src', 'lib', 'decoders', `${decoderName}.txt`);
    const decoderCode = await fs.readFile(decoderPath, 'utf8');
    return decoderCode;
  } catch (error) {
    console.error(`Decoder ${decoderName} nicht gefunden:`, error);
    return null;
  }
}

function executeDecoder(decoderCode: string, payload: string, fPort?: number) {
  try {
    const vm = require('vm');

    const bytes = Buffer.from(payload, 'hex');

    const input = {
      bytes: Array.from(bytes),
      fPort: fPort || 1,
      recvTime: new Date(),
    };

    const context = {
      input,
      Buffer,
      console: {
        log: (...args: unknown[]) => console.log('Decoder Log:', ...args),
        error: (...args: unknown[]) => console.error('Decoder Error:', ...args),
        warn: (...args: unknown[]) => console.warn('Decoder Warning:', ...args),
      },
      String,
      Number,
      Array,
      Object,
      Math,
      Date,
      parseInt,
      parseFloat,
    };

    const script = new vm.Script(decoderCode);
    const result = script.runInNewContext(context, { timeout: 5000 });

    const ctx = context as unknown as { decodeUplink?: (i: typeof input) => unknown };
    if (typeof ctx.decodeUplink === 'function') {
      return ctx.decodeUplink(input);
    }

    return result || { data: {}, errors: [], warnings: [] };
  } catch (error) {
    console.error('Fehler beim Ausführen des Decoders:', error);
    return {
      data: {},
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: [],
    };
  }
}

function decodeIntegraTopasSonic(payload: string) {
  try {
    const bytes = Buffer.from(payload, 'hex');
    const data: Record<string, unknown> = {};

    if (bytes[0] === bytes.length - 1 && bytes[1] === 0x44) {
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

      function manId2ascii(idhex: number) {
        return (
          String.fromCharCode((idhex >> 10) + 64) +
          String.fromCharCode(((idhex >> 5) & 0x1f) + 64) +
          String.fromCharCode((idhex & 0x1f) + 64)
        ).toUpperCase();
      }

      function readUInt16LE(buf: Buffer) {
        return 0xffff & ((buf[1] << 8) | buf[0]);
      }

      function readInt32LE(buf: Buffer) {
        const res = 0xffffffff & ((buf[3] << 24) | (buf[2] << 16) | (buf[1] << 8) | buf[0]);
        return res > 0x7fffffff ? res - 0x100000000 : res;
      }

      function readInt16LE(buf: Buffer) {
        const res = readUInt16LE(buf);
        return res > 0x7fff ? res - 0x10000 : res;
      }

      function decodeTopasErrors(errorBytes: number) {
        const errors: string[] = [];
        if (errorBytes & 0x0002) errors.push('E2 Luft in Leitung');
        if (errorBytes & 0x0004) errors.push('E3 Burst');
        if (errorBytes & 0x0008) errors.push('E4 Leckage');
        if (errorBytes & 0x0010) errors.push('E5 Frost');
        if (errorBytes & 0x0020) errors.push('E6 Hitze');
        if (errorBytes & 0x0040) errors.push('E7 Over temperature');
        if (errorBytes & 0x0080) errors.push('E8 Kein Durchfluss');
        if (errorBytes & 0x0100) errors.push('Battery Low');
        if (errorBytes & 0x0200) errors.push('Reverse Flow');
        if (errorBytes & 0x0400) errors.push('Overload');
        if (errorBytes & 0x0800) errors.push('Leer');
        if (errorBytes & 0x1000) errors.push('Limit Min Wat. Temp (current)');
        if (errorBytes & 0x2000) errors.push('Limit Max Wat Temp (current)');
        if (errorBytes & 0x4000) errors.push('Limit Min Amb. Temp (current)');
        if (errorBytes & 0x8000) errors.push('Limit Max Amb Temp (current)');
        return errors;
      }

      const header = {
        id: decodeBCD(8, bytes.slice(4)),
        man: manId2ascii(readUInt16LE(bytes.slice(2))),
        gen: bytes[8],
        med: bytes[9],
        ci: bytes[10],
        acc: bytes[11],
        sts: bytes[12],
        conf: readUInt16LE(bytes.slice(13)),
      };

      if (header.ci === 0x7a && header.conf === 0x2000) {
        const values = bytes.slice(15);

        if (values[0] === 0x04 && values[1] === 0x13) {
          data.volume = readInt32LE(values.slice(2)) / 1e3;
        }
        if (values[6] === 0x84 && values[8] === 0x13) {
          data.reverseVolume = readInt32LE(values.slice(9)) / 1e3;
        }
        if (values[13] === 0x02 && values[14] === 0x5a) {
          data.waterTemperature = readInt16LE(values.slice(15)) / 10;
        }
        if (values[17] === 0x02 && values[19] === 0x17) {
          data.errorCode = readUInt16LE(values.slice(20));
          data.errors = decodeTopasErrors(data.errorCode as number);
        }
        if (values[22] === 0x02 && values[24] === 0x74) {
          data.battery = readUInt16LE(values.slice(25));
        }

        data.header = header;

        let sparte = 'X';
        if (header.med === 7) {
          sparte = '8';
        } else if (header.med === 6) {
          sparte = '9';
        }
        data.meter_id =
          sparte +
          header.man +
          header.gen.toString(10).padStart(2, '0') +
          (header.id as number).toString(10).padStart(8, '0');
      } else {
        data.error = 'Application Payload Error';
      }
    } else {
      data.error = 'payload length failure or unknown CI Field';
    }

    return {
      data,
      errors: data.error ? [String(data.error)] : [],
      warnings: [] as string[],
    };
  } catch (error) {
    return {
      data: {},
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: [] as string[],
    };
  }
}

function decodeH200(payload: string) {
  try {
    const data: Record<string, unknown> = {};

    if (payload.length === 22 || payload.length === 26) {
      const bytes = Buffer.from(payload, 'hex');

      function decodeMedium(code: number) {
        if (code < 5 && code > 2) {
          code = code - 3;
        } else if (code < 7 && code > 4) {
          code = code - 5;
        }
        if (code === 0) return 'water';
        if (code === 1) return 'warm water';
        if (code === 2) return 'gas';
        return 'unknown';
      }

      function decodeUnits(code: number) {
        if (code < 3) return 'm3';
        if (code < 5) return 'galons';
        if (code < 7) return 'feet3';
        return 'unknown';
      }

      function decodeMultiplier(code: number) {
        if (code == 0) return 0.001;
        if (code == 1) return 0.01;
        if (code == 2) return 0.1;
        if (code == 3) return 1;
        if (code == 4) return 10;
        return 'unknown';
      }

      function getActualityDuration(input: number) {
        if (input < 0 || input > 255) return 'unknown';
        if (input <= 59) return input + ' minutes';
        if (input > 59 && input < 152) {
          const durationMin = ((input - 60) * 15) % 60;
          const durationHour = Math.floor(((input - 60) * 15) / 60) + 1;
          return durationHour + 'h ' + durationMin + 'm';
        }
        if (152 <= input && input < 200) {
          const durationDays = input - 152 + 1;
          return durationDays + ' days';
        }
        if (200 <= input && input < 245) {
          const durationWeeks = input - 200 + 7;
          return durationWeeks + ' weeks';
        }
        if (245 <= input) return 'more than 1 years';
        return 'unknown';
      }

      const meter_volume = ((bytes[3] & 0b111) << 24) | (bytes[2] << 16) | (bytes[1] << 8) | bytes[0];
      const meter_unit = decodeUnits(bytes[4] & 0xf);
      const meter_multiplier = decodeMultiplier(bytes[4] >> 4);

      data.meterVolume =
        meter_volume * (typeof meter_multiplier === 'number' ? meter_multiplier : 1);
      data.lifetimeSemester = (bytes[3] >> 3) + ' semester(s)';
      data.medium = decodeMedium(bytes[4] & 0xf) + ' ' + meter_unit;
      data.meterSerialNumber = ((bytes[8] & 0b111) << 24) | (bytes[7] << 16) | (bytes[6] << 8) | bytes[5];
      data.actualityDuration = getActualityDuration(bytes[10]);
      data.meterNoResponse = ((bytes[8] >> 3) & 0x01) == 1;
      data.meterEcoFrameError = ((bytes[8] >> 4) & 0x01) == 1;
      data.meterRollError = ((bytes[8] >> 5) & 0x01) == 1;
      data.brokenPipe = ((bytes[8] >> 6) & 0x01) == 1;
      data.lowBattery = ((bytes[8] >> 7) & 0x01) == 1;
      data.backflow = (bytes[9] & 0x01) == 1;
      data.continuousFlow = ((bytes[9] >> 1) & 0x01) == 1;
      data.noUsage = ((bytes[9] >> 2) & 0x01) == 1;
      data.linkError = ((bytes[9] >> 3) & 0x01) == 1;

      if (payload.length == 26) {
        const keydate = (bytes[12] << 8) | bytes[11];
        const keydate_day = keydate & 0x1f;
        const keydate_month = (keydate & 0xf00) >> 8;
        const keydate_year = ((keydate & 0xe0) >> 5) + ((keydate & 0xf000) >> 9);
        data.keyDate = '' + keydate_day + '.' + keydate_month + '.' + keydate_year;
      }
    }

    return {
      data,
      errors: [] as string[],
      warnings: [] as string[],
    };
  } catch (error) {
    return {
      data: {},
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: [] as string[],
    };
  }
}

export interface DecodePayloadInput {
  payload: string;
  decoder?: string;
  deviceType?: string;
  fPort?: number;
  deviceEUI?: string;
  deviceInfo?: {
    decoder?: string;
    name?: string;
    manufacturer?: string;
    model?: string;
  };
}

export interface DecodePayloadCoreResult {
  success: boolean;
  payload: string;
  decoder: string;
  deviceType?: string;
  fPort?: number;
  deviceEUI?: string;
  deviceInfo?: DecodePayloadInput['deviceInfo'];
  decodedData: Record<string, unknown>;
  errors: string[];
  warnings: string[];
  timestamp: string;
}

/**
 * Run the same decode pipeline as POST /api/payload/decode (no HTTP).
 */
export async function decodePayloadCore(input: DecodePayloadInput): Promise<DecodePayloadCoreResult> {
  const { payload, decoder = 'auto', deviceType, fPort, deviceEUI, deviceInfo } = input;

  if (!payload) {
    throw new Error('Payload erforderlich');
  }

  let decodedData: { data: Record<string, unknown>; errors: string[]; warnings: string[] };
  let usedDecoder = decoder;

  if (decoder === 'auto') {
    if (deviceInfo?.decoder && deviceInfo.decoder !== 'auto') {
      usedDecoder = deviceInfo.decoder;
      console.log(`Verwende Device-Decoder: ${usedDecoder} für Device ${deviceEUI}`);
    } else if (deviceType?.includes('TOPWASLW') || deviceType?.includes('INTE')) {
      usedDecoder = 'integra-topas-sonic';
    } else if (deviceType?.includes('RCMH200') || deviceType?.includes('GWF')) {
      usedDecoder = 'h200';
    } else if (deviceType?.includes('HARVY') || deviceType?.includes('deZem')) {
      usedDecoder = 'harvy2';
    } else {
      const bytes = Buffer.from(payload, 'hex');
      if (bytes[0] === bytes.length - 1 && bytes[1] === 0x44) {
        usedDecoder = 'integra-topas-sonic';
      } else if (payload.length === 22 || payload.length === 26) {
        usedDecoder = 'h200';
      } else if (fPort === 6 || fPort === 10 || fPort === 99) {
        usedDecoder = 'harvy2';
      } else {
        usedDecoder = 'raw';
      }
    }
  }

  switch (usedDecoder) {
    case 'integra-topas-sonic':
      decodedData = decodeIntegraTopasSonic(payload);
      break;
    case 'h200':
      decodedData = decodeH200(payload);
      break;
    case 'harvy2':
      try {
        const LoRaWANDecoder = require('@/lib/lorawan-decoder');
        const decodedResult = LoRaWANDecoder.decode(payload, 'harvy2', 'harvy2', fPort);

        decodedData = {
          data: decodedResult as Record<string, unknown>,
          errors: [],
          warnings: [],
        };
      } catch (error) {
        console.error('Fehler bei Harvy2-Dekodierung:', error);
        decodedData = {
          data: {
            raw_hex: payload,
            raw_bytes: Array.from(Buffer.from(payload, 'hex')),
            length: payload.length / 2,
            error: `Harvy2 Dekodierungsfehler: ${error instanceof Error ? error.message : String(error)}`,
          },
          errors: [`Harvy2 Dekodierungsfehler: ${error instanceof Error ? error.message : String(error)}`],
          warnings: [],
        };
      }
      break;
    case 'raw':
      decodedData = {
        data: {
          raw_hex: payload,
          raw_bytes: Array.from(Buffer.from(payload, 'hex')),
          length: payload.length / 2,
        },
        errors: [],
        warnings: [],
      };
      break;
    default: {
      const decoderCode = await loadDecoder(usedDecoder);
      if (decoderCode) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- vm decoder return shape varies
        decodedData = executeDecoder(decoderCode, payload, fPort) as any;
        if (!decodedData || typeof decodedData !== 'object') {
          decodedData = { data: {}, errors: [] as string[], warnings: [] as string[] };
        }
        if (!('data' in decodedData)) {
          decodedData = {
            data: decodedData as Record<string, unknown>,
            errors: (decodedData as { errors?: string[] }).errors || [],
            warnings: (decodedData as { warnings?: string[] }).warnings || [],
          };
        }
      } else {
        decodedData = {
          data: {
            raw_hex: payload,
            raw_bytes: Array.from(Buffer.from(payload, 'hex')),
            length: payload.length / 2,
            error: `Decoder '${usedDecoder}' nicht gefunden`,
          },
          errors: [`Decoder '${usedDecoder}' nicht gefunden`],
          warnings: [],
        };
      }
    }
  }

  const errors = decodedData.errors || [];
  const success = errors.length === 0;

  return {
    success,
    payload,
    decoder: usedDecoder,
    deviceType,
    fPort,
    deviceEUI,
    deviceInfo,
    decodedData: decodedData.data,
    errors,
    warnings: decodedData.warnings || [],
    timestamp: new Date().toISOString(),
  };
}
