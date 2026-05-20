'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Wallet, ShieldCheck, CreditCard, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function RechargePage() {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleQuickSelect = (value: number) => {
    setAmount(value.toString());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const rechargeVal = parseFloat(amount);
    if (isNaN(rechargeVal) || rechargeVal < 100) {
      setError('Minimum recharge amount is LKR 100.00');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/payment/create-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount: rechargeVal }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to initiate checkout session');
      }

      if (data.url) {
        // Redirect to Stripe checkout
        window.location.href = data.url;
      } else {
        throw new Error('No redirect URL returned from checkout session.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Network error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '480px', margin: '60px auto', padding: '0 15px' }}>
      <div className="glass-panel" style={{ padding: '40px 30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
          <Link href="/dashboard" style={{ textDecoration: 'none', color: 'var(--text-secondary)' }}>
            <ArrowLeft size={22} />
          </Link>
          <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Top Up Wallet</h1>
        </div>

        <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.15)', padding: '15px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '30px' }}>
          <Wallet size={24} color="var(--success)" />
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Recharge your digital wallet instantly using credit/debit card. Safe transit payments.
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label">Enter Top-Up Amount (LKR)</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '15px', top: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>LKR</span>
              <input 
                type="number" 
                className="form-input" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00" 
                required
                min="100"
                step="50"
                style={{ paddingLeft: '55px', fontSize: '1.25rem', fontWeight: 700 }}
              />
            </div>
          </div>

          <label className="form-label" style={{ marginBottom: '10px' }}>Quick Preset Recharges</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '30px' }}>
            {[100, 500, 1000].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => handleQuickSelect(val)}
                className="btn-primary"
                style={{
                  background: amount === val.toString() ? 'rgba(59, 130, 246, 0.15)' : 'var(--glass-bg)',
                  border: amount === val.toString() ? '2px solid var(--primary-color)' : '1px solid var(--glass-border)',
                  color: amount === val.toString() ? 'var(--text-primary)' : 'var(--text-secondary)',
                  padding: '12px',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                }}
              >
                + LKR {val}
              </button>
            ))}
          </div>

          <button 
            type="submit" 
            className="btn-primary" 
            style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '14px' }}
            disabled={loading}
          >
            {loading ? 'Routing to Secure Gateway...' : 'Proceed to Checkout'} <ChevronRight size={18} />
          </button>
        </form>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', marginTop: '24px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          <ShieldCheck size={14} color="var(--success)" /> <span>Stripe 256-bit encrypted secure gateway</span>
        </div>
      </div>
    </div>
  );
}
