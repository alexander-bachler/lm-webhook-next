'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Calendar,
  Upload,
  Clock,
  AlertCircle,
  CheckCircle2,
  Loader2
} from 'lucide-react';

interface HistoricalPushProps {
  deviceId: string;
  deviceName: string;
  deviceEUI: string;
  lineMetricsEnabled: boolean;
}

export function HistoricalPush({
  deviceId,
  deviceName,
  deviceEUI,
  lineMetricsEnabled
}: HistoricalPushProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [formData, setFormData] = useState({
    limit: 50,
    startDate: '',
    endDate: '',
    force: false
  });

  const handlePushHistorical = async () => {
    if (!lineMetricsEnabled) {
      setResult({
        success: false,
        error: 'LineMetrics ist für dieses Device nicht aktiviert'
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/line-metrics/historical', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deviceId,
          ...formData
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error: any) {
      setResult({
        success: false,
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  if (!lineMetricsEnabled) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Historische Daten pushen
          </CardTitle>
          <CardDescription>
            Push historische Daten von webhook.site an LineMetrics Cloud
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              LineMetrics ist für dieses Device nicht aktiviert. Aktivieren Sie LineMetrics in den Device-Einstellungen.
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Historische Daten pushen
        </CardTitle>
        <CardDescription>
          Push historische Daten von webhook.site an LineMetrics Cloud für Device: {deviceName}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Device Info */}
        <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
          <div className="flex-1">
            <Label className="text-sm font-medium">Device</Label>
            <p className="text-sm text-muted-foreground">{deviceName}</p>
          </div>
          <div>
            <Label className="text-sm font-medium">Device EUI</Label>
            <p className="text-sm font-mono text-muted-foreground">{deviceEUI}</p>
          </div>
        </div>

        <Separator />

        {/* Konfiguration */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="limit">Anzahl Webhooks</Label>
              <Input
                id="limit"
                type="number"
                min="1"
                max="1000"
                value={formData.limit}
                onChange={(e) => setFormData({...formData, limit: parseInt(e.target.value) || 50})}
                placeholder="50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startDate">Startdatum</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="endDate">Enddatum</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                className="pl-10"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Action */}
        <div className="flex justify-end">
          <Button 
            onClick={handlePushHistorical}
            disabled={loading}
            className="flex items-center gap-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {loading ? 'Wird gepusht...' : 'Historische Daten pushen'}
          </Button>
        </div>

        {/* Result */}
        {result && (
          <div className={`p-4 rounded-lg border ${
            result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {result.success ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600" />
              )}
              <span className={`font-medium ${
                result.success ? 'text-green-800' : 'text-red-800'
              }`}>
                {result.success ? 'Erfolgreich' : 'Fehler'}
              </span>
            </div>
            
            <p className={`text-sm ${
              result.success ? 'text-green-700' : 'text-red-700'
            }`}>
              {result.message || result.error}
            </p>

            {result.success && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Gesendete Daten:</span>
                  <Badge variant="secondary">{result.dataSent}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Gefundene Webhooks:</span>
                  <Badge variant="outline">{result.deviceWebhooks}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Fehler:</span>
                  <Badge variant="destructive">{result.errors}</Badge>
                </div>
                {result.errorDetails && result.errorDetails.length > 0 && (
                  <div className="mt-2">
                    <Label className="text-xs font-medium">Fehler-Details:</Label>
                    <div className="mt-1 space-y-1">
                      {result.errorDetails.map((error: string, index: number) => (
                        <p key={index} className="text-xs text-red-600 font-mono">
                          {error}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 