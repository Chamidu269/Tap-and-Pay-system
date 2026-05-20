'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, Search, User, CreditCard, DollarSign, Activity, 
  X, AlertCircle, CheckCircle, RefreshCw, Navigation 
} from 'lucide-react';
import Link from 'next/link';

interface PassengerItem {
  id: string;
  full_name: string;
  nic: string;
  phone: string;
  address: string;
  gender: string;
  rfid_uid: string | null;
  created_at: string;
  balance: number;
  status: string;
}

interface PassengersClientProps {
  initialPassengers: PassengerItem[];
}

export default function PassengersClient({ initialPassengers }: PassengersClientProps) {
  const [passengers, setPassengers] = useState<PassengerItem[]>(initialPassengers);
  const [search, setSearch] = useState('');
  
  // Drawer states
  const [selectedPassenger, setSelectedPassenger] = useState<PassengerItem | null>(null);
  const [trips, setTrips] = useState<any[]>([]);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'adjust' | 'trips'>('profile');

  // Change RFID form
  const [newRfid, setNewRfid] = useState('');
  const [rfidReason, setRfidReason] = useState('Admin Card Replacement');
  
  // Balance adjustment form
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustType, setAdjustType] = useState<'credit' | 'debit'>('credit');
  const [adjustReason, setAdjustReason] = useState('');

  // Status/action indicators
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const router = useRouter();

  // Load trips when drawer opens or tab switches to 'trips'
  useEffect(() => {
    if (!selectedPassenger || activeTab !== 'trips') return;
    const fetchTrips = async () => {
      setTripsLoading(true);
      try {
        const res = await fetch(`/api/admin/passenger-trips?passenger_id=${selectedPassenger.id}`);
        const data = await res.json();
        if (res.ok) {
          setTrips(data.trips || []);
        } else {
          console.error(data.error);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setTripsLoading(false);
      }
    };
    fetchTrips();
  }, [selectedPassenger, activeTab]);

  // Handle RFID Change Submission
  const handleRfidChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPassenger || !newRfid.trim()) return;
    setActionLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/change-rfid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passenger_id: selectedPassenger.id,
          new_rfid_uid: newRfid,
          reason: rfidReason,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ type: 'success', text: 'RFID UID linked successfully.' });
        const updated = { ...selectedPassenger, rfid_uid: newRfid };
        setSelectedPassenger(updated);
        setPassengers(passengers.map(p => p.id === selectedPassenger.id ? updated : p));
        setNewRfid('');
        router.refresh();
      } else {
        setMsg({ type: 'error', text: data.error || 'Failed to update RFID.' });
      }
    } catch (err) {
      console.error(err);
      setMsg({ type: 'error', text: 'Network connection failed.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Wallet Balance Adjustment
  const handleAdjustBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPassenger || !adjustAmount || !adjustReason.trim()) return;
    setActionLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/adjust-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passenger_id: selectedPassenger.id,
          amount: parseFloat(adjustAmount),
          type: adjustType,
          reason: adjustReason,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ type: 'success', text: `Wallet balance successfully ${adjustType}ed by LKR ${parseFloat(adjustAmount).toFixed(2)}.` });
        const updated = { ...selectedPassenger, balance: data.new_balance };
        setSelectedPassenger(updated);
        setPassengers(passengers.map(p => p.id === selectedPassenger.id ? updated : p));
        setAdjustAmount('');
        setAdjustReason('');
        router.refresh();
      } else {
        setMsg({ type: 'error', text: data.error || 'Failed to adjust balance.' });
      }
    } catch (err) {
      console.error(err);
      setMsg({ type: 'error', text: 'Network error.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Filter passengers
  const filteredPassengers = passengers.filter(p => {
    return p.full_name.toLowerCase().includes(search.toLowerCase()) || 
           p.nic.toLowerCase().includes(search.toLowerCase()) ||
           p.phone.includes(search);
  });

  const maskRfid = (uid: string | null) => {
    if (!uid) return 'Unlinked';
    if (uid.length <= 6) return uid;
    return `...${uid.substring(uid.length - 6)}`;
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '24px' }}>
        <Link href="/admin/dashboard" style={{ textDecoration: 'none', color: 'var(--text-secondary)' }}>
          <ArrowLeft size={24} />
        </Link>
        <h1 style={{ margin: 0, fontSize: '2rem' }}>Passenger Management</h1>
      </div>

      {/* Search Bar */}
      <div className="glass-panel" style={{ marginBottom: '30px' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: '450px' }}>
          <Search size={18} color="var(--text-secondary)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
          <input 
            type="text" 
            className="form-input" 
            placeholder="Search passenger by name, NIC, or phone..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '40px' }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              <th style={{ padding: '16px 20px' }}>Passenger Name</th>
              <th style={{ padding: '16px 20px' }}>NIC</th>
              <th style={{ padding: '16px 20px' }}>Phone</th>
              <th style={{ padding: '16px 20px' }}>RFID UID</th>
              <th style={{ padding: '16px 20px' }}>Wallet Balance</th>
              <th style={{ padding: '16px 20px' }}>Account Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredPassengers.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No passengers registered in the system.
                </td>
              </tr>
            ) : (
              filteredPassengers.map((p) => (
                <tr 
                  key={p.id}
                  onClick={() => { setSelectedPassenger(p); setMsg(null); setActiveTab('profile'); }}
                  style={{ borderBottom: '1px solid var(--glass-border)', cursor: 'pointer', transition: 'background 0.2s ease' }}
                  className="table-row-hover"
                >
                  <td style={{ padding: '16px 20px', fontWeight: 600 }}>{p.full_name}</td>
                  <td style={{ padding: '16px 20px' }}>{p.nic}</td>
                  <td style={{ padding: '16px 20px' }}>{p.phone}</td>
                  <td style={{ padding: '16px 20px', fontFamily: 'monospace', fontSize: '0.9rem' }}>{maskRfid(p.rfid_uid)}</td>
                  <td style={{ padding: '16px 20px', fontWeight: 700, color: 'var(--success)' }}>
                    LKR {Number(p.balance).toFixed(2)}
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <span style={{
                      background: p.status === 'active' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: p.status === 'active' ? 'var(--success)' : 'var(--danger)',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      textTransform: 'capitalize'
                    }}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* DETAILED INSPECTION DRAWER */}
      {selectedPassenger && (
        <div style={{ position: 'fixed', top: 0, right: 0, width: '100%', maxWidth: '500px', height: '100vh', background: 'var(--bg-color)', borderLeft: '1px solid var(--glass-border)', boxShadow: '-10px 0 30px rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px', borderBottom: '1px solid var(--glass-border)' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Passenger File</h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>ID: {selectedPassenger.id}</p>
            </div>
            <button onClick={() => setSelectedPassenger(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <X size={24} />
            </button>
          </div>

          {/* Tab Navigation */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.01)' }}>
            <button 
              onClick={() => { setActiveTab('profile'); setMsg(null); }}
              style={{ flex: 1, padding: '12px', border: 'none', background: 'none', borderBottom: activeTab === 'profile' ? '2px solid var(--primary-color)' : 'none', color: activeTab === 'profile' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
            >
              Profile & RFID
            </button>
            <button 
              onClick={() => { setActiveTab('adjust'); setMsg(null); }}
              style={{ flex: 1, padding: '12px', border: 'none', background: 'none', borderBottom: activeTab === 'adjust' ? '2px solid var(--primary-color)' : 'none', color: activeTab === 'adjust' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
            >
              Manual Wallet
            </button>
            <button 
              onClick={() => { setActiveTab('trips'); setMsg(null); }}
              style={{ flex: 1, padding: '12px', border: 'none', background: 'none', borderBottom: activeTab === 'trips' ? '2px solid var(--primary-color)' : 'none', color: activeTab === 'trips' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
            >
              Trips History
            </button>
          </div>

          <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
            
            {msg && (
              <div style={{
                background: msg.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: msg.type === 'success' ? '1px solid var(--success)' : '1px solid var(--danger)',
                color: msg.type === 'success' ? 'var(--success)' : 'var(--danger)',
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.85rem'
              }}>
                {msg.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                <span>{msg.text}</span>
              </div>
            )}

            {/* TAB 1: Profile & RFID */}
            {activeTab === 'profile' && (
              <div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(255,255,255,0.02)', padding: '18px', borderRadius: '12px', border: '1px solid var(--glass-border)', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Full Name</span>
                    <strong>{selectedPassenger.full_name}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>NIC</span>
                    <strong>{selectedPassenger.nic}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Phone</span>
                    <strong>{selectedPassenger.phone}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Gender</span>
                    <strong style={{ textTransform: 'capitalize' }}>{selectedPassenger.gender}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Joined Date</span>
                    <strong>{new Date(selectedPassenger.created_at).toLocaleDateString()}</strong>
                  </div>
                  <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '10px', marginTop: '5px' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>Permanent Address</span>
                    <span style={{ fontSize: '0.85rem' }}>{selectedPassenger.address}</span>
                  </div>
                </div>

                <div className="glass-panel" style={{ border: '1px solid var(--glass-border)' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CreditCard size={18} /> Update RFID Card
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '15px' }}>
                    Assign a new RFID Card UID to this passenger. This automatically voids their old card.
                  </p>

                  <form onSubmit={handleRfidChange}>
                    <div className="form-group" style={{ marginBottom: '10px' }}>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Current UID: <strong>{selectedPassenger.rfid_uid || 'Unlinked'}</strong></label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Enter new physical card UID" 
                        value={newRfid}
                        onChange={(e) => setNewRfid(e.target.value)}
                        required
                        style={{ padding: '8px 12px', fontSize: '0.9rem' }}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: '15px' }}>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Adjustment Reason</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={rfidReason}
                        onChange={(e) => setRfidReason(e.target.value)}
                        required
                        style={{ padding: '8px 12px', fontSize: '0.9rem' }}
                      />
                    </div>
                    <button 
                      type="submit" 
                      className="btn-primary" 
                      style={{ width: '100%', padding: '10px', fontSize: '0.85rem' }}
                      disabled={actionLoading}
                    >
                      {actionLoading ? 'Updating Card...' : 'Link New RFID Card'}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* TAB 2: Manual Wallet Adjustment */}
            {activeTab === 'adjust' && (
              <div>
                <div style={{ textAlign: 'center', background: 'rgba(16, 185, 129, 0.05)', padding: '20px', borderRadius: '12px', border: '1px solid var(--glass-border)', marginBottom: '24px' }}>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Current Balance</p>
                  <h2 style={{ fontSize: '2.5rem', margin: '5px 0', color: 'var(--success)' }}>LKR {Number(selectedPassenger.balance).toFixed(2)}</h2>
                </div>

                <div className="glass-panel" style={{ border: '1px solid var(--glass-border)' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <DollarSign size={18} /> Balance Override Form
                  </h4>
                  
                  <form onSubmit={handleAdjustBalance}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Adjustment Type</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <button
                          type="button"
                          onClick={() => setAdjustType('credit')}
                          className="btn-primary"
                          style={{
                            padding: '8px',
                            fontSize: '0.85rem',
                            background: adjustType === 'credit' ? 'var(--success)' : 'rgba(255,255,255,0.05)',
                            border: adjustType === 'credit' ? '1px solid var(--success)' : '1px solid var(--glass-border)'
                          }}
                        >
                          Credit (+)
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdjustType('debit')}
                          className="btn-primary"
                          style={{
                            padding: '8px',
                            fontSize: '0.85rem',
                            background: adjustType === 'debit' ? 'var(--danger)' : 'rgba(255,255,255,0.05)',
                            border: adjustType === 'debit' ? '1px solid var(--danger)' : '1px solid var(--glass-border)'
                          }}
                        >
                          Debit (-)
                        </button>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Amount (LKR)</label>
                      <input 
                        type="number" 
                        className="form-input" 
                        placeholder="e.g. 500.00" 
                        value={adjustAmount}
                        onChange={(e) => setAdjustAmount(e.target.value)}
                        required
                        min="1"
                        step="0.01"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Reason for Modification (Logged)</label>
                      <textarea 
                        className="form-input" 
                        rows={3} 
                        placeholder="e.g. Disputed fare refund or manual cash topup correction"
                        value={adjustReason}
                        onChange={(e) => setAdjustReason(e.target.value)}
                        required
                      />
                    </div>

                    <button 
                      type="submit" 
                      className="btn-primary" 
                      style={{ width: '100%', padding: '12px', background: adjustType === 'credit' ? 'var(--success)' : 'var(--danger)' }}
                      disabled={actionLoading}
                    >
                      {actionLoading ? 'Processing Override...' : `Execute ${adjustType === 'credit' ? 'Credit' : 'Debit'} Adjust`}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* TAB 3: Trip History */}
            {activeTab === 'trips' && (
              <div>
                {tripsLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                    <RefreshCw className="animate-spin" size={24} style={{ margin: '0 auto 12px' }} />
                    <p style={{ fontSize: '0.85rem', margin: 0 }}>Querying database logs...</p>
                  </div>
                ) : trips.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '30px' }}>
                    No journey records found for this passenger.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {trips.map((trip) => (
                      <div key={trip.id} className="glass-panel" style={{ border: '1px solid var(--glass-border)', padding: '15px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {new Date(trip.board_time).toLocaleString()}
                          </span>
                          <span style={{
                            fontSize: '0.7rem',
                            background: trip.status === 'completed' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: trip.status === 'completed' ? 'var(--success)' : 'var(--danger)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontWeight: 600,
                            textTransform: 'capitalize'
                          }}>
                            {trip.status}
                          </span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                          <div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Navigation size={12} color="var(--primary-color)" />
                              {trip.buses?.route_name || 'Generic Route'}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                              Bus: <strong>{trip.buses?.bus_number || 'N/A'}</strong> · Distance: <strong>{trip.distance_km ? `${Number(trip.distance_km).toFixed(1)} km` : '0.0 km'}</strong>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Fare:</span>
                            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent-color)' }}>
                              LKR {trip.fare ? Number(trip.fare).toFixed(2) : '0.00'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
