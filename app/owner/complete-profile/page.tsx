'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { ShieldCheck, Bus, Plus, Trash2, ArrowRight } from 'lucide-react';
import posthog from 'posthog-js';

export default function CompleteProfilePage() {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const router = useRouter();
  const supabase = createClient();

  // Form fields
  const [fullName, setFullName] = useState('');
  const [nic, setNic] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [busList, setBusList] = useState<string[]>(['']);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUserEmail(user.email || '');

      // Check if profile is already complete
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'bus_owner') {
        router.push('/dashboard');
        return;
      }

      const { data: owner } = await supabase
        .from('bus_owners')
        .select('status')
        .eq('id', user.id)
        .single();

      if (owner) {
        // Already completed profile, send to dashboard holding/home page
        router.push('/owner/dashboard');
      } else {
        setChecking(false);
      }
    };
    checkUser();
  }, [router, supabase]);

  const handleAddBus = () => {
    setBusList([...busList, '']);
  };

  const handleRemoveBus = (index: number) => {
    if (busList.length > 1) {
      setBusList(busList.filter((_, i) => i !== index));
    }
  };

  const handleBusNumberChange = (index: number, value: string) => {
    const newList = [...busList];
    newList[index] = value;
    setBusList(newList);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validations
    if (!fullName || !nic || !phone || !address) {
      setError('Please fill in all personal information fields.');
      setLoading(false);
      return;
    }

    const validBuses = busList.map(b => b.trim()).filter(b => b !== '');
    if (validBuses.length === 0) {
      setError('Please add at least one bus number.');
      setLoading(false);
      return;
    }

    const nicRegex = /^\d{9}[vVxX]$|^\d{12}$/;
    if (!nicRegex.test(nic)) {
      setError('Invalid NIC format. Must be 9 digits followed by V/X, or 12 digits.');
      setLoading(false);
      return;
    }

    const phoneRegex = /^\+94\d{9}$/;
    if (!phoneRegex.test(phone.replace(/\s+/g, ''))) {
      setError('Invalid phone number. Must be in Sri Lankan format (e.g. +94771234567).');
      setLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User authentication lost. Please log in again.');

      // 1. Insert into bus_owners
      const { error: ownerError } = await supabase.from('bus_owners').insert([
        {
          id: user.id,
          full_name: fullName,
          nic: nic,
          phone: phone,
          address: address,
          email: userEmail,
          status: 'pending',
        }
      ]);

      if (ownerError) {
        throw new Error('Error saving owner profile: ' + ownerError.message);
      }

      // 2. Insert into buses (one row per bus number)
      const busesToInsert = validBuses.map((busNum) => ({
        owner_id: user.id,
        bus_number: busNum,
        status: 'active',
      }));

      const { error: busesError } = await supabase.from('buses').insert(busesToInsert);
      if (busesError) {
        throw new Error('Error registering buses: ' + busesError.message);
      }

      // Track profile completion event in PostHog
      posthog.capture('owner_profile_completed', {
        id: user.id,
        bus_count: validBuses.length,
      });

      setSubmitted(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div style={{ textAlign: 'center', marginTop: '100px' }}>
        <p>Loading application details...</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={{ maxWidth: '600px', margin: '60px auto', padding: '0 15px' }}>
        <div className="glass-panel" style={{ textAlign: 'center', padding: '50px 30px' }}>
          <div style={{ background: 'rgba(59, 130, 246, 0.1)', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <ShieldCheck size={48} color="var(--primary-color)" />
          </div>
          <h1 style={{ marginBottom: '16px' }}>Application Under Review</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', lineHeight: '1.6', marginBottom: '30px' }}>
            Thank you, <strong>{fullName}</strong>. Your profile details and bus registrations have been successfully submitted. 
            An administrator will review your application shortly.
          </p>
          <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '24px' }}>
            <button 
              onClick={() => router.push('/owner/dashboard')} 
              className="btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              Go to Owner Panel <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '700px', margin: '40px auto', padding: '0 15px' }}>
      <div className="glass-panel" style={{ padding: '40px' }}>
        <h1 style={{ background: 'linear-gradient(90deg, var(--primary-color), var(--accent-color))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '8px' }}>
          Complete Bus Owner Profile
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
          Please provide your details and register your initial bus fleet.
        </p>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '12px', borderRadius: '8px', marginBottom: '24px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="form-input" placeholder="e.g. Bandara Perera" required />
            </div>
            <div className="form-group">
              <label className="form-label">NIC (National Identity Card)</label>
              <input type="text" value={nic} onChange={(e) => setNic(e.target.value)} className="form-input" placeholder="e.g. 198512345678" required />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="form-input" placeholder="+94 7X XXX XXXX" required />
            </div>
            <div className="form-group">
              <label className="form-label">Email (Account Email)</label>
              <input type="email" value={userEmail} disabled className="form-input" style={{ opacity: 0.6, cursor: 'not-allowed' }} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Permanent Resident Address</label>
            <textarea value={address} onChange={(e) => setAddress(e.target.value)} className="form-input" rows={3} placeholder="Your residential address" required></textarea>
          </div>

          {/* Dynamic Bus Input List */}
          <div style={{ borderTop: '1px solid var(--glass-border)', marginTop: '30px', paddingTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Bus Fleet Registration</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>List all the bus license plate numbers you own.</p>
              </div>
              <button 
                type="button" 
                onClick={handleAddBus}
                className="btn-primary"
                style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={16} /> Add Bus
              </button>
            </div>

            {busList.map((bus, index) => (
              <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px' }}>
                  <Bus size={18} color="var(--text-secondary)" />
                </div>
                <input 
                  type="text" 
                  value={bus} 
                  onChange={(e) => handleBusNumberChange(index, e.target.value)} 
                  className="form-input" 
                  placeholder="e.g. WP ND-1234 or NA-5678" 
                  required
                  style={{ flex: 1 }}
                />
                <button 
                  type="button" 
                  onClick={() => handleRemoveBus(index)}
                  disabled={busList.length === 1}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: busList.length === 1 ? 'rgba(255, 255, 255, 0.1)' : 'var(--danger)',
                    cursor: busList.length === 1 ? 'not-allowed' : 'pointer',
                    padding: '8px',
                  }}
                >
                  <Trash2 size={20} />
                </button>
              </div>
            ))}
          </div>

          <button 
            type="submit" 
            className="btn-primary" 
            style={{ width: '100%', marginTop: '30px', padding: '14px' }}
            disabled={loading}
          >
            {loading ? 'Submitting Details...' : 'Submit Profile for Approval'}
          </button>
        </form>
      </div>
    </div>
  );
}
