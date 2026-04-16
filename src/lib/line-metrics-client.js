const logger = require('./logger');

// Global token cache um Token über mehrere Requests hinweg zu teilen
const tokenCache = new Map();

class LineMetricsClient {
  constructor() {
    this.baseUrl = 'https://rest-api.linemetrics.com';
    this.version = 'v1';
  }

  /**
   * Get cached access token or request a new one
   * @param {string} clientId - LineMetrics Client ID
   * @param {string} clientSecret - LineMetrics Client Secret
   * @returns {Promise<string>} Access token
   */
  async getAccessToken(clientId, clientSecret) {
    const cacheKey = `${clientId}:${clientSecret}`;
    const now = Date.now();
    
    // Check if we have a valid cached token
    const cached = tokenCache.get(cacheKey);
    if (cached && cached.expiresAt > now + 60000) { // Token muss noch mindestens 60s gültig sein
      logger.info('Verwendung von gecachtem LineMetrics OAuth Token');
      return cached.accessToken;
    }

    // Request new token
    try {
      logger.info('Anfrage eines neuen LineMetrics OAuth Tokens');
      
      const response = await fetch(`${this.baseUrl}/oauth/access_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'client_credentials'
        }).toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OAuth token request failed: ${response.status} - ${errorText}`);
      }

      const tokenData = await response.json();
      
      // Cache the token with expiry time (mit Sicherheitspuffer von 5 Minuten)
      const expiresIn = tokenData.expires_in || 3600; // Default 1 Stunde
      const expiresAt = now + (expiresIn * 1000) - (5 * 60 * 1000); // 5 Minuten Puffer
      
      tokenCache.set(cacheKey, {
        accessToken: tokenData.access_token,
        expiresAt: expiresAt
      });
      
      logger.info(`Neuer LineMetrics OAuth Token erhalten, gültig bis ${new Date(expiresAt).toISOString()}`);
      
      return tokenData.access_token;
    } catch (error) {
      logger.error(`Fehler beim Abrufen des Access Tokens: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send data to LineMetrics Cloud with retry logic
   * @param {Object} config - LineMetrics configuration
   * @param {string} config.clientId - LineMetrics Client ID
   * @param {string} config.clientSecret - LineMetrics Client Secret
   * @param {string} config.projectId - LineMetrics Project ID
   * @param {Object} config.dataPoints - Mapping of decoder fields to data point IDs
   * @param {Object} decodedData - Decoded webhook data
   * @param {string} deviceId - Device identifier
   * @param {string} timestamp - ISO timestamp
   * @param {number} retryCount - Current retry count (internal)
   * @returns {Promise<Object>} API response
   */
  async sendData(config, decodedData, deviceId, timestamp, retryCount = 0) {
    try {
      if (!config.enabled || !config.clientId || !config.clientSecret || !config.projectId) {
        logger.info('LineMetrics integration not configured or disabled');
        return { success: false, message: 'LineMetrics not configured' };
      }

      const dataPoints = config.dataPoints || {};
      const measurements = [];

      // Create measurements for each mapped data point
      for (const [field, dataPointId] of Object.entries(dataPoints)) {
        if (decodedData[field] !== undefined && decodedData[field] !== null) {
          measurements.push({
            data_point_id: dataPointId,
            value: decodedData[field],
            timestamp: timestamp
          });
        }
      }

      if (measurements.length === 0) {
        logger.info('No valid measurements to send to LineMetrics');
        return { success: false, message: 'No valid measurements' };
      }

      // Get OAuth access token (verwendet jetzt Caching)
      const accessToken = await this.getAccessToken(config.clientId, config.clientSecret);

      // LineMetrics verwendet einen anderen Endpunkt für Daten
      // POST /v2/data/{CUSTOM_KEY}/{ALIAS}
      // CUSTOM_KEY = Asset ID, ALIAS = Data Point ID
      const dataPointId = Object.values(config.dataPoints)[0]; // Verwende das erste Data Point
      if (!dataPointId) {
        return {
          success: false,
          error: 'Kein Data Point konfiguriert'
        };
      }

      // Verwende die Project ID als CUSTOM_KEY (Asset ID)
      // und die Data Point ID als ALIAS
      const customKey = config.projectId; // Asset ID
      const alias = dataPointId; // Data Point ID / Alias

      // Debug: Log die verwendete Konfiguration
      logger.info(`LineMetrics Config Debug: projectId=${config.projectId}, dataPoints=${JSON.stringify(config.dataPoints)}`);
      logger.info(`LineMetrics URL Debug: customKey=${customKey}, alias=${alias}`);
      logger.info(`LineMetrics Timestamp Debug: timestamp=${timestamp}`);

      // Erstelle das Datenformat für LineMetrics
      const lineMetricsData = [];
      for (const [field, dataPointId] of Object.entries(config.dataPoints)) {
        if (decodedData[field] !== undefined && decodedData[field] !== null) {
          // Standardisiere das Datenformat
          let value = decodedData[field];
          
          // Konvertiere zu Number falls nötig
          if (typeof value === 'string') {
            // Entferne Leerzeichen und ersetze Kommas durch Punkte
            value = value.trim().replace(',', '.');
            value = parseFloat(value);
          }
          
          // Stelle sicher, dass es eine gültige Zahl ist
          if (isNaN(value)) {
            logger.warn(`Invalid value for field ${field}: ${decodedData[field]}`);
            continue;
          }
          
          // Stelle sicher, dass es eine endliche Zahl ist
          if (!isFinite(value)) {
            logger.warn(`Infinite value for field ${field}: ${decodedData[field]}`);
            continue;
          }
          
          // Behalte volle Genauigkeit für LineMetrics API
          // Verwende 3 Dezimalstellen für bessere Lesbarkeit in LineMetrics
          value = value.toFixed(3); // 3 Dezimalstellen für optimale Darstellung
          
          const dataPoint = {
            val: value
          };
          
          // Füge Timestamp hinzu, falls verfügbar
          if (timestamp) {
            dataPoint.ts = new Date(timestamp).getTime();
          }
          
          lineMetricsData.push(dataPoint);
          
          // Debug: Log das formatierte Datenformat
          logger.info(`LineMetrics Data Format: field=${field}, original=${decodedData[field]}, formatted=${value}, type=${typeof value}`);
        }
      }

      if (lineMetricsData.length === 0) {
        return {
          success: false,
          error: 'Keine gültigen Daten zum Senden'
        };
      }
      
      // Debug: Log die gesendeten Daten
      logger.info(`LineMetrics Data Debug: ${JSON.stringify(lineMetricsData)}`);
      logger.info(`LineMetrics Data Points Count: ${lineMetricsData.length}`);
      logger.info(`LineMetrics Timestamp for each data point: ${lineMetricsData.map(dp => dp.ts).join(', ')}`);
      logger.info(`LineMetrics Raw Timestamp: ${timestamp}`);
      logger.info(`LineMetrics Converted Timestamp: ${timestamp ? new Date(timestamp).getTime() : 'null'}`);

      const response = await fetch(`${this.baseUrl}/v2/data/${customKey}/${alias}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(lineMetricsData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        // Handle rate limiting with exponential backoff
        if (response.status === 429 && retryCount < 3) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
          const backoffDelay = Math.min(retryAfter * 1000, (2 ** retryCount) * 1000); // Exponentielles Backoff, max Retry-After
          
          logger.warn(`LineMetrics Rate Limit erreicht für Webhook ${config.projectId}. Wiederhole in ${backoffDelay}ms (Versuch ${retryCount + 1}/3)`);
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          
          // Clear cached token to force refresh
          const cacheKey = `${config.clientId}:${config.clientSecret}`;
          tokenCache.delete(cacheKey);
          
          // Retry with incremented counter
          return this.sendData(config, decodedData, deviceId, timestamp, retryCount + 1);
        }
        
        logger.error(`LineMetrics API Fehler für Webhook ${config.projectId}: ${response.status} - ${errorText}`);
        logger.error(`Gesendete Daten: ${JSON.stringify(lineMetricsData)}`);
        logger.error(`Custom Key (Asset ID): ${customKey}`);
        logger.error(`Alias (Data Point ID): ${alias}`);
        logger.error(`LineMetrics API URL: ${this.baseUrl}/v2/data/${customKey}/${alias}`);
        
        return {
          success: false,
          error: `LineMetrics API error: ${response.status}`,
          details: errorText,
          retryCount: retryCount
        };
      }

      const result = await response.json();
      logger.info(`Successfully sent ${measurements.length} measurements to LineMetrics for device ${deviceId}`);
      
      return {
        success: true,
        measurementsSent: measurements.length,
        data: result
      };

    } catch (error) {
      logger.error(`Error sending data to LineMetrics: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Test LineMetrics connection
   * @param {string} clientId - LineMetrics Client ID
   * @param {string} clientSecret - LineMetrics Client Secret
   * @param {string} projectId - LineMetrics Project ID
   * @returns {Promise<Object>} Test result
   */
  async testConnection(clientId, clientSecret, projectId) {
    try {
      // Get OAuth access token (verwendet jetzt Caching)
      const accessToken = await this.getAccessToken(clientId, clientSecret);

      // Teste die Verbindung durch einen einfachen API-Call
      // LineMetrics hat möglicherweise einen anderen Endpunkt für Tests
      const response = await fetch(`${this.baseUrl}/v2/data/test`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Connection test failed: ${response.status}`,
          details: errorText
        };
      }

      const projectInfo = await response.json();
      return {
        success: true,
        project: projectInfo
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get available data points for a project
   * @param {string} clientId - LineMetrics Client ID
   * @param {string} clientSecret - LineMetrics Client Secret
   * @param {string} projectId - LineMetrics Project ID
   * @returns {Promise<Object>} Data points list
   */
  async getDataPoints(clientId, clientSecret, projectId) {
    try {
      // Get OAuth access token (verwendet jetzt Caching)
      const accessToken = await this.getAccessToken(clientId, clientSecret);

      // LineMetrics Data Points Endpunkt
      const response = await fetch(`${this.baseUrl}/v2/data_points`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Failed to fetch data points: ${response.status}`,
          details: errorText
        };
      }

      const dataPoints = await response.json();
      return {
        success: true,
        dataPoints: dataPoints
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = LineMetricsClient; 