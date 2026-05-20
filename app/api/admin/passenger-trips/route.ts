import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/server';
import { verifyAdmin } from '@/lib/admin-auth';

export async function GET(request: Request) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const passengerId = searchParams.get('passenger_id');

    if (!passengerId) {
      return NextResponse.json({ error: 'Passenger ID is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Fetch trips with joined bus number
    const { data: trips, error } = await supabase
      .from('trips')
      .select(`
        id,
        board_time,
        alight_time,
        distance_km,
        fare,
        status,
        buses (
          bus_number,
          route_name
        )
      `)
      .eq('passenger_id', passengerId)
      .order('board_time', { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ trips });
  } catch (err: any) {
    console.error('Fetch passenger trips error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
