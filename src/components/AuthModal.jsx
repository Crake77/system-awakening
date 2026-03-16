import React, { useState } from 'react';
import { supabase } from '../lib/supabase.js';

export default function AuthModal({ onClose }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setSent(true);
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: '#1a1a2e', border: '1px solid #444', borderRadius: 8,
        padding: 32, width: 320, color: '#ccc',
      }}>
        <h2 style={{ margin: '0 0 8px', color: '#a6f' }}>Sign In to Sync Saves</h2>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#888' }}>
          Enter your email for a magic link — no password needed.
        </p>

        {sent ? (
          <p style={{ color: '#6f6', textAlign: 'center' }}>
            Check your email for a login link!
          </p>
        ) : (
          <form onSubmit={handleLogin}>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{
                width: '100%', padding: '8px 10px', marginBottom: 12,
                background: '#111', border: '1px solid #555', borderRadius: 4,
                color: '#eee', fontSize: 14, boxSizing: 'border-box',
              }}
            />
            {error && <p style={{ color: '#f66', fontSize: 12, margin: '0 0 8px' }}>{error}</p>}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '9px', background: '#5b4fcf',
                border: 'none', borderRadius: 4, color: '#fff',
                fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Sending...' : 'Send Magic Link'}
            </button>
          </form>
        )}

        <button
          onClick={onClose}
          style={{
            marginTop: 16, width: '100%', padding: '7px',
            background: 'transparent', border: '1px solid #444',
            borderRadius: 4, color: '#888', fontSize: 13, cursor: 'pointer',
          }}
        >
          Play without signing in
        </button>
      </div>
    </div>
  );
}
