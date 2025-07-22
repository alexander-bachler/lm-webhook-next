'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { DecoderSelect } from '@/components/ui/decoder-select';
import { LineMetricsConfig } from '@/components/ui/line-metrics-config';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Eye,
  Activity,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Code
} from 'lucide-react';

interface Device {
  deviceId: string;
  deviceEUI?: string;
  name: string;
  description?: string;
  decoder: string;
  manufacturer?: string;
  model?: string;
  location?: string;
  tags?: string[];
  active: boolean;
  lastActivity?: string;
  createdAt: string;
  updatedAt: string;
  // LineMetrics Integration
  lineMetrics?: {
    enabled: boolean;
    apiKey?: string;
    projectId?: string;
    dataPoints?: {
      [key: string]: string; // decoder field -> LineMetrics data point ID
    };
  };
}

interface Decoder {
  id: string;
  name: string;
  description: string;
  manufacturer: string;
  model: string;
  image?: string;
  repository: string;
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [filteredDevices, setFilteredDevices] = useState<Device[]>([]);
  const [availableDecoders, setAvailableDecoders] = useState<Decoder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    deviceId: '',
    deviceEUI: '',
    name: '',
    description: '',
    decoder: 'auto',
    manufacturer: '',
    model: '',
    location: '',
    tags: [] as string[],
    // LineMetrics Integration
    lineMetrics: {
      enabled: false,
      apiKey: '',
      projectId: '',
      dataPoints: {} as { [key: string]: string }
    }
  });

  const loadDevices = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/devices');
      const data = await response.json();
      
      if (data.success) {
        setDevices(data.data || []);
        setFilteredDevices(data.data || []);
      } else {
        setError('Fehler beim Laden der Devices');
      }
    } catch (err) {
      setError('Fehler beim Laden der Devices');
      console.error('Error loading devices:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDecoders = async () => {
    try {
      const response = await fetch('/api/devices/decoders');
      const data = await response.json();
      
      if (data.success) {
        setAvailableDecoders(data.data || []);
      } else {
        console.error('Fehler beim Laden der Decoder:', data.error);
      }
    } catch (err) {
      console.error('Error loading decoders:', err);
    }
  };

  useEffect(() => {
    loadDevices();
    loadDecoders();
  }, []);

  useEffect(() => {
    let filtered = devices;
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(device =>
        device.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        device.deviceId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        device.deviceEUI?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        device.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply status filter
    if (statusFilter === 'active') {
      filtered = filtered.filter(device => device.active);
    } else if (statusFilter === 'inactive') {
      filtered = filtered.filter(device => !device.active);
    }
    
    setFilteredDevices(filtered);
  }, [devices, searchTerm, statusFilter]);

  const handleCreateDevice = async () => {
    try {
      const response = await fetch('/api/devices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setIsCreateDialogOpen(false);
        setFormData({
          deviceId: '',
          deviceEUI: '',
          name: '',
          description: '',
          decoder: 'auto',
          manufacturer: '',
          model: '',
          location: '',
          tags: [],
          lineMetrics: {
            enabled: false,
            apiKey: '',
            projectId: '',
            dataPoints: {}
          }
        });
        loadDevices();
      } else {
        setError(data.error || 'Fehler beim Erstellen des Devices');
      }
    } catch (err) {
      setError('Fehler beim Erstellen des Devices');
      console.error('Error creating device:', err);
    }
  };

  const handleUpdateDevice = async () => {
    if (!selectedDevice) return;
    
    try {
      const response = await fetch('/api/devices', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setIsEditDialogOpen(false);
        setSelectedDevice(null);
        setFormData({
          deviceId: '',
          deviceEUI: '',
          name: '',
          description: '',
          decoder: 'auto',
          manufacturer: '',
          model: '',
          location: '',
          tags: [],
          lineMetrics: {
            enabled: false,
            apiKey: '',
            projectId: '',
            dataPoints: {}
          }
        });
        loadDevices();
      } else {
        setError(data.error || 'Fehler beim Aktualisieren des Devices');
      }
    } catch (err) {
      setError('Fehler beim Aktualisieren des Devices');
      console.error('Error updating device:', err);
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    if (!confirm('Möchten Sie dieses Device wirklich löschen?')) return;
    
    try {
      const response = await fetch(`/api/devices?deviceId=${deviceId}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (data.success) {
        loadDevices();
      } else {
        setError(data.error || 'Fehler beim Löschen des Devices');
      }
    } catch (err) {
      setError('Fehler beim Löschen des Devices');
      console.error('Error deleting device:', err);
    }
  };

  const openEditDialog = (device: Device) => {
    setSelectedDevice(device);
    setFormData({
      deviceId: device.deviceId,
      deviceEUI: device.deviceEUI || '',
      name: device.name,
      description: device.description || '',
      decoder: device.decoder,
      manufacturer: device.manufacturer || '',
      model: device.model || '',
      location: device.location || '',
      tags: device.tags || [],
      lineMetrics: {
        enabled: device.lineMetrics?.enabled || false,
        apiKey: device.lineMetrics?.apiKey || '',
        projectId: device.lineMetrics?.projectId || '',
        dataPoints: device.lineMetrics?.dataPoints || {}
      }
    });
    setIsEditDialogOpen(true);
  };

  const getStatusBadge = (active: boolean) => {
    return (
      <Badge variant={active ? "default" : "secondary"} className="text-xs">
        {active ? (
          <>
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Aktiv
          </>
        ) : (
          <>
            <WifiOff className="h-3 w-3 mr-1" />
            Inaktiv
          </>
        )}
      </Badge>
    );
  };

  const getActivityIcon = (active: boolean, lastActivity?: string) => {
    if (!active) {
      return <WifiOff className="h-4 w-4 text-muted-foreground" />;
    }
    
    if (!lastActivity) {
      return <Activity className="h-4 w-4 text-yellow-500" />;
    }
    
    const lastSeen = new Date(lastActivity);
    const now = new Date();
    const diffHours = (now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60);
    
    if (diffHours < 1) {
      return <Activity className="h-4 w-4 text-green-500" />;
    } else if (diffHours < 24) {
      return <Activity className="h-4 w-4 text-yellow-500" />;
    } else {
      return <Activity className="h-4 w-4 text-red-500" />;
    }
  };

  const getDecoderInfo = (decoderId: string) => {
    const decoder = availableDecoders.find(d => d.id === decoderId);
    return decoder || { name: decoderId, description: 'Unbekannter Decoder' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Lade Devices...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Device-Management</h1>
          <p className="text-muted-foreground">
            Verwalte deine LoRaWAN-Devices und deren Konfiguration
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Neues Device
        </Button>
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Neues Device erstellen</DialogTitle>
            <DialogDescription>
              Erstelle ein neues LoRaWAN-Device mit Decoder-Konfiguration.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="deviceId" className="text-right">
                Device ID
              </Label>
              <Input
                id="deviceId"
                value={formData.deviceId}
                onChange={(e) => setFormData({...formData, deviceId: e.target.value})}
                className="col-span-3"
                placeholder="device-001"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="deviceEUI" className="text-right">
                Device EUI
              </Label>
              <Input
                id="deviceEUI"
                value={formData.deviceEUI}
                onChange={(e) => setFormData({...formData, deviceEUI: e.target.value})}
                className="col-span-3"
                placeholder="A8404194A1835E9F"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="col-span-3"
                placeholder="Temperatursensor 1"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">
                Beschreibung
              </Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="col-span-3"
                placeholder="Temperatursensor im Keller"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="decoder" className="text-right">
                Decoder
              </Label>
              <DecoderSelect
                decoders={availableDecoders}
                value={formData.decoder}
                onValueChange={(value) => setFormData({...formData, decoder: value})}
                placeholder="Decoder auswählen"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="manufacturer" className="text-right">
                Hersteller
              </Label>
              <Input
                id="manufacturer"
                value={formData.manufacturer}
                onChange={(e) => setFormData({...formData, manufacturer: e.target.value})}
                className="col-span-3"
                placeholder="Hersteller"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="model" className="text-right">
                Modell
              </Label>
              <Input
                id="model"
                value={formData.model}
                onChange={(e) => setFormData({...formData, model: e.target.value})}
                className="col-span-3"
                placeholder="Modell"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="location" className="text-right">
                Standort
              </Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({...formData, location: e.target.value})}
                className="col-span-3"
                placeholder="Standort"
              />
            </div>
            
            {/* LineMetrics Configuration */}
            <div className="mt-6">
              <LineMetricsConfig
                enabled={formData.lineMetrics.enabled}
                apiKey={formData.lineMetrics.apiKey}
                projectId={formData.lineMetrics.projectId}
                dataPoints={formData.lineMetrics.dataPoints}
                decoder={formData.decoder}
                onConfigChange={(config) => setFormData({
                  ...formData,
                  lineMetrics: config
                })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleCreateDevice}>Device erstellen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Devices durchsuchen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Devices</SelectItem>
                <SelectItem value="active">Nur aktive</SelectItem>
                <SelectItem value="inactive">Nur inaktive</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={loadDevices}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-2 py-4">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span className="text-red-700">{error}</span>
            <Button variant="ghost" size="sm" onClick={() => setError(null)}>
              ×
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Devices Grid */}
      {filteredDevices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Activity className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Keine Devices gefunden</h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchTerm || statusFilter !== 'all' 
                ? 'Keine Devices entsprechen den aktuellen Filtern.'
                : 'Du hast noch keine Devices erstellt.'
              }
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Erstes Device erstellen
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredDevices.map((device) => {
            const decoderInfo = getDecoderInfo(device.decoder);
            return (
              <Card key={device.deviceId} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{device.name}</CardTitle>
                      <CardDescription className="text-sm">
                        {device.deviceId}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-1">
                      {getActivityIcon(device.active, device.lastActivity)}
                      {getStatusBadge(device.active)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {device.description && (
                    <p className="text-sm text-muted-foreground">
                      {device.description}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Decoder:</span>
                    <div className="flex items-center gap-2">
                      <Code className="h-3 w-3 text-muted-foreground" />
                      <Badge variant="outline" className="text-xs">
                        {decoderInfo.name}
                      </Badge>
                    </div>
                  </div>
                  
                  {decoderInfo.description && (
                    <div className="text-xs text-muted-foreground">
                      {decoderInfo.description}
                    </div>
                  )}
                  
                  {device.manufacturer && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Hersteller:</span>
                      <span>{device.manufacturer}</span>
                    </div>
                  )}
                  
                  {device.lastActivity && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Letzte Aktivität:</span>
                      <span>{new Date(device.lastActivity).toLocaleString('de-DE')}</span>
                    </div>
                  )}
                  
                  <Separator />
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {device.tags?.map((tag, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(device)}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteDevice(device.deviceId)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Device bearbeiten</DialogTitle>
            <DialogDescription>
              Bearbeite die Einstellungen für {selectedDevice?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-deviceId" className="text-right">
                Device ID
              </Label>
              <Input
                id="edit-deviceId"
                value={formData.deviceId}
                onChange={(e) => setFormData({...formData, deviceId: e.target.value})}
                className="col-span-3"
                placeholder="device-001"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-deviceEUI" className="text-right">
                Device EUI
              </Label>
              <Input
                id="edit-deviceEUI"
                value={formData.deviceEUI}
                onChange={(e) => setFormData({...formData, deviceEUI: e.target.value})}
                className="col-span-3"
                placeholder="A8404194A1835E9F"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-name" className="text-right">
                Name
              </Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="col-span-3"
                placeholder="Temperatursensor 1"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-description" className="text-right">
                Beschreibung
              </Label>
              <Input
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="col-span-3"
                placeholder="Temperatursensor im Keller"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-decoder" className="text-right">
                Decoder
              </Label>
              <Select value={formData.decoder} onValueChange={(value) => setFormData({...formData, decoder: value})}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Decoder auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {availableDecoders.map((decoder) => (
                    <SelectItem key={decoder.id} value={decoder.id}>
                      <div className="flex items-center gap-2">
                        <Code className="h-3 w-3" />
                        <div>
                          <div className="font-medium">{decoder.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {decoder.manufacturer} {decoder.model}
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-manufacturer" className="text-right">
                Hersteller
              </Label>
              <Input
                id="edit-manufacturer"
                value={formData.manufacturer}
                onChange={(e) => setFormData({...formData, manufacturer: e.target.value})}
                className="col-span-3"
                placeholder="Hersteller"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-model" className="text-right">
                Modell
              </Label>
              <Input
                id="edit-model"
                value={formData.model}
                onChange={(e) => setFormData({...formData, model: e.target.value})}
                className="col-span-3"
                placeholder="Modell"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-location" className="text-right">
                Standort
              </Label>
              <Input
                id="edit-location"
                value={formData.location}
                onChange={(e) => setFormData({...formData, location: e.target.value})}
                className="col-span-3"
                placeholder="Standort"
              />
            </div>
            {/* LineMetrics Konfiguration */}
            <div className="mt-6">
              <LineMetricsConfig
                enabled={formData.lineMetrics.enabled}
                apiKey={formData.lineMetrics.apiKey}
                projectId={formData.lineMetrics.projectId}
                dataPoints={formData.lineMetrics.dataPoints}
                decoder={formData.decoder}
                onConfigChange={(config) => setFormData({
                  ...formData,
                  lineMetrics: config
                })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleUpdateDevice}>Änderungen speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 