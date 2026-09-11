import React, { useState } from 'react';
import { BrandLogo } from '@/components/BrandLogo';
import { registerUser, loginUser, isUsernameAvailable } from '@/lib/auth/userAuth';
import { Shield, Sparkles, Store, User, Lock, KeyRound, ArrowRight, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

interface AuthScreenProps {
  onSuccess: () => void;
}

export function AuthScreen({ onSuccess }: AuthScreenProps) {
  const [tab, setTab] = useState<'login' | 'register'>('register');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availabilityChecking, setAvailabilityChecking] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'available' | 'taken'>('idle');

  const handleCheckUsername = async (val: string) => {
    const clean = val.trim().toLowerCase();
    setUsername(clean);
    setError(null);
    if (clean.length < 3) {
      setUsernameStatus('idle');
      return;
    }
    setAvailabilityChecking(true);
    const avail = await isUsernameAvailable(clean);
    setAvailabilityChecking(false);
    setUsernameStatus(avail ? 'available' : 'taken');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please fill in both your username and password.');
      return;
    }
    setLoading(true);
    setError(null);
    const res = await loginUser({ username, password });
    setLoading(false);
    if (!res.ok) {
      setError(res.error || 'Login failed. Please check your credentials.');
      return;
    }
    onSuccess();
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password || !fullName.trim() || !storeName.trim()) {
      setError('All fields are required to establish your store account.');
      return;
    }
    setLoading(true);
    setError(null);
    const res = await registerUser({ username, password, fullName, storeName });
    setLoading(false);
    if (!res.ok) {
      setError(res.error || 'Registration failed.');
      return;
    }
    onSuccess();
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at 50% 20%, #151928 0%, #0a0d16 65%, #05070c 100%)',
      padding: '24px 16px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Spider-verse neon backdrop glow */}
      <div style={{
        position: 'absolute',
        top: '-15%',
        left: '20%',
        width: '450px',
        height: '450px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(239, 68, 68, 0.15) 0%, transparent 70%)',
        filter: 'blur(60px)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-10%',
        right: '25%',
        width: '500px',
        height: '500px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(56, 189, 248, 0.12) 0%, transparent 70%)',
        filter: 'blur(70px)',
        pointerEvents: 'none',
      }} />

      <div style={{
        width: '100%',
        maxWidth: '460px',
        background: 'rgba(17, 24, 39, 0.85)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 40px rgba(56, 189, 248, 0.08)',
        borderRadius: '24px',
        padding: '36px 32px',
        position: 'relative',
        zIndex: 10,
      }}>
        {/* Brand header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ display: 'inline-flex', justifyContent: 'center', marginBottom: '14px' }}>
            <BrandLogo size="lg" />
          </div>
          <h1 style={{
            margin: '0 0 6px',
            fontSize: '1.75rem',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color: '#f8fafc',
            fontFamily: "'Space Grotesk', system-ui, sans-serif",
          }}>
            Vendora Sovereign
          </h1>
          <p style={{
            margin: 0,
            fontSize: '0.875rem',
            color: '#94a3b8',
            lineHeight: 1.5,
          }}>
            Multi-Tenant Smart Ledger with Sovereign On-Device Persistence
          </p>
        </div>

        {/* Tab switcher */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '14px',
          padding: '4px',
          marginBottom: '24px',
        }}>
          <button
            type="button"
            onClick={() => { setTab('register'); setError(null); }}
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              fontSize: '0.875rem',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              background: tab === 'register' ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'transparent',
              color: tab === 'register' ? '#ffffff' : '#94a3b8',
              boxShadow: tab === 'register' ? '0 4px 14px rgba(239, 68, 68, 0.35)' : 'none',
            }}
          >
            Create Store (New Owner)
          </button>
          <button
            type="button"
            onClick={() => { setTab('login'); setError(null); }}
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              fontSize: '0.875rem',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              background: tab === 'login' ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'transparent',
              color: tab === 'login' ? '#ffffff' : '#94a3b8',
              boxShadow: tab === 'login' ? '0 4px 14px rgba(2, 132, 199, 0.35)' : 'none',
            }}
          >
            Sign In
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#fca5a5',
            padding: '12px 14px',
            borderRadius: '12px',
            fontSize: '0.85rem',
            marginBottom: '20px',
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0, color: '#ef4444' }} />
            <span>{error}</span>
          </div>
        )}

        {tab === 'register' ? (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                Store / Organisation Name
              </label>
              <div style={{ position: 'relative' }}>
                <Store size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#64748b' }} />
                <input
                  type="text"
                  required
                  placeholder="e.g. Om Shetkar Tailoring, Apex Kirana"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '11px 14px 11px 40px',
                    borderRadius: '12px',
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                Your Full Name (Owner)
              </label>
              <div style={{ position: 'relative' }}>
                <User size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#64748b' }} />
                <input
                  type="text"
                  required
                  placeholder="e.g. Om Shetkar"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '11px 14px 11px 40px',
                    borderRadius: '12px',
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1' }}>
                  Choose Unique Username
                </label>
                {availabilityChecking ? (
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Checking...</span>
                ) : usernameStatus === 'available' ? (
                  <span style={{ fontSize: '0.72rem', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <CheckCircle2 size={12} /> Available
                  </span>
                ) : usernameStatus === 'taken' ? (
                  <span style={{ fontSize: '0.72rem', color: '#f87171' }}>Taken</span>
                ) : null}
              </div>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '14px', top: '11px', color: '#64748b', fontWeight: 600 }}>@</span>
                <input
                  type="text"
                  required
                  placeholder="unique_username"
                  value={username}
                  onChange={(e) => handleCheckUsername(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '11px 14px 11px 36px',
                    borderRadius: '12px',
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: usernameStatus === 'available' ? '1px solid rgba(74, 222, 128, 0.5)' : usernameStatus === 'taken' ? '1px solid rgba(248, 113, 113, 0.5)' : '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#64748b' }} />
                <input
                  type="password"
                  required
                  placeholder="Min 4 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '11px 14px 11px 40px',
                    borderRadius: '12px',
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '10px',
                padding: '13px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 8px 24px rgba(239, 68, 68, 0.4)',
                opacity: loading ? 0.7 : 1,
                transition: 'all 0.2s ease',
              }}
            >
              {loading ? (
                <>
                  <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  Creating Sovereign Store...
                </>
              ) : (
                <>
                  Create Store & Enter as Owner
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                Username
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '14px', top: '11px', color: '#64748b', fontWeight: 600 }}>@</span>
                <input
                  type="text"
                  required
                  placeholder="your_username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.trim().toLowerCase())}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '11px 14px 11px 36px',
                    borderRadius: '12px',
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <KeyRound size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#64748b' }} />
                <input
                  type="password"
                  required
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '11px 14px 11px 40px',
                    borderRadius: '12px',
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '10px',
                padding: '13px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 8px 24px rgba(2, 132, 199, 0.4)',
                opacity: loading ? 0.7 : 1,
                transition: 'all 0.2s ease',
              }}
            >
              {loading ? (
                <>
                  <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  Verifying Credentials...
                </>
              ) : (
                <>
                  Sign In to Store Ledger
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        )}

        {/* Security badge footer */}
        <div style={{
          marginTop: '24px',
          paddingTop: '18px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
          fontSize: '0.78rem',
          color: '#64748b',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={14} style={{ color: '#38bdf8' }} />
            <span>SHA-256 Multi-Tenant Store Isolation · Supabase Cloud Sync</span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Clear all local browser data and caches for a clean slate?')) {
                try {
                  localStorage.clear();
                  indexedDB.deleteDatabase('vendora_orders_db');
                } catch {}
                window.location.reload();
              }
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              fontSize: '0.75rem',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: '4px 8px',
              opacity: 0.8,
            }}
          >
            Reset Device Cache & Clean Slate
          </button>
        </div>
      </div>
    </div>
  );
}
