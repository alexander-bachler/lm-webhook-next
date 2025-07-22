import { NextRequest, NextResponse } from 'next/server';
import LineMetricsClient from '@/lib/line-metrics-client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, projectId } = body;

    if (!apiKey || !projectId) {
      return NextResponse.json({
        success: false,
        error: 'API Key und Project ID sind erforderlich'
      }, { status: 400 });
    }

    const lineMetricsClient = new LineMetricsClient();
    const result: any = await lineMetricsClient.getDataPoints(apiKey, projectId);

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