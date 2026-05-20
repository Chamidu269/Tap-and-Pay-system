import { createAdminClient } from '@/utils/supabase/server';
import PassengersClient from './PassengersClient';

export const revalidate = 0; // Disable caching

export default async function AdminPassengersPage() {
  const supabase = createAdminClient();

  let passengers: any[] = [];
  try {
    const { data, error } = await supabase
      .from('passengers')
      .select(`
        id,
        full_name,
        nic,
        phone,
        address,
        gender,
        rfid_uid,
        created_at,
        accounts (
          balance,
          status
        )
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      // Map joined accounts object/array safely
      passengers = data.map((p: any) => {
        const wallet = Array.isArray(p.accounts) ? p.accounts[0] : p.accounts;
        return {
          id: p.id,
          full_name: p.full_name,
          nic: p.nic,
          phone: p.phone,
          address: p.address,
          gender: p.gender,
          rfid_uid: p.rfid_uid,
          created_at: p.created_at,
          balance: wallet ? parseFloat(wallet.balance) : 0.00,
          status: wallet ? wallet.status : 'active',
        };
      });
    } else if (error) {
      console.error('Error querying passengers:', error);
    }
  } catch (err) {
    console.error('Fetch passengers error:', err);
  }

  return (
    <div style={{ paddingBottom: '60px' }}>
      <PassengersClient initialPassengers={passengers} />
    </div>
  );
}
