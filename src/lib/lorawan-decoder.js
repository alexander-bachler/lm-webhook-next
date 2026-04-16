const logger = require('./logger');

class LoRaWANDecoder {
  
  /**
   * Lade verfügbare Repository-Decoder
   */
  static getRepositoryDecoders() {
    try {
      const m = require('./device-manager');
      const deviceManager = m.default || m;
      return deviceManager.getAvailableDecoders();
    } catch (error) {
      logger.debug('Repository-Decoder nicht verfügbar:', error.message);
      return [];
    }
  }
  
  /**
   * Hauptdekodierungsfunktion - versucht automatische Erkennung des Formats
   */
  static decode(payload, format = 'auto', deviceType = null, fPort = null) {
    try {
      if (!payload) {
        throw new Error('Payload ist leer');
      }

      // Konvertiere String zu Buffer wenn nötig
      let buffer;
      if (typeof payload === 'string') {
        buffer = Buffer.from(payload, 'hex');
      } else if (Array.isArray(payload)) {
        buffer = Buffer.from(payload);
      } else {
        buffer = payload;
      }

      if (format === 'auto') {
        format = this.detectFormat(buffer, deviceType, fPort);
      }

      logger.info(`Dekodiere LoRaWAN Payload mit Format: ${format}`, { 
        payloadLength: buffer.length,
        deviceType 
      });

      // Prüfe ob es sich um einen Repository-Decoder handelt
      const repoDecoders = this.getRepositoryDecoders();
      const repoDecoder = repoDecoders.find(d => d.id === format);
      
      if (repoDecoder && repoDecoder.repository !== 'builtin') {
        return this.executeRepositoryDecoder(repoDecoder, payload, buffer, fPort);
      }

      switch (format.toLowerCase()) {
        case 'ttn':
          return this.decodeTTN(buffer);
        case 'cayenne':
        case 'cayennelpp':
          return this.decodeCayenneLPP(buffer);
        case 'actility':
          return this.decodeActility(buffer);
        case 'dezem_harvy2':
        case 'harvy2':
          return this.decodeDezemHarvy2(buffer, fPort);
        case 'temperature':
          return this.decodeTemperature(buffer);
        case 'environmental':
          return this.decodeEnvironmental(buffer);
        case 'energy':
          return this.decodeEnergy(buffer);
        case 'h200':
          return this.decodeH200(buffer);
        case 'integra-topas-sonic':
          return this.decodeIntegraTopasSonic(buffer);
        case 'custom':
          return this.decodeCustom(buffer, deviceType);
        default:
          return this.decodeRaw(buffer);
      }
    } catch (error) {
      logger.error('Fehler beim Dekodieren des LoRaWAN Payloads:', error.message);
      throw error;
    }
  }

  /**
   * Führe Repository-Decoder aus
   */
  static executeRepositoryDecoder(decoder, originalPayload, buffer, fPort) {
    try {
      logger.info(`Verwende Repository-Decoder: ${decoder.name} (${decoder.id})`);
      
      // Konvertiere Payload zu Base64 falls nötig (viele Repository-Decoder erwarten Base64)
      let payloadBase64;
      if (typeof originalPayload === 'string') {
        // Hex String zu Base64 konvertieren
        payloadBase64 = Buffer.from(originalPayload, 'hex').toString('base64');
      } else {
        payloadBase64 = Buffer.from(originalPayload).toString('base64');
      }
      
      // Erstelle Payload-Objekt für Decoder
      const payloadObj = {
        data: payloadBase64,
        fPort: fPort,
        devEUI: '0123456789ABCDEF',
        deviceInfo: {
          devEui: '0123456789ABCDEF'
        }
      };
      
      // Erstelle Metadata-Objekt
      const metadata = {
        name: `Device using ${decoder.name}`,
        location: {
          coordinates: [0, 0]
        },
        commentOnLocation: 'Test Location'
      };
      
      // Führe Decoder-Code aus
      const decodedResult = this.runDecoderCode(decoder.code, payloadObj, metadata);
      
      logger.info('Repository-Decoder Ergebnis:', decodedResult);
      return decodedResult;
      
    } catch (error) {
      logger.error(`Fehler beim Ausführen von Repository-Decoder ${decoder.id}:`, error);
      // Fallback auf Raw-Dekodierung
      return this.decodeRaw(buffer);
    }
  }
  
