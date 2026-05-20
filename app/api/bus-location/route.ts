import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const { esp32_device_id, lat, lng, speed } = await request.json();

    if (!esp32_device_id || lat === undefined || lng === undefined) {
      return NextResponse.json({ error: 'Missing required parameters (esp32_device_id, lat, lng)' }, { status: 400 });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const speedKmh = speed !== undefined ? parseFloat(speed) : null;

    const supabase = createAdminClient();

    // 1. Find bus by device ID
    const { data: bus, error: busError } = await supabase
      .from('buses')
      .select('id')
      .eq('esp32_device_id', esp32_device_id)
      .single();

    if (busError || !bus) {
      return NextResponse.json({ error: 'Bus hardware terminal not registered' }, { status: 404 });
    }

    // 2. Upsert GPS coordinates and speed
    const { error: upsertError } = await supabase
      .from('bus_locations')
      .upsert(
        {
          bus_id: bus.id,
          lat: latitude,
          lng: longitude,
          speed_kmh: speedKmh,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'bus_id' }
      );

    if (upsertError) {
      return NextResponse.json({ error: 'Failed to update location: ' + upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Bus location update error:', err);
    return NextResponse.json({ error: 'Internal server error: ' + err.message }, { status: 500 });
  }
}
