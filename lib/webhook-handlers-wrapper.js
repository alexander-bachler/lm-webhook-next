// ES Module Wrapper für webhook-handlers.js
const webhookHandlers = require('./webhook-handlers.js');

export const extractPayload = webhookHandlers.extractPayload;
export const extractDeviceInfo = webhookHandlers.extractDeviceInfo;

export default webhookHandlers; 