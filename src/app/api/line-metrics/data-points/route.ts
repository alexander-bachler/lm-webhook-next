import { NextRequest, NextResponse } from 'next/server';
import LineMetricsClient from '@/lib/line-metrics-client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId, clientSecret, projectId } = body;

    if (!clientId || !clientSecret || !projectId) {
      return NextResponse.json({
        success: false,
        error: 'Client ID, Client Secret und Project ID sind erforderlich'
      }, { status: 400 });
    }

    const lineMetricsClient = new LineMetricsClient();
    const result: any = await lineMetricsClient.getDataPoints(clientId, clientSecret, projectId);

    if (result.success) {
      return NextResponse.json({
        success: true,
        dataPoints: result.dataPoints
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error,
        details: result.details
      }, { status: 400 });
    }

  } catch (error) {
    console.error('LineMetrics data points error:', error);
    return NextResponse.json({
      success: false,
      error: 'Interner Server-Fehler'
    }, { status: 500 });
  }
} 