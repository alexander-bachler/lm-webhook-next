const axios = require('axios');
const logger = require('../logger');
const LoRaWANDecoder = require('../lorawan-decoder');
const { detectWebhookEndpoint, extractPayload, extractDeviceInfo } = require('./webhook-handlers');

// In-memory storage
let webhookHistory = [];
let webhookStats = {
  total: 0,
  successful: 0,
  failed: 0,
  avgTime: 0,
  totalTime: 0
};

const MAX_WEBHOOK_HISTORY = 1000;

/**
 * Speichere Webhook-Daten für Dashboard
 */
function saveWebhookData(endpoint, payload, decodedData, deviceInfo, success, processingTime, error = null) {
  const webhookEntry = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    endpoint: endpoint,
    deviceId: deviceInfo.id,
    success: success,
    processingTime: processingTime,
    rawPayload: typeof payload === 'string' ? payload : JSON.stringify(payload),
    decodedData: decodedData,
    originalPayload: payload,
    metadata: {
      rssi: deviceInfo.rssi,
      snr: deviceInfo.snr,
      gateway: deviceInfo.gateway,
      fPort: deviceInfo.fPort,
      location: deviceInfo.location,
      customerName: deviceInfo.customerName
    },
    error: error
  };

  // Hinzufügen zum Verlauf
  webhookHistory.push(webhookEntry);
  
  // Alte Einträge entfernen wenn Limit erreicht
  if (webhookHistory.length > MAX_WEBHOOK_HISTORY) {
    webhookHistory = webhookHistory.slice(-MAX_WEBHOOK_HISTORY);
  }

  // Statistiken aktualisieren
  webhookStats.total++;
  if (success) {
    webhookStats.successful++;
  } else {
    webhookStats.failed++;
  }
  webhookStats.totalTime += processingTime;
  webhookStats.avgTime = webhookStats.totalTime / webhookStats.total;
}

/**
 * Hole lokale Webhook-Historie
 */
function getLocalHistory(limit = 100, startDate = null, endDate = null, deviceId = null, endpoint = null) {
  let filteredHistory = [...webhookHistory];

  // Filtern nach Parametern
  if (startDate) {
    filteredHistory = filteredHistory.filter(w => new Date(w.timestamp) >= new Date(startDate));
  }
  if (endDate) {
    filteredHistory = filteredHistory.filter(w => new Date(w.timestamp) <= new Date(endDate));
  }
  if (deviceId) {
    filteredHistory = filteredHistory.filter(w => w.deviceId.includes(deviceId));
  }
  if (endpoint) {
    filteredHistory = filteredHistory.filter(w => w.endpoint === endpoint);
  }

  // Sortieren (neueste zuerst) und limitieren
  return filteredHistory
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
}

/**
 * Hole und dekodiere historische Daten von webhook.site
 */
