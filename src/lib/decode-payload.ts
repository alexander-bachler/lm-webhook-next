import DeviceManager from '@/lib/device-manager';
import { decodePayloadCore } from '@/lib/payload-decode';

export function getServerBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL || `http://127.0.0.1:${process.env.PORT || 3000}`
  );
}

export interface DecodePayloadResult {
  success: boolean;
  decoder: string;
  decodedData: Record<string, unknown> | null;
  warnings: string[];
  errors: string[];
  deviceInfo: {
    name: string;
    manufacturer: string;
    model: string;
    decoder: string;
  } | null;
}

/**
 * Decode hex payload using the same logic as POST /api/payload/decode (in-process, no HTTP).
 */
export async function decodePayload(
  deviceEUI: string,
  payload: string,
  fPort: number | null
): Promise<DecodePayloadResult> {
  try {
    const device = DeviceManager.getDeviceByEUI(deviceEUI) as Record<string, unknown> | null;
    let decoder = 'auto';
    const deviceType = '';
    let deviceInfo = {
      name: deviceEUI,
      manufacturer: 'Unknown',
      model: 'Unknown',
      decoder: 'auto',
    };

    if (device && device.decoder) {
      decoder = String(device.decoder);
      deviceInfo = {
        name: String(device.name || deviceEUI),
        manufacturer: String(device.manufacturer || 'Unknown'),
        model: String(device.model || 'Unknown'),
        decoder: String(device.decoder || 'auto'),
      };
    }

    if (!payload || payload.length === 0 || payload.length % 2 !== 0) {
      return {
        success: false,
        decoder,
        decodedData: null,
        warnings: [],
        errors: ['Invalid payload or decode error'],
        deviceInfo: device
          ? {
              name: String(device.name ?? deviceEUI),
              manufacturer: String(device.manufacturer ?? 'Unknown'),
              model: String(device.model ?? 'Unknown'),
              decoder: String(device.decoder ?? 'auto'),
            }
          : null,
      };
    }

    const result = await decodePayloadCore({
      payload,
      decoder,
      deviceType,
      fPort: fPort ?? undefined,
      deviceEUI,
      deviceInfo,
    });

    const fromResult = result.deviceInfo;
    const finalDeviceInfo: DecodePayloadResult['deviceInfo'] =
      fromResult && fromResult.name && fromResult.decoder
        ? {
            name: String(fromResult.name),
            manufacturer: String(fromResult.manufacturer ?? 'Unknown'),
            model: String(fromResult.model ?? 'Unknown'),
            decoder: String(fromResult.decoder),
          }
        : device
          ? {
              name: String(device.name || deviceEUI),
              manufacturer: String(device.manufacturer || 'Unknown'),
              model: String(device.model || 'Unknown'),
              decoder: String(device.decoder || 'auto'),
            }
          : null;

    const errors = result.errors || [];
    const success = errors.length === 0 && result.success;

    return {
      success,
      decoder: result.decoder,
      decodedData: result.decodedData ?? null,
      warnings: result.warnings || [],
      errors,
      deviceInfo: finalDeviceInfo,
    };
  } catch (error) {
    console.error('decodePayload error:', error);
    return {
      success: false,
      decoder: 'auto',
      decodedData: null,
      warnings: [],
      errors: [`Decode error: ${error}`],
      deviceInfo: null,
    };
  }
}
