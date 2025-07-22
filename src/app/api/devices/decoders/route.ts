import { NextRequest, NextResponse } from 'next/server';
import DeviceManager from '@/lib/device-manager';

export async function GET(request: NextRequest) {
  try {
    // Lade die verfügbaren Decoder aus dem Device Manager
    const decoders = DeviceManager.getAvailableDecoders();
    
    return NextResponse.json({
      success: true,
      count: decoders.length,
      data: decoders
    });
  } catch (error) {
    console.error('Error loading decoders:', error);
    return NextResponse.json({
      success: false,
      error: 'Fehler beim Laden der Decoder',
      count: 0,
      data: []
    }, { status: 500 });
  }
} 