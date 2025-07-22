const logger = require('./logger');

class LineMetricsClient {
  constructor() {
    this.baseUrl = 'https://api.linemetrics.com';
    this.version = 'v1';
  }

  /**
   * Send data to LineMetrics Cloud
   * @param {Object} config - LineMetrics configuration
   * @param {string} config.apiKey - LineMetrics API Key
   * @param {string} config.projectId - LineMetrics Project ID
   * @param {Object} config.dataPoints - Mapping of decoder fields to data point IDs
   * @param {Object} decodedData - Decoded webhook data
   * @param {string} deviceId - Device identifier
   * @param {string} timestamp - ISO timestamp
   * @returns {Promise<Object>} API response
   */
  async sendData(config, decodedData, deviceId, timestamp) {
    try {
      if (!config.enabled || !config.apiKey || !config.projectId) {
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

      const payload = {
        measurements: measurements
      };

      const response = await fetch(`${this.baseUrl}/${this.version}/projects/${config.projectId}/measurements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`LineMetrics API error: ${response.status} - ${errorText}`);
        return {
          success: false,
          error: `LineMetrics API error: ${response.status}`,
          details: errorText
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
   * @param {string} apiKey - LineMetrics API Key
   * @param {string} projectId - LineMetrics Project ID
   * @returns {Promise<Object>} Test result
   */
  async testConnection(apiKey, projectId) {
    try {
      const response = await fetch(`${this.baseUrl}/${this.version}/projects/${projectId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`
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
   * @param {string} apiKey - LineMetrics API Key
   * @param {string} projectId - LineMetrics Project ID
   * @returns {Promise<Object>} Data points list
   */
  async getDataPoints(apiKey, projectId) {
    try {
      const response = await fetch(`${this.baseUrl}/${this.version}/projects/${projectId}/data_points`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`
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