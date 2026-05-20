import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/server';
import { verifyAdmin } from '@/lib/admin-auth';

export async function POST(request: Request) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { passenger_id, amount, type, reason } = await request.json();

    if (!passenger_id || amount === undefined || !type || !reason) {
      return NextResponse.json({ error: 'All fields (passenger_id, amount, type, reason) are required' }, { status: 400 });
    }

    const adjustAmount = parseFloat(amount);
    if (isNaN(adjustAmount) || adjustAmount <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 });
    }

    if (type !== 'credit' && type !== 'debit') {
      return NextResponse.json({ error: 'Type must be credit or debit' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Get current balance
    const { data: account, error: getError } = await supabase
      .from('accounts')
      .select('balance')
      .eq('passenger_id', passenger_id)
      .single();

    if (getError || !account) {
      return NextResponse.json({ error: 'Passenger wallet account not found' }, { status: 404 });
    }

    const currentBalance = parseFloat(account.balance.toString());
    let newBalance = currentBalance;

    if (type === 'credit') {
      newBalance = currentBalance + adjustAmount;
    } else {
      newBalance = currentBalance - adjustAmount;
      if (newBalance < 0) {
        return NextResponse.json({ error: 'Adjustment would result in negative balance. Denied.' }, { status: 400 });
      }
    }

    // 2. Update accounts balance
    const { error: updateError } = await supabase
      .from('accounts')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('passenger_id', passenger_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // 3. Log in transactions
    const { error: txError } = await supabase
      .from('transactions')
      .insert([
        {
          passenger_id,
          type,
          amount: adjustAmount,
          description: `Admin manual adjustment: ${reason}`,
        }
      ]);

    if (txError) {
      console.error('Adjustment transaction log failed:', txError);
    }

    return NextResponse.json({ success: true, new_balance: newBalance });
  } catch (err: any) {
    console.error('Balance adjust error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
