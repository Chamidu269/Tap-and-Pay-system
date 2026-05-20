import { createAdminClient } from '@/utils/supabase/server';
import BusOwnersClient from './BusOwnersClient';

export const revalidate = 0; // Disable cache

export default async function AdminBusOwnersPage() {
  const supabase = createAdminClient();

  let owners: any[] = [];
  try {
    const { data, error } = await supabase
      .from('bus_owner_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      owners = data;
    } else if (error) {
      console.error('Error fetching bus owners requests view:', error);
    }
  } catch (err) {
    console.error('Fetch owners error:', err);
  }

  return (
    <div style={{ paddingBottom: '60px' }}>
      <BusOwnersClient initialOwners={owners} />
    </div>
  );
}
