import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/server';
import crypto from 'crypto';

// Haversine Distance Formula in Kilometers
function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function POST(request: Request) {
  try {
    const { rfid_uid, esp32_device_id, lat, lng } = await request.json();

    if (!rfid_uid || !esp32_device_id || lat === undefined || lng === undefined) {
      return NextResponse.json({ error: 'Missing required parameters (rfid_uid, esp32_device_id, lat, lng)' }, { status: 400 });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const supabase = createAdminClient();

    // 1. Resolve bus from ESP32 ID
    const { data: bus, error: busError } = await supabase
      .from('buses')
      .select('id, bus_number, route_name')
      .eq('esp32_device_id', esp32_device_id)
      .single();

    if (busError || !bus) {
      return NextResponse.json({ error: 'Bus hardware terminal not registered' }, { status: 404 });
    }

    // 2. Update Bus coordinates instantly on live locations
    const { error: locError } = await supabase
      .from('bus_locations')
      .upsert(
        {
          bus_id: bus.id,
          lat: latitude,
          lng: longitude,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'bus_id' }
      );

    if (locError) {
      console.error('Failed to update bus live coordinates on tap:', locError);
    }

    // 3. Resolve Passenger from RFID UID
    const { data: passenger, error: passengerError } = await supabase
      .from('passengers')
      .select('id, full_name')
      .eq('rfid_uid', rfid_uid)
      .single();

    if (passengerError || !passenger) {
      return NextResponse.json({ error: 'RFID transit card unrecognized' }, { status: 404 });
    }

    // 4. Retrieve Passenger Account balance
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('balance, status')
      .eq('passenger_id', passenger.id)
      .single();

    if (accountError || !account) {
      return NextResponse.json({ error: 'Transit wallet account not found' }, { status: 404 });
    }

    if (account.status !== 'active') {
      return NextResponse.json({ error: 'Transit wallet account is suspended' }, { status: 403 });
    }

    const balance = parseFloat(account.balance.toString());

    // 5. Query for an active (in-progress) trip
    const { data: activeTrip, error: tripError } = await supabase
      .from('trips')
      .select('*')
      .eq('passenger_id', passenger.id)
      .eq('status', 'in_progress')
      .maybeSingle();

    if (tripError) {
      return NextResponse.json({ error: 'Database check failed: ' + tripError.message }, { status: 500 });
    }

    const nowStr = new Date().toISOString();

    // CASE A: TAP-IN (No active trip)
    if (!activeTrip) {
      // Balance check: Must have at least LKR 100.00 to board
      if (balance < 100.00) {
        return NextResponse.json({ 
          error: `Insufficient funds. Minimum LKR 100.00 required. Current: LKR ${balance.toFixed(2)}` 
        }, { status: 403 });
      }

      // Start new journey
      const { data: startedTrip, error: startError } = await supabase
        .from('trips')
        .insert([
          {
            passenger_id: passenger.id,
            bus_id: bus.id,
            board_lat: latitude,
            board_lng: longitude,
            board_time: nowStr,
            status: 'in_progress',
          }
        ])
        .select()
        .single();

      if (startError) {
        return NextResponse.json({ error: 'Failed to initiate journey: ' + startError.message }, { status: 500 });
      }

      return NextResponse.json({
        action: 'tap_in',
        message: 'Tap-In Successful. Journey started.',
        passenger_name: passenger.full_name,
        bus_number: bus.bus_number,
        balance: balance,
      });
    }

    // CASE B: TAP-OUT (Active trip exists)
    const boardLat = parseFloat(activeTrip.board_lat.toString());
    const boardLng = parseFloat(activeTrip.board_lng.toString());

    // Calculate journey distance via Haversine
    const distanceKm = calculateHaversineDistance(boardLat, boardLng, latitude, longitude);

    // Fetch pricing configuration
    const { data: pricing } = await supabase
      .from('pricing_config')
      .select('fare_per_km, minimum_fare')
      .order('effective_from', { ascending: false })
      .limit(1)
      .single();

    const farePerKm = pricing ? parseFloat(pricing.fare_per_km.toString()) : 10.00;
    const minimumFare = pricing ? parseFloat(pricing.minimum_fare.toString()) : 15.00;

    // Calculate final fare
    const calculatedFare = Math.max(minimumFare, distanceKm * farePerKm);
    
    // Deduct fare safely to avoid negative balance constraints (set to 0 if insufficient)
    const deduction = Math.min(balance, calculatedFare);
    const remainingBalance = balance - deduction;

    // 1. Update passenger account balance
    const { error: balanceUpdateError } = await supabase
      .from('accounts')
      .update({ balance: remainingBalance, updated_at: nowStr })
      .eq('passenger_id', passenger.id);

    if (balanceUpdateError) {
      return NextResponse.json({ error: 'Failed to process fare payment: ' + balanceUpdateError.message }, { status: 500 });
    }

    // 2. Complete the trip log
    const { error: tripCompleteError } = await supabase
      .from('trips')
      .update({
        alight_lat: latitude,
        alight_lng: longitude,
        alight_time: nowStr,
        distance_km: distanceKm,
        fare: calculatedFare,
        status: 'completed',
      })
      .eq('id', activeTrip.id);

    if (tripCompleteError) {
      console.error('Failed to complete trip log:', tripCompleteError);
    }

    // 3. Generate QR code verification security hash
    const qrData = crypto
      .createHash('sha256')
      .update(`${activeTrip.id}-${passenger.id}-${nowStr}`)
      .digest('hex');

    // 4. Generate digital ticket record
    const { error: ticketError } = await supabase
      .from('tickets')
      .insert([
        {
          trip_id: activeTrip.id,
          passenger_id: passenger.id,
          qr_code_data: qrData,
          issued_at: nowStr,
        }
      ]);

    if (ticketError) {
      console.error('Failed to write ticket invoice:', ticketError);
    }

    // 5. Log debit transaction
    const { error: txError } = await supabase
      .from('transactions')
      .insert([
        {
          passenger_id: passenger.id,
          type: 'debit',
          amount: calculatedFare,
          description: `Transit fare debit. Bus: ${bus.bus_number} (Route: ${bus.route_name || 'N/A'})`,
          trip_id: activeTrip.id,
          created_at: nowStr,
        }
      ]);

    if (txError) {
      console.error('Failed to log debit transaction:', txError);
    }

    return NextResponse.json({
      action: 'tap_out',
      message: 'Tap-Out Successful. Fare deducted.',
      passenger_name: passenger.full_name,
      bus_number: bus.bus_number,
      distance_km: distanceKm,
      fare: calculatedFare,
      remaining_balance: remainingBalance,
      insufficient_funds_warning: calculatedFare > balance,
    });
  } catch (err: any) {
    console.error('RFID Tap processing error:', err);
    return NextResponse.json({ error: 'Internal server processing error: ' + err.message }, { status: 500 });
  }
}