  /**
   * Führe Decoder-JavaScript-Code aus
   */
  static runDecoderCode(code, payload, metadata) {
    try {
      // Erstelle sichere Umgebung für Code-Ausführung
      const vm = require('vm');
      const util = require('util');
      
      // Helper Funktionen für Decoder
      const context = {
        payload,
        metadata,
        console: {
          log: (...args) => logger.debug('Decoder Log:', ...args),
          error: (...args) => logger.error('Decoder Error:', ...args),
          warn: (...args) => logger.warn('Decoder Warning:', ...args)
        },
        Buffer,
        JSON,
        Math,
        Date,
        parseInt,
        parseFloat,
        atob: (str) => Buffer.from(str, 'base64').toString('binary'),
        btoa: (str) => Buffer.from(str, 'binary').toString('base64'),
        // Standard JS Funktionen
        String,
        Number,
        Array,
        Object
      };
      
      // Kompiliere und führe Code aus
      const script = new vm.Script(`
        ${code}
        
        // Führe decode-Funktion aus falls vorhanden
        if (typeof decode === 'function') {
          decode(payload, metadata);
        } else {
          throw new Error('decode function not found in decoder code');
        }
      `);
      
      const result = script.runInNewContext(context, { timeout: 5000 });
      return result || context.payload?.data || {};
      
    } catch (error) {
      logger.error('Fehler beim Ausführen des Decoder-Codes:', error);
      throw error;
    }
  }

  /**
   * Automatische Format-Erkennung basierend auf Payload-Struktur
   */
  static detectFormat(buffer, deviceType, fPort = null) {
    if (deviceType) {
      const typeFormats = {
        'temperature': 'temperature',
        'environmental': 'environmental',
        'energy': 'energy',
        'ttn': 'ttn',
        'dezem_harvy2': 'dezem_harvy2',
        'harvy2': 'dezem_harvy2'
      };
      if (typeFormats[deviceType.toLowerCase()]) {
        return typeFormats[deviceType.toLowerCase()];
      }
    }

    // deZem Harvy2 Erkennung basierend auf FPort und Payload-Länge
    if (fPort && (fPort === 6 || fPort === 10 || fPort === 99)) {
      if ((fPort === 6 && buffer.length >= 35) ||
          (fPort === 10 && buffer.length >= 10) ||
          (fPort === 99 && buffer.length >= 4)) {
        return 'dezem_harvy2';
      }
    }

    // Harvy2 Erkennung auch ohne FPort (basierend auf typischen Payload-Längen)
    if (buffer.length >= 35 && buffer.length <= 80) {
      // Typische Harvy2 Port 6 Payload-Länge
      return 'dezem_harvy2';
    }

    // Cayenne LPP Erkennung (erste 3 Bytes sind meist Channel + Data Type)
    if (buffer.length >= 3 && buffer[1] >= 0x00 && buffer[1] <= 0x88) {
      return 'cayenne';
    }

    // TTN Standard Format Erkennung
    if (buffer.length === 2 || buffer.length === 4 || buffer.length === 8) {
      return 'ttn';
    }

    return 'raw';
  }

  /**
   * TTN Standard Format Dekodierung
   */
  static decodeTTN(buffer) {
    const data = {};
    
    if (buffer.length >= 2) {
      // Temperatur (2 Bytes, signed, /100)
      data.temperature = buffer.readInt16BE(0) / 100;
    }
    
    if (buffer.length >= 4) {
      // Feuchtigkeit (2 Bytes, unsigned, /100)
      data.humidity = buffer.readUInt16BE(2) / 100;
    }
    
    if (buffer.length >= 6) {
      // Druck (2 Bytes, unsigned, hPa)
      data.pressure = buffer.readUInt16BE(4);
    }
    
    if (buffer.length >= 8) {
      // Batterie (2 Bytes, mV)
      data.battery = buffer.readUInt16BE(6);
    }

    return data;
  }

