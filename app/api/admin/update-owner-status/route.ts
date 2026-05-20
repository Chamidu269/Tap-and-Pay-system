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

    const { owner_id, status } = await request.json();
    if (!owner_id || !status) {
      return NextResponse.json({ error: 'Owner ID and status are required' }, { status: 400 });
    }

    if (status !== 'active' && status !== 'suspended') {
      return NextResponse.json({ error: 'Invalid status value. Must be active or suspended' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Update status in profiles and bus_owners
    // Wait! Let's update both tables: profiles.status and bus_owners.status.
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ status })
      .eq('id', owner_id);

    if (profileError) throw profileError;

    const { error: ownerError } = await supabase
      .from('bus_owners')
      .update({ status })
      .eq('id', owner_id);

    if (ownerError) throw ownerError;

    // Track status change in PostHog
    posthog.capture('owner_status_changed', {
      owner_id,
      status,
      changed_by: admin.admin_id,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Update owner status error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