async function getWebhookSiteHistory(limit = 100, startDate = null, endDate = null) {
  try {
    const config = require('../config');
    
    // Prüfe ob webhook.site Token konfiguriert ist
    if (!config.webhook?.webhookSiteToken) {
      logger.warn('Webhook.site Token nicht konfiguriert - Historie nicht verfügbar');
      return [];
    }
    
    const token = config.webhook.webhookSiteToken;
    const apiKey = config.webhook?.webhookSiteApiKey;
    
    // Validiere Token-Format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isValidUuid = uuidRegex.test(token);
    
    // Bestimme Authentifizierungsmodus
    const hasApiKey = apiKey && apiKey.length > 0;
    const useApiKeyAuth = hasApiKey; // Verwende API Key wenn verfügbar
    
    if (!isValidUuid) {
      logger.warn('Webhook.site Token scheint ungültiges UUID-Format zu haben:', {
        tokenLength: token.length,
        tokenPreview: token.substring(0, 8) + '...',
        expectedFormat: '12345678-1234-1234-1234-123456789012'
      });
    }
    
    logger.debug('Webhook.site Authentifizierung:', {
      hasValidUuid: isValidUuid,
      hasApiKey: hasApiKey,
      useApiKeyAuth: useApiKeyAuth,
      tokenPreview: token.substring(0, 8) + '...',
      apiKeyPreview: apiKey ? apiKey.substring(0, 8) + '...' : 'nicht verfügbar'
    });
    
    let url, headers, params;
    
    if (useApiKeyAuth) {
      // API Key Authentifizierung - verwende UUID Token für Endpunkt, API Key für Auth
      url = `https://webhook.site/token/${token}/requests`;
      headers = {
        'Api-Key': apiKey,
        'User-Agent': 'LineMetrics-Webhook-Server/1.0',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      };
      params = {
        sorting: 'newest',
        per_page: Math.min(limit, 100)
      };
    } else {
      // Standard UUID Token Modus ohne API Key
      url = `https://webhook.site/token/${token}/requests`;
      headers = {
        'User-Agent': 'LineMetrics-Webhook-Server/1.0',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      };
      params = {
        sorting: 'newest',
        per_page: Math.min(limit, 100)
      };
    }
    
    // Füge Datums-Parameter hinzu falls vorhanden
    if (startDate) {
      const dateParam = useApiKeyAuth ? 'created_after' : 'from';
      params[dateParam] = new Date(startDate).toISOString();
    }
    if (endDate) {
      const dateParam = useApiKeyAuth ? 'created_before' : 'to';
      params[dateParam] = new Date(endDate).toISOString();
    }
    
    logger.debug('Webhook.site API Aufruf:', {
      mode: useApiKeyAuth ? 'UUID + API Key' : 'UUID Token only',
      tokenPreview: token.substring(0, 8) + '...',
      apiKeyPreview: apiKey ? apiKey.substring(0, 8) + '...' : 'nicht verfügbar',
      url: url,
      params: params,
      isValidUuid: isValidUuid,
      tokenLength: token.length
    });
    
    let response;
    let requestsData = [];
    
    try {
      logger.debug(`Verwende webhook.site Endpunkt: ${url}`);
      
      response = await axios.get(url, {
        params: params,
        headers: headers,
        timeout: 15000,
        baseURL: '' // Überschreibe jede axios baseURL-Konfiguration
      });
      
      // Erfolgreicher API Call - verarbeite Response
      if (response.data) {
        if (Array.isArray(response.data)) {
          requestsData = response.data;
        } else if (response.data.data && Array.isArray(response.data.data)) {
          requestsData = response.data.data;
        } else if (response.data.requests && Array.isArray(response.data.requests)) {
          requestsData = response.data.requests;
        }
        
        logger.debug(`Webhook.site Endpunkt erfolgreich: ${url}, ${requestsData.length} Requests gefunden`);
      }
      
    } catch (error) {
      logger.debug(`Webhook.site Endpunkt fehlgeschlagen: ${url} - ${error.message}`);
      throw error;
    }

    logger.info(`Webhook.site Historie abgerufen: ${requestsData.length} Einträge (${useApiKeyAuth ? 'UUID + API Key' : 'UUID Token only'})`);
    return requestsData;
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      let errorMessage = 'Webhook.site API Fehler';
      let suggestion = '';
      
      switch (status) {
        case 401:
          errorMessage = 'Webhook.site Authentication Fehler';
          suggestion = 'Token möglicherweise abgelaufen oder ungültig. Versuchen Sie ein neues Token zu erstellen.';
          break;
        case 404:
          errorMessage = 'Webhook.site Token nicht gefunden';
          suggestion = 'UUID Token existiert nicht oder ist abgelaufen. Erstellen Sie ein neues Token auf webhook.site.';
          break;
        case 403:
          errorMessage = 'Webhook.site Zugriff verweigert';
          suggestion = 'Token hat möglicherweise keine Berechtigung für API-Zugriff.';
          break;
        case 429:
          errorMessage = 'Webhook.site Rate Limit erreicht';
          suggestion = 'Zu viele Anfragen. Warten Sie kurz und versuchen Sie es erneut.';
          break;
        default:
          errorMessage = `Webhook.site API Fehler (${status})`;
          suggestion = 'Prüfen Sie die webhook.site Status-Seite oder versuchen Sie es später erneut.';
      }
      
      logger.error(errorMessage, {
        status: status,
        statusText: error.response.statusText,
        data: data,
        url: error.config?.url,
        suggestion: suggestion
      });
      
      // Werfe einen hilfreichen Fehler für die UI
      throw new Error(`${errorMessage}: ${data?.error?.message || error.response.statusText}. ${suggestion}`);
      
    } else if (error.request) {
      logger.error('Webhook.site Netzwerk Fehler:', error.message);
      throw new Error('Webhook.site nicht erreichbar: Prüfen Sie Ihre Internetverbindung.');
    } else {
      logger.error('Webhook.site unbekannter Fehler:', error.message);
      throw new Error('Unbekannter webhook.site Fehler: ' + error.message);
    }
  }
}