  /**
   * Cayenne LPP Format Dekodierung
   */
  static decodeCayenneLPP(buffer) {
    const data = {};
    let index = 0;

    while (index < buffer.length) {
      if (index + 2 >= buffer.length) break;

      const channel = buffer[index];
      const type = buffer[index + 1];
      index += 2;

      switch (type) {
        case 0x01: // Digital Input
          if (index < buffer.length) {
            data[`digital_in_${channel}`] = buffer[index];
            index += 1;
          }
          break;
        case 0x02: // Digital Output
          if (index < buffer.length) {
            data[`digital_out_${channel}`] = buffer[index];
            index += 1;
          }
          break;
        case 0x67: // Temperature
          if (index + 1 < buffer.length) {
            data[`temperature_${channel}`] = buffer.readInt16BE(index) / 10;
            index += 2;
          }
          break;
        case 0x68: // Humidity
          if (index < buffer.length) {
            data[`humidity_${channel}`] = buffer[index] / 2;
            index += 1;
          }
          break;
        case 0x73: // Barometric Pressure
          if (index + 1 < buffer.length) {
            data[`pressure_${channel}`] = buffer.readUInt16BE(index) / 10;
            index += 2;
          }
          break;
        case 0x88: // GPS
          if (index + 8 < buffer.length) {
            const lat = buffer.readInt32BE(index) / 10000;
            const lon = buffer.readInt32BE(index + 3) / 10000;
            const alt = buffer.readInt32BE(index + 6) / 100;
            data[`gps_${channel}`] = { latitude: lat, longitude: lon, altitude: alt };
            index += 9;
          }
          break;
        default:
          // Unbekannter Typ, überspringe
          index += 1;
          break;
      }
    }

    return data;
  }

  /**
   * Temperatur-spezifische Dekodierung
   */
  static decodeTemperature(buffer) {
    const data = {};
    
    if (buffer.length >= 2) {
      data.temperature = buffer.readInt16BE(0) / 100;
    }
    
    if (buffer.length >= 4) {
      data.humidity = buffer.readUInt16BE(2) / 100;
    }

    return data;
  }

  /**
   * Umwelt-Sensor Dekodierung
   */
  static decodeEnvironmental(buffer) {
    const data = {};
    
    if (buffer.length >= 2) {
      data.temperature = buffer.readInt16BE(0) / 100;
    }
    
    if (buffer.length >= 4) {
      data.humidity = buffer.readUInt16BE(2) / 100;
    }
    
    if (buffer.length >= 6) {
      data.pressure = buffer.readUInt16BE(4) / 10;
    }
    
    if (buffer.length >= 8) {
      data.light = buffer.readUInt16BE(6);
    }
    
    if (buffer.length >= 10) {
      data.co2 = buffer.readUInt16BE(8);
    }

    return data;
  }

  /**
   * Energie-Meter Dekodierung
   */
  static decodeEnergy(buffer) {
    const data = {};
    
    if (buffer.length >= 4) {
      data.energy = buffer.readUInt32BE(0) / 1000; // kWh
    }
    
    if (buffer.length >= 8) {
      data.power = buffer.readUInt32BE(4) / 10; // W
    }
    
    if (buffer.length >= 10) {
      data.voltage = buffer.readUInt16BE(8) / 10; // V
    }
    
    if (buffer.length >= 12) {
      data.current = buffer.readUInt16BE(10) / 1000; // A
    }

    return data;
  }

