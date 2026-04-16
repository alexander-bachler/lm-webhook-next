import { NextRequest, NextResponse } from 'next/server';
import { decodePayloadCore } from '@/lib/payload-decode';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { payload, decoder = 'auto', deviceType, fPort, deviceEUI, deviceInfo } = body;

    if (!payload) {
      return NextResponse.json({ error: 'Payload erforderlich' }, { status: 400 });
    }

    const result = await decodePayloadCore({
      payload,
      decoder,
      deviceType,
      fPort,
      deviceEUI,
      deviceInfo,
    });

    return NextResponse.json({
      success: result.success,
      payload: result.payload,
      decoder: result.decoder,
      deviceType: result.deviceType,
      fPort: result.fPort,
      deviceEUI: result.deviceEUI,
      deviceInfo: result.deviceInfo,
      decodedData: result.decodedData,
      errors: result.errors,
      warnings: result.warnings,
      timestamp: result.timestamp,
    });
  } catch (error: unknown) {
    console.error('Fehler bei der Payload-Dekodierung:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        payload: 'unknown',
      },
      { status: 400 }
    );
  }
}
