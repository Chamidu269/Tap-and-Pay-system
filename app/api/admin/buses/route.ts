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
    const ownerId = searchParams.get('owner_id');

    if (!ownerId) {
      return NextResponse.json({ error: 'Owner ID is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Query buses list
    const { data: buses, error } = await supabase
      .from('buses')
      .select('*')
      .eq('owner_id', ownerId)
      .order('registered_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ buses });
  } catch (err: any) {
    console.error('Fetch owner buses error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