  /**
   * Actility ThingPark spezifische Dekodierung
   */
  static decodeActility(buffer) {
    const data = {};
    
    // Actility verwendet oft standardisierte Formate
    // Versuche intelligente Erkennung basierend auf Payload-Länge und -Struktur
    
    if (buffer.length === 2) {
      // 2-Byte Temperatur (häufig bei Actility Sensoren)
      data.temperature = buffer.readInt16BE(0) / 100;
    }
    else if (buffer.length === 4) {
      // 4-Byte Format: Temperatur + Feuchtigkeit
      data.temperature = buffer.readInt16BE(0) / 100;
      data.humidity = buffer.readUInt16BE(2) / 100;
    }
    else if (buffer.length === 6) {
      // 6-Byte Format: Temperatur + Feuchtigkeit + Batterie
      data.temperature = buffer.readInt16BE(0) / 100;
      data.humidity = buffer.readUInt16BE(2) / 100;
      data.battery = buffer.readUInt16BE(4); // mV
    }
    else if (buffer.length === 8) {
      // 8-Byte Format: Extended Environmental Data
      data.temperature = buffer.readInt16BE(0) / 100;
      data.humidity = buffer.readUInt16BE(2) / 100;
      data.pressure = buffer.readUInt16BE(4) / 10; // hPa
      data.battery = buffer.readUInt16BE(6); // mV
    }
    else if (buffer.length >= 10) {
      // Längere Payloads: Vollständige Umweltdaten
      data.temperature = buffer.readInt16BE(0) / 100;
      data.humidity = buffer.readUInt16BE(2) / 100;
      data.pressure = buffer.readUInt16BE(4) / 10;
      data.light = buffer.readUInt16BE(6);
      
      if (buffer.length >= 12) {
        data.battery = buffer.readUInt16BE(8);
        data.co2 = buffer.readUInt16BE(10);
      }
    }
    else {
      // Fallback zu Raw-Format wenn nichts erkannt wird
      return this.decodeRaw(buffer);
    }

    return data;
  }

  /**
   * deZem Harvy2 Stromzähler Dekodierung
   * Basiert auf: https://docs.harvy2.dezem.io/docs/decoders/unsupported/chirpstack_v4
   */
  static decodeDezemHarvy2(buffer, fPort = 10) {
    try {
      // Port-basierte Dekodierung
      switch (fPort) {
        case 6:
          return this.decodeHarvy2Port6(buffer);
        case 10:
          return this.decodeHarvy2Port10(buffer);
        case 99:
          return this.decodeHarvy2Port99(buffer);
        default:
          // Versuche Port 10 als Standard
          return this.decodeHarvy2Port10(buffer);
      }
    } catch (error) {
      logger.error('Fehler bei deZem Harvy2 Dekodierung:', error.message);
      return this.decodeRaw(buffer);
    }
  }

