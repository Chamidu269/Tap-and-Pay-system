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

    const { passenger_id, new_rfid_uid, reason } = await request.json();
    if (!passenger_id || !new_rfid_uid) {
      return NextResponse.json({ error: 'Passenger ID and new RFID UID are required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Get old RFID UID
    const { data: passenger, error: fetchError } = await supabase
      .from('passengers')
      .select('rfid_uid')
      .eq('id', passenger_id)
      .single();

    if (fetchError || !passenger) {
      return NextResponse.json({ error: 'Passenger not found' }, { status: 404 });
    }

    const old_rfid_uid = passenger.rfid_uid;

    // 2. Check if new RFID is already used by another passenger
    if (new_rfid_uid) {
      const { data: existingPassenger } = await supabase
        .from('passengers')
        .select('id')
        .eq('rfid_uid', new_rfid_uid)
        .neq('id', passenger_id)
        .maybeSingle();

      if (existingPassenger) {
        return NextResponse.json({ error: 'This RFID UID is already assigned to another passenger.' }, { status: 400 });
      }
    }

    // 3. Update passenger's RFID UID
    const { error: updateError } = await supabase
      .from('passengers')
      .update({ rfid_uid: new_rfid_uid || null })
      .eq('id', passenger_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // 4. Log change in rfid_change_log
    const { error: logError } = await supabase.from('rfid_change_log').insert([
      {
        passenger_id,
        old_rfid_uid,
        new_rfid_uid,
        changed_by: admin.admin_id,
        reason: reason || 'Admin update',
      }
    ]);

    if (logError) {
      console.error('Failed to write RFID change log:', logError);
    }

    // Capture in PostHog
    posthog.capture('rfid_changed', {
      passenger_id,
      old_rfid_uid,
      new_rfid_uid,
      changed_by: admin.admin_id,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('RFID change error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
