import { NextRequest, NextResponse } from 'next/server';
import DeviceManager from '@/lib/device-manager';

export const runtime = 'nodejs';

function mapDevice(d: Record<string, unknown>) {
  const tags = Array.isArray(d.tags) ? (d.tags as string[]) : [];
  return {
    deviceId: d.deviceId,
    deviceEUI: d.deviceEUI,
    name: d.name,
    description: d.description ?? '',
    decoder: d.decoder,
    manufacturer: d.manufacturer,
    model: d.model,
    location: d.location ?? '',
    tags,
    active: d.active !== false,
    archived: d.archived === true,
    lastActivity: d.lastSeen ?? d.lastActivity,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    lineMetrics: d.lineMetrics ?? { enabled: false, dataPoints: {} },
    outputs: d.outputs,
    schedules: d.schedules,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get('includeArchived') === 'true';
    DeviceManager.reloadDevices();
    let list = DeviceManager.getAllDevices() as Record<string, unknown>[];
    if (!includeArchived) {
      list = list.filter((d) => !d.archived);
    }
    return NextResponse.json({
      success: true,
      count: list.length,
      data: list.map(mapDevice),
    });
  } catch (error: unknown) {
    console.error('GET /api/devices:', error);
    return NextResponse.json(
      { error: 'Failed to list devices', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.import && Array.isArray(body.devices)) {
      let n = 0;
      for (const raw of body.devices) {
        const d = raw as Record<string, unknown>;
        if (!d.deviceId || !d.deviceEUI) continue;
        const id = String(d.deviceId);
        const payload = {
          deviceId: id,
          deviceEUI: String(d.deviceEUI),
          name: String(d.name || id),
          description: d.description,
          decoder: d.decoder,
          manufacturer: d.manufacturer,
          model: d.model,
          image: d.image,
          tags: d.tags,
          location: d.location,
          active: d.active,
          lineMetrics: d.lineMetrics,
          outputs: d.outputs,
          schedules: d.schedules,
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dm = DeviceManager as any;
        if (dm.getDevice(id)) {
          const { deviceId: _skip, ...upd } = payload;
          dm.updateDevice(id, upd);
        } else {
          dm.registerDevice(payload);
        }
        n += 1;
      }
      return NextResponse.json({ success: true, imported: n });
    }

    if (!body.deviceId || !body.deviceEUI || !body.name) {
      return NextResponse.json(
        { error: 'deviceId, deviceEUI and name are required' },
        { status: 400 }
      );
    }

    const device = DeviceManager.registerDevice({
      deviceId: body.deviceId,
      deviceEUI: body.deviceEUI,
      name: body.name,
      description: body.description,
      decoder: body.decoder,
      manufacturer: body.manufacturer,
      model: body.model,
      image: body.image,
      tags: body.tags,
      location: body.location,
      active: body.active,
      lineMetrics: body.lineMetrics,
      outputs: body.outputs,
      schedules: body.schedules,
    });

    return NextResponse.json({ success: true, data: mapDevice(device as Record<string, unknown>) });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.deviceId) {
      return NextResponse.json({ error: 'deviceId is required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    const fields = [
      'name',
      'description',
      'decoder',
      'manufacturer',
      'model',
      'location',
      'tags',
      'active',
      'archived',
      'lineMetrics',
      'outputs',
      'schedules',
      'deviceEUI',
    ];
    for (const f of fields) {
      if (body[f] !== undefined) updates[f] = body[f];
    }

    const device = DeviceManager.updateDevice(body.deviceId, updates);
    return NextResponse.json({ success: true, data: mapDevice(device as Record<string, unknown>) });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 404 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');
    if (!deviceId) {
      return NextResponse.json({ error: 'deviceId required' }, { status: 400 });
    }
    DeviceManager.deleteDevice(deviceId);
    return NextResponse.json({ success: true, message: 'Device archived' });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 404 }
    );
  }
}