  /**
   * deZem Harvy2 Port 6 Dekodierung (v0.6 payload)
   */
  static decodeHarvy2Port6(buffer) {
    if (buffer.length < 35) {
      throw new Error(`Port 6 Payload zu kurz: ${buffer.length} bytes, erwartet mindestens 35`);
    }

    const data = {};

    // Ströme (mA)
    const c0_mA = this.readUInt16LE(buffer, 6) / 40;
    const c1_mA = this.readUInt16LE(buffer, 8) / 40;
    const c2_mA = this.readUInt16LE(buffer, 10) / 40;
    const c3_mA = this.readUInt16LE(buffer, 12) / 40;

    // Spannung (V)
    const voltage_ac = this.readUInt16LE(buffer, 30) / 10.0;

    // Scheinleistung (VA)
    const power_s_1 = ((c0_mA * 2) * voltage_ac) || 0;
    const power_s_2 = ((c1_mA * 2) * voltage_ac) || 0;
    const power_s_3 = ((c2_mA * 2) * voltage_ac) || 0;

    // Leistungsfaktor (cos phi)
    const cosphi_3_0 = this.readInt8(buffer, 32) / 100.0;
    const cosphi_3_1 = this.readInt8(buffer, 33) / 100.0;
    const cosphi_3_2 = this.readInt8(buffer, 34) / 100.0;

    // Wirkleistung (W)
    const power_p_1 = power_s_1 * cosphi_3_0;
    const power_p_2 = power_s_2 * cosphi_3_1;
    const power_p_3 = power_s_3 * cosphi_3_2;

    // Blindleistung (VAR)
    const power_q_1 = Math.sqrt((power_s_1 * power_s_1) - (power_p_1 * power_p_1)) || 0;
    const power_q_2 = Math.sqrt((power_s_2 * power_s_2) - (power_p_2 * power_p_2)) || 0;
    const power_q_3 = Math.sqrt((power_s_3 * power_s_3) - (power_p_3 * power_p_3)) || 0;

    // Formatierte Ausgabe
    data.current_l1_A = this.toFixed(c0_mA / 1000, 3);
    data.current_l2_A = this.toFixed(c1_mA / 1000, 3);
    data.current_l3_A = this.toFixed(c2_mA / 1000, 3);
    data.voltage_ac_V = this.toFixed(voltage_ac, 1);
    data.power_app_l1_VA = this.toFixed(power_s_1, 2);
    data.power_app_l2_VA = this.toFixed(power_s_2, 2);
    data.power_app_l3_VA = this.toFixed(power_s_3, 2);
    data.power_act_l1_W = this.toFixed(power_p_1, 2);
    data.power_act_l2_W = this.toFixed(power_p_2, 2);
    data.power_act_l3_W = this.toFixed(power_p_3, 2);
    data.power_react_l1_VAR = this.toFixed(power_q_1, 2);
    data.power_react_l2_VAR = this.toFixed(power_q_2, 2);
    data.power_react_l3_VAR = this.toFixed(power_q_3, 2);
    data.power_factor_l1 = this.toFixed(cosphi_3_0, 3);
    data.power_factor_l2 = this.toFixed(cosphi_3_1, 3);
    data.power_factor_l3 = this.toFixed(cosphi_3_2, 3);

    // Summen
    data.power_app_total_VA = this.toFixed(power_s_1 + power_s_2 + power_s_3, 2);
    data.power_act_total_W = this.toFixed(power_p_1 + power_p_2 + power_p_3, 2);
    data.power_react_total_VAR = this.toFixed(power_q_1 + power_q_2 + power_q_3, 2);

    data.decoder_version = 'v0.6';
    data.port = 6;

    return data;
  }

  /**
   * deZem Harvy2 Port 10 Dekodierung (v1.0 payload)
   */
  static decodeHarvy2Port10(buffer) {
    if (buffer.length < 10) {
      throw new Error(`Port 10 Payload zu kurz: ${buffer.length} bytes, erwartet mindestens 10`);
    }

    const data = {};

    // Flags aus den ersten 2 Bytes
    const flags = this.parseHarvy2Flags(buffer.slice(0, 2));
    
    // Channel-Daten beginnen ab Byte 10
    if (buffer.length > 10) {
      const channelData = this.parseHarvy2Channels(buffer.slice(10), flags);
      Object.assign(data, channelData);
    }

    // Basis-Informationen
    data.decoder_version = 'v1.0';
    data.port = 10;
    data.payload_length = buffer.length;

    // Flags hinzufügen
    Object.assign(data, flags);

    return data;
  }

  /**
   * deZem Harvy2 Port 99 Dekodierung (Reboot Message)
   */
  static decodeHarvy2Port99(buffer) {
    if (buffer.length < 4) {
      throw new Error(`Port 99 Payload zu kurz: ${buffer.length} bytes, erwartet mindestens 4`);
    }

    const data = {};
    data.reboot_counter = this.readUInt32LE(buffer, 0);
    
    if (buffer.length >= 7) {
      data.app_version_major = buffer[4] || 0;
      data.app_version_minor = buffer[5] || 0;
      data.app_version_patch = buffer[6] || 0;
      data.firmware_version = `${data.app_version_major}.${data.app_version_minor}.${data.app_version_patch}`;
    }

    data.decoder_version = 'reboot';
    data.port = 99;
    data.message_type = 'reboot';

    return data;
  }

