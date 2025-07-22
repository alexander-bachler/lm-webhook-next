// ES Module Wrapper für history-manager.js
const historyManager = require('./history-manager.js');

export const getLocalHistory = historyManager.getLocalHistory;
export const getStats = historyManager.getStats;
export const saveWebhookData = historyManager.saveWebhookData;
export const getWebhookSiteHistory = historyManager.getWebhookSiteHistory;
export const getDecodedWebhookSiteHistory = historyManager.getDecodedWebhookSiteHistory;
export const convertToCSV = historyManager.convertToCSV;
export const getCurrentHistory = historyManager.getCurrentHistory;

export default historyManager; 