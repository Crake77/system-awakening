import React, { useState } from 'react';
import { supabase } from '../lib/supabase.js';

const inputStyle = {
  width: '100%', padding: '8px 10px', marginBottom: 12,
  background: '#111', border: '1px solid #555', borderRadius: 4,
  color: '#eee', fontSize: 14, boxSizing: 'border-box',
};

const btnStyle = (color = '#5b4fcf') => ({
  width: '100%', padding: '9px', background: color,
  border: 'none', borderRadius: 4, color: '#fff',
  fontSize: 14, cursor: 'pointer',
});

export default function AuthModal({ onClose }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('email'); // 'email' | 'code'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSendCode(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setStep('code');
  }

  async function handleVerifyCode(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: 'email',
    });
    setLoading(false);
    if (error) { setError('Invalid or expired code. Try again.'); return; }
    onClose();
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

        {step === 'email' ? (
          <>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#888' }}>
              Enter your email — we'll send a 6-digit code.
            </p>
            <form onSubmit={handleSendCode}>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={inputStyle}
              />
              {error && <p style={{ color: '#f66', fontSize: 12, margin: '0 0 8px' }}>{error}</p>}
              <button type="submit" disabled={loading} style={btnStyle()}>
                {loading ? 'Sending...' : 'Send Code'}
              </button>
            </form>
          </>
        ) : (
          <>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#888' }}>
              Enter the 6-digit code sent to <strong style={{ color: '#ccc' }}>{email}</strong>.
            </p>
            <form onSubmit={handleVerifyCode}>
              <input
                type="text"
                inputMode="numeric"
                placeholder="000000"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                required
                autoFocus
                style={{ ...inputStyle, fontSize: 24, letterSpacing: 8, textAlign: 'center' }}
              />
              {error && <p style={{ color: '#f66', fontSize: 12, margin: '0 0 8px' }}>{error}</p>}
              <button type="submit" disabled={loading || code.length < 6} style={btnStyle()}>
                {loading ? 'Verifying...' : 'Verify Code'}
              </button>
            </form>
            <button
              onClick={() => { setStep('email'); setCode(''); setError(''); }}
              style={{ ...btnStyle('#333'), marginTop: 8 }}
            >
              Use a different email
            </button>
          </>
        )}

        <button
          onClick={onClose}
          style={{
            marginTop: 12, width: '100%', padding: '7px',
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
