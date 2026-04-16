/**
 * Shared Actility / LoRa uplink parsing and device resolution for webhooks.
 */

export interface UplinkDeviceInfo {
  deviceEUI: string;
  fPort: number | null;
  payload: string;
  rssi: number | null;
  snr: number | null;
  customerName: string | null;
  timestamp: string;
  success: boolean;
  frequency: unknown;
  txPower: unknown;
  spFact: unknown;
  subBand: unknown;
  channel: unknown;
  devAddr: unknown;
  fCntUp: unknown;
  fCntDn: unknown;
  mType: unknown;
  adrBit: unknown;
  nbTrans: unknown;
  dynamicClass: unknown;
  instantPER: unknown;
  meanPER: unknown;
  lostUplinksAS: unknown;
  gatewayId: unknown;
  gatewayLat: unknown;
  gatewayLon: unknown;
  deviceType: unknown;
  deviceLocation: unknown;
  payloadDecodedError: unknown;
}

export function extractUplinkInfoFromActilityContent(
  content: Record<string, unknown>
): UplinkDeviceInfo {
  const uplink = content.DevEUI_uplink as Record<string, unknown> | undefined;
  if (uplink) {
    const customer = uplink.CustomerData as Record<string, unknown> | undefined;
    const payloadHex = uplink.payload_hex;
    const hex =
      typeof payloadHex === 'string'
        ? payloadHex
        : payloadHex != null
          ? String(payloadHex)
          : '';
    return {
      deviceEUI: uplink.DevEUI != null ? String(uplink.DevEUI) : 'Unbekannt',
      fPort: uplink.FPort != null ? Number(uplink.FPort) : null,
      payload: hex,
      rssi: uplink.LrrRSSI != null ? Number(uplink.LrrRSSI) : null,
      snr: uplink.LrrSNR != null ? Number(uplink.LrrSNR) : null,
      customerName: customer?.name != null ? String(customer.name) : null,
      timestamp:
        uplink.Time != null
          ? String(uplink.Time)
          : new Date().toISOString(),
      success: Boolean(
        hex && hex.length > 0 && hex.length % 2 === 0
      ),
      frequency: uplink.Frequency,
      txPower: uplink.TxPower,
      spFact: uplink.SpFact,
      subBand: uplink.SubBand,
      channel: uplink.Channel,
      devAddr: uplink.DevAddr,
      fCntUp: uplink.FCntUp,
      fCntDn: uplink.FCntDn,
      mType: uplink.MType,
      adrBit: uplink.ADRbit,
      nbTrans: uplink.NbTrans,
      dynamicClass: uplink.DynamicClass,
      instantPER: uplink.InstantPER,
      meanPER: uplink.MeanPER,
      lostUplinksAS: uplink.LostUplinksAS,
      gatewayId: uplink.Lrrid,
      gatewayLat: uplink.LrrLAT,
      gatewayLon: uplink.LrrLON,
      deviceType:
        customer?.alr != null && typeof customer.alr === 'object'
          ? (customer.alr as Record<string, unknown>).pro
          : undefined,
      deviceLocation: customer?.loc,
      payloadDecodedError: uplink.payloadDecodedError,
    };
  }

  return {
    deviceEUI: 'Unbekannt',
    fPort: null,
    payload: 'Kein Payload',
    rssi: null,
    snr: null,
    customerName: null,
    timestamp: new Date().toISOString(),
    success: false,
    frequency: null,
    txPower: null,
    spFact: null,
    subBand: null,
    channel: null,
    devAddr: null,
    fCntUp: null,
    fCntDn: null,
    mType: null,
    adrBit: null,
    nbTrans: null,
    dynamicClass: null,
    instantPER: null,
    meanPER: null,
    lostUplinksAS: null,
    gatewayId: null,
    gatewayLat: null,
    gatewayLon: null,
    deviceType: null,
    deviceLocation: null,
    payloadDecodedError: null,
  };
}

/**
 * Resolve temporary Harvy2 device for unknown EUIs (same heuristic as dashboard flow).
 */
export function resolveLocalDeviceForUplink(
  deviceInfo: UplinkDeviceInfo,
  deviceMap: Map<string, Record<string, unknown>>
): Record<string, unknown> | null {
  let localDevice =
    deviceMap.get(deviceInfo.deviceEUI) ||
    deviceMap.get(deviceInfo.deviceEUI?.toLowerCase());

  if (
    !localDevice &&
    deviceInfo.payload &&
    deviceInfo.payload.length >= 70 &&
    deviceInfo.payload.length <= 160
  ) {
    const buffer = Buffer.from(deviceInfo.payload, 'hex');
    if (buffer.length >= 35 && buffer.length <= 80) {
      localDevice = {
        deviceId: `LORA/Generic_${deviceInfo.deviceEUI}`,
        deviceEUI: deviceInfo.deviceEUI,
        name: `LORA/Generic_${deviceInfo.deviceEUI}`,
        description: 'Auto-generated device from webhook data',
        decoder: 'harvy2',
        manufacturer: 'Dezem',
        model: 'Harvy2',
        image: '/images/devices/default.svg',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastSeen: deviceInfo.timestamp || new Date().toISOString(),
        dataCount: 0,
        metadata: {},
      };
    }
  }

  return localDevice ?? null;
}

export function buildDeviceMap(
  allDevices: Record<string, unknown>[]
): Map<string, Record<string, unknown>> {
  const deviceMap = new Map<string, Record<string, unknown>>();
  for (const device of allDevices) {
    const d = device as { deviceEUI?: string; deviceId?: string };
    if (d.deviceEUI) {
      deviceMap.set(d.deviceEUI, device as Record<string, unknown>);
      deviceMap.set(d.deviceEUI.toLowerCase(), device as Record<string, unknown>);
    }
    if (d.deviceId) {
      deviceMap.set(d.deviceId, device as Record<string, unknown>);
    }
  }
  return deviceMap;
}
