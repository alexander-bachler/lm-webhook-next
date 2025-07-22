const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const axios = require('axios');

/**
 * Device Manager für LoRaWAN Geräte und Payload Decoder
 * Verwaltet Device-zu-Decoder-Zuordnungen und Repository-Integration
 */

class DeviceManager {
  constructor() {
    this.devicesFile = path.join(process.cwd(), 'devices.json');
    this.decodersDir = path.join(process.cwd(), 'decoders');
    this.devices = this.loadDevices();
    this.decoderRepositories = {
      'os2iot': 'https://api.github.com/repos/OS2iot/OS2iot-payloaddecoders',
      'ttn-official': 'https://api.github.com/repos/TheThingsNetwork/lorawan-devices',
      'rakwireless': 'https://api.github.com/repos/RAKWireless/RAKwireless_Standardized_Payload',
      'ttn-community': 'https://api.github.com/repos/emanueleg/ttn-decoders'
    };
    
    // Sicherstellen dass Decoder-Verzeichnis existiert
    if (!fs.existsSync(this.decodersDir)) {
      fs.mkdirSync(this.decodersDir, { recursive: true });
    }
  }

  /**
   * Lade gespeicherte Devices
   */
  loadDevices() {
    try {
      if (fs.existsSync(this.devicesFile)) {
        const data = fs.readFileSync(this.devicesFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      logger.error('Fehler beim Laden der Devices:', error.message);
    }
    
    return {
      devices: {},
      decoders: {},
      lastUpdate: null
    };
  }

  /**
   * Speichere Devices
   */
  saveDevices() {
    try {
      fs.writeFileSync(this.devicesFile, JSON.stringify(this.devices, null, 2));
      logger.info('Devices erfolgreich gespeichert');
    } catch (error) {
      logger.error('Fehler beim Speichern der Devices:', error.message);
      throw error;
    }
  }

  /**
   * Registriere neues Device
   */
  registerDevice(deviceData) {
    const { deviceId, deviceEUI, name, description, decoder, manufacturer, model, image } = deviceData;
    
    if (!deviceId) {
      throw new Error('Device ID ist erforderlich');
    }

    const device = {
      deviceId: deviceId,
      deviceEUI: deviceEUI || null,
      name: name || `Device ${deviceId}`,
      description: description || '',
      decoder: decoder || 'auto',
      manufacturer: manufacturer || 'Unknown',
      model: model || 'Unknown',
              image: image || '/images/devices/default.svg',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSeen: null,
      dataCount: 0,
      metadata: {}
    };

    this.devices.devices[deviceId] = device;
    this.saveDevices();
    
    logger.info('Neues Device registriert:', { deviceId, name, decoder });
    return device;
  }

  /**
   * Aktualisiere Device
   */
  updateDevice(deviceId, updates) {
    if (!this.devices.devices[deviceId]) {
      throw new Error(`Device ${deviceId} nicht gefunden`);
    }

    const device = this.devices.devices[deviceId];
    Object.assign(device, updates, {
      updatedAt: new Date().toISOString()
    });

    this.saveDevices();
    logger.info('Device aktualisiert:', { deviceId, updates });
    return device;
  }

  /**
   * Lösche Device
   */
  deleteDevice(deviceId) {
    if (!this.devices.devices[deviceId]) {
      throw new Error(`Device ${deviceId} nicht gefunden`);
    }

    delete this.devices.devices[deviceId];
    this.saveDevices();
    logger.info('Device gelöscht:', { deviceId });
  }

  /**
   * Hole alle Devices
   */
  getAllDevices() {
    return Object.values(this.devices.devices);
  }

  /**
   * Lade Devices neu aus der Datei
   */
  reloadDevices() {
    this.devices = this.loadDevices();
    logger.info('Devices neu geladen aus Datei');
    return Object.values(this.devices.devices);
  }

  /**
   * Hole Device by ID
   */
  getDevice(deviceId) {
    return this.devices.devices[deviceId] || null;
  }

  /**
   * Finde Device by EUI
   */
  getDeviceByEUI(deviceEUI) {
    return Object.values(this.devices.devices).find(device => 
      device.deviceEUI === deviceEUI
    ) || null;
  }

  /**
   * Aktualisiere Device Last Seen
   */
  updateDeviceActivity(deviceId, payload = null) {
    const device = this.devices.devices[deviceId];
    if (device) {
      device.lastSeen = new Date().toISOString();
      device.dataCount = (device.dataCount || 0) + 1;
      
      // Versuche automatische Device-Erkennung basierend auf Payload
      if (payload && device.decoder === 'auto') {
        const detectedDecoder = this.detectDecoderFromPayload(payload);
        if (detectedDecoder) {
          device.decoder = detectedDecoder;
          logger.info('Automatischer Decoder erkannt:', { deviceId, decoder: detectedDecoder });
        }
      }
      
      this.saveDevices();
    }
  }

  /**
   * Versuche Decoder anhand Payload zu erkennen
   */
  detectDecoderFromPayload(payload) {
    try {
      // Cayenne LPP Detection
      if (typeof payload === 'string' && payload.match(/^([0-9a-fA-F]{2})+$/)) {
        const buffer = Buffer.from(payload, 'hex');
        if (this.isCayenneLPP(buffer)) {
          return 'cayenne_lpp';
        }
      }

      // TTN Standard Detection
      if (payload.decoded_payload || payload.uplink_message) {
        return 'ttn_standard';
      }

      // JSON Payload Detection
      if (typeof payload === 'object' && payload.data) {
        return 'json_generic';
      }

      return null;
    } catch (error) {
      logger.debug('Decoder-Erkennung fehlgeschlagen:', error.message);
      return null;
    }
  }

  /**
   * Prüfe ob Payload Cayenne LPP ist
   */
  isCayenneLPP(buffer) {
    if (buffer.length < 3) return false;
    
    // Cayenne LPP hat Channel/Type/Data Structure
    // Typische LPP Type IDs: 0, 1, 2, 101, 102, 103, 104, 115, 136, etc.
    const knownTypes = [0, 1, 2, 101, 102, 103, 104, 115, 116, 125, 134, 136, 138];
    
    try {
      let pos = 0;
      while (pos < buffer.length - 2) {
        const channel = buffer[pos];
        const type = buffer[pos + 1];
        
        if (!knownTypes.includes(type)) {
          return false;
        }
        
        // Springe zur nächsten Channel/Type basierend auf Type
        const dataLength = this.getCayenneDataLength(type);
        if (dataLength === -1) return false;
        
        pos += 2 + dataLength;
      }
      
      return pos === buffer.length;
    } catch (error) {
      return false;
    }
  }

  /**
   * Hole Cayenne LPP Data Length für Type
   */
  getCayenneDataLength(type) {
    const lengths = {
      0: 1,   // Digital Input
      1: 1,   // Digital Output
      2: 2,   // Analog Input
      101: 2, // Illuminance
      102: 1, // Presence
      103: 2, // Temperature
      104: 1, // Humidity
      115: 2, // Barometric Pressure
      116: 2, // Voltage
      125: 2, // Concentration
      134: 6, // Accelerometer
      136: 9, // GPS
      138: 2  // VOC
    };
    
    return lengths[type] || -1;
  }

  /**
   * Statische Liste wichtiger TTN Decoder (umgeht API Rate-Limiting)
   */
  getStaticTTNDecoders() {
    return [
      // Milesight Devices
      {
        id: 'ttn-milesight-uc11-t1',
        name: 'UC11-T1 - Temperature Sensor',
        description: 'Wireless Temperature Sensor with NTC thermistor probe',
        manufacturer: 'milesight',
        model: 'uc11-t1',
        repository: 'ttn-official',
        type: 'device',
        version: '1.0',
        code: `function decodeUplink(input) {
  const bytes = input.bytes;
  const decoded = {};
  
  if (bytes.length >= 6) {
    // Milesight UC11-T1 Temperature Sensor
    decoded.temperature = ((bytes[3] << 8) | bytes[2]) / 10;
    decoded.battery = bytes[4];
  }
  
  return {
    data: decoded,
    warnings: [],
    errors: []
  };
}`,
        image: 'https://www.milesight-iot.com/wp-content/uploads/2021/07/UC11-T1.png',
        lastUpdate: new Date().toISOString(),
        metadata: {
          regions: ['EU863-870', 'US902-928'],
          codecId: 'uc11-codec'
        }
      },
      
      // Elsys Devices
      {
        id: 'ttn-elsys-ers',
        name: 'ERS - Environmental Sensor',
        description: 'Temperature, Humidity, Light sensor',
        manufacturer: 'elsys',
        model: 'ers',
        repository: 'ttn-official',
        type: 'device',
        version: '1.0',
        code: `function decodeUplink(input) {
  const bytes = input.bytes;
  const decoded = {};
  let i = 0;
  
  while (i < bytes.length) {
    const type = bytes[i++];
    switch (type) {
      case 0x01: // Temperature
        decoded.temperature = ((bytes[i] << 8) | bytes[i+1]) / 10;
        i += 2;
        break;
      case 0x02: // Humidity
        decoded.humidity = bytes[i++];
        break;
      case 0x04: // Light
        decoded.light = (bytes[i] << 8) | bytes[i+1];
        i += 2;
        break;
      case 0x07: // Battery
        decoded.battery = bytes[i++];
        break;
      default:
        i = bytes.length; // Stop parsing
    }
  }
  
  return {
    data: decoded,
    warnings: [],
    errors: []
  };
}`,
        image: 'https://www.elsys.se/wp-content/uploads/2018/10/ERS.png',
        lastUpdate: new Date().toISOString(),
        metadata: {
          regions: ['EU863-870'],
          codecId: 'ers-codec'
        }
      },
      
      // Dragino Devices
      {
        id: 'ttn-dragino-lht65',
        name: 'LHT65 - Temperature & Humidity Sensor',
        description: 'Built-in Temperature and Humidity sensor',
        manufacturer: 'dragino',
        model: 'lht65',
        repository: 'ttn-official',
        type: 'device',
        version: '1.0',
        code: `function decodeUplink(input) {
  const bytes = input.bytes;
  const decoded = {};
  
  if (bytes.length >= 11) {
    // Dragino LHT65
    decoded.temperature_internal = ((bytes[0] << 8) | bytes[1]) / 100;
    decoded.humidity_internal = ((bytes[2] << 8) | bytes[3]) / 10;
    decoded.temperature_external = ((bytes[4] << 8) | bytes[5]) / 100;
    decoded.battery = ((bytes[9] << 8) | bytes[10]) / 1000;
  }
  
  return {
    data: decoded,
    warnings: [],
    errors: []
  };
}`,
        image: 'https://www.dragino.com/media/k2/items/cache/b1e0b6ac85e4176f7b5b9b9e7ca1b0cd_L.jpg',
        lastUpdate: new Date().toISOString(),
        metadata: {
          regions: ['EU863-870', 'US902-928'],
          codecId: 'lht65-codec'
        }
      },
      
      // Decentlab Devices
      {
        id: 'ttn-decentlab-dl-sht35',
        name: 'DL-SHT35 - Temperature and Humidity Sensor',
        description: 'High-accuracy temperature and humidity sensor',
        manufacturer: 'decentlab',
        model: 'dl-sht35',
        repository: 'ttn-official',
        type: 'device',
        version: '1.0',
        code: `function decodeUplink(input) {
  const bytes = input.bytes;
  const decoded = {};
  
  if (bytes.length >= 6) {
    // Decentlab DL-SHT35
    const deviceId = (bytes[0] << 8) | bytes[1];
    const flags = (bytes[2] << 8) | bytes[3];
    
    if (flags & 0x0001) {
      decoded.temperature = -45 + 175 * ((bytes[4] << 8) | bytes[5]) / 65535;
      decoded.humidity = 100 * ((bytes[6] << 8) | bytes[7]) / 65535;
    }
  }
  
  return {
    data: decoded,
    warnings: [],
    errors: []
  };
}`,
        image: 'https://www.decentlab.com/images/products/dl-sht35.jpg',
        lastUpdate: new Date().toISOString(),
        metadata: {
          regions: ['EU863-870'],
          codecId: 'dl-sht35-codec'
        }
      },
      
      // The Things Industries/Arduino Devices
      {
        id: 'ttn-tektelic-kona-micro',
        name: 'KONA Micro IoT Gateway',
        description: 'Compact LoRaWAN IoT Gateway',
        manufacturer: 'tektelic',
        model: 'kona-micro',
        repository: 'ttn-official',
        type: 'device',
        version: '1.0',
        code: `function decodeUplink(input) {
  return {
    data: {
      raw: input.bytes,
      fPort: input.fPort,
      deviceModel: 'kona-micro',
      manufacturer: 'tektelic'
    },
    warnings: [],
    errors: []
  };
}`,
        image: 'https://tektelic.com/wp-content/uploads/KONA-Micro-IoT-Gateway.png',
        lastUpdate: new Date().toISOString(),
        metadata: {
          regions: ['EU863-870', 'US902-928'],
          codecId: 'tektelic-codec'
        }
      },

      // RAK Wireless Devices  
      {
        id: 'ttn-rak-rak7204',
        name: 'RAK7204 - Environmental Sensor',
        description: 'LPWAN Environmental Sensor with Temperature, Humidity, Gas Pressure and IAQ',
        manufacturer: 'rak',
        model: 'rak7204',
        repository: 'ttn-official',
        type: 'device',
        version: '1.0',
        code: `function decodeUplink(input) {
  const bytes = input.bytes;
  const decoded = {};
  
  if (bytes.length >= 11) {
    // RAK7204 Environmental Sensor
    decoded.humidity = bytes[0] / 2;
    decoded.temperature = ((bytes[1] << 8) | bytes[2]) / 100;
    decoded.pressure = ((bytes[3] << 8) | bytes[4]) / 10;
    decoded.gas = ((bytes[5] << 8) | bytes[6]);
    decoded.battery = ((bytes[9] << 8) | bytes[10]) / 1000;
  }
  
  return {
    data: decoded,
    warnings: [],
    errors: []
  };
}`,
        image: 'https://docs.rakwireless.com/assets/images/wisnode/rak7204/datasheet/rak7204.png',
        lastUpdate: new Date().toISOString(),
        metadata: {
          regions: ['EU863-870', 'US902-928', 'AS923'],
          codecId: 'rak7204-codec'
        }
      }
    ];
  }

  /**
   * Parse TTN Official Repository (YAML-basiert) - Fallback zu statischen Decodern
   */
  async parseTTNOfficialRepository(repoUrl) {
    try {
      // Versuche zuerst, einige Geräte aus der API zu laden
      const vendorsResponse = await axios.get(`${repoUrl}/contents/vendor`, {
        headers: { 'User-Agent': 'LineMetrics-Webhook-Server/1.0' },
        timeout: 10000
      });
      
      let allDecoders = [];
      
      // Lade statische Decoder als Hauptquelle
      const staticDecoders = this.getStaticTTNDecoders();
      allDecoders.push(...staticDecoders);
      logger.info(`${staticDecoders.length} statische TTN Decoder geladen`);
      
      // Versuche zusätzlich einige Decoder aus der API zu laden (falls verfügbar)
      const limitedVendors = vendorsResponse.data
        .filter(vendor => vendor.type === 'dir')
        .slice(0, 5); // Nur 5 Hersteller wegen Rate-Limiting
      
      for (const vendor of limitedVendors) {
        try {
          const vendorDevicesResponse = await axios.get(`${vendor.url}`, {
            headers: { 'User-Agent': 'LineMetrics-Webhook-Server/1.0' },
            timeout: 8000
          });
          
          const deviceFiles = vendorDevicesResponse.data
            .filter(file => file.name.endsWith('.yaml') && file.name !== 'index.yaml')
            .slice(0, 3); // Nur 3 Geräte pro Hersteller
            
          for (const file of deviceFiles) {
            try {
              const deviceFileResponse = await axios.get(file.download_url, {
                timeout: 6000
              });
              const yamlContent = deviceFileResponse.data;
              
              const deviceDef = this.parseTTNDeviceYAML(yamlContent, vendor.name, file.name);
              if (deviceDef) {
                // Prüfe, ob bereits statischer Decoder existiert
                const existingDecoder = allDecoders.find(d => 
                  d.manufacturer === deviceDef.manufacturer && d.model === deviceDef.model
                );
                if (!existingDecoder) {
                  allDecoders.push(deviceDef);
                }
              }
            } catch (error) {
              logger.debug(`Fehler beim Parsen ${vendor.name}/${file.name}:`, error.message);
              if (error.response?.status === 403) {
                logger.warn('GitHub API Rate-Limit erreicht, verwende nur statische Decoder');
                break;
              }
            }
          }
          
          // Kleine Pause zwischen Vendor-Requests
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (error) {
          logger.debug(`Fehler beim Laden von Vendor ${vendor.name}:`, error.message);
          if (error.response?.status === 403) {
            logger.warn('GitHub API Rate-Limit erreicht, verwende nur statische Decoder');
            break;
          }
        }
      }
      
      logger.info(`Insgesamt ${allDecoders.length} TTN Devices geladen (${staticDecoders.length} statisch, ${allDecoders.length - staticDecoders.length} aus API)`);
      return allDecoders;
      
    } catch (error) {
      logger.error('Fehler beim Laden des TTN Official Repository:', error);
      if (error.response?.status === 403) {
        logger.warn('GitHub API Rate-Limit erreicht, verwende nur statische Decoder');
        // Fallback zu statischen Decodern
        const staticDecoders = this.getStaticTTNDecoders();
        logger.info(`${staticDecoders.length} statische TTN Decoder als Fallback geladen`);
        return staticDecoders;
      }
      throw error;
    }
  }
  
  /**
   * Parse TTN Device YAML Definition
   */
  parseTTNDeviceYAML(yamlContent, vendorName, fileName) {
    try {
      // Einfacher YAML-Parser für die wichtigsten Felder
      const lines = yamlContent.split('\n');
      let device = {
        id: `ttn-${vendorName}-${fileName.replace('.yaml', '')}`,
        name: '',
        description: '',
        manufacturer: vendorName,
        model: fileName.replace('.yaml', ''),
        repository: 'ttn-official',
        type: 'device',
        version: '1.0',
        code: 'function decodeUplink(input) { return { data: input, warnings: [], errors: [] }; }',
        image: `https://raw.githubusercontent.com/TheThingsNetwork/lorawan-devices/master/vendor/${vendorName}/${fileName.replace('.yaml', '.png')}`,
        lastUpdate: new Date().toISOString(),
        metadata: {
          hardwareVersions: [],
          firmwareVersions: [],
          profiles: {},
          regions: [],
          codecId: null
        }
      };
      
      let currentSection = null;
      let indentLevel = 0;
      
      for (const line of lines) {
        const trimmed = line.trim();
        const leadingSpaces = line.length - line.trimStart().length;
        
        if (trimmed.startsWith('name:')) {
          device.name = trimmed.replace('name:', '').trim().replace(/['"]/g, '');
        } else if (trimmed.startsWith('description:')) {
          device.description = trimmed.replace('description:', '').trim().replace(/['"]/g, '');
        } else if (trimmed.startsWith('hardwareVersions:')) {
          currentSection = 'hardware';
          indentLevel = leadingSpaces;
        } else if (trimmed.startsWith('firmwareVersions:')) {
          currentSection = 'firmware';
          indentLevel = leadingSpaces;
        } else if (trimmed.startsWith('profiles:')) {
          currentSection = 'profiles';
          indentLevel = leadingSpaces;
        } else if (trimmed.startsWith('codec:') && currentSection === 'profiles') {
          const codecName = trimmed.replace('codec:', '').trim().replace(/['"]/g, '');
          if (codecName && codecName !== 'null') {
            device.metadata.codecId = codecName;
            // Erstelle einfachen Passthrough-Decoder
            device.code = `// TTN Codec: ${codecName}\nfunction decodeUplink(input) {\n  // Auto-generated from TTN Device Repository\n  return {\n    data: {\n      raw: input.bytes,\n      fPort: input.fPort,\n      deviceModel: '${device.model}',\n      manufacturer: '${device.manufacturer}'\n    },\n    warnings: [],\n    errors: []\n  };\n}`;
          }
        } else if (trimmed.match(/^[A-Z]{2}\d{3}-\d{3}:/) && currentSection === 'profiles') {
          const region = trimmed.replace(':', '').trim();
          device.metadata.regions.push(region);
        }
      }
      
      // Fallback-Namen
      if (!device.name) {
        device.name = `${vendorName} ${device.model}`;
      }
      if (!device.description) {
        device.description = `TTN Official Device: ${device.name}`;
      }
      
      return device;
      
    } catch (error) {
      logger.debug('Fehler beim Parsen der TTN YAML:', error.message);
      return null;
    }
  }

  /**
   * Lade verfügbare Decoder aus Repository
   */
  async loadDecodersFromRepository(repoName = 'os2iot') {
    try {
      const repoUrl = this.decoderRepositories[repoName];
      if (!repoUrl) {
        throw new Error(`Repository ${repoName} nicht gefunden`);
      }

      logger.info('Lade Decoder aus Repository:', repoName);
      
      let decoders = [];
      
      // Spezielle Behandlung für TTN Official Repository
      if (repoName === 'ttn-official') {
        decoders = await this.parseTTNOfficialRepository(repoUrl);
      } else {
        // Standard OS2iot Repository-Verarbeitung
        const response = await axios.get(`${repoUrl}/contents`, {
          headers: {
            'User-Agent': 'LineMetrics-Webhook-Server/1.0'
          },
          timeout: 15000
        });

        // Verarbeite Repository-Struktur
        for (const item of response.data) {
          if (item.type === 'dir' && !item.name.startsWith('.')) {
            try {
              const decoderInfo = await this.loadDecoderFromFolder(repoUrl, item.name);
              if (decoderInfo) {
                decoders.push(decoderInfo);
              }
            } catch (error) {
              logger.debug(`Fehler beim Laden von Decoder ${item.name}:`, error.message);
            }
          }
        }
      }

      // Speichere Decoder-Informationen
      this.devices.decoders[repoName] = {
        decoders: decoders,
        lastUpdate: new Date().toISOString(),
        count: decoders.length
      };
      
      this.saveDevices();
      
      logger.info(`${decoders.length} Decoder aus ${repoName} geladen`);
      return decoders;
      
    } catch (error) {
      logger.error('Fehler beim Laden der Decoder:', error.message);
      throw error;
    }
  }

  /**
   * Lade einzelnen Decoder aus Repository-Ordner
   */
  async loadDecoderFromFolder(repoUrl, folderName) {
    try {
      // Hole Ordner-Inhalt
      const response = await axios.get(`${repoUrl}/contents/${folderName}`, {
        headers: {
          'User-Agent': 'LineMetrics-Webhook-Server/1.0'
        },
        timeout: 10000
      });

      let decoderFile = null;
      let readmeFile = null;
      let imageFile = null;

      // Finde relevante Dateien
      for (const file of response.data) {
        if (file.name.endsWith('.js') && !decoderFile) {
          decoderFile = file;
        } else if (file.name.toLowerCase().includes('readme') && !readmeFile) {
          readmeFile = file;
        } else if (file.name.match(/\.(jpg|jpeg|png|gif)$/i) && !imageFile) {
          imageFile = file;
        }
      }

      if (!decoderFile) {
        return null;
      }

      // Hole Decoder-Code
      const decoderResponse = await axios.get(decoderFile.download_url, {
        timeout: 10000
      });

      const decoder = {
        id: folderName.toLowerCase().replace(/[^a-z0-9-_]/g, '_'),
        name: folderName.replace(/[_-]/g, ' '),
        description: `Payload decoder for ${folderName}`,
        manufacturer: this.extractManufacturer(folderName),
        model: this.extractModel(folderName),
        code: decoderResponse.data,
        image: imageFile ? imageFile.download_url : null,
        repository: 'os2iot',
        lastUpdate: new Date().toISOString(),
        metadata: {
          originalFolder: folderName,
          codeUrl: decoderFile.download_url,
          readmeUrl: readmeFile ? readmeFile.download_url : null
        }
      };

      // Versuche README zu laden für bessere Beschreibung
      if (readmeFile) {
        try {
          const readmeResponse = await axios.get(readmeFile.download_url, {
            timeout: 5000
          });
          decoder.readme = readmeResponse.data;
          
          // Extrahiere Informationen aus README
          const readmeInfo = this.parseReadme(readmeResponse.data);
          Object.assign(decoder, readmeInfo);
        } catch (error) {
          logger.debug(`README für ${folderName} konnte nicht geladen werden:`, error.message);
        }
      }

      return decoder;
      
    } catch (error) {
      logger.debug(`Fehler beim Laden von Decoder-Ordner ${folderName}:`, error.message);
      return null;
    }
  }

  /**
   * Extrahiere Hersteller aus Ordnername
   */
  extractManufacturer(folderName) {
    const manufacturers = {
      'elsys': 'Elsys',
      'milesight': 'Milesight',
      'adeunis': 'Adeunis',
      'decentlab': 'Decentlab',
      'axioma': 'Axioma',
      'talkpool': 'Talkpool',
      'imbuildings': 'IMBUILDINGS',
      'rakwireless': 'RAKwireless',
      'sensit': 'Sensit',
      'mcf88': 'MCF88'
    };

    const lowerName = folderName.toLowerCase();
    for (const [key, value] of Object.entries(manufacturers)) {
      if (lowerName.includes(key)) {
        return value;
      }
    }

    // Versuche ersten Teil vor Unterstrich/Bindestrich
    const parts = folderName.split(/[_-]/);
    return parts[0] || 'Unknown';
  }

  /**
   * Extrahiere Model aus Ordnername
   */
  extractModel(folderName) {
    // Entferne Hersteller und extrahiere Model
    const parts = folderName.split(/[_-]/);
    if (parts.length > 1) {
      return parts.slice(1).join(' ');
    }
    return folderName;
  }

  /**
   * Parse README für zusätzliche Informationen
   */
  parseReadme(readmeContent) {
    const info = {};
    
    try {
      const lines = readmeContent.split('\n');
      
      for (const line of lines) {
        // Suche nach strukturierten Informationen
        if (line.includes('IoT-device model:')) {
          info.model = line.split(':')[1]?.trim();
        } else if (line.includes('Description:')) {
          info.description = line.split(':')[1]?.trim();
        } else if (line.includes('Author:')) {
          info.author = line.split(':')[1]?.trim();
        } else if (line.includes('Source:')) {
          info.source = line.split(':')[1]?.trim();
        }
      }
    } catch (error) {
      logger.debug('Fehler beim Parsen der README:', error.message);
    }
    
    return info;
  }

  /**
   * Hole alle verfügbaren Decoder
   */
  getAvailableDecoders() {
    const allDecoders = [];
    
    // Sammle Decoder aus allen Repositories
    for (const [repoName, repoData] of Object.entries(this.devices.decoders || {})) {
      if (repoData.decoders) {
        allDecoders.push(...repoData.decoders.map(decoder => ({
          ...decoder,
          repository: repoName
        })));
      }
    }
    
    // Füge eingebaute Decoder hinzu
    allDecoders.push(
      {
        id: 'auto',
        name: 'Automatische Erkennung',
        description: 'Versucht automatisch den passenden Decoder zu erkennen',
        manufacturer: 'LineMetrics',
        model: 'Auto-Detection',
        image: '/images/decoders/auto.png',
        repository: 'builtin'
      },
      {
        id: 'cayenne_lpp',
        name: 'Cayenne LPP',
        description: 'Standard Cayenne Low Power Payload Format',
        manufacturer: 'Cayenne',
        model: 'LPP',
        image: '/images/decoders/cayenne.png',
        repository: 'builtin'
      },
      {
        id: 'ttn_standard',
        name: 'TTN Standard',
        description: 'The Things Network Standard Payload Format',
        manufacturer: 'TTN',
        model: 'Standard',
        image: '/images/decoders/ttn.png',
        repository: 'builtin'
      },
      {
        id: 'json_generic',
        name: 'Generic JSON',
        description: 'Generischer JSON Payload Decoder',
        manufacturer: 'Generic',
        model: 'JSON',
        image: '/images/decoders/json.png',
        repository: 'builtin'
      },
      {
        id: 'h200',
        name: 'H200 Wasserzähler',
        description: 'RCM H200 Wasserzähler-Decoder für Wasser, Warmwasser und Gas',
        manufacturer: 'RCM',
        model: 'H200',
        image: '/images/decoders/h200.png',
        repository: 'builtin'
      },
      {
        id: 'integra-topas-sonic',
        name: 'Topas Sonic DN25',
        description: 'INTEGRA Topas Sonic DN25 L175 Wasserzähler-Decoder',
        manufacturer: 'INTEGRA',
        model: 'Topas Sonic DN25 L175',
        image: '/images/decoders/integra-topas-sonic.png',
        repository: 'builtin'
      },
      {
        id: 'harvy2',
        name: 'Harvy2 (deZem)',
        description: 'deZem Harvy2 Strom- und Spannungsmessgerät für Port 6, 10 und 99',
        manufacturer: 'deZem',
        model: 'Harvy2',
        image: '/images/decoders/harvy2.png',
        repository: 'builtin'
      }
    );
    
    return allDecoders;
  }

  /**
   * Decoder-Statistiken
   */
  getDecoderStats() {
    const stats = {
      totalDevices: Object.keys(this.devices.devices).length,
      activeDevices: 0,
      decoderRepositories: Object.keys(this.devices.decoders || {}).length,
      totalDecoders: 0,
      decoderUsage: {}
    };

    // Zähle aktive Devices (letzte 7 Tage)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    for (const device of Object.values(this.devices.devices)) {
      if (device.lastSeen && new Date(device.lastSeen) > weekAgo) {
        stats.activeDevices++;
      }
      
      // Zähle Decoder-Nutzung
      const decoder = device.decoder || 'none';
      stats.decoderUsage[decoder] = (stats.decoderUsage[decoder] || 0) + 1;
    }

    // Zähle verfügbare Decoder
    for (const repoData of Object.values(this.devices.decoders || {})) {
      if (repoData.decoders) {
        stats.totalDecoders += repoData.decoders.length;
      }
    }

    return stats;
  }
}

module.exports = new DeviceManager(); 