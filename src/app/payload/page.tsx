'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Textarea 
} from '@/components/ui/textarea';
import { 
  Play, 
  Copy, 
  Download, 
  FileText, 
  Code, 
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Zap
} from 'lucide-react';

interface DecodeResult {
  success: boolean;
  payload: string;
  decoder: string;
  decodedData: any;
  timestamp: string;
  error?: string;
}

export default function PayloadPage() {
  const [payload, setPayload] = useState('');
  const [decoder, setDecoder] = useState('auto');
  const [deviceType, setDeviceType] = useState('');
  const [fPort, setFPort] = useState('');
  const [result, setResult] = useState<DecodeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const samplePayloads = [
    {
      name: 'Cayenne LPP - Temperatur & Feuchtigkeit',
      payload: '0100A8404194A1835E9F0000000000000000',
      decoder: 'cayenne',
      description: 'Temperatur- und Feuchtigkeitssensor mit Cayenne LPP Format'
    },
    {
      name: 'H200 Sensor',
      payload: '0100A8404194A1835E9F0000000000000000',
      decoder: 'h200',
      description: 'H200 Temperatursensor'
    },
    {
      name: 'Integra Topas Sonic',
      payload: '0200B8404194A1835E9F0000000000000000',
      decoder: 'integra-topas-sonic',
      description: 'Wassermessung mit Integra Topas Sonic'
    },
    {
      name: 'Custom Hex Payload',
      payload: '0102030405060708090A0B0C0D0E0F10',
      decoder: 'auto',
      description: 'Generischer Hex-Payload zur automatischen Erkennung'
    }
  ];

  const handleDecode = async () => {
    if (!payload.trim()) {
      setError('Bitte geben Sie einen Payload ein');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/payload/decode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payload: payload.trim(),
          decoder,
          deviceType: deviceType || undefined,
          fPort: fPort ? parseInt(fPort) : undefined
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || 'Fehler bei der Dekodierung');
      }
    } catch (err) {
      setError('Fehler bei der Dekodierung');
      console.error('Error decoding payload:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSample = (sample: typeof samplePayloads[0]) => {
    setPayload(sample.payload);
    setDecoder(sample.decoder);
    setDeviceType('');
    setFPort('');
    setResult(null);
    setError(null);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const downloadResult = () => {
    if (!result) return;
    
    const dataStr = JSON.stringify(result, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `payload-result-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const formatDecodedData = (data: any): string => {
    if (typeof data === 'object') {
      return JSON.stringify(data, null, 2);
    }
    return String(data);
  };

  const getValueType = (value: any): string => {
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'string') return 'string';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    return 'unknown';
  };

  const getValueColor = (type: string): string => {
    switch (type) {
      case 'number': return 'text-blue-600';
      case 'boolean': return 'text-green-600';
      case 'string': return 'text-purple-600';
      case 'array': return 'text-orange-600';
      case 'object': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payload Tester</h1>
        <p className="text-muted-foreground mt-2">
          Teste und dekodiere LoRaWAN Payloads mit verschiedenen Decodern
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Input Section */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payload Eingabe</CardTitle>
              <CardDescription>
                Gib einen LoRaWAN Payload ein und wähle einen Decoder
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="payload">Payload (Hex)</Label>
                <Textarea
                  id="payload"
                  placeholder="z.B. 0100A8404194A1835E9F0000000000000000"
                  value={payload}
                  onChange={(e) => setPayload(e.target.value)}
                  className="font-mono text-sm"
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="decoder">Decoder</Label>
                  <Select value={decoder} onValueChange={setDecoder}>
                    <SelectTrigger>
                      <SelectValue placeholder="Decoder auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-Detection</SelectItem>
                      <SelectItem value="cayenne">Cayenne LPP</SelectItem>
                      <SelectItem value="h200">H200</SelectItem>
                      <SelectItem value="integra-topas-sonic">Integra Topas Sonic</SelectItem>
                      <SelectItem value="custom">Custom Decoder</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fPort">FPort (optional)</Label>
                  <Input
                    id="fPort"
                    type="number"
                    placeholder="1"
                    value={fPort}
                    onChange={(e) => setFPort(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="deviceType">Device Type (optional)</Label>
                <Input
                  id="deviceType"
                  placeholder="z.B. temperature, humidity, water"
                  value={deviceType}
                  onChange={(e) => setDeviceType(e.target.value)}
                />
              </div>

              <Button 
                onClick={handleDecode} 
                disabled={loading || !payload.trim()}
                className="w-full"
              >
                {loading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Dekodiere...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Payload dekodieren
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Sample Payloads */}
          <Card>
            <CardHeader>
              <CardTitle>Beispiel Payloads</CardTitle>
              <CardDescription>
                Lade vordefinierte Payloads zum Testen
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {samplePayloads.map((sample, index) => (
                <div key={index}>
                  <Button
                    variant="outline"
                    className="w-full h-auto p-3 justify-start"
                    onClick={() => loadSample(sample)}
                  >
                    <div className="flex items-start gap-3 w-full">
                      <FileText className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 text-left">
                        <p className="font-medium text-sm">{sample.name}</p>
                        <p className="text-xs text-muted-foreground">{sample.description}</p>
                        <p className="text-xs font-mono text-muted-foreground mt-1">
                          {sample.payload.substring(0, 20)}...
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {sample.decoder}
                      </Badge>
                    </div>
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Results Section */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Dekodierung Ergebnis</CardTitle>
                  <CardDescription>
                    Ergebnis der Payload-Dekodierung
                  </CardDescription>
                </div>
                {result && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(JSON.stringify(result, null, 2))}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={downloadResult}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="text-red-700">{error}</span>
                </div>
              )}

              {result && (
                <div className="space-y-4">
                  {/* Success Status */}
                  <div className="flex items-center gap-2">
                    {result.success ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-green-700 font-medium">Dekodierung erfolgreich</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-4 w-4 text-red-500" />
                        <span className="text-red-700 font-medium">Dekodierung fehlgeschlagen</span>
                      </>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Decoder:</span>
                      <Badge variant="outline" className="ml-2">
                        {result.decoder}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Zeitstempel:</span>
                      <span className="ml-2">{new Date(result.timestamp).toLocaleString('de-DE')}</span>
                    </div>
                  </div>

                  <Separator />

                  {/* Decoded Data */}
                  {result.success && result.decodedData && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Code className="h-4 w-4" />
                        <span className="font-medium">Dekodierte Daten</span>
                      </div>
                      
                      {typeof result.decodedData === 'object' && !Array.isArray(result.decodedData) ? (
                        <div className="space-y-2">
                          {Object.entries(result.decodedData).map(([key, value]) => (
                            <div key={key} className="flex items-center justify-between p-2 bg-muted rounded">
                              <span className="font-medium text-sm">{key}:</span>
                              <div className="flex items-center gap-2">
                                <span className={`text-sm ${getValueColor(getValueType(value))}`}>
                                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {getValueType(value)}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-3 bg-muted rounded font-mono text-sm">
                          {formatDecodedData(result.decodedData)}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Raw Payload */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span className="font-medium">Original Payload</span>
                    </div>
                    <div className="p-3 bg-muted rounded font-mono text-sm break-all">
                      {result.payload}
                    </div>
                  </div>
                </div>
              )}

              {!result && !error && !loading && (
                <div className="text-center py-8">
                  <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Kein Ergebnis</h3>
                  <p className="text-muted-foreground">
                    Gib einen Payload ein und klicke auf "Dekodieren" um ein Ergebnis zu erhalten.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card>
            <CardHeader>
              <CardTitle>Hilfe & Informationen</CardTitle>
              <CardDescription>
                Wichtige Hinweise zur Payload-Dekodierung
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="space-y-2">
                <h4 className="font-medium">Unterstützte Decoder:</h4>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li><strong>Auto-Detection:</strong> Automatische Erkennung des Payload-Formats</li>
                  <li><strong>Cayenne LPP:</strong> Standard LoRaWAN Application Protocol</li>
                  <li><strong>H200:</strong> Spezifischer Decoder für H200 Sensoren</li>
                  <li><strong>Integra Topas Sonic:</strong> Wassermessung Decoder</li>
                  <li><strong>Custom:</strong> Benutzerdefinierte Decoder</li>
                </ul>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <h4 className="font-medium">Payload Format:</h4>
                <p className="text-muted-foreground">
                  Der Payload muss im Hex-Format eingegeben werden (z.B. 0100A8404194A1835E9F).
                  Leerzeichen und andere Zeichen werden automatisch entfernt.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 