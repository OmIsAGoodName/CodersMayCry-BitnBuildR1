import React, { useState } from 'react';
import { BrandLogo } from '@/components/BrandLogo';
import { registerUser, loginUser, isUsernameAvailable, registerEmployeeUser } from '@/lib/auth/userAuth';
import { Shield, Sparkles, Store, User, Lock, KeyRound, ArrowRight, CheckCircle2, AlertCircle, RefreshCw, Users, UserCheck } from 'lucide-react';

interface AuthScreenProps {
  onSuccess: () => void;
}

type AuthTab = 'register_owner' | 'login' | 'register_employee';

export function AuthScreen({ onSuccess }: AuthScreenProps) {
  const [tab, setTab] = useState<AuthTab>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availabilityChecking, setAvailabilityChecking] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'available' | 'taken'>('idle');

  const handleCheckUsername = async (val: string) => {
    const clean = val.trim().toLowerCase().replace(/^@/, '');
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
    try {
      indexedDB.deleteDatabase('vendora_orders_db');
      localStorage.removeItem('vendora-orders-v1');
      localStorage.removeItem('vendora_pending_sync_queue');
    } catch {}
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

  const handleOwnerRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      indexedDB.deleteDatabase('vendora_orders_db');
      localStorage.removeItem('vendora-orders-v1');
      localStorage.removeItem('vendora_pending_sync_queue');
    } catch {}
    if (!username.trim() || !password || !fullName.trim() || !storeName.trim()) {
      setError('All fields are required to establish your store account.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await registerUser({ username, password, fullName, storeName });
      if (!res.ok) {
        setError(res.error || 'Registration failed.');
        setLoading(false);
        return;
      }
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred during store creation.');
      setLoading(false);
    }
  };

  const handleEmployeeRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      indexedDB.deleteDatabase('vendora_orders_db');
      localStorage.removeItem('vendora-orders-v1');
      localStorage.removeItem('vendora_pending_sync_queue');
    } catch {}
    if (!username.trim() || !password || !fullName.trim()) {
      setError('Please fill in full name, username, and password.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await registerEmployeeUser({ username, password, fullName });
      if (!res.ok) {
        setError(res.error || 'Employee registration failed.');
        setLoading(false);
        return;
      }
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred during employee registration.');
      setLoading(false);
    }
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
        width: '400px',
        height: '400px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, transparent 70%)',
        filter: 'blur(60px)',
        pointerEvents: 'none',
      }} />

      <div style={{
        width: '100%',
        maxWidth: '480px',
        background: 'rgba(18, 24, 38, 0.85)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '20px',
        padding: '36px 30px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(16px)',
        zIndex: 10,
        position: 'relative',
      }}>
        {/* Brand Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ marginBottom: '14px', transform: 'scale(1.15)' }}>
            <BrandLogo />
          </div>
          <h1 style={{
            margin: '0 0 6px',
            fontSize: '1.6rem',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            background: 'linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Vendora Sovereign
          </h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', maxWidth: '340px', lineHeight: 1.4 }}>
            Multi-Tenant Ledger & Offline Order Management System
          </p>
        </div>

        {/* 3 Clean Modern Auth Mode Tabs */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1.2fr',
          gap: '4px',
          background: 'rgba(10, 14, 23, 0.7)',
          padding: '4px',
          borderRadius: '14px',
          marginBottom: '22px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}>
          <button
            type="button"
            onClick={() => { setTab('login'); setError(null); }}
            style={{
              padding: '9px 4px',
              borderRadius: '10px',
              border: 'none',
              background: tab === 'login' ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'transparent',
              color: tab === 'login' ? '#ffffff' : '#94a3b8',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              transition: 'all 0.2s ease',
              boxShadow: tab === 'login' ? '0 4px 12px rgba(2, 132, 199, 0.3)' : 'none',
            }}
          >
            <KeyRound size={13} />
            <span>Sign In</span>
          </button>

          <button
            type="button"
            onClick={() => { setTab('register_owner'); setError(null); }}
            style={{
              padding: '9px 4px',
              borderRadius: '10px',
              border: 'none',
              background: tab === 'register_owner' ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)' : 'transparent',
              color: tab === 'register_owner' ? '#ffffff' : '#94a3b8',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              transition: 'all 0.2s ease',
              boxShadow: tab === 'register_owner' ? '0 4px 12px rgba(239, 68, 68, 0.3)' : 'none',
            }}
          >
            <Store size={13} />
            <span>Owner</span>
          </button>

          <button
            type="button"
            onClick={() => { setTab('register_employee'); setError(null); }}
            style={{
              padding: '9px 4px',
              borderRadius: '10px',
              border: 'none',
              background: tab === 'register_employee' ? 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' : 'transparent',
              color: tab === 'register_employee' ? '#ffffff' : '#94a3b8',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              transition: 'all 0.2s ease',
              boxShadow: tab === 'register_employee' ? '0 4px 12px rgba(139, 92, 246, 0.3)' : 'none',
            }}
          >
            <Users size={13} />
            <span>Employee</span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '10px',
            padding: '10px 14px',
            marginBottom: '18px',
            color: '#fca5a5',
            fontSize: '0.82rem',
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0, color: '#ef4444' }} />
            <span>{error}</span>
          </div>
        )}

        {/* TAB 1: SIGN IN (UNIVERSAL FOR OWNER & EMPLOYEE) */}
        {tab === 'login' && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ margin: '0 0 4px', fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.4 }}>
              Sign in with your <strong>@username</strong> to load your store orders and role permissions.
            </p>

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
                  onChange={(e) => setUsername(e.target.value.trim().toLowerCase().replace(/^@/, ''))}
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

        {/* TAB 2: OWNER REGISTRATION */}
        {tab === 'register_owner' && (
          <form onSubmit={handleOwnerRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ margin: '0 0 2px', fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.4 }}>
              Register as a <strong>Store Owner</strong> to establish an isolated ledger and invite employees.
            </p>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                Store / Business Name
              </label>
              <div style={{ position: 'relative' }}>
                <Store size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#64748b' }} />
                <input
                  type="text"
                  required
                  placeholder="e.g. Om Electricals & Hardware"
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
                Owner Full Name
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
                  Owner Username
                </label>
                {availabilityChecking && <span style={{ fontSize: '0.72rem', color: '#38bdf8' }}>Checking availability...</span>}
                {usernameStatus === 'available' && <span style={{ fontSize: '0.72rem', color: '#4ade80' }}>✓ Available</span>}
                {usernameStatus === 'taken' && <span style={{ fontSize: '0.72rem', color: '#f87171' }}>✗ Taken</span>}
              </div>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '14px', top: '11px', color: '#64748b', fontWeight: 600 }}>@</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. omshetkar"
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
                marginTop: '8px',
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
        )}

        {/* TAB 3: JOIN AS EMPLOYEE */}
        {tab === 'register_employee' && (
          <form onSubmit={handleEmployeeRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{
              background: 'rgba(139, 92, 246, 0.12)',
              border: '1px solid rgba(139, 92, 246, 0.25)',
              borderRadius: '12px',
              padding: '10px 14px',
              fontSize: '0.8rem',
              color: '#c4b5fd',
              lineHeight: 1.4,
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
            }}>
              <UserCheck size={16} style={{ flexShrink: 0, marginTop: '2px', color: '#a78bfa' }} />
              <span>
                Register your employee account. Once your store owner inputs your <strong>@username</strong> in their Employees tab, you can accept and manage orders under them!
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                Your Full Name
              </label>
              <div style={{ position: 'relative' }}>
                <User size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#64748b' }} />
                <input
                  type="text"
                  required
                  placeholder="e.g. Anand Verma"
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
                  Choose Your Username
                </label>
                {availabilityChecking && <span style={{ fontSize: '0.72rem', color: '#38bdf8' }}>Checking...</span>}
                {usernameStatus === 'available' && <span style={{ fontSize: '0.72rem', color: '#4ade80' }}>✓ Available</span>}
                {usernameStatus === 'taken' && <span style={{ fontSize: '0.72rem', color: '#f87171' }}>✗ Taken</span>}
              </div>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '14px', top: '11px', color: '#64748b', fontWeight: 600 }}>@</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. anand_ops"
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
              <small style={{ display: 'block', marginTop: '4px', fontSize: '0.72rem', color: '#94a3b8' }}>
                You will share this username with your store owner so they can invite you.
              </small>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                Create Password
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
                marginTop: '8px',
                padding: '13px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 8px 24px rgba(139, 92, 246, 0.4)',
                opacity: loading ? 0.7 : 1,
                transition: 'all 0.2s ease',
              }}
            >
              {loading ? (
                <>
                  <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  Creating Employee Account...
                </>
              ) : (
                <>
                  Create Employee Account
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
            <span>SHA-256 Multi-Tenant Isolation · Supabase Cloud Sync</span>
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
