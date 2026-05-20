import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createAdminClient } from '@/utils/supabase/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'dummy_key', {
  apiVersion: '2024-04-10' as any,
});

export async function POST(request: Request) {
  const body = await request.text();
  const sig = headers().get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe signature header' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );
  } catch (err: any) {
    console.error(`Webhook signature verification failed:`, err.message);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // Handle checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    
    // Extract metadata
    const passengerId = session.metadata?.passenger_id;
    const amountStr = session.metadata?.amount;

    if (passengerId && amountStr) {
      const topUpAmount = parseFloat(amountStr);
      const supabase = createAdminClient();

      try {
        // 1. Fetch current balance
        const { data: account, error: getError } = await supabase
          .from('accounts')
          .select('balance')
          .eq('passenger_id', passengerId)
          .single();

        if (getError || !account) {
          console.error(`Passenger wallet not found during webhook execution: ${passengerId}`);
          return NextResponse.json({ error: 'Passenger account not found' }, { status: 404 });
        }

        const currentBalance = parseFloat(account.balance.toString());
        const newBalance = currentBalance + topUpAmount;

        // 2. Update wallet balance
        const { error: updateError } = await supabase
          .from('accounts')
          .update({ balance: newBalance, updated_at: new Date().toISOString() })
          .eq('passenger_id', passengerId);

        if (updateError) {
          throw updateError;
        }

        // 3. Log credit transaction log
        const { error: txError } = await supabase.from('transactions').insert([
          {
            passenger_id: passengerId,
            type: 'credit',
            amount: topUpAmount,
            description: 'Online wallet topup via Stripe Card',
            stripe_payment_intent: session.payment_intent as string || null,
          }
        ]);

        if (txError) {
          console.error('Webhook transaction insertion failed:', txError);
        }

        console.log(`Successfully recharged wallet for passenger ${passengerId} with LKR ${topUpAmount}`);

      } catch (dbErr: any) {
        console.error('Database update failed in webhook handler:', dbErr);
        return NextResponse.json({ error: 'Database update failed: ' + dbErr.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
