'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, Search, Filter, Calendar, Phone, Mail, MapPin, 
  User, Bus, AlertTriangle, ShieldCheck, X 
} from 'lucide-react';
import Link from 'next/link';

interface OwnerItem {
  id: string;
  full_name: string;
  nic: string;
  phone: string;
  email: string;
  address: string;
  status: 'pending' | 'active' | 'suspended' | 'rejected';
  created_at: string;
  bus_count: number;
}

interface BusOwnersClientProps {
  initialOwners: OwnerItem[];
}

export default function BusOwnersClient({ initialOwners }: BusOwnersClientProps) {
  const [owners, setOwners] = useState<OwnerItem[]>(initialOwners);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Drawer states
  const [selectedOwner, setSelectedOwner] = useState<OwnerItem | null>(null);
  const [ownerBuses, setOwnerBuses] = useState<any[]>([]);
  const [busesLoading, setBusesLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  const router = useRouter();

  // Load owner's buses when drawer opens
  useEffect(() => {
    if (!selectedOwner) return;
    const fetchBuses = async () => {
      setBusesLoading(true);
      try {
        const res = await fetch(`/api/admin/buses?owner_id=${selectedOwner.id}`);
        const data = await res.json();
        if (res.ok) {
          setOwnerBuses(data.buses || []);
        } else {
          console.error(data.error);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setBusesLoading(false);
      }
    };
    fetchBuses();
  }, [selectedOwner]);

  // Update Owner Account Status
  const handleUpdateStatus = async (newStatus: 'active' | 'suspended') => {
    if (!selectedOwner) return;
    const confirmMsg = newStatus === 'suspended' 
      ? 'Are you sure you want to suspend this bus owner? Their buses will lose operational access.'
      : 'Are you sure you want to reinstate this bus owner?';
    if (!confirm(confirmMsg)) return;

    setStatusLoading(true);
    try {
      const res = await fetch('/api/admin/update-owner-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner_id: selectedOwner.id, status: newStatus }),
      });
      const data = await res.json();
      if (res.ok) {
        const updated = { ...selectedOwner, status: newStatus };
        setSelectedOwner(updated);
        setOwners(owners.map(o => o.id === selectedOwner.id ? updated : o));
        router.refresh();
      } else {
        alert('Failed: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error(err);
      alert('Error updating status.');
    } finally {
      setStatusLoading(false);
    }
  };

  // Filter owners
  const filteredOwners = owners.filter(o => {
    const matchesSearch = o.full_name.toLowerCase().includes(search.toLowerCase()) || 
                          o.nic.toLowerCase().includes(search.toLowerCase()) ||
                          o.phone.includes(search);
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const styles: Record<string, any> = {
      active: { bg: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)' },
      pending: { bg: 'rgba(59, 130, 246, 0.15)', color: 'var(--primary-color)' },
      suspended: { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' },
      rejected: { bg: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)' },
    };
    const style = styles[status] || { bg: 'rgba(255,255,255,0.05)', color: 'white' };
    return (
      <span style={{ background: style.bg, color: style.color, padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600, textTransform: 'capitalize' }}>
        {status}
      </span>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '24px' }}>
        <Link href="/admin/dashboard" style={{ textDecoration: 'none', color: 'var(--text-secondary)' }}>
          <ArrowLeft size={24} />
        </Link>
        <h1 style={{ margin: 0, fontSize: '2rem' }}>Bus Owner Directory</h1>
      </div>

      {/* Search & Filters */}
      <div className="glass-panel" style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div style={{ display: 'flex', gap: '10px', flex: 1, minWidth: '280px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} color="var(--text-secondary)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
            <input 
              type="text" 
              className="form-input" 
              placeholder="Search by name, NIC, or phone..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '40px' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {['all', 'pending', 'active', 'suspended', 'rejected'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className="btn-primary"
              style={{
                padding: '6px 14px',
                fontSize: '0.85rem',
                background: statusFilter === status ? 'var(--primary-color)' : 'rgba(255,255,255,0.05)',
                border: statusFilter === status ? '1px solid var(--primary-color)' : '1px solid var(--glass-border)',
                color: statusFilter === status ? 'white' : 'var(--text-secondary)',
                textTransform: 'capitalize',
              }}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table */}
      <div className="glass-panel" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              <th style={{ padding: '16px 20px' }}>Owner Name</th>
              <th style={{ padding: '16px 20px' }}>NIC</th>
              <th style={{ padding: '16px 20px' }}>Phone</th>
              <th style={{ padding: '16px 20px' }}>Status</th>
              <th style={{ padding: '16px 20px' }}>Buses</th>
              <th style={{ padding: '16px 20px' }}>Registered Date</th>
            </tr>
          </thead>
          <tbody>
            {filteredOwners.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No bus owners found matching the criteria.
                </td>
              </tr>
            ) : (
              filteredOwners.map((owner) => (
                <tr 
                  key={owner.id}
                  onClick={() => setSelectedOwner(owner)}
                  style={{ borderBottom: '1px solid var(--glass-border)', cursor: 'pointer', transition: 'background 0.2s ease' }}
                  className="table-row-hover"
                >
                  <td style={{ padding: '16px 20px', fontWeight: 600 }}>{owner.full_name}</td>
                  <td style={{ padding: '16px 20px' }}>{owner.nic}</td>
                  <td style={{ padding: '16px 20px' }}>{owner.phone}</td>
                  <td style={{ padding: '16px 20px' }}>{getStatusBadge(owner.status)}</td>
                  <td style={{ padding: '16px 20px', fontWeight: 600 }}>{owner.bus_count}</td>
                  <td style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    {new Date(owner.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* DETAIL DRAWER / SIDE PANEL */}
      {selectedOwner && (
        <div style={{ position: 'fixed', top: 0, right: 0, width: '100%', maxWidth: '480px', height: '100vh', background: 'var(--bg-color)', borderLeft: '1px solid var(--glass-border)', boxShadow: '-10px 0 30px rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px', borderBottom: '1px solid var(--glass-border)' }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Owner Profile Inspection</h3>
            <button onClick={() => setSelectedOwner(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <X size={24} />
            </button>
          </div>

          <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ background: 'rgba(255,255,255,0.05)', width: '70px', height: '70px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <User size={36} color="var(--primary-color)" />
              </div>
              <h2 style={{ fontSize: '1.4rem', margin: '0 0 6px 0' }}>{selectedOwner.full_name}</h2>
              <div style={{ marginBottom: '15px' }}>{getStatusBadge(selectedOwner.status)}</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--glass-border)', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
                <User size={16} color="var(--text-secondary)" />
                <span>NIC: <strong>{selectedOwner.nic}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
                <Phone size={16} color="var(--text-secondary)" />
                <span>Phone: <strong>{selectedOwner.phone}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
                <Mail size={16} color="var(--text-secondary)" />
                <span>Email: <strong>{selectedOwner.email}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
                <MapPin size={16} color="var(--text-secondary)" />
                <span>Address: <em>{selectedOwner.address}</em></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
                <Calendar size={16} color="var(--text-secondary)" />
                <span>Joined: {new Date(selectedOwner.created_at).toLocaleString()}</span>
              </div>
            </div>

            {/* Buses List */}
            <h4 style={{ fontSize: '1.05rem', marginBottom: '12px', fontWeight: 600 }}>Registered Fleet ({selectedOwner.bus_count})</h4>
            {busesLoading ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Loading fleet details...</p>
            ) : ownerBuses.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No buses registered.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '30px' }}>
                {ownerBuses.map((bus) => (
                  <div key={bus.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(0,0,0,0.15)', border: '1px solid var(--glass-border)', borderRadius: '8px' }}>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Bus size={14} /> {bus.bus_number}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Route: {bus.route_name || 'Not Configured'}</div>
                    </div>
                    <span style={{
                      fontSize: '0.75rem',
                      background: bus.status === 'active' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: bus.status === 'active' ? 'var(--success)' : 'var(--danger)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      textTransform: 'uppercase',
                      fontWeight: 600
                    }}>
                      {bus.status}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Account Administration Controls */}
            {selectedOwner.status !== 'pending' && selectedOwner.status !== 'rejected' && (
              <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '20px' }}>
                <h4 style={{ fontSize: '1.05rem', marginBottom: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={18} color="#f59e0b" /> Access Controls
                </h4>
                
                {selectedOwner.status === 'active' ? (
                  <button
                    onClick={() => handleUpdateStatus('suspended')}
                    disabled={statusLoading}
                    className="btn-primary"
                    style={{ width: '100%', background: 'var(--danger)', padding: '12px' }}
                  >
                    {statusLoading ? 'Processing...' : 'Suspend Owner Access'}
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpdateStatus('active')}
                    disabled={statusLoading}
                    className="btn-primary"
                    style={{ width: '100%', background: 'var(--success)', padding: '12px' }}
                  >
                    {statusLoading ? 'Processing...' : 'Reinstate Owner Access'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
