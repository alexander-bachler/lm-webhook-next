const logger = require('../logger');

/**
 * Webhook Handlers - Zentrale Verarbeitung verschiedener LoRaWAN Webhook-Formate
 */

/**
 * Erkenne den Webhook-Endpoint basierend auf Payload-Struktur
 */
function detectWebhookEndpoint(payload) {
  if (payload.DevEUI_uplink) return '/webhook/actility';
  if (payload.dev_id || payload.payload_raw) return '/webhook/ttn';
  if (payload.deviceName || payload.data) return '/webhook/chirpstack';
  if (payload.uplink_message?.frm_payload) return '/webhook/ttn';
  return '/webhook';
}

/**
 * Extrahiere LoRaWAN-Payload aus verschiedenen Webhook-Formaten
 */
function extractPayload(webhookData) {
  // TTN Format
  if (webhookData.payload_raw) {
    return { data: webhookData.payload_raw, format: 'ttn' };
  }
  
  // TTN v3 Format
  if (webhookData.uplink_message?.frm_payload) {
    return { data: webhookData.uplink_message.frm_payload, format: 'ttn' };
  }
  
  // ChirpStack Format
  if (webhookData.data || webhookData.object?.data) {
    return { data: webhookData.data || webhookData.object.data, format: 'auto' };
  }
  
  // Actility Format
  if (webhookData.DevEUI_uplink?.payload_hex) {
    return { 
      data: webhookData.DevEUI_uplink.payload_hex, 
      format: 'auto',
      fPort: webhookData.DevEUI_uplink.Fport 
    };
  }
  
  // Generisches Format
  if (webhookData.payload) {
    return { data: webhookData.payload, format: webhookData.format || 'auto' };
  }

  return null;
}

/**
 * Extrahiere Geräteinformationen aus verschiedenen Webhook-Formaten
 */
function extractDeviceInfo(webhookData) {
  const config = require('../config');
  
  let deviceInfo = {
    id: 'unknown_device',
    type: 'generic',
    customKey: config.lineMetrics.defaultCustomKey,
    timestamp: new Date().toISOString(),
    rssi: null,
    snr: null,
    gateway: null,
    fPort: null,
    location: null,
    customerName: null
  };

  // Actility ThingPark Format
  if (webhookData.DevEUI_uplink) {
    const uplink = webhookData.DevEUI_uplink;
    deviceInfo.id = uplink.DevEUI;
    deviceInfo.type = 'actility_device';
    deviceInfo.timestamp = uplink.Time || deviceInfo.timestamp;
    deviceInfo.fPort = uplink.Fport;
    
    // Gateway-Informationen extrahieren (verschiedene Actility-Formate)
    if (uplink.Lrrs && uplink.Lrrs.length > 0) {
      const firstGw = uplink.Lrrs[0];
      deviceInfo.rssi = parseFloat(firstGw.LrrRSSI || firstGw.Rssi);
      deviceInfo.snr = parseFloat(firstGw.LrrSNR || firstGw.Snr);
      deviceInfo.gateway = firstGw.Lrr;
    } else if (uplink.Lrr) {
      // Einzelner Gateway (ohne Array)
      deviceInfo.rssi = parseFloat(uplink.Lrr.Rssi);
      deviceInfo.snr = parseFloat(uplink.Lrr.Snr);
      deviceInfo.gateway = uplink.Lrr.Lrr;
    }
    
    // Zusätzliche Metadaten
    if (uplink.CustomerData) {
      deviceInfo.customerName = uplink.CustomerData.name;
      deviceInfo.location = uplink.CustomerData.loc;
    }
  }
  
  // TTN Format
  else if (webhookData.dev_id || webhookData.end_device_ids?.device_id) {
    deviceInfo.id = webhookData.dev_id || webhookData.end_device_ids.device_id;
    deviceInfo.type = 'ttn_device';
    deviceInfo.timestamp = webhookData.metadata?.time || webhookData.received_at || deviceInfo.timestamp;
    
    if (webhookData.metadata?.gateways && webhookData.metadata.gateways.length > 0) {
      const firstGw = webhookData.metadata.gateways[0];
      deviceInfo.rssi = firstGw.rssi;
      deviceInfo.snr = firstGw.snr;
      deviceInfo.gateway = firstGw.gtw_id;
    }
  }
  
  // ChirpStack Format
  else if (webhookData.deviceName || webhookData.devEUI) {
    deviceInfo.id = webhookData.deviceName || webhookData.devEUI;
    deviceInfo.type = 'chirpstack_device';
    deviceInfo.timestamp = webhookData.time || deviceInfo.timestamp;
    
    if (webhookData.rxInfo && webhookData.rxInfo.length > 0) {
      const firstGw = webhookData.rxInfo[0];
      deviceInfo.rssi = firstGw.rssi;
      deviceInfo.snr = firstGw.loRaSNR;
      deviceInfo.gateway = firstGw.gatewayID;
    }
  }
  
  // Generic Device Info Format (eigenes Test-Format)
  else if (webhookData.deviceInfo) {
    const devInfo = webhookData.deviceInfo;
    deviceInfo.id = devInfo.devEUI || devInfo.deviceId || devInfo.devAddr;
    deviceInfo.type = 'generic_device';
    deviceInfo.timestamp = webhookData.timestamp || deviceInfo.timestamp;
    deviceInfo.fPort = webhookData.fPort;
    
    // Extrahiere weitere Informationen falls verfügbar
    if (devInfo.rssi) deviceInfo.rssi = devInfo.rssi;
    if (devInfo.snr) deviceInfo.snr = devInfo.snr;
    if (devInfo.gateway) deviceInfo.gateway = devInfo.gateway;
  }

  return deviceInfo;
}

module.exports = {
  detectWebhookEndpoint,
  extractPayload,
  extractDeviceInfo
}; 