// ES Module Wrapper für device-manager.js
const deviceManager = require('./device-manager.js');

export const getAllDevices = deviceManager.getAllDevices;
export const getDevice = deviceManager.getDevice;
export const getDeviceByEUI = deviceManager.getDeviceByEUI;
export const registerDevice = deviceManager.registerDevice;
export const updateDevice = deviceManager.updateDevice;
export const deleteDevice = deviceManager.deleteDevice;
export const updateDeviceActivity = deviceManager.updateDeviceActivity;

export default deviceManager; 