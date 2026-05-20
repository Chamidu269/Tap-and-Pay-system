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

    const { owner_id, reason } = await request.json();
    if (!owner_id || !reason) {
      return NextResponse.json({ error: 'Owner ID and rejection reason are required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Update status to rejected and write rejection reason
    const { error } = await supabase
      .from('bus_owners')
      .update({
        status: 'rejected',
        rejection_reason: reason,
      })
      .eq('id', owner_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Capture rejection in PostHog
    posthog.capture('owner_rejected', {
      owner_id,
      reason,
      rejected_by: admin.admin_id,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Reject owner error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