  /**
   * Parse Harvy2 Flags (vereinfacht)
   */
  static parseHarvy2Flags(flagBuffer) {
    const flags = {};
    
    if (flagBuffer.length >= 2) {
      const flag1 = flagBuffer[0];
      const flag2 = flagBuffer[1];
      
      flags.in1_scaled_mode = !!(flag1 & 0x01);
      flags.in2_scaled_mode = !!(flag1 & 0x02);
      flags.in3_scaled_mode = !!(flag1 & 0x04);
      flags.in4_scaled_mode = !!(flag1 & 0x08);
      flags.in1_voltage_mode = !!(flag1 & 0x10);
      flags.in2_voltage_mode = !!(flag1 & 0x20);
      flags.in3_voltage_mode = !!(flag1 & 0x40);
      flags.in4_voltage_mode = !!(flag1 & 0x80);
      
      flags.ct_plus_mode = !!(flag2 & 0x01);
    }
    
    return flags;
  }

  /**
   * Parse Harvy2 Channel Data (vereinfacht)
   */
  static parseHarvy2Channels(channelBuffer, flags) {
    const data = {};
    
    if (channelBuffer.length >= 4) {
      // Vereinfachte Kanal-Dekodierung
      data.in1_raw = this.readUInt16LE(channelBuffer, 0);
      data.in2_raw = this.readUInt16LE(channelBuffer, 2);
      
      if (channelBuffer.length >= 8) {
        data.in3_raw = this.readUInt16LE(channelBuffer, 4);
        data.in4_raw = this.readUInt16LE(channelBuffer, 6);
      }
      
      // Skalierte Werte wenn verfügbar
      if (flags.in1_scaled_mode && data.in1_raw !== undefined) {
        data.in1_scaled = this.toFixed(data.in1_raw / 1000, 3);
      }
      if (flags.in2_scaled_mode && data.in2_raw !== undefined) {
        data.in2_scaled = this.toFixed(data.in2_raw / 1000, 3);
      }
    }
    
    return data;
  }

  // Hilfsfunktionen für deZem Harvy2
  static readUInt16LE(buffer, offset) {
    return buffer.readUInt16LE(offset);
  }

  static readUInt32LE(buffer, offset) {
    return buffer.readUInt32LE(offset);
  }

  static readInt8(buffer, offset) {
    return buffer.readInt8(offset);
  }

  static readInt16LE(buffer, offset) {
    const res = this.readUInt16LE(buffer, offset);
    return res > 0x7FFF ? res - 0x10000 : res;
  }

  static readInt32LE(buffer, offset) {
    const res = this.readUInt32LE(buffer, offset);
    return res > 0x7FFFFFFF ? res - 0x100000000 : res;
  }

  static toFixed(value, digits) {
    return Number(value.toFixed(digits));
  }

