require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,

  lineMetrics: {
    apiUrl: process.env.LM_API_URL || 'https://restapi.linemetrics.com/v2',
    clientId: process.env.LM_CLIENT_ID,
    clientSecret: process.env.LM_CLIENT_SECRET,
    username: process.env.LM_USERNAME,
    password: process.env.LM_PASSWORD,
    defaultCustomKey: process.env.LM_DEFAULT_CUSTOM_KEY,
    defaultAlias: process.env.LM_DEFAULT_ALIAS,
  },

  webhook: {
    allowedIPs: [],
    webhookSiteToken: process.env.WEBHOOK_SITE_TOKEN || '',
    webhookSiteApiKey: process.env.WEBHOOK_SITE_API_KEY || '',
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || './logs/app.log',
  },
};
