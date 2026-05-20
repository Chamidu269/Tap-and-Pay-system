'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Bus, Users, DollarSign, Activity, Check, X, Search, CreditCard, 
  ArrowRight, ShieldCheck, AlertCircle, FileText, Ban 
} from 'lucide-react';
import Link from 'next/link';

interface RequestItem {
  id: string;
  full_name: string;
  nic: string;
  phone: string;
  email: string;
  address: string;
  status: string;
  created_at: string;
  bus_count: number;
  bus_numbers: string[];
}

interface DashboardClientProps {
  kpis: {
    total_passengers: string;
    total_bus_owners: string;
    total_buses: string;
    total_transactions: string;
    total_revenue: number;
  } | null;
  initialRequests: RequestItem[];
}

export default function DashboardClient({ kpis, initialRequests }: DashboardClientProps) {
  const [requests, setRequests] = useState<RequestItem[]>(initialRequests);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Rejection modal state
  const [rejectingOwnerId, setRejectingOwnerId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  
  // RFID search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedPassenger, setSelectedPassenger] = useState<any | null>(null);
  const [newRfid, setNewRfid] = useState('');
  const [rfidReason, setRfidReason] = useState('New Card Issue');
  const [rfidSuccessMsg, setRfidSuccessMsg] = useState('');
  const [rfidErrorMsg, setRfidErrorMsg] = useState('');

  const router = useRouter();

  // Approve Bus Owner Request
  const handleApprove = async (ownerId: string) => {
    if (!confirm('Are you sure you want to approve this bus owner?')) return;
    setActionLoading(ownerId);
    try {
      const res = await fetch('/api/admin/approve-owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner_id: ownerId }),
      });
      if (res.ok) {
        setRequests(requests.filter(req => req.id !== ownerId));
        router.refresh();
      } else {
        const data = await res.json();
        alert('Failed to approve: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error(err);
      alert('Network error during approval.');
    } finally {
      setActionLoading(null);
    }
  };

  // Reject Bus Owner Request
  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingOwnerId || !rejectionReason.trim()) return;
    setActionLoading(rejectingOwnerId);
    try {
      const res = await fetch('/api/admin/reject-owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner_id: rejectingOwnerId, reason: rejectionReason }),
      });
      if (res.ok) {
        setRequests(requests.filter(req => req.id !== rejectingOwnerId));
        setRejectingOwnerId(null);
        setRejectionReason('');
        router.refresh();
      } else {
        const data = await res.json();
        alert('Failed to reject: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error(err);
      alert('Network error during rejection.');
    } finally {
      setActionLoading(null);
    }
  };

  // RFID Passenger Search
  const handlePassengerSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setSelectedPassenger(null);
    setRfidSuccessMsg('');
    setRfidErrorMsg('');
    try {
      const res = await fetch(`/api/admin/search-passenger?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (res.ok) {
        setSearchResults(data.passengers || []);
      } else {
        setRfidErrorMsg(data.error || 'Failed to search passengers');
      }
    } catch (err) {
      console.error(err);
      setRfidErrorMsg('Search failed due to network error.');
    } finally {
      setSearchLoading(false);
    }
  };

  // RFID Update Submit
  const handleRfidUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPassenger || !newRfid.trim()) return;
    setActionLoading('rfid');
    setRfidSuccessMsg('');
    setRfidErrorMsg('');
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
        setRfidSuccessMsg(`Successfully updated RFID for ${selectedPassenger.full_name}.`);
        setSelectedPassenger((prev: any) => ({ ...prev, rfid_uid: newRfid }));
        setNewRfid('');
        setSearchResults(searchResults.map(p => p.id === selectedPassenger.id ? { ...p, rfid_uid: newRfid } : p));
      } else {
        setRfidErrorMsg(data.error || 'Failed to update RFID UID');
      }
    } catch (err) {
      console.error(err);
      setRfidErrorMsg('Network error while updating RFID UID.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div>
      {/* KPI Cards Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '40px' }}>
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '15px', borderRadius: '12px' }}>
            <Bus size={28} color="var(--primary-color)" />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>Active Buses</p>
            <h3 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>{kpis?.total_buses || '0'}</h3>
          </div>
        </div>

        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '15px', borderRadius: '12px' }}>
            <Users size={28} color="var(--success)" />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>Passengers Registered</p>
            <h3 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>{kpis?.total_passengers || '0'}</h3>
          </div>
        </div>

        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ background: 'rgba(139, 92, 246, 0.1)', padding: '15px', borderRadius: '12px' }}>
            <Activity size={28} color="var(--accent-color)" />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>Total Transactions</p>
            <h3 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>{kpis?.total_transactions || '0'}</h3>
          </div>
        </div>

        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '15px', borderRadius: '12px' }}>
            <DollarSign size={28} color="#f59e0b" />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>Total Revenue (LKR)</p>
            <h3 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>
              {kpis?.total_revenue ? Number(kpis.total_revenue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
            </h3>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '30px', marginBottom: '40px' }}>
        
        {/* LEFT COLUMN: Bus Owner Requests */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>Bus Owner Requests</h2>
            <span style={{ background: 'rgba(59, 130, 246, 0.15)', color: 'var(--primary-color)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>
              {requests.length} Pending
            </span>
          </div>

          {requests.length === 0 ? (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
              <ShieldCheck size={36} color="var(--success)" style={{ margin: '0 auto 12px' }} />
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>All registration requests processed. Outstanding cue is clear.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {requests.map((req) => (
                <div key={req.id} className="glass-panel" style={{ borderLeft: '4px solid var(--primary-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '15px', marginBottom: '15px' }}>
                    <div>
                      <h3 style={{ margin: '0 0 4px 0', fontSize: '1.15rem' }}>{req.full_name}</h3>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        NIC: <strong>{req.nic}</strong> · Phone: <strong>{req.phone}</strong> · Email: <strong>{req.email}</strong>
                      </p>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Address: <em>{req.address}</em>
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600 }}>
                        <Bus size={14} /> {req.bus_count} {req.bus_count === 1 ? 'Bus' : 'Buses'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '20px', background: 'rgba(0,0,0,0.15)', padding: '10px', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginRight: '6px', alignSelf: 'center' }}>Buses requested:</span>
                    {req.bus_numbers && req.bus_numbers.map((b, idx) => (
                      <span key={idx} style={{ background: 'var(--primary-color)', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 500 }}>
                        {b}
                      </span>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button 
                      onClick={() => handleApprove(req.id)}
                      disabled={actionLoading !== null}
                      className="btn-primary" 
                      style={{ padding: '8px 16px', fontSize: '0.85rem', background: 'var(--success)', color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Check size={16} /> Approve
                    </button>
                    <button 
                      onClick={() => setRejectingOwnerId(req.id)}
                      disabled={actionLoading !== null}
                      className="btn-primary" 
                      style={{ padding: '8px 16px', fontSize: '0.85rem', background: 'var(--danger)', color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <X size={16} /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: RFID Card Management & Actions */}
        <div style={{ marginTop: '20px' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '20px' }}>RFID Card Management</h2>
          <div className="glass-panel" style={{ marginBottom: '30px' }}>
            <form onSubmit={handlePassengerSearch} style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Search passenger by Name or NIC" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                required
              />
              <button type="submit" className="btn-primary" style={{ padding: '10px' }} disabled={searchLoading}>
                <Search size={20} />
              </button>
            </form>

            {searchResults.length > 0 && !selectedPassenger && (
              <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--glass-border)', borderRadius: '8px', background: 'rgba(0,0,0,0.2)' }}>
                {searchResults.map((p) => (
                  <div 
                    key={p.id}
                    onClick={() => {
                      setSelectedPassenger(p);
                      setSearchResults([]);
                    }}
                    style={{ padding: '10px 15px', borderBottom: '1px solid var(--glass-border)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    className="passenger-search-row"
                  >
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{p.full_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>NIC: {p.nic} · RFID: {p.rfid_uid || 'None'}</div>
                    </div>
                    <ArrowRight size={16} color="var(--text-secondary)" />
                  </div>
                ))}
              </div>
            )}

            {rfidErrorMsg && <div style={{ color: 'var(--danger)', fontSize: '0.85rem', margin: '10px 0' }}>{rfidErrorMsg}</div>}
            {rfidSuccessMsg && <div style={{ color: 'var(--success)', fontSize: '0.85rem', margin: '10px 0' }}>{rfidSuccessMsg}</div>}

            {selectedPassenger && (
              <div style={{ marginTop: '15px', background: 'rgba(255, 255, 255, 0.03)', padding: '15px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.95rem' }}>{selectedPassenger.full_name}</h4>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>NIC: {selectedPassenger.nic}</p>
                  </div>
                  <button onClick={() => setSelectedPassenger(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.75rem' }}>
                    Cancel Selection
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontSize: '0.85rem' }}>
                  <CreditCard size={16} />
                  <span>Current RFID UID: <strong>{selectedPassenger.rfid_uid || 'Unlinked'}</strong></span>
                </div>

                <form onSubmit={handleRfidUpdate}>
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>New RFID UID</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Enter card physical UID" 
                      value={newRfid}
                      onChange={(e) => setNewRfid(e.target.value)}
                      required
                      style={{ padding: '8px 12px', fontSize: '0.9rem' }}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: '15px' }}>
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Reason for Change</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={rfidReason}
                      onChange={(e) => setRfidReason(e.target.value)}
                      placeholder="e.g. Card replacement, Lost card"
                      required
                      style={{ padding: '8px 12px', fontSize: '0.9rem' }}
                    />
                  </div>
                  <button 
                    type="submit" 
                    className="btn-primary" 
                    style={{ width: '100%', padding: '10px', fontSize: '0.85rem' }}
                    disabled={actionLoading === 'rfid'}
                  >
                    {actionLoading === 'rfid' ? 'Updating RFID UID...' : 'Link RFID Card'}
                  </button>
                </form>
              </div>
            )}
          </div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '20px' }}>Quick Navigation</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Link href="/admin/bus-owners" style={{ textDecoration: 'none' }}>
              <div className="glass-panel navigation-link-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', transition: 'transform 0.2s ease', cursor: 'pointer' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', margin: '0 0 4px 0', color: 'var(--text-primary)' }}>Manage Bus Owners</h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>View, inspect profiles, audit, or suspend owner logs.</p>
                </div>
                <ArrowRight size={18} />
              </div>
            </Link>

            <Link href="/admin/passengers" style={{ textDecoration: 'none' }}>
              <div className="glass-panel navigation-link-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', transition: 'transform 0.2s ease', cursor: 'pointer' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', margin: '0 0 4px 0', color: 'var(--text-primary)' }}>Manage Passengers</h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Audit transaction logs, manage card balances, or view trips.</p>
                </div>
                <ArrowRight size={18} />
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* REJECTION MODAL */}
      {rejectingOwnerId && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '15px' }}>
          <div className="glass-panel" style={{ maxWidth: '450px', width: '100%', background: 'var(--bg-color)', border: '1px solid var(--danger)', padding: '30px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--danger)', marginBottom: '16px' }}>
              <Ban size={24} />
              <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Reject Application</h3>
            </div>
            
            <form onSubmit={handleRejectSubmit}>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Provide Rejection Reason</label>
                <textarea 
                  className="form-input" 
                  value={rejectionReason} 
                  onChange={(e) => setRejectionReason(e.target.value)} 
                  rows={4} 
                  placeholder="Tell the owner why their application was rejected..." 
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button 
                  type="button" 
                  onClick={() => { setRejectingOwnerId(null); setRejectionReason(''); }} 
                  className="btn-primary" 
                  style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '8px 16px', fontSize: '0.85rem' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary" 
                  style={{ background: 'var(--danger)', padding: '8px 16px', fontSize: '0.85rem' }}
                  disabled={actionLoading !== null}
                >
                  Submit Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