  /**
   * Dekodiere RCM H200 Wasserzähler
   */
  static decodeH200(buffer) {
    try {
      const data = {};
      const hexString = buffer.toString('hex');
      
      // H200 Decoder Logik
      function decodeMedium(code) {
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

      function decodeUnits(code) {
        if (code < 3) return "m3";
        if (code < 5) return "galons";
        if (code < 7) return "feet3";
        return "unknown";
      }

      function decodeMultiplier(code) {
        if (code == 0) return 0.001;
        if (code == 1) return 0.01;
        if (code == 2) return 0.1;
        if (code == 3) return 1;
        if (code == 4) return 10;
        return "unknown";
      }

      function getActualityDuration(input) {
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

      if (hexString.length == 22 || hexString.length == 26) {
        const bytes = Buffer.from(hexString, 'hex');
        
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

        if (hexString.length == 26) {
          const keydate = ((bytes[12] << 8) | bytes[11]);
          const keydate_day = keydate & 0x1f;
          const keydate_month = (keydate & 0xf00) >> 8;
          const keydate_year = ((keydate & 0xe0) >> 5) + ((keydate & 0xf000) >> 9);
          data.keyDate = "" + keydate_day + "." + keydate_month + "." + keydate_year;
        }
      }
      
      logger.info('H200 Wasserzähler dekodiert:', data);
      return data;
    } catch (error) {
      logger.error('Fehler beim Dekodieren H200 Wasserzähler:', error);
      return { error: error.message };
    }
  }

  /**
   * Dekodiere INTEGRA Topas Sonic DN25 L175
   */
  static decodeIntegraTopasSonic(buffer) {
    try {
      const data = {};
      
      // INTEGRA Topas Sonic Decoder Logik
      function decodeBCD(digits, bcd) {
        let sign = 1;
        if (bcd[digits / 2 - 1] >> 4 > 9) {
          bcd[digits / 2 - 1] &= 0b00001111;
          sign = -1;
        }
        let val = 0;
        for (let i = 0; i < digits / 2; i++) {
          val += ((bcd[i] & 0x0f) + (((bcd[i] & 0xf0) >> 4) * 10)) * Math.pow(100, i);
        }
        return parseInt(sign * val);
      }

      function manId2ascii(idhex) {
        return (String.fromCharCode((idhex >> 10) + 64) + 
                String.fromCharCode(((idhex >> 5) & 0x1f) + 64) + 
                String.fromCharCode((idhex & 0x1f) + 64)).toUpperCase();
      }

      function decodeTopasErrors(bytes) {
        const errors = [];
        if (bytes & 0x0002) errors.push("E2 Luft in Leitung");
        if (bytes & 0x0004) errors.push("E3 Burst");
        if (bytes & 0x0008) errors.push("E4 Leckage");
        if (bytes & 0x0010) errors.push("E5 Frost");
        if (bytes & 0x0020) errors.push("E6 Hitze");
        if (bytes & 0x0040) errors.push("E7 Over temperature");
        if (bytes & 0x0080) errors.push("E8 Kein Durchfluss");
        if (bytes & 0x0100) errors.push("Battery Low");
        if (bytes & 0x0200) errors.push("Reverse Flow");
        if (bytes & 0x0400) errors.push("Overload");
        if (bytes & 0x0800) errors.push("Leer");
        if (bytes & 0x1000) errors.push("Limit Min Wat. Temp (current)");
        if (bytes & 0x2000) errors.push("Limit Max Wat Temp (current)");
        if (bytes & 0x4000) errors.push("Limit Min Amb. Temp (current)");
        if (bytes & 0x8000) errors.push("Limit Max Amb Temp (current)");
        return errors;
      }

      function decodeTopasHeader(bytes) {
        return {
          id: decodeBCD(8, bytes.slice(4)),
          man: manId2ascii(LoRaWANDecoder.readUInt16LE(bytes.slice(2), 0)),
          gen: bytes[8],
          med: bytes[9],
          ci: bytes[10],
          acc: bytes[11],
          sts: bytes[12],
          conf: LoRaWANDecoder.readUInt16LE(bytes.slice(13), 0)
        };
      }

      function decodeTopasValues(bytes) {
        const values = {};
        if (bytes[0] === 0x04 && bytes[1] === 0x13) {
          values.volume = LoRaWANDecoder.readInt32LE(bytes.slice(2), 0) / 1e3;
        }
        if (bytes[6] === 0x84 && bytes[8] === 0x13) {
          values.reverseVolume = LoRaWANDecoder.readInt32LE(bytes.slice(9), 0) / 1e3;
        }
        if (bytes[13] === 0x02 && bytes[14] === 0x5A) {
          values.waterTemperature = LoRaWANDecoder.readInt16LE(bytes.slice(15), 0) / 10;
        }
        if (bytes[17] === 0x02 && bytes[19] === 0x17) {
          values.errorCode = LoRaWANDecoder.readUInt16LE(bytes.slice(20), 0);
          values.errors = decodeTopasErrors(values.errorCode);
        }
        if (bytes[22] === 0x02 && bytes[24] === 0x74) {
          values.battery = LoRaWANDecoder.readUInt16LE(bytes.slice(25), 0);
        }
        return values;
      }

      function getMeterID(header) {
        let sparte = "X";
        if (header.med === 7) {
          sparte = "8";
        } else if (header.med === 6) {
          sparte = "9";
        }
        return sparte + header.man + header.gen.toString(10).padStart(2, '0') + 
               header.id.toString(10).padStart(8, '0');
      }

      if (buffer[0] === buffer.length - 1 && buffer[1] === 0x44) {
        const header = decodeTopasHeader.call(this, buffer);
        if (header.ci === 0x7A && header.conf === 0x2000) {
          Object.assign(data, decodeTopasValues.call(this, buffer.slice(15)));
          data.header = header;
          data.meter_id = getMeterID(header);
        } else {
          data.error = "Application Payload Error";
        }
      } else {
        data.error = "payload length failure or unknown CI Field";
      }
      
      logger.info('INTEGRA Topas Sonic dekodiert:', data);
      return data;
    } catch (error) {
      logger.error('Fehler beim Dekodieren INTEGRA Topas Sonic:', error);
      return { error: error.message };
    }
  }

  /**
   * Benutzerdefinierte Dekodierung
   */
  static decodeCustom(buffer, deviceType) {
    // Hier können spezielle Dekodierungsregeln für bestimmte Gerätetypen hinzugefügt werden
    logger.info(`Custom Dekodierung für Gerätetyp: ${deviceType}`);
    
    // Beispiel: Wenn bekannt ist, dass ein bestimmtes Gerät ein spezifisches Format verwendet
    switch (deviceType) {
      case 'wien_energie_wasserzaehler':
        return this.decodeWienEnergieWasserzaehler(buffer);
      case 'my_special_device':
        return this.decodeMySpecialDevice(buffer);
      default:
        return this.decodeRaw(buffer);
    }
  }

  /**
   * Wien Energie Wasserzähler Dekodierung (Beispiel)
   */
  static decodeWienEnergieWasserzaehler(buffer) {
    const data = {};
    
    if (buffer.length >= 72) {
      // Vereinfachte Dekodierung - echte Implementierung benötigt Spezifikation
      data.raw_hex = buffer.toString('hex');
      data.length = buffer.length;
      data.device_type = 'wasserzaehler';
      
      // Beispiel: Erste 4 Bytes als Zählerstand interpretieren
      data.water_reading = buffer.readUInt32BE(0);
      
      // Beispiel: Bytes 4-8 als Zeitstempel
      data.timestamp_raw = buffer.readUInt32BE(4);
      
      // Weitere Dekodierung würde die genaue Wasserzähler-Spezifikation benötigen
      data.note = 'Vollständige Dekodierung benötigt Wasserzähler-Spezifikation';
    }

    return data;
  }

  /**
   * Beispiel für spezielle Gerätedekodierung
   */
  static decodeMySpecialDevice(buffer) {
    // Implementierung für spezifisches Gerät
    return {
      value1: buffer.readUInt16BE(0),
      value2: buffer.readUInt16BE(2)
    };
  }

  /**
   * Raw Dekodierung - gibt Hex-String und einzelne Bytes zurück
   */
  static decodeRaw(buffer) {
    return {
      raw_hex: buffer.toString('hex'),
      raw_bytes: Array.from(buffer),
      length: buffer.length
    };
  }

  /**
   * Hilfsfunktion zum Konvertieren von Werten zu LineMetrics-kompatiblen Formaten
   */
  static formatForLineMetrics(decodedData, mappingConfig = null) {
    const formatted = [];

    for (const [key, value] of Object.entries(decodedData)) {
      if (typeof value === 'object' && value !== null) {
        // Komplexe Objekte (z.B. GPS) als Tabelle formatieren
        formatted.push({
          alias: key,
          value: { val: value },
          dataType: 'Tabelle'
        });
      } else {
        // Einfache Werte
        formatted.push({
          alias: mappingConfig?.[key]?.alias || key,
          value: value,
          dataType: this.detectDataType(value)
        });
      }
    }

    return formatted;
  }

  /**
   * Datentyp-Erkennung für LineMetrics
   */
  static detectDataType(value) {
    if (typeof value === 'boolean') {
      return 'Bool';
    } else if (typeof value === 'number') {
      return 'Double';
    } else if (typeof value === 'string') {
      return 'String';
    }
    return 'String';
  }
}

module.exports = LoRaWANDecoder; 