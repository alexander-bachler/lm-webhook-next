'use client';
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DecoderSelect } from '@/components/ui/decoder-select';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, SortableTableHead } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { 
  RefreshCw, 
  Search, 
  Filter, 
  Download, 
  Copy, 
  Eye, 
  EyeOff,
  Clock,
  Signal,
  Wifi,
  MapPin,
  Smartphone,
  Activity,
  Code,
  FileText,
  CheckCircle2,
  AlertCircle,
  Zap,
  BarChart3,
  Satellite,
  Gauge,
  Globe,
  X,
  ChevronUp,
  ExternalLink
} from 'lucide-react';

interface WebhookData {
  id: string;
  timestamp: string;
  deviceId?: string;
  deviceEUI?: string;
  payload?: string;
  fPort?: number;
  rssi?: number;
  snr?: number;
  gatewayId?: string;
  endpoint?: string;
  success?: boolean;
  processingTime?: number;
  decodedData?: any;
  metadata?: {
    usedDecoder?: string;
    detectedFormat?: string;
    processingTime?: number;
    customerName?: string;
    deviceInfo?: {
      name?: string;
      manufacturer?: string;
      model?: string;
      decoder?: string;
    };
    warnings?: string[];
    errors?: string[];
  };
  details?: any;
  content?: any;
  uuid?: string;
  created_at?: string;
}

