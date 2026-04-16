'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { LineMetricsConfig } from '@/components/ui/line-metrics-config';
import { HistoricalPush } from '@/components/ui/historical-push';
import { DevicesAdminGrid } from '@/components/devices/DevicesAdminGrid';
import { Plus, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

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
    clientId?: string;
    clientSecret?: string;
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
  const [decoders, setDecoders] = useState<Decoder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
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
      clientId: '',
      clientSecret: '',
      projectId: '',
      dataPoints: {} as { [key: string]: string }
    }
  });

  const loadDevices = async () => {
    try {
      const response = await fetch('/api/devices');
      const data = await response.json();
      
      if (data.success) {
        setDevices(data.data);
      } else {
        setError(data.error || 'Fehler beim Laden der Devices');
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
        setDecoders(data.data);
      }
    } catch (err) {
      console.error('Error loading decoders:', err);
    }
  };

  useEffect(() => {
    loadDevices();
    loadDecoders();
  }, []);

  const handleCreateDevice = async () => {
    try {
      const response = await fetch('/api/devices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData
        }),
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
            clientId: '',
            clientSecret: '',
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
            clientId: '',
            clientSecret: '',
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
        clientId: device.lineMetrics?.clientId || '',
        clientSecret: device.lineMetrics?.clientSecret || '',
        projectId: device.lineMetrics?.projectId || '',
        dataPoints: device.lineMetrics?.dataPoints || {}
      }
    });
    setIsEditDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Lade Devices...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Devices</h1>
          <p className="text-gray-600">Verwalten Sie Ihre LoRaWAN-Geräte und deren Konfiguration</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Device hinzufügen
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          <span className="text-red-700">{error}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setError(null)}
            className="ml-auto"
          >
            Schließen
          </Button>
        </div>
      )}

      {/* Success Message */}
      {!error && devices.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center">
          <CheckCircle2 className="h-5 w-5 text-green-500 mr-2" />
          <span className="text-green-700">Keine Devices gefunden. Erstellen Sie Ihr erstes Device.</span>
        </div>
      )}

      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Device directory</h2>
        <p className="text-sm text-muted-foreground">
          Search, export/import JSON, and edit LineMetrics from the dialog.
        </p>
        <DevicesAdminGrid
          onEdit={(row) =>
            openEditDialog({
              deviceId: row.deviceId,
              deviceEUI: row.deviceEUI,
              name: row.name,
              description: row.description ?? '',
              decoder: row.decoder,
              manufacturer: row.manufacturer ?? '',
              model: row.model ?? '',
              location: row.location ?? '',
              tags: row.tags ?? [],
              active: row.active,
              lastActivity: row.lastActivity,
              createdAt: row.createdAt,
              updatedAt: row.updatedAt,
              lineMetrics: row.lineMetrics ?? {
                enabled: false,
                clientId: '',
                clientSecret: '',
                projectId: '',
                dataPoints: {},
              },
            })
          }
        />
      </div>

      {/* Create Device Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Neues Device erstellen</DialogTitle>
            <DialogDescription>
              Erstellen Sie ein neues LoRaWAN-Device mit Decoder-Konfiguration.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Basic Device Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="deviceId">Device ID *</Label>
                <Input
                  id="deviceId"
                  value={formData.deviceId}
                  onChange={(e) => setFormData({...formData, deviceId: e.target.value})}
                  placeholder="Eindeutige Device-ID"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="deviceEUI">Device EUI</Label>
                <Input
                  id="deviceEUI"
                  value={formData.deviceEUI}
                  onChange={(e) => setFormData({...formData, deviceEUI: e.target.value})}
                  placeholder="Device EUI (optional)"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="Device-Name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Beschreibung</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Optionale Beschreibung"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="manufacturer">Hersteller</Label>
                <Input
                  id="manufacturer"
                  value={formData.manufacturer}
                  onChange={(e) => setFormData({...formData, manufacturer: e.target.value})}
                  placeholder="Hersteller"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="model">Modell</Label>
                <Input
                  id="model"
                  value={formData.model}
                  onChange={(e) => setFormData({...formData, model: e.target.value})}
                  placeholder="Modell"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="location">Standort</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                  placeholder="Standort"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="decoder">Decoder</Label>
              <Select value={formData.decoder} onValueChange={(value) => setFormData({...formData, decoder: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Decoder auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {decoders.map((decoder) => (
                    <SelectItem key={decoder.id} value={decoder.id}>
                      {decoder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* LineMetrics Configuration */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">LineMetrics Integration</Label>
                <Switch
                  checked={formData.lineMetrics.enabled}
                  onCheckedChange={(checked) => 
                    setFormData({
                      ...formData, 
                      lineMetrics: { ...formData.lineMetrics, enabled: checked }
                    })
                  }
                />
              </div>
              
              {formData.lineMetrics.enabled && (
                <LineMetricsConfig
                  enabled={formData.lineMetrics.enabled}
                  clientId={formData.lineMetrics.clientId}
                  clientSecret={formData.lineMetrics.clientSecret}
                  projectId={formData.lineMetrics.projectId}
                  dataPoints={formData.lineMetrics.dataPoints}
                  decoder={formData.decoder}
                  onConfigChange={(config) => 
                    setFormData({
                      ...formData, 
                      lineMetrics: config
                    })
                  }
                />
              )}
            </div>

            {/* Historical Push */}
            <div className="mt-6">
              <HistoricalPush
                deviceId={formData.deviceId}
                deviceName={formData.name}
                deviceEUI={formData.deviceEUI}
                lineMetricsEnabled={formData.lineMetrics.enabled}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleCreateDevice} disabled={!formData.deviceId || !formData.name}>
              Device erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Device Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Device bearbeiten</DialogTitle>
            <DialogDescription>
              Bearbeiten Sie die Konfiguration des ausgewählten Devices.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Basic Device Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editDeviceId">Device ID *</Label>
                <Input
                  id="editDeviceId"
                  value={formData.deviceId}
                  onChange={(e) => setFormData({...formData, deviceId: e.target.value})}
                  placeholder="Eindeutige Device-ID"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="editDeviceEUI">Device EUI</Label>
                <Input
                  id="editDeviceEUI"
                  value={formData.deviceEUI}
                  onChange={(e) => setFormData({...formData, deviceEUI: e.target.value})}
                  placeholder="Device EUI (optional)"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="editName">Name *</Label>
              <Input
                id="editName"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="Device-Name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editDescription">Beschreibung</Label>
              <Textarea
                id="editDescription"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Optionale Beschreibung"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editManufacturer">Hersteller</Label>
                <Input
                  id="editManufacturer"
                  value={formData.manufacturer}
                  onChange={(e) => setFormData({...formData, manufacturer: e.target.value})}
                  placeholder="Hersteller"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="editModel">Modell</Label>
                <Input
                  id="editModel"
                  value={formData.model}
                  onChange={(e) => setFormData({...formData, model: e.target.value})}
                  placeholder="Modell"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="editLocation">Standort</Label>
                <Input
                  id="editLocation"
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                  placeholder="Standort"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="editDecoder">Decoder</Label>
              <Select value={formData.decoder} onValueChange={(value) => setFormData({...formData, decoder: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Decoder auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {decoders.map((decoder) => (
                    <SelectItem key={decoder.id} value={decoder.id}>
                      {decoder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* LineMetrics Configuration */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">LineMetrics Integration</Label>
                <Switch
                  checked={formData.lineMetrics.enabled}
                  onCheckedChange={(checked) => 
                    setFormData({
                      ...formData, 
                      lineMetrics: { ...formData.lineMetrics, enabled: checked }
                    })
                  }
                />
              </div>
              
              {formData.lineMetrics.enabled && (
                <LineMetricsConfig
                  enabled={formData.lineMetrics.enabled}
                  clientId={formData.lineMetrics.clientId}
                  clientSecret={formData.lineMetrics.clientSecret}
                  projectId={formData.lineMetrics.projectId}
                  dataPoints={formData.lineMetrics.dataPoints}
                  decoder={formData.decoder}
                  onConfigChange={(config) => 
                    setFormData({
                      ...formData, 
                      lineMetrics: config
                    })
                  }
                />
              )}
            </div>

            {/* Historical Push */}
            <div className="mt-6">
              <HistoricalPush
                deviceId={formData.deviceId}
                deviceName={formData.name}
                deviceEUI={formData.deviceEUI}
                lineMetricsEnabled={formData.lineMetrics.enabled}
              />
            </div>
          </div>

          <DialogFooter className="flex flex-wrap gap-2 justify-between">
            <Button
              variant="destructive"
              type="button"
              onClick={() => {
                void handleDeleteDevice(formData.deviceId);
                setIsEditDialogOpen(false);
              }}
            >
              Archive
            </Button>
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleUpdateDevice} disabled={!formData.deviceId || !formData.name}>
                Änderungen speichern
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 