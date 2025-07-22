import { NextRequest, NextResponse } from 'next/server';

// Webhook.site Konfiguration
const WEBHOOK_SITE_TOKEN = 'fbd2d5a5-d00d-4129-b533-edbc9f438088';
const WEBHOOK_SITE_API_KEY = '52e69666-a1da-478f-b060-7b029a5f5634';

async function fetchWebhookSiteHistory(limit: number, startDate?: string, endDate?: string) {
  const url = `https://webhook.site/token/${WEBHOOK_SITE_TOKEN}/requests`;
  const headers: Record<string, string> = {
    'User-Agent': 'LineMetrics-Webhook-Server/1.0',
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };

  // Füge API Key hinzu wenn verfügbar
  if (WEBHOOK_SITE_API_KEY) {
    headers['Api-Key'] = WEBHOOK_SITE_API_KEY;
  }

  const params: Record<string, string> = {
    sorting: 'newest',
    per_page: Math.min(limit, 100).toString()
  };

  // Füge Datums-Parameter hinzu falls vorhanden
  if (startDate) {
    params['created_after'] = new Date(startDate).toISOString();
  }
  if (endDate) {
    params['created_before'] = new Date(endDate).toISOString();
  }

  const response = await fetch(`${url}?${new URLSearchParams(params)}`, {
    headers,
    method: 'GET'
  });

  if (!response.ok) {
    throw new Error(`Webhook.site API Fehler: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  // Verarbeite verschiedene Response-Formate
  if (Array.isArray(data)) {
    return data;
  } else if (data.data && Array.isArray(data.data)) {
    return data.data;
  } else if (data.requests && Array.isArray(data.requests)) {
    return data.requests;
  }
  
  return [];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get('source') || 'webhook.site';
  const limit = parseInt(searchParams.get('limit') || '50');
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;
  
  try {
    let data;
    
    if (source === 'webhook.site') {
      // Direkte webhook.site API-Integration
      data = await fetchWebhookSiteHistory(limit, startDate, endDate);
    } else {
      // Für lokale Daten verwende ein leeres Array (kann später erweitert werden)
      data = [];
    }
    
    return NextResponse.json({
      success: true,
      count: data.length,
      data: data,
      source: source
    });
  } catch (error: any) {
    console.error('Fehler beim Abrufen historischer Daten:', error);
    return NextResponse.json(
      { 
        error: 'Fehler beim Abrufen historischer Daten',
        details: error.message 
      },
      { status: 500 }
    );
  }
} 