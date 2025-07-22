import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { payload, fPort = 6 } = body;
    
    if (!payload) {
      return NextResponse.json(
        { error: 'Payload erforderlich' },
        { status: 400 }
      );
    }
    
    // Teste Harvy2-Decoder
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/payload/decode`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        payload: payload,
        decoder: 'harvy2',
        fPort: fPort
      }),
    });
    
    const result = await response.json();
    
    return NextResponse.json({
      success: true,
      test: 'Harvy2 Decoder Test',
      payload: payload,
      fPort: fPort,
      result: result
    });
    
  } catch (error: any) {
    console.error('Fehler beim Testen des Harvy2-Decoders:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message
      },
      { status: 400 }
    );
  }
} 