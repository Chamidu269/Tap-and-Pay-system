import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/server';
import { verifyAdmin } from '@/lib/admin-auth';
import posthog from 'posthog-js';

export async function POST(request: Request) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { owner_id } = await request.json();
    if (!owner_id) {
      return NextResponse.json({ error: 'Owner ID is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Update status to active and register approval details
    const { error } = await supabase
      .from('bus_owners')
      .update({
        status: 'active',
        approved_by: admin.admin_id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', owner_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Capture approval in PostHog
    posthog.capture('owner_approved', {
      owner_id,
      approved_by: admin.admin_id,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Approve owner error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
