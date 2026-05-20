export default function Home() {
  return (
    <div style={{ textAlign: 'center', padding: '60px 0' }}>
      <h1>Welcome to BusTap</h1>
      <p style={{ fontSize: '1.2rem', maxWidth: '600px', margin: '0 auto 40px' }}>
        The smart, contactless bus ticketing platform for Sri Lankan local buses.
        Tap your card, track your journey, and manage your wallet easily.
      </p>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px' }}>
        <a href="/register">
          <button className="btn-primary">Register Now</button>
        </a>
        <a href="/dashboard">
          <button className="btn-primary" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>Go to Dashboard</button>
        </a>
      </div>
    </div>
  );
}