interface Stats {
  totalWebhooks: number;
  activeDevices: number;
  successRate: number;
  avgProcessingTime: number;
  todayWebhooks: number;
  weeklyGrowth: number;
}

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDevice, setSelectedDevice] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<Record<string, 'payload' | 'raw' | 'decoded' | 'details' | ''>>({});
  const [limit, setLimit] = useState('100');
  const [dateRange, setDateRange] = useState<{ start: Date | undefined; end: Date | undefined }>({
    start: undefined,
    end: undefined
  });
  const [sortConfig, setSortConfig] = useState<{
    key: keyof WebhookData;
    direction: 'asc' | 'desc';
  } | null>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [deviceDialogOpen, setDeviceDialogOpen] = useState(false);
  const [newDeviceData, setNewDeviceData] = useState<{
    deviceId: string;
    deviceEUI: string;
    name: string;
    description: string;
    decoder: string;
    manufacturer: string;
    model: string;
    location: string;
    tags: string[];
    active: boolean;
  } | null>(null);

  const loadWebhooks = async () => {
    setLoading(true);
    try {
      // Bei Datumsauswahl mehr Daten laden (100 statt 20)
      const effectiveLimit = dateRange.start && dateRange.end ? '100' : limit;
      
      const params = new URLSearchParams({
        limit: effectiveLimit,
        ...(dateRange.start && dateRange.end && {
          startDate: dateRange.start.toISOString().split('T')[0],
          endDate: dateRange.end.toISOString().split('T')[0]
        })
      });
      
      console.log('Frontend API-Aufruf:', {
        effectiveLimit,
        dateRange: dateRange.start && dateRange.end ? `${dateRange.start.toISOString().split('T')[0]} bis ${dateRange.end.toISOString().split('T')[0]}` : 'kein Datum',
        params: params.toString()
      });
      
      const response = await fetch(`/api/webhooks?${params}`);
      const data = await response.json();
      
      if (data.success) {
        console.log('API-Antwort:', {
          success: data.success,
          count: data.count,
          dataLength: data.data?.length || 0,
          stats: data.stats
        });
        
        // Webhook-API lädt bereits die aktuellen Device-Daten automatisch
        setWebhooks(data.data || []);
        
        // Bei Datumsauswahl das Limit automatisch erhöhen
        if (dateRange.start && dateRange.end && data.data?.length > 0) {
          setLimit('100');
        }
      } else {
        setError('Fehler beim Laden der Webhook-Daten');
      }
    } catch (err) {
      setError('Fehler beim Laden der Webhook-Daten');
      console.error('Error loading webhooks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWebhooks();
  }, [limit, dateRange.start, dateRange.end]);





  const filteredWebhooks = webhooks.filter(webhook => {
    const deviceName = webhook.metadata?.deviceInfo?.name || webhook.deviceId || '';
    const deviceEUI = webhook.deviceEUI || '';
    const matchesSearch = searchTerm === '' || 
      deviceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deviceEUI.toLowerCase().includes(searchTerm.toLowerCase()) ||
      webhook.payload?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDevice = selectedDevice === 'all' || 
      webhook.deviceId === selectedDevice || 
      webhook.deviceEUI === selectedDevice;
    
    return matchesSearch && matchesDevice;
  });

  // Sortierung
  const sortedWebhooks = React.useMemo(() => {
    if (!sortConfig) return filteredWebhooks;

    return [...filteredWebhooks].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue === undefined || aValue === null) return 1;
      if (bValue === undefined || bValue === null) return -1;

      let comparison = 0;
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else {
        comparison = String(aValue).localeCompare(String(bValue));
      }

      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [filteredWebhooks, sortConfig]);

  const handleSort = (key: keyof WebhookData) => {
    setSortConfig(current => {
      if (current?.key === key) {
        if (current.direction === 'asc') {
          return { key, direction: 'desc' };
        } else {
          return null; // Entferne Sortierung beim dritten Klick
        }
      } else {
        return { key, direction: 'asc' };
      }
    });
  };



  const setActiveTabForWebhook = (webhookId: string, tab: 'payload' | 'raw' | 'decoded' | 'details' | '') => {
    setActiveTab(prev => ({
      ...prev,
      [webhookId]: tab
    }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const exportToCSV = () => {
    const headers = ['ID', 'Timestamp', 'Device ID', 'Device EUI', 'Payload', 'FPort', 'RSSI', 'SNR', 'Success', 'Processing Time'];
    const csvContent = [
      headers.join(','),
      ...filteredWebhooks.map(w => [
        w.id,
        w.timestamp,
        w.deviceId || '',
        w.deviceEUI || '',
        w.payload || '',
        w.fPort || '',
        w.rssi || '',
        w.snr || '',
        w.success ? 'true' : 'false',
        w.processingTime || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `webhooks_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('de-DE');
  };

  const getDeviceNames = () => {
    const deviceMap = new Map();
    
    // Sammle Device-Namen aus Webhooks
    webhooks.forEach(webhook => {
      const deviceId = webhook.deviceId;
      const deviceEUI = webhook.deviceEUI;
      const deviceName = webhook.metadata?.deviceInfo?.name || deviceId;
      
      if (deviceId && deviceId !== 'Unbekanntes Device') {
        deviceMap.set(deviceId, deviceName);
      }
      if (deviceEUI && deviceEUI !== 'Unbekannt') {
        deviceMap.set(deviceEUI, deviceName);
      }
    });
    
    // Füge auch lokale Devices hinzu
    devices.forEach(device => {
      if (device.deviceId) {
        deviceMap.set(device.deviceId, device.name || device.deviceId);
      }
      if (device.deviceEUI) {
        deviceMap.set(device.deviceEUI, device.name || device.deviceEUI);
      }
    });
    
    // Sortiere nach Namen
    return Array.from(deviceMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  // Prüfe ob ein Device bereits existiert (in lokaler DB oder in Webhooks)
  const deviceExists = (deviceEUI: string) => {
    if (!deviceEUI || deviceEUI === 'Unbekannt') return false;
    
    // Prüfe lokale Devices
    const existsInLocalDB = devices.some(device => 
      device.deviceEUI === deviceEUI || 
      device.deviceEUI === deviceEUI.toLowerCase() ||
      device.deviceId === deviceEUI
    );
    
    if (existsInLocalDB) return true;
    
    // Prüfe ob Device in Webhooks mit Device-Info existiert
    const existsInWebhooks = webhooks.some(webhook => 
      webhook.deviceEUI === deviceEUI && 
      webhook.metadata?.deviceInfo?.name && 
      webhook.metadata.deviceInfo.name !== deviceEUI
    );
    
    return existsInWebhooks;
  };

  // Erstelle Device-Daten aus Webhook
  const createDeviceFromWebhook = (webhook: WebhookData) => {
    const deviceEUI = webhook.deviceEUI || webhook.deviceId;
    if (!deviceEUI || deviceEUI === 'Unbekannt') return null;

    // Verwende bereits erkannte Device-Informationen falls verfügbar
    let deviceType = webhook.metadata?.deviceInfo?.name || 'Unknown';
    let manufacturer = webhook.metadata?.deviceInfo?.manufacturer || 'Unknown';
    let model = webhook.metadata?.deviceInfo?.model || 'Unknown';
    let decoder = webhook.metadata?.deviceInfo?.decoder || 'auto';

    // Fallback: Versuche Device-Typ aus Payload oder Details zu erkennen
    if (deviceType === 'Unknown') {
      if (webhook.details?.deviceType) {
        deviceType = webhook.details.deviceType;
      } else if (webhook.fPort === 6 || webhook.fPort === 10 || webhook.fPort === 99) {
        deviceType = 'Harvy2';
        manufacturer = 'deZem';
        model = 'Harvy2';
        decoder = 'harvy2';
      } else if (webhook.payload) {
        // Einfache Erkennung basierend auf Payload-Länge oder Inhalt
        if (webhook.payload.length > 20) {
          deviceType = 'Sensor';
        } else {
          deviceType = 'Simple Device';
        }
      }
    }

    // Versuche Standort zu extrahieren
    let location = 'Unknown';
    if (webhook.details?.deviceLocation?.lat && webhook.details?.deviceLocation?.lon) {
      const lat = Number(webhook.details.deviceLocation.lat);
      const lon = Number(webhook.details.deviceLocation.lon);
      if (!isNaN(lat) && !isNaN(lon)) {
        location = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
      }
    } else if (webhook.details?.gatewayLat && webhook.details?.gatewayLon) {
      const lat = Number(webhook.details.gatewayLat);
      const lon = Number(webhook.details.gatewayLon);
      if (!isNaN(lat) && !isNaN(lon)) {
        location = `Gateway: ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
      }
    }

    return {
      deviceId: deviceEUI,
      deviceEUI: deviceEUI,
      name: deviceType !== 'Unknown' ? deviceType : `${deviceType}_${deviceEUI.substring(0, 8)}`,
      description: `Auto-generated device from webhook data`,
      decoder: decoder,
      manufacturer: manufacturer,
      model: model,
      location: location,
      tags: ['auto-generated', 'webhook', deviceType.toLowerCase()],
      active: true
    };
  };

  // Öffne Device-Dialog mit vorausgefüllten Daten
  const openDeviceDialog = (webhook: WebhookData) => {
    const deviceData = createDeviceFromWebhook(webhook);
    if (deviceData) {
      setNewDeviceData(deviceData);
      setDeviceDialogOpen(true);
    }
  };

  // Erstelle Device automatisch
  const createDeviceAuto = async (webhook: WebhookData) => {
    const deviceData = createDeviceFromWebhook(webhook);
    if (!deviceData) return;

    try {
      const response = await fetch('/api/devices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(deviceData),
      });

      const result = await response.json();
      
      if (result.success) {
        // Lade Webhooks neu, um die Device-Informationen zu aktualisieren
        await loadWebhooks();
        alert(`Device "${deviceData.name}" erfolgreich angelegt!`);
      } else {
        alert(`Fehler beim Anlegen des Devices: ${result.error}`);
      }
    } catch (error) {
      console.error('Fehler beim Anlegen des Devices:', error);
      alert('Fehler beim Anlegen des Devices');
    }
  };

  // Hilfsfunktionen für die Darstellung der dekodierten Daten
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

  const formatDecodedData = (data: any): string => {
    if (typeof data === 'object') {
      return JSON.stringify(data, null, 2);
    }
    return String(data);
  };

  // RSSI Qualitätsbewertung
  const getRSSIQuality = (rssi: number): { quality: string; color: string } => {
    if (rssi >= -80) return { quality: 'Excellent', color: 'text-green-600' };
    if (rssi >= -100) return { quality: 'Good', color: 'text-yellow-600' };
    if (rssi >= -120) return { quality: 'Fair', color: 'text-orange-600' };
    return { quality: 'Poor', color: 'text-red-600' };
  };

  // SNR Qualitätsbewertung
  const getSNRQuality = (snr: number): { quality: string; color: string } => {
    if (snr >= 10) return { quality: 'Excellent', color: 'text-green-600' };
    if (snr >= 5) return { quality: 'Good', color: 'text-yellow-600' };
    if (snr >= 0) return { quality: 'Fair', color: 'text-orange-600' };
    return { quality: 'Poor', color: 'text-red-600' };
  };

  // Data Rate Mapping
  const getDataRate = (spFact: number): string => {
    const dataRates: Record<number, string> = {
      7: 'SF7 (125 kHz)',
      8: 'SF8 (125 kHz)',
      9: 'SF9 (125 kHz)',
      10: 'SF10 (125 kHz)',
      11: 'SF11 (125 kHz)',
      12: 'SF12 (125 kHz)'
    };
    return dataRates[spFact] || `SF${spFact}`;
  };

  // Geolocation Komponente
  const LocationMap = ({ lat, lon, deviceName, locationType }: { lat: number; lon: number; deviceName: string; locationType?: string }) => {
    // Sicherstellen, dass lat und lon als Zahlen behandelt werden
    const latitude = typeof lat === 'number' ? lat : parseFloat(String(lat));
    const longitude = typeof lon === 'number' ? lon : parseFloat(String(lon));
    
    // Prüfen ob die Werte gültige Zahlen sind
    if (isNaN(latitude) || isNaN(longitude)) {
      return (
        <div className="bg-muted/50 p-3 rounded-lg border">
          <div className="text-center py-4">
            <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Ungültige Koordinaten</p>
            <p className="text-xs text-muted-foreground mt-1">
              Die GPS-Koordinaten konnten nicht verarbeitet werden.
            </p>
          </div>
        </div>
      );
    }
    
    const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${longitude-0.01},${latitude-0.01},${longitude+0.01},${latitude+0.01}&layer=mapnik&marker=${latitude},${longitude}`;
    
    return (
      <div className="space-y-2">
        <div className="bg-muted rounded-md overflow-hidden">
          <iframe
            width="100%"
            height="200"
            frameBorder="0"
            scrolling="no"
            marginHeight={0}
            marginWidth={0}
            src={mapUrl}
            title={`Standort von ${deviceName}`}
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {latitude.toFixed(6)}, {longitude.toFixed(6)}
        </div>
      </div>
    );
  };

  // Strukturierte JSON Viewer Komponente
  const StructuredJSONViewer = ({ data }: { data: any }) => {
    const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

    const toggleKey = (key: string) => {
      const newExpanded = new Set(expandedKeys);
      if (newExpanded.has(key)) {
        newExpanded.delete(key);
      } else {
        newExpanded.add(key);
      }
      setExpandedKeys(newExpanded);
    };

    const renderValue = (value: any, key: string, level: number = 0): React.ReactElement => {
      const keyPath = key;
      const indent = '  '.repeat(level);

      if (value === null) {
        return <span className="text-gray-500">null</span>;
      }

      if (typeof value === 'undefined') {
        return <span className="text-gray-500">undefined</span>;
      }

      if (typeof value === 'boolean') {
        return <span className="text-green-600">{value.toString()}</span>;
      }

      if (typeof value === 'number') {
        return <span className="text-blue-600">{value}</span>;
      }

      if (typeof value === 'string') {
        // Prüfe ob es ein Datum ist
        if (key.toLowerCase().includes('time') || key.toLowerCase().includes('date')) {
          try {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
              return (
                <span className="text-purple-600">
                  "{value}" <span className="text-gray-500 text-xs">({date.toLocaleString('de-DE')})</span>
                </span>
              );
            }
          } catch (e) {
            // Fallback zu normalem String
          }
        }
        return <span className="text-purple-600">"{value}"</span>;
      }

      if (Array.isArray(value)) {
        const isExpanded = expandedKeys.has(keyPath);
        return (
          <div className="ml-4">
            <div className="flex items-center gap-1">
              <button
                onClick={() => toggleKey(keyPath)}
                className="text-gray-500 hover:text-gray-700 text-xs"
              >
                {isExpanded ? '▼' : '▶'}
              </button>
              <span className="text-gray-700">[</span>
              <span className="text-gray-500 text-xs">{value.length} items</span>
              {!isExpanded && <span className="text-gray-700">]</span>}
            </div>
            {isExpanded && (
              <div className="ml-4">
                {value.map((item, index) => (
                  <div key={index} className="flex items-start">
                    <span className="text-gray-500 text-xs mr-2">{index}:</span>
                    {renderValue(item, `${keyPath}[${index}]`, level + 1)}
                  </div>
                ))}
                <span className="text-gray-700">]</span>
              </div>
            )}
          </div>
        );
      }

      if (typeof value === 'object') {
        const isExpanded = expandedKeys.has(keyPath);
        const keys = Object.keys(value);
        
        return (
          <div className="ml-4">
            <div className="flex items-center gap-1">
              <button
                onClick={() => toggleKey(keyPath)}
                className="text-gray-500 hover:text-gray-700 text-xs"
              >
                {isExpanded ? '▼' : '▶'}
              </button>
              <span className="text-gray-700">{'{'}</span>
              <span className="text-gray-500 text-xs">{keys.length} properties</span>
              {!isExpanded && <span className="text-gray-700">{'}'}</span>}
            </div>
            {isExpanded && (
              <div className="ml-4">
                {keys.map((k) => (
                  <div key={k} className="flex items-start">
                    <span className="text-blue-800 font-medium text-xs mr-2">"{k}":</span>
                    {renderValue(value[k], `${keyPath}.${k}`, level + 1)}
                  </div>
                ))}
                <span className="text-gray-700">{'}'}</span>
              </div>
            )}
          </div>
        );
      }

      return <span className="text-gray-600">{String(value)}</span>;
    };

    return (
      <div className="text-xs font-mono whitespace-pre-wrap">
        {renderValue(data, 'root')}
      </div>
    );
  };

  // Einfache JSON Formatierung Komponente
  const SimpleJSONViewer = ({ data }: { data: any }) => {
    const formatJSON = (obj: any, indent: number = 0): string => {
      const spaces = '  '.repeat(indent);
      
      if (obj === null) return 'null';
      if (typeof obj === 'undefined') return 'undefined';
      if (typeof obj === 'boolean') return obj.toString();
      if (typeof obj === 'number') return obj.toString();
      if (typeof obj === 'string') return `"${obj}"`;
      
      if (Array.isArray(obj)) {
        if (obj.length === 0) return '[]';
        const items = obj.map(item => spaces + '  ' + formatJSON(item, indent + 1)).join(',\n');
        return `[\n${items}\n${spaces}]`;
      }
      
      if (typeof obj === 'object') {
        const keys = Object.keys(obj);
        if (keys.length === 0) return '{}';
        const items = keys.map(key => 
          `${spaces}  "${key}": ${formatJSON(obj[key], indent + 1)}`
        ).join(',\n');
        return `{\n${items}\n${spaces}}`;
      }
      
      return String(obj);
    };

    return (
      <pre className="text-xs font-mono whitespace-pre-wrap text-gray-800">
        {formatJSON(data)}
      </pre>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Lade Webhook-Daten...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Webhooks</h1>
          <p className="text-muted-foreground">
            Zentrale Verwaltung aller Webhook-Events, Statistiken und Historie
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadWebhooks} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Aktualisieren
          </Button>
          <Button onClick={exportToCSV} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            CSV Export
          </Button>
        </div>
      </div>

      {/* Kompakter Filter */}
      <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Device, EUI oder Payload suchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-9"
          />
        </div>
        
        <Select value={selectedDevice} onValueChange={setSelectedDevice}>
          <SelectTrigger className="w-48 h-9">
            <SelectValue placeholder="Alle Devices" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Devices</SelectItem>
            {getDeviceNames().map(device => (
              <SelectItem key={device.id} value={device.id}>
                <div className="flex flex-col">
                  <span className="font-medium">{device.name}</span>
                  <span className="text-xs text-gray-500 font-mono">{device.id}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DateRangePicker
          startDate={dateRange.start}
          endDate={dateRange.end}
          onDateRangeChange={(start, end) => setDateRange({ start, end })}
          placeholder="Zeitraum auswählen..."
        />
        
        <div className="text-xs text-muted-foreground">
          {sortedWebhooks.length} von {webhooks.length} Webhooks
          {dateRange.start && dateRange.end && (
            <span className="ml-2 text-green-600">
              • Historische Daten (Limit: {limit})
            </span>
          )}
          {!dateRange.start && !dateRange.end && (
            <span className="ml-2 text-blue-600">
              • Neueste Daten (Limit: {limit})
            </span>
          )}
          {sortConfig && (
            <span className="ml-2 text-blue-600">
              • Sortiert nach {sortConfig.key} ({sortConfig.direction})
            </span>
          )}
        </div>
      </div>

      {/* Webhook-Liste */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">
            Webhook-Events ({filteredWebhooks.length})
            {dateRange.start && dateRange.end && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                vom {dateRange.start.toLocaleDateString('de-DE')} bis {dateRange.end.toLocaleDateString('de-DE')}
              </span>
            )}
          </h2>
          {filteredWebhooks.length > 0 && (
            <div className="text-sm text-muted-foreground">
              {dateRange.start && dateRange.end ? (
                <div className="flex items-center gap-2">
                  <span>Historische Daten geladen</span>
                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                    {webhooks.length} Webhooks
                  </Badge>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span>Neueste Webhooks</span>
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                    Limit: {limit}
                  </Badge>
                </div>
              )}
            </div>
          )}
        </div>
        
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead 
                sortable 
                sortDirection={sortConfig?.key === 'deviceId' ? sortConfig.direction : false}
                onSort={() => handleSort('deviceId')}
              >
                Device Name
              </SortableTableHead>
              <SortableTableHead 
                sortable 
                sortDirection={sortConfig?.key === 'deviceEUI' ? sortConfig.direction : false}
                onSort={() => handleSort('deviceEUI')}
              >
                Device EUI
              </SortableTableHead>
              <SortableTableHead 
                sortable 
                sortDirection={sortConfig?.key === 'timestamp' ? sortConfig.direction : false}
                onSort={() => handleSort('timestamp')}
              >
                Timestamp
              </SortableTableHead>
              <SortableTableHead 
                sortable 
                sortDirection={sortConfig?.key === 'fPort' ? sortConfig.direction : false}
                onSort={() => handleSort('fPort')}
              >
                Port
              </SortableTableHead>

              <SortableTableHead 
                sortable 
                sortDirection={sortConfig?.key === 'payload' ? sortConfig.direction : false}
                onSort={() => handleSort('payload')}
              >
                Payload
              </SortableTableHead>
              <SortableTableHead 
                sortable 
                sortDirection={sortConfig?.key === 'success' ? sortConfig.direction : false}
                onSort={() => handleSort('success')}
              >
                Status
              </SortableTableHead>
              <SortableTableHead 
                sortable 
                sortDirection={sortConfig?.key === 'rssi' ? sortConfig.direction : false}
                onSort={() => handleSort('rssi')}
              >
                RSSI
              </SortableTableHead>
              <SortableTableHead 
                sortable 
                sortDirection={sortConfig?.key === 'snr' ? sortConfig.direction : false}
                onSort={() => handleSort('snr')}
              >
                SNR
              </SortableTableHead>
              <TableHead>SF</TableHead>
              <TableHead>Gateway</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedWebhooks.map((webhook) => {
              const rssiQuality = webhook.rssi ? getRSSIQuality(webhook.rssi) : null;
              const snrQuality = webhook.snr ? getSNRQuality(webhook.snr) : null;
              
              // Erweiterte Geolocation-Erkennung
              const hasGatewayLocation = webhook.details?.gatewayLat && webhook.details?.gatewayLon;
              const hasDeviceLocation = webhook.details?.deviceLocation?.lat && webhook.details?.deviceLocation?.lon;
              const hasLocation = hasGatewayLocation || hasDeviceLocation;
              
              // Bestimme welche Koordinaten verwendet werden sollen
              const locationData = hasDeviceLocation ? {
                lat: webhook.details.deviceLocation.lat,
                lon: webhook.details.deviceLocation.lon,
                type: 'Device Location'
              } : hasGatewayLocation ? {
                lat: webhook.details.gatewayLat,
                lon: webhook.details.gatewayLon,
                type: 'Gateway Location'
              } : null;
              
              return (
                <TableRow key={webhook.id} className="hover:bg-gray-50">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {webhook.metadata?.deviceInfo?.name || webhook.deviceId || 'Unbekanntes Device'}
                      </span>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        {webhook.metadata?.deviceInfo?.manufacturer && webhook.metadata?.deviceInfo?.model && (
                          <span className="font-mono">
                            {webhook.metadata.deviceInfo.manufacturer} {webhook.metadata.deviceInfo.model}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-mono text-sm">{webhook.deviceEUI || 'N/A'}</span>
                      {webhook.metadata?.deviceInfo?.name && webhook.metadata.deviceInfo.name !== webhook.deviceId && (
                        <span className="text-xs text-gray-500">
                          Name: {webhook.metadata.deviceInfo.name}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{formatTimestamp(webhook.timestamp)}</TableCell>
                  <TableCell className="text-sm">{webhook.fPort || 'N/A'}</TableCell>

                  <TableCell className="max-w-32 truncate font-mono text-xs">
                    {webhook.payload ? `${webhook.payload.substring(0, 20)}...` : 'N/A'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={webhook.success ? "default" : "destructive"} className="text-xs">
                      {webhook.success ? '✓ Erfolgreich' : '✗ Fehler'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className={`text-sm font-bold ${rssiQuality?.color || 'text-gray-600'}`}>
                        {webhook.rssi ? `${Number(webhook.rssi).toFixed(2)}` : 'N/A'} dBm
                      </span>
                      <span className="text-xs text-gray-500">{rssiQuality?.quality || 'N/A'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className={`text-sm font-bold ${snrQuality?.color || 'text-gray-600'}`}>
                        {webhook.snr ? `${Number(webhook.snr).toFixed(2)}` : 'N/A'} dB
                      </span>
                      <span className="text-xs text-gray-500">{snrQuality?.quality || 'N/A'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-gray-600">
                        {webhook.details?.spFact || 'N/A'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {webhook.details?.spFact ? getDataRate(webhook.details.spFact) : 'N/A'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs truncate max-w-20">
                    {webhook.gatewayId || 'N/A'}
                  </TableCell>
                  <TableCell>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 hover:bg-gray-100"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <div className="flex items-center justify-between">
                            <DialogTitle>Webhook Details: {webhook.deviceId || 'Unknown Device'}</DialogTitle>
                            {webhook.deviceEUI && !deviceExists(webhook.deviceEUI) && (
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => createDeviceAuto(webhook)}
                                  className="text-xs"
                                >
                                  <Smartphone className="h-3 w-3 mr-1" />
                                  Device anlegen
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openDeviceDialog(webhook)}
                                  className="text-xs"
                                >
                                  <Code className="h-3 w-3 mr-1" />
                                  Bearbeiten
                                </Button>
                              </div>
                            )}
                            {webhook.deviceEUI && deviceExists(webhook.deviceEUI) && (
                              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Device existiert
                              </Badge>
                            )}
                          </div>
                        </DialogHeader>
                        <div className="space-y-6">
                          {/* Payload Section */}
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <FileText className="h-5 w-5 text-blue-600" />
                                <span className="font-semibold text-gray-900">Payload</span>
                                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                  {webhook.payload?.length || 0} Bytes
                                </Badge>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(webhook.payload || '')}
                                className="h-8 w-8 p-0 hover:bg-blue-50"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="bg-white p-4 rounded-lg border border-gray-200">
                              <code className="text-sm break-all text-gray-800 font-mono block">
                                {webhook.payload || 'Kein Payload verfügbar'}
                              </code>
                            </div>
                          </div>

                          {/* Raw Data Section */}
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Code className="h-5 w-5 text-green-600" />
                                <span className="font-semibold text-gray-900">Rohdaten</span>
                                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                  JSON
                                </Badge>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(JSON.stringify(webhook.content || webhook, null, 2))}
                                className="h-8 w-8 p-0 hover:bg-green-50"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="bg-white p-4 rounded-lg border border-gray-200 max-h-64 overflow-y-auto">
                              <pre className="text-sm font-mono text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
                                {(() => {
                                  try {
                                    if (typeof webhook.content === 'object' && webhook.content !== null) {
                                      return JSON.stringify(webhook.content, null, 2);
                                    }
                                    if (typeof webhook.content === 'string') {
                                      const parsed = JSON.parse(webhook.content);
                                      return JSON.stringify(parsed, null, 2);
                                    }
                                    return JSON.stringify(webhook, null, 2);
                                  } catch (error) {
                                    return webhook.content || JSON.stringify(webhook, null, 2);
                                  }
                                })()}
                              </pre>
                            </div>
                          </div>

                          {/* Decoded Data Section */}
                          {webhook.decodedData && (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <CheckCircle2 className="h-5 w-5 text-purple-600" />
                                  <span className="font-semibold text-gray-900">Dekodierte Daten</span>
                                  <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                                    Decoded
                                  </Badge>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyToClipboard(JSON.stringify(webhook.decodedData, null, 2))}
                                  className="h-8 w-8 p-0 hover:bg-purple-50"
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="bg-white p-4 rounded-lg border border-gray-200">
                                {typeof webhook.decodedData === 'object' && !Array.isArray(webhook.decodedData) ? (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {Object.entries(webhook.decodedData).map(([key, value]) => (
                                      <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                                        <span className="font-medium text-sm text-gray-700">{key}:</span>
                                        <div className="flex items-center gap-2">
                                          <span className={`text-sm font-medium ${getValueColor(getValueType(value))}`}>
                                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                          </span>
                                          <Badge variant="outline" className="text-xs bg-gray-100 text-gray-600">
                                            {getValueType(value)}
                                          </Badge>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="font-mono text-sm">
                                    {formatDecodedData(webhook.decodedData)}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* LoRaWAN Details Section */}
                          {webhook.details && (
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <Activity className="h-5 w-5 text-orange-600" />
                                <span className="font-semibold text-gray-900">LoRaWAN Details</span>
                                <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                                  Technical
                                </Badge>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white p-4 rounded-lg border border-gray-200">
                                  <h4 className="font-semibold mb-3 text-sm text-gray-900 flex items-center gap-2">
                                    <Activity className="h-4 w-4" />
                                    LoRaWAN Parameter
                                  </h4>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex justify-between"><span className="font-medium text-gray-700">Frequenz:</span> <span className="text-gray-900">{webhook.details.frequency} MHz</span></div>
                                    <div className="flex justify-between"><span className="font-medium text-gray-700">TX Power:</span> <span className="text-gray-900">{webhook.details.txPower} dBm</span></div>
                                    <div className="flex justify-between"><span className="font-medium text-gray-700">Spreading Factor:</span> <span className="text-gray-900">{webhook.details.spFact}</span></div>
                                    <div className="flex justify-between"><span className="font-medium text-gray-700">DevAddr:</span> <span className="text-gray-900 font-mono text-xs">{webhook.details.devAddr}</span></div>
                                    <div className="flex justify-between"><span className="font-medium text-gray-700">FCnt Up:</span> <span className="text-gray-900">{webhook.details.fCntUp}</span></div>
                                    <div className="flex justify-between"><span className="font-medium text-gray-700">Message Type:</span> <span className="text-gray-900">{webhook.details.mType}</span></div>
                                  </div>
                                </div>
                                
                                <div className="bg-white p-4 rounded-lg border border-gray-200">
                                  <h4 className="font-semibold mb-3 text-sm text-gray-900 flex items-center gap-2">
                                    <BarChart3 className="h-4 w-4" />
                                    Performance
                                  </h4>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex justify-between"><span className="font-medium text-gray-700">Instant PER:</span> <span className="text-gray-900">{webhook.details.instantPER}</span></div>
                                    <div className="flex justify-between"><span className="font-medium text-gray-700">Mean PER:</span> <span className="text-gray-900">{webhook.details.meanPER}</span></div>
                                    <div className="flex justify-between"><span className="font-medium text-gray-700">Lost Uplinks:</span> <span className="text-gray-900">{webhook.details.lostUplinksAS}</span></div>
                                    <div className="flex justify-between"><span className="font-medium text-gray-700">Device Type:</span> <span className="text-gray-900">{webhook.details.deviceType}</span></div>
                                    <div className="flex justify-between"><span className="font-medium text-gray-700">Processing Time:</span> <span className="text-gray-900">{webhook.processingTime}ms</span></div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Geolocation Map */}
                          {hasLocation && (
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <MapPin className="h-5 w-5 text-red-600" />
                                <span className="font-semibold text-gray-900">Standort</span>
                                {locationData?.type && (
                                  <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                                    {locationData.type}
                                  </Badge>
                                )}
                              </div>
                              <LocationMap 
                                lat={locationData?.lat || 0} 
                                lon={locationData?.lon || 0}
                                deviceName={webhook.deviceId || 'Unknown Device'}
                                locationType={locationData?.type}
                              />
                            </div>
                          )}

                          {/* Error Messages */}
                          {(webhook.details?.payloadDecodedError || (webhook.metadata?.warnings && webhook.metadata.warnings.length > 0) || (webhook.metadata?.errors && webhook.metadata.errors.length > 0)) && (
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <AlertCircle className="h-5 w-5 text-yellow-600" />
                                <span className="font-semibold text-gray-900">Warnungen & Fehler</span>
                              </div>
                              
                              {webhook.details?.payloadDecodedError && !webhook.decodedData && (
                                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                                  <h4 className="font-semibold mb-2 text-sm text-red-900">Dekodierungsfehler</h4>
                                  <div className="text-sm space-y-1">
                                    <div className="flex justify-between"><span className="font-medium text-gray-700">Code:</span> <span className="text-gray-900">{webhook.details.payloadDecodedError.code}</span></div>
                                    <div className="flex justify-between"><span className="font-medium text-gray-700">Message:</span> <span className="text-gray-900">{webhook.details.payloadDecodedError.message}</span></div>
                                  </div>
                                </div>
                              )}

                              {webhook.metadata?.warnings && webhook.metadata.warnings.length > 0 && (
                                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                                  <h4 className="font-semibold mb-2 text-sm text-yellow-900">Decoder-Warnungen</h4>
                                  <div className="text-sm">
                                    {webhook.metadata.warnings.map((warning, index) => (
                                      <div key={index} className="text-yellow-800 flex items-start gap-2">
                                        <span className="text-yellow-600 mt-1">•</span>
                                        <span>{warning || 'Unbekannte Warnung'}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {webhook.metadata?.errors && webhook.metadata.errors.length > 0 && (
                                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                                  <h4 className="font-semibold mb-2 text-sm text-red-900">Decoder-Fehler</h4>
                                  <div className="text-sm">
                                    {webhook.metadata.errors.map((error, index) => (
                                      <div key={index} className="text-red-800 flex items-start gap-2">
                                        <span className="text-red-600 mt-1">•</span>
                                        <span>{error || 'Unbekannter Fehler'}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Device Anlegen Dialog */}
      <Dialog open={deviceDialogOpen} onOpenChange={setDeviceDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Device anlegen</DialogTitle>
          </DialogHeader>
          {newDeviceData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="deviceId">Device ID</Label>
                  <Input
                    id="deviceId"
                    value={newDeviceData.deviceId}
                    onChange={(e) => setNewDeviceData(prev => prev ? { ...prev, deviceId: e.target.value } : null)}
                  />
                </div>
                <div>
                  <Label htmlFor="deviceEUI">Device EUI</Label>
                  <Input
                    id="deviceEUI"
                    value={newDeviceData.deviceEUI}
                    onChange={(e) => setNewDeviceData(prev => prev ? { ...prev, deviceEUI: e.target.value } : null)}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={newDeviceData.name}
                  onChange={(e) => setNewDeviceData(prev => prev ? { ...prev, name: e.target.value } : null)}
                />
              </div>
              
              <div>
                <Label htmlFor="description">Beschreibung</Label>
                <Input
                  id="description"
                  value={newDeviceData.description}
                  onChange={(e) => setNewDeviceData(prev => prev ? { ...prev, description: e.target.value } : null)}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="manufacturer">Hersteller</Label>
                  <Input
                    id="manufacturer"
                    value={newDeviceData.manufacturer}
                    onChange={(e) => setNewDeviceData(prev => prev ? { ...prev, manufacturer: e.target.value } : null)}
                  />
                </div>
                <div>
                  <Label htmlFor="model">Modell</Label>
                  <Input
                    id="model"
                    value={newDeviceData.model}
                    onChange={(e) => setNewDeviceData(prev => prev ? { ...prev, model: e.target.value } : null)}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="location">Standort</Label>
                <Input
                  id="location"
                  value={newDeviceData.location}
                  onChange={(e) => setNewDeviceData(prev => prev ? { ...prev, location: e.target.value } : null)}
                />
              </div>
              
              <div>
                <Label htmlFor="decoder">Decoder</Label>
                <DecoderSelect
                  decoders={[
                    {
                      id: 'auto',
                      name: 'Automatische Erkennung',
                      description: 'Versucht automatisch den passenden Decoder zu erkennen',
                      manufacturer: 'LineMetrics',
                      model: 'Auto-Detection',
                      repository: 'builtin'
                    },
                    {
                      id: 'h200',
                      name: 'H200 Wasserzähler',
                      description: 'RCM H200 Wasserzähler-Decoder für Wasser, Warmwasser und Gas',
                      manufacturer: 'RCM',
                      model: 'H200',
                      repository: 'builtin'
                    },
                    {
                      id: 'integra-topas-sonic',
                      name: 'Topas Sonic DN25',
                      description: 'INTEGRA Topas Sonic DN25 L175 Wasserzähler-Decoder',
                      manufacturer: 'INTEGRA',
                      model: 'Topas Sonic DN25 L175',
                      repository: 'builtin'
                    },
                    {
                      id: 'harvy2',
                      name: 'Harvy2 (deZem)',
                      description: 'deZem Harvy2 Strom- und Spannungsmessgerät für Port 6, 10 und 99',
                      manufacturer: 'deZem',
                      model: 'Harvy2',
                      repository: 'builtin'
                    }
                  ]}
                  value={newDeviceData.decoder}
                  onValueChange={(value) => setNewDeviceData(prev => prev ? { ...prev, decoder: value } : null)}
                  placeholder="Decoder auswählen"
                />
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setDeviceDialogOpen(false)}
                >
                  Abbrechen
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/devices', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(newDeviceData),
                      });

                      const result = await response.json();
                      
                      if (result.success) {
                        setDevices(prev => [...prev, result.data]);
                        setDeviceDialogOpen(false);
                        alert(`Device "${newDeviceData.name}" erfolgreich angelegt!`);
                      } else {
                        alert(`Fehler beim Anlegen des Devices: ${result.error}`);
                      }
                    } catch (error) {
                      console.error('Fehler beim Anlegen des Devices:', error);
                      alert('Fehler beim Anlegen des Devices');
                    }
                  }}
                >
                  Device anlegen
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
} 