/**
 * Teste webhook.site Token-Verbindung  
 */
async function testWebhookSiteToken() {
  try {
    const config = require('../config');
    const token = config.webhook?.webhookSiteToken;
    const apiKey = config.webhook?.webhookSiteApiKey;
    
    if (!token) {
      return { success: false, error: 'Kein Token konfiguriert' };
    }
    
    const hasApiKey = apiKey && apiKey.length > 0;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isValidUuid = uuidRegex.test(token);
    
    if (!isValidUuid) {
      return { 
        success: false, 
        error: 'Ungültiges UUID Token Format' 
      };
    }
    
    // Teste webhook.site URL - verwende UUID Token für Endpunkt, API Key für Auth
    const testUrl = `https://webhook.site/token/${token}/requests`;
    const headers = {
      'User-Agent': 'LineMetrics-Webhook-Server/1.0',
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };
    
    // Füge API Key hinzu wenn verfügbar (korrekte webhook.site API Format)
    if (hasApiKey) {
      headers['Api-Key'] = apiKey;
    }
    
    logger.debug('Teste webhook.site Verbindung:', { 
      testUrl, 
      hasApiKey,
      tokenPreview: token.substring(0, 8) + '...',
      apiKeyPreview: apiKey ? apiKey.substring(0, 8) + '...' : 'nicht verfügbar'
    });
    
    const response = await axios.get(testUrl, {
      params: { limit: 1 },
      headers: headers,
      timeout: 10000,
      baseURL: ''
    });
    
    const count = response.data?.length || (response.data?.data?.length || 0);
    
    return {
      success: true,
      token: token.substring(0, 8) + '...',
      apiKey: apiKey ? apiKey.substring(0, 8) + '...' : 'nicht verfügbar',
      type: hasApiKey ? 'UUID Token + API Key' : 'UUID Token only',
      count: count,
      message: 'Verbindung erfolgreich'
    };
    
  } catch (error) {
    logger.error('Webhook.site Token Test Fehler:', error.message);
    
    let errorMessage = 'Verbindungstest fehlgeschlagen';
    
    if (error.response) {
      const status = error.response.status;
      
      switch (status) {
        case 401:
          errorMessage = 'Authentication error. Token möglicherweise abgelaufen oder ungültig. Versuchen Sie ein neues Token zu erstellen.';
          break;
        case 404:
          errorMessage = 'Token not found. Das UUID Token existiert nicht oder ist abgelaufen.';
          break;
        case 403:
          errorMessage = 'Access forbidden. Überprüfen Sie Ihre Berechtigung.';
          break;
        default:
          errorMessage = `HTTP ${status}: ${error.response.statusText}`;
      }
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      errorMessage = 'Netzwerkfehler. Überprüfen Sie Ihre Internetverbindung.';
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Dekodiere historische webhook.site Daten
 */
async function getDecodedWebhookSiteHistory(source = 'webhook.site', limit = 50, startDate = null, endDate = null) {
  logger.info('Dekodierung historischer Daten angefordert', { source, limit, startDate, endDate });

  try {
    // Hole rohe historische Daten
    const rawData = await getWebhookSiteHistory(limit, startDate, endDate);
    const decodedWebhooks = [];

    // Verarbeite jeden historischen Request
    for (const item of rawData) {
      let payload = null;
      try {
        if (!item.content) {
          logger.debug('Überspringe Item ohne Content:', item.id);
          continue;
        }

        try {
          payload = typeof item.content === 'string' ? JSON.parse(item.content) : item.content;
        } catch (parseError) {
          logger.warn('Konnte Payload nicht parsen:', { id: item.id, content: item.content });
          continue;
        }

        logger.debug('Verarbeite historischen Request:', { 
          id: item.id, 
          method: item.method,
          hasContent: !!item.content,
          payloadKeys: Object.keys(payload || {})
        });

        // Extrahiere und dekodiere Payload
        const extractedPayload = extractPayload(payload);
        const deviceInfo = extractDeviceInfo(payload);
        
        logger.debug('Extrahierte Daten:', {
          extracted: !!extractedPayload,
          hasData: !!extractedPayload?.data
        });

        if (extractedPayload && extractedPayload.data) {
          // Finde Device und verwende Device-spezifischen Decoder
          const deviceManager = require('./device-manager');
          let device = null;
          
          // Versuche zuerst Device-ID zu finden
          if (deviceInfo.id) {
            device = deviceManager.getDevice(deviceInfo.id);
          }
          
          // Falls nicht gefunden, versuche Device-EUI
          if (!device && deviceInfo.eui) {
            device = deviceManager.getDeviceByEUI(deviceInfo.eui);
          }
          
          // Falls immer noch nicht gefunden, versuche Device-ID als EUI
          if (!device && deviceInfo.id) {
            device = deviceManager.getDeviceByEUI(deviceInfo.id);
          }
          
          // Verwende Device-spezifischen Decoder oder Fallback auf 'auto'
          const decoderFormat = device?.decoder || 'auto';
          
          logger.info('Verwende Decoder für historische Daten:', {
            deviceId: deviceInfo.id,
            deviceEUI: deviceInfo.eui,
            deviceFound: !!device,
            decoderFormat: decoderFormat,
            deviceDecoder: device?.decoder,
            payloadLength: extractedPayload.data.length,
            rawPayload: extractedPayload.data.substring(0, 50) + '...'
          });
          
          // Dekodiere die Daten mit Device-spezifischem Decoder
          const decodedData = LoRaWANDecoder.decode(extractedPayload.data, decoderFormat);
          
          logger.debug('Dekodierung Ergebnis:', {
            success: !!decodedData,
            data: decodedData,
            rawPayload: extractedPayload.data,
            port: extractedPayload.port
          });
          
          // Erstelle Webhook-Entry im Dashboard-Format
          const webhookEntry = {
            id: item.uuid || `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date(item.created_at || item.timestamp).toISOString(),
            endpoint: detectWebhookEndpoint(payload),
            deviceId: deviceInfo.id,
            payload: payload,
            originalPayload: payload,
            decodedData: decodedData,
            success: true,
            metadata: {
              source: 'webhook.site',
              rssi: deviceInfo.rssi,
              snr: deviceInfo.snr,
              gateway: deviceInfo.gateway,
              fPort: deviceInfo.fPort,
              decoderUsed: decoderFormat,
              deviceFound: !!device
            }
          };
          
          decodedWebhooks.push(webhookEntry);
        }
      } catch (error) {
        logger.warn('Fehler beim Dekodieren historischer Daten:', {
          error: error.message,
          stack: error.stack,
          itemId: item.id,
          payloadKeys: payload ? Object.keys(payload) : 'payload not available'
        });
      }
    }

    logger.info(`${decodedWebhooks.length} historische Webhooks erfolgreich dekodiert`);
    return decodedWebhooks;
  } catch (error) {
    logger.error('Fehler bei historischer Dekodierung:', error);
    throw error;
  }
}

/**
 * Konvertiere Daten zu CSV
 */
function convertToCSV(data) {
  if (!data || data.length === 0) {
    return 'Keine Daten verfügbar\n';
  }

  const headers = ['timestamp', 'deviceId', 'endpoint', 'success', 'processingTime'];
  const csvLines = [headers.join(',')];

  data.forEach(item => {
    const values = [
      item.timestamp,
      item.deviceId,
      item.endpoint,
      item.success,
      item.processingTime || 0
    ];
    csvLines.push(values.join(','));
  });

  return csvLines.join('\n');
}

/**
 * Hole aktuelle Statistiken
 */
function getStats() {
  return { ...webhookStats };
}

/**
 * Hole aktuellen Verlauf
 */
function getCurrentHistory() {
  return [...webhookHistory];
}

/**
 * Teste webhook.site Token-Verbindung
 */
async function testWebhookSiteToken() {
  try {
    const config = require('../config');
    const token = config.webhook?.webhookSiteToken;
    const apiKey = config.webhook?.webhookSiteApiKey;
    
    if (!token) {
      return { success: false, error: 'Kein Token konfiguriert' };
    }
    
    const hasApiKey = apiKey && apiKey.length > 0;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isValidUuid = uuidRegex.test(token);
    
    if (!isValidUuid) {
      return { 
        success: false, 
        error: 'Ungültiges UUID Token Format' 
      };
    }
    
    // Teste einfachen Zugriff auf webhook.site URL
    const testUrl = `https://webhook.site/token/${token}/requests`;
    const headers = {
      'User-Agent': 'LineMetrics-Webhook-Server/1.0',
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };
    
    // Füge API Key hinzu wenn verfügbar
    if (hasApiKey) {
      headers['Api-Key'] = apiKey;
    }
    
    logger.debug('Teste webhook.site Verbindung:', { 
      testUrl, 
      hasApiKey,
      tokenPreview: token.substring(0, 8) + '...',
      apiKeyPreview: apiKey ? apiKey.substring(0, 8) + '...' : 'nicht verfügbar'
    });
    
    const response = await axios.get(testUrl, {
      params: { limit: 1 },
      headers: headers,
      timeout: 10000,
      baseURL: ''
    });
    
    const count = response.data?.length || (response.data?.data?.length || 0);
    
    return {
      success: true,
      token: token.substring(0, 8) + '...',
      apiKey: apiKey ? apiKey.substring(0, 8) + '...' : 'nicht verfügbar',
      type: hasApiKey ? 'UUID Token + API Key' : 'UUID Token only',
      count: count,
      message: 'Verbindung erfolgreich'
    };
    
  } catch (error) {
    logger.error('Webhook.site Token Test Fehler:', error.message);
    
    let errorMessage = 'Verbindungstest fehlgeschlagen';
    
    if (error.response) {
      const status = error.response.status;
      
      switch (status) {
        case 401:
          errorMessage = 'Authentication error. Token möglicherweise abgelaufen oder ungültig. Versuchen Sie ein neues Token zu erstellen.';
          break;
        case 404:
          errorMessage = 'Token not found. Das UUID Token existiert nicht oder ist abgelaufen.';
          break;
        case 403:
          errorMessage = 'Access forbidden. Überprüfen Sie Ihre Berechtigung.';
          break;
        default:
          errorMessage = `HTTP ${status}: ${error.response.statusText}`;
      }
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      errorMessage = 'Netzwerkfehler. Überprüfen Sie Ihre Internetverbindung.';
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
}

module.exports = {
  saveWebhookData,
  getLocalHistory,
  getWebhookSiteHistory,
  getDecodedWebhookSiteHistory,
  testWebhookSiteToken,
  convertToCSV,
  getStats,
  getCurrentHistory
}; 