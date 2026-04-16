import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { getDevicesFilePath } from '@/lib/data-paths.js';

// Interface für Device-Daten
interface Device {
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
  lastActivity: string;
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

// Lade Devices aus JSON-Datei (DeviceManager-Format)
async function loadDevices(): Promise<Device[]> {
  try {
    const data = await fs.readFile(getDevicesFilePath(), 'utf8');
    const deviceManagerData = JSON.parse(data);
    
    // Konvertiere DeviceManager-Format zu Array-Format
    if (deviceManagerData.devices) {
      return Object.values(deviceManagerData.devices).map((device: any) => ({
        deviceId: device.deviceId,
        deviceEUI: device.deviceEUI,
        name: device.name,
        description: device.description || '',
        decoder: device.decoder,
        manufacturer: device.manufacturer,
        model: device.model,
        location: device.location || 'Unknown',
        tags: device.tags || [],
        active: device.active !== false,
        lastActivity: device.lastSeen || device.lastActivity || new Date().toISOString(),
        createdAt: device.createdAt,
        updatedAt: device.updatedAt,
        lineMetrics: device.lineMetrics || {
          enabled: false,
          clientId: '',
          clientSecret: '',
          projectId: '',
          dataPoints: {}
        }
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Fehler beim Laden der Devices:', error);
    return [];
  }
}

// Speichere Devices in JSON-Datei (DeviceManager-Format)
async function saveDevices(devices: Device[]): Promise<void> {
  try {
    // Lade bestehende DeviceManager-Daten
    let deviceManagerData: any = { devices: {}, decoders: {}, lastUpdate: null };
    
    try {
      const existingData = await fs.readFile(getDevicesFilePath(), 'utf8');
      deviceManagerData = JSON.parse(existingData);
    } catch (error) {
      // Datei existiert nicht oder ist leer, verwende Standard-Format
    }
    
    // Konvertiere Array-Format zu DeviceManager-Format
    const deviceMap: any = {};
    devices.forEach(device => {
      const deviceId = device.deviceId;
      deviceMap[deviceId] = {
        deviceId: device.deviceId,
        deviceEUI: device.deviceEUI,
        name: device.name,
        description: device.description,
        decoder: device.decoder,
        manufacturer: device.manufacturer,
        model: device.model,
        image: '/images/devices/default.svg',
        createdAt: device.createdAt,
        updatedAt: device.updatedAt,
        lastSeen: device.lastActivity,
        dataCount: 0,
        metadata: {},
        lineMetrics: device.lineMetrics || {
          enabled: false,
          clientId: '',
          clientSecret: '',
          projectId: '',
          dataPoints: {}
        }
      };
    });
    
    // Aktualisiere nur die Devices, behalte Decoders
    deviceManagerData.devices = deviceMap;
    deviceManagerData.lastUpdate = new Date().toISOString();
    
    await fs.writeFile(getDevicesFilePath(), JSON.stringify(deviceManagerData, null, 2));
  } catch (error) {
    console.error('Fehler beim Speichern der Devices:', error);
    throw new Error('Fehler beim Speichern der Devices');
  }
}

export async function GET(request: NextRequest) {
  try {
    const devices = await loadDevices();
    
    return NextResponse.json({
      success: true,
      count: devices.length,
      data: devices
    });
  } catch (error: any) {
    console.error('Fehler beim Abrufen der Devices:', error);
    return NextResponse.json(
      { error: 'Fehler beim Abrufen der Devices', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validiere erforderliche Felder
    if (!body.deviceId || !body.deviceEUI || !body.name) {
      return NextResponse.json(
        { error: 'Device ID, Device EUI und Name sind erforderlich' },
        { status: 400 }
      );
    }
    
    const devices = await loadDevices();
    
    // Prüfe ob Device bereits existiert
    const existingDevice = devices.find(d => d.deviceId === body.deviceId);
    if (existingDevice) {
      return NextResponse.json(
        { error: 'Device mit dieser ID existiert bereits' },
        { status: 400 }
      );
    }
    
    const newDevice: Device = {
      deviceId: body.deviceId,
      deviceEUI: body.deviceEUI,
      name: body.name,
      description: body.description || '',
      decoder: body.decoder || 'auto',
      manufacturer: body.manufacturer || '',
      model: body.model || '',
      location: body.location || '',
      tags: body.tags || [],
      active: body.active !== undefined ? body.active : true,
      lastActivity: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lineMetrics: body.lineMetrics || {
        enabled: false,
        clientId: '',
        clientSecret: '',
        projectId: '',
        dataPoints: {}
      }
    };
    
    devices.push(newDevice);
    await saveDevices(devices);
    
    return NextResponse.json({
      success: true,
      data: newDevice
    });
  } catch (error: any) {
    console.error('Fehler beim Erstellen des Devices:', error);
    return NextResponse.json(
      { error: 'Fehler beim Erstellen des Devices', details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.deviceId) {
      return NextResponse.json(
        { error: 'Device ID ist erforderlich' },
        { status: 400 }
      );
    }
    
    const devices = await loadDevices();
    const deviceIndex = devices.findIndex(d => d.deviceId === body.deviceId);
    
    if (deviceIndex === -1) {
      return NextResponse.json(
        { error: 'Device nicht gefunden' },
        { status: 404 }
      );
    }
    
    // Aktualisiere Device
    devices[deviceIndex] = {
      ...devices[deviceIndex],
      name: body.name || devices[deviceIndex].name,
      description: body.description || devices[deviceIndex].description,
      decoder: body.decoder || devices[deviceIndex].decoder,
      manufacturer: body.manufacturer || devices[deviceIndex].manufacturer,
      model: body.model || devices[deviceIndex].model,
      location: body.location || devices[deviceIndex].location,
      tags: body.tags || devices[deviceIndex].tags,
      active: body.active !== undefined ? body.active : devices[deviceIndex].active,
      lineMetrics: body.lineMetrics || devices[deviceIndex].lineMetrics || {
        enabled: false,
        clientId: '',
        clientSecret: '',
        projectId: '',
        dataPoints: {}
      },
      updatedAt: new Date().toISOString()
    };
    
    await saveDevices(devices);
    
    return NextResponse.json({
      success: true,
      data: devices[deviceIndex]
    });
  } catch (error: any) {
    console.error('Fehler beim Aktualisieren des Devices:', error);
    return NextResponse.json(
      { error: 'Fehler beim Aktualisieren des Devices', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');
    
    if (!deviceId) {
      return NextResponse.json(
        { error: 'Device ID erforderlich' },
        { status: 400 }
      );
    }
    
    const devices = await loadDevices();
    const deviceIndex = devices.findIndex(d => d.deviceId === deviceId);
    
    if (deviceIndex === -1) {
      return NextResponse.json(
        { error: 'Device nicht gefunden' },
        { status: 404 }
      );
    }
    
    // Entferne Device
    devices.splice(deviceIndex, 1);
    await saveDevices(devices);
    
    return NextResponse.json({
      success: true,
      message: 'Device erfolgreich gelöscht'
    });
  } catch (error: any) {
    console.error('Fehler beim Löschen des Devices:', error);
    return NextResponse.json(
      { error: 'Fehler beim Löschen des Devices', details: error.message },
      { status: 500 }
    );
  }
} 