import DeviceManager from '@/lib/device-manager';

export function getServerBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    `http://127.0.0.1:${process.env.PORT || 3000}`
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
 * Decode hex payload via internal /api/payload/decode route (same logic as GET /api/webhooks).
 */
export async function decodePayload(
  deviceEUI: string,
  payload: string,
  fPort: number | null
): Promise<DecodePayloadResult> {
  try {
    const device = DeviceManager.getDeviceByEUI(deviceEUI);
    let decoder = 'auto';
    const deviceType = '';
    let deviceInfo = {
      name: deviceEUI,
      manufacturer: 'Unknown',
      model: 'Unknown',
      decoder: 'auto',
    };

    if (device && device.decoder) {
      decoder = device.decoder;
      deviceInfo = {
        name: device.name || deviceEUI,
        manufacturer: device.manufacturer || 'Unknown',
        model: device.model || 'Unknown',
        decoder: device.decoder || 'auto',
      };
    }

    if (payload && payload.length > 0 && payload.length % 2 === 0) {
      try {
        const response = await fetch(`${getServerBaseUrl()}/api/payload/decode`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            payload,
            decoder,
            deviceType,
            fPort: fPort ?? undefined,
            deviceEUI,
            deviceInfo,
          }),
        });

        if (response.ok) {
          const result = (await response.json()) as {
            success?: boolean;
            decoder?: string;
            decodedData?: Record<string, unknown>;
            warnings?: string[];
            errors?: string[];
            deviceInfo?: DecodePayloadResult['deviceInfo'];
          };

          const finalDeviceInfo =
            result.deviceInfo ||
            (device
              ? {
                  name: device.name,
                  manufacturer: device.manufacturer,
                  model: device.model,
                  decoder: device.decoder,
                }
              : null);

          return {
            success: Boolean(result.success),
            decoder: result.decoder || decoder,
            decodedData: result.decodedData ?? null,
            warnings: result.warnings || [],
            errors: result.errors || [],
            deviceInfo: finalDeviceInfo,
          };
        }
      } catch (error) {
        console.error('decodePayload fetch error:', error);
      }
    }

    return {
      success: false,
      decoder,
      decodedData: null,
      warnings: [],
      errors: ['Invalid payload or decode error'],
      deviceInfo: device
        ? {
            name: device.name,
            manufacturer: device.manufacturer,
            model: device.model,
            decoder: device.decoder,
          }
        : null,
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
