require('dotenv').config();

module.exports = {
  // Server Konfiguration
  port: process.env.PORT || 3000,
  
  // LineMetrics API Konfiguration
  lineMetrics: {
    apiUrl: process.env.LM_API_URL || 'https://restapi.linemetrics.com/v2',
    clientId: process.env.LM_CLIENT_ID,
    clientSecret: process.env.LM_CLIENT_SECRET,
    username: process.env.LM_USERNAME,
    password: process.env.LM_PASSWORD,
    
    // Standard Asset und Messpunkt (können überschrieben werden)
    defaultCustomKey: process.env.LM_DEFAULT_CUSTOM_KEY,
    defaultAlias: process.env.LM_DEFAULT_ALIAS
  },
  
  // Webhook Sicherheit
  webhook: {
    allowedIPs: [], // [] = alle IPs erlaubt, spezifische IPs mit ['IP1', 'IP2']
    webhookSiteToken: 'fbd2d5a5-d00d-4129-b533-edbc9f438088', // UUID Token aus der webhook.site URL
    webhookSiteApiKey: '52e69666-a1da-478f-b060-7b029a5f5634' // API Key für webhook.site API-Authentifizierung
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || './logs/app.log'
  }
}; 