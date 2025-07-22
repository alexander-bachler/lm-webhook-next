const axios = require('axios');
const config = require('./config');
const logger = require('./logger');

class LineMetricsClient {
  constructor() {
    this.apiUrl = config.lineMetrics.apiUrl;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * OAuth2 Token mit Client Credentials holen
   */
  async getAccessToken() {
    try {
      const response = await axios.post(`${this.apiUrl}/oauth2/token`, {
        grant_type: 'client_credentials',
        client_id: config.lineMetrics.clientId,
        client_secret: config.lineMetrics.clientSecret
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
      
      logger.info('LineMetrics OAuth2 Token erfolgreich erhalten');
      return this.accessToken;
    } catch (error) {
      logger.error('Fehler beim Holen des OAuth2 Tokens:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * OAuth2 Token mit Password Grant holen (alternative Methode)
   */
  async getAccessTokenWithPassword() {
    try {
      const response = await axios.post(`${this.apiUrl}/oauth2/token`, {
        grant_type: 'password',
        client_id: config.lineMetrics.clientId,
        client_secret: config.lineMetrics.clientSecret,
        username: config.lineMetrics.username,
        password: config.lineMetrics.password
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
      
      logger.info('LineMetrics OAuth2 Token (Password Grant) erfolgreich erhalten');
      return this.accessToken;
    } catch (error) {
      logger.error('Fehler beim Holen des OAuth2 Tokens (Password Grant):', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Prüft ob Token noch gültig ist und erneuert es bei Bedarf
   */
  async ensureValidToken() {
    if (!this.accessToken || !this.tokenExpiry || Date.now() >= this.tokenExpiry - 30000) {
      try {
        await this.getAccessToken();
      } catch (error) {
        // Fallback zu Password Grant wenn Client Credentials fehlschlagen
        if (config.lineMetrics.username && config.lineMetrics.password) {
          logger.info('Client Credentials fehlgeschlagen, versuche Password Grant...');
          await this.getAccessTokenWithPassword();
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Datentyp eines Messpunkts abfragen
   */
  async getDataType(customKey, alias) {
    await this.ensureValidToken();
    
    try {
      const response = await axios.get(
        `${this.apiUrl}/data/${customKey}/${alias}/config`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );
      
      logger.info(`Datentyp für ${customKey}/${alias} abgefragt: ${response.data.input}`);
      return response.data;
    } catch (error) {
      logger.error(`Fehler beim Abfragen des Datentyps für ${customKey}/${alias}:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Daten zu einem Messpunkt senden
   */
  async sendData(customKey, alias, value, timestamp = null) {
    await this.ensureValidToken();
    
    const payload = {
      val: value
    };
    
    if (timestamp) {
      payload.ts = timestamp;
    }

    try {
      const response = await axios.post(
        `${this.apiUrl}/data/${customKey}/${alias}`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      logger.info(`Daten erfolgreich an ${customKey}/${alias} gesendet:`, { value, timestamp });
      return response.data;
    } catch (error) {
      logger.error(`Fehler beim Senden der Daten an ${customKey}/${alias}:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Mehrere Datenpunkte gleichzeitig senden
   */
  async sendMultipleData(dataPoints) {
    const results = [];
    
    for (const point of dataPoints) {
      try {
        const result = await this.sendData(
          point.customKey || config.lineMetrics.defaultCustomKey,
          point.alias,
          point.value,
          point.timestamp
        );
        results.push({ success: true, alias: point.alias, result });
      } catch (error) {
        results.push({ success: false, alias: point.alias, error: error.message });
      }
    }
    
    return results;
  }

  /**
   * Historische Daten von einem Messpunkt abrufen
   */
  async getHistoricalData(customKey, alias, startDate = null, endDate = null, limit = 1000) {
    await this.ensureValidToken();
    
    try {
      // Baue Query-Parameter
      const params = new URLSearchParams();
      
      if (startDate) {
        params.append('from', new Date(startDate).toISOString());
      }
      
      if (endDate) {
        params.append('to', new Date(endDate).toISOString());
      }
      
      params.append('limit', limit.toString());

      const response = await axios.get(
        `${this.apiUrl}/data/${customKey}/${alias}/values?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          },
          timeout: 30000 // 30s Timeout für historische Daten
        }
      );
      
      logger.info(`Historische Daten für ${customKey}/${alias} abgerufen: ${response.data.length || 0} Einträge`);
      return response.data;
      
    } catch (error) {
      logger.error(`Fehler beim Abrufen historischer Daten für ${customKey}/${alias}:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Alle verfügbaren Assets abrufen
   */
  async getAssets() {
    await this.ensureValidToken();
    
    try {
      const response = await axios.get(
        `${this.apiUrl}/assets`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );
      
      logger.info(`${response.data.length || 0} Assets abgerufen`);
      return response.data;
      
    } catch (error) {
      logger.error('Fehler beim Abrufen der Assets:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Messpunkte für ein Asset abrufen
   */
  async getDatapoints(customKey) {
    await this.ensureValidToken();
    
    try {
      const response = await axios.get(
        `${this.apiUrl}/assets/${customKey}/datapoints`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );
      
      logger.info(`${response.data.length || 0} Messpunkte für Asset ${customKey} abgerufen`);
      return response.data;
      
    } catch (error) {
      logger.error(`Fehler beim Abrufen der Messpunkte für ${customKey}:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Aggregierte Statistiken für einen Zeitraum abrufen
   */
  async getStatistics(customKey, alias, startDate, endDate, aggregation = 'hour') {
    await this.ensureValidToken();
    
    try {
      const params = new URLSearchParams({
        from: new Date(startDate).toISOString(),
        to: new Date(endDate).toISOString(),
        aggregation: aggregation // hour, day, week, month
      });

      const response = await axios.get(
        `${this.apiUrl}/data/${customKey}/${alias}/statistics?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );
      
      logger.info(`Statistiken für ${customKey}/${alias} abgerufen (${aggregation})`);
      return response.data;
      
    } catch (error) {
      logger.error(`Fehler beim Abrufen der Statistiken für ${customKey}/${alias}:`, error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = LineMetricsClient; 