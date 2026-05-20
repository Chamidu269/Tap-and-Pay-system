'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { 
  ArrowLeft, Bus, Plus, Save, Trash2, Cpu, Navigation, AlertCircle, CheckCircle 
} from 'lucide-react';
import Link from 'next/link';

interface BusItem {
  id: string;
  bus_number: string;
  route_name: string | null;
  esp32_device_id: string | null;
  status: string;
  registered_at: string;
}

export default function OwnerBusesPage() {
  const [buses, setBuses] = useState<BusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');
  
  // Add new bus form
  const [newBusNumber, setNewBusNumber] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  // Edit states for existing buses
  const [editStates, setEditStates] = useState<Record<string, { route_name: string; esp32_device_id: string }>>({});
  const [saveLoading, setSaveLoading] = useState<string | null>(null);

  // Feedback notifications
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUserId(user.id);

      // Verify owner status is active
      const { data: owner } = await supabase
        .from('bus_owners')
        .select('status')
        .eq('id', user.id)
        .single();

      if (owner?.status !== 'active') {
        router.push('/owner/dashboard');
        return;
      }

      // Fetch buses
      const { data: busesData, error } = await supabase
        .from('buses')
        .select('*')
        .eq('owner_id', user.id)
        .order('registered_at', { ascending: false });

      if (error) {
        console.error('Error fetching buses:', error);
      } else if (busesData) {
        setBuses(busesData);
        // Initialize edit states
        const initialEditStates: Record<string, { route_name: string; esp32_device_id: string }> = {};
        busesData.forEach((bus) => {
          initialEditStates[bus.id] = {
            route_name: bus.route_name || '',
            esp32_device_id: bus.esp32_device_id || '',
          };
        });
        setEditStates(initialEditStates);
      }
      setLoading(false);
    };

    fetchData();
  }, [supabase, router]);

  // Handle Add Bus
  const handleAddBus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBusNumber.trim()) return;
    setAddLoading(true);
    setMsg(null);

    try {
      const { data: newBus, error } = await supabase
        .from('buses')
        .insert([
          {
            owner_id: userId,
            bus_number: newBusNumber.trim(),
            status: 'active',
          }
        ])
        .select()
        .single();

      if (error) throw error;

      if (newBus) {
        setBuses([newBus, ...buses]);
        setEditStates(prev => ({
          ...prev,
          [newBus.id]: { route_name: '', esp32_device_id: '' }
        }));
        setNewBusNumber('');
        setMsg({ type: 'success', text: `Bus ${newBus.bus_number} successfully registered.` });
      }
    } catch (err: any) {
      console.error(err);
      setMsg({ type: 'error', text: err.message || 'Failed to add bus. Make sure license plate is unique.' });
    } finally {
      setAddLoading(false);
    }
  };

  // Handle Edit State Change
  const handleEditChange = (busId: string, field: 'route_name' | 'esp32_device_id', value: string) => {
    setEditStates(prev => ({
      ...prev,
      [busId]: {
        ...prev[busId],
        [field]: value
      }
    }));
  };

  // Handle Save Bus Details
  const handleSaveBus = async (busId: string) => {
    setSaveLoading(busId);
    setMsg(null);
    const updates = editStates[busId];

    try {
      // Check if ESP32 device ID is already linked to another bus
      if (updates.esp32_device_id.trim()) {
        const { data: duplicate } = await supabase
          .from('buses')
          .select('id, bus_number')
          .eq('esp32_device_id', updates.esp32_device_id.trim())
          .neq('id', busId)
          .maybeSingle();

        if (duplicate) {
          throw new Error(`Device ID is already assigned to bus ${duplicate.bus_number}.`);
        }
      }

      const { error } = await supabase
        .from('buses')
        .update({
          route_name: updates.route_name.trim() || null,
          esp32_device_id: updates.esp32_device_id.trim() || null,
        })
        .eq('id', busId);

      if (error) throw error;

      setMsg({ type: 'success', text: 'Bus configuration updated successfully.' });
      setBuses(buses.map(b => b.id === busId ? { ...b, route_name: updates.route_name.trim() || null, esp32_device_id: updates.esp32_device_id.trim() || null } : b));
    } catch (err: any) {
      console.error(err);
      setMsg({ type: 'error', text: err.message || 'Failed to save changes.' });
    } finally {
      setSaveLoading(null);
    }
  };

  // Handle Delete Bus
  const handleDeleteBus = async (busId: string, busNum: string) => {
    if (!confirm(`Are you sure you want to delete bus ${busNum}? All related journey logs will be orphaned.`)) return;
    setMsg(null);

    try {
      const { error } = await supabase
        .from('buses')
        .delete()
        .eq('id', busId);

      if (error) throw error;

      setBuses(buses.filter(b => b.id !== busId));
      setMsg({ type: 'success', text: `Bus ${busNum} has been deleted.` });
    } catch (err: any) {
      console.error(err);
      setMsg({ type: 'error', text: err.message || 'Failed to delete bus.' });
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', marginTop: '100px' }}>
        <p>Loading fleet details...</p>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: '60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px' }}>
        <Link href="/owner/dashboard" style={{ textDecoration: 'none', color: 'var(--text-secondary)' }}>
          <ArrowLeft size={24} />
        </Link>
        <div>
          <h1 style={{ margin: 0, fontSize: '2.25rem' }}>Fleet Configurations</h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)' }}>Configure routes and link hardware devices to your active buses.</p>
        </div>
      </div>

      {msg && (
        <div style={{
          background: msg.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: msg.type === 'success' ? '1px solid var(--success)' : '1px solid var(--danger)',
          color: msg.type === 'success' ? 'var(--success)' : 'var(--danger)',
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '0.9rem'
        }}>
          {msg.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{msg.text}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '30px' }}>
        
        {/* ADD BUS CARD */}
        <div>
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={18} color="var(--primary-color)" /> Add New Vehicle
            </h3>
            
            <form onSubmit={handleAddBus}>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Bus License Plate Number</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={newBusNumber}
                  onChange={(e) => setNewBusNumber(e.target.value)}
                  placeholder="e.g. WP ND-4567 or NA-7890" 
                  required
                />
              </div>

              <button 
                type="submit" 
                className="btn-primary" 
                style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                disabled={addLoading}
              >
                {addLoading ? 'Registering...' : 'Register Bus'}
              </button>
            </form>
          </div>
        </div>

        {/* LIST & EDIT VEHICLES */}
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '20px' }}>Active Fleet Directory ({buses.length})</h2>
          
          {buses.length === 0 ? (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
              <Bus size={32} color="var(--text-secondary)" style={{ margin: '0 auto 12px' }} />
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>You don't have any vehicles listed. Add a bus on the left to start.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {buses.map((bus) => (
                <div key={bus.id} className="glass-panel" style={{ borderLeft: '4px solid var(--primary-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '15px', marginBottom: '20px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Bus size={20} color="var(--primary-color)" />
                      <span style={{ fontSize: '1.2rem', fontWeight: 700 }}>{bus.bus_number}</span>
                    </div>
                    <button 
                      onClick={() => handleDeleteBus(bus.id, bus.bus_number)}
                      style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}
                    >
                      <Trash2 size={16} /> Retire Vehicle
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Navigation size={12} /> Route Name
                      </label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={editStates[bus.id]?.route_name || ''}
                        onChange={(e) => handleEditChange(bus.id, 'route_name', e.target.value)}
                        placeholder="e.g. 120 Colombo - Horana"
                        style={{ padding: '8px 12px', fontSize: '0.9rem' }}
                      />
                    </div>
                    
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Cpu size={12} /> Hardware Device Link (ESP32 ID)
                      </label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={editStates[bus.id]?.esp32_device_id || ''}
                        onChange={(e) => handleEditChange(bus.id, 'esp32_device_id', e.target.value)}
                        placeholder="e.g. ESP32_TRANSIT_99"
                        style={{ padding: '8px 12px', fontSize: '0.9rem' }}
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => handleSaveBus(bus.id)}
                    disabled={saveLoading === bus.id}
                    className="btn-primary"
                    style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Save size={16} /> {saveLoading === bus.id ? 'Saving...' : 'Save Configuration'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
