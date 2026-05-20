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
    const query = searchParams.get('q');

    if (!query) {
      return NextResponse.json({ passengers: [] });
    }

    const supabase = createAdminClient();

    // Search passengers by full_name or nic
    const { data: passengers, error } = await supabase
      .from('passengers')
      .select('id, full_name, nic, phone, rfid_uid')
      .or(`full_name.ilike.%${query}%,nic.ilike.%${query}%`)
      .limit(10);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ passengers });
  } catch (err: any) {
    console.error('Search passenger error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
