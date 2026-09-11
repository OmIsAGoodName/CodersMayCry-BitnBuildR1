import React, { useState } from 'react';
import { useOrgAuth } from '@/context/OrgAuthContext';
import { X, Lock, Mail, Smartphone, Building2, User, KeyRound, Check, AlertCircle, ArrowRight } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const {
    user,
    organization,
    currentMember,
    loginWithEmail,
    signUpWithEmail,
    loginWithStoreCode,
    logout
  } = useOrgAuth();

  const [activeTab, setActiveTab] = useState<'store_code' | 'email_login' | 'signup'>('store_code');

  // Store Code form
  const [storeCode, setStoreCode] = useState(organization.slug || 'vendora-main');
  const [memberName, setMemberName] = useState('');

  // Email form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [storeName, setStoreName] = useState('');

  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStoreCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setBusy(true);
    const res = await loginWithStoreCode(storeCode, memberName);
    setBusy(false);
    if (!res.ok) {
      setErrorMsg(res.error || 'Failed to connect to store');
    } else {
      setSuccessMsg('Store connected! All orders synced to this device.');
      setTimeout(() => onClose(), 800);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setBusy(true);
    const res = await loginWithEmail(email, password);
    setBusy(false);
    if (!res.ok) {
      setErrorMsg(res.error || 'Login failed');
    } else {
      setSuccessMsg('Logged in! Databases synced.');
      setTimeout(() => onClose(), 800);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setBusy(true);
    const res = await signUpWithEmail(email, password, fullName, storeName);
    setBusy(false);
    if (!res.ok) {
      setErrorMsg(res.error || 'Sign up failed');
    } else {
      setSuccessMsg('Account and Store created on Supabase!');
      setTimeout(() => onClose(), 800);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal auth-modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <span className="eyebrow">Multi-Device Cloud Sync</span>
            <h2>{user ? 'Account & Device Sync' : 'Connect Device & Sync'}</h2>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '20px 24px' }}>
          {user ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ padding: 14, background: '#0d1117', borderRadius: 8, border: '1px solid #232c3d' }}>
                <span style={{ font: '10px var(--app-font-mono)', color: '#64748b', textTransform: 'uppercase' }}>LOGGED IN USER</span>
                <strong style={{ display: 'block', color: '#fff', fontSize: 14, marginTop: 4 }}>{user.email}</strong>
                <span style={{ fontSize: 12, color: '#10b981', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <Check size={14} /> Synced across all your logged-in devices
                </span>
              </div>

              <div style={{ padding: 14, background: '#0d1117', borderRadius: 8, border: '1px solid #232c3d' }}>
                <span style={{ font: '10px var(--app-font-mono)', color: '#64748b', textTransform: 'uppercase' }}>ACTIVE STORE & ROLE</span>
                <strong style={{ display: 'block', color: '#fff', fontSize: 14, marginTop: 4 }}>{organization.name}</strong>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>Profile: {currentMember.name} ({currentMember.role.toUpperCase()})</span>
              </div>

              <button
                type="button"
                className="btn btn-danger"
                onClick={logout}
                style={{ width: '100%', marginTop: 8 }}
              >
                Log Out from This Device
              </button>
            </div>
          ) : (
            <>
              {/* Auth Mode Tabs */}
              <div className="filter-bar" style={{ padding: '0 0 16px', borderBottom: '1px solid #1c2331', marginBottom: 16 }}>
                <button
                  type="button"
                  className={`filter-tab ${activeTab === 'store_code' ? 'selected' : ''}`}
                  onClick={() => { setActiveTab('store_code'); setErrorMsg(null); }}
                >
                  <Smartphone size={13} style={{ display: 'inline', marginRight: 4 }} /> Store Code (Fast)
                </button>
                <button
                  type="button"
                  className={`filter-tab ${activeTab === 'email_login' ? 'selected' : ''}`}
                  onClick={() => { setActiveTab('email_login'); setErrorMsg(null); }}
                >
                  <Mail size={13} style={{ display: 'inline', marginRight: 4 }} /> Cloud Login
                </button>
                <button
                  type="button"
                  className={`filter-tab ${activeTab === 'signup' ? 'selected' : ''}`}
                  onClick={() => { setActiveTab('signup'); setErrorMsg(null); }}
                >
                  <Building2 size={13} style={{ display: 'inline', marginRight: 4 }} /> Register Store
                </button>
              </div>

              {errorMsg && (
                <div style={{ padding: '10px 12px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', borderRadius: 6, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <AlertCircle size={15} /> {errorMsg}
                </div>
              )}

              {successMsg && (
                <div style={{ padding: '10px 12px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', borderRadius: 6, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <Check size={15} /> {successMsg}
                </div>
              )}

              {/* Tab 1: Instant Store Code (For connecting phone/tablet in shop) */}
              {activeTab === 'store_code' && (
                <form onSubmit={handleStoreCodeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 4px', lineHeight: 1.5 }}>
                    Connect any phone, tablet, or laptop to your store ledger instantly by entering your Store Slug / ID.
                  </p>

                  <div className="field">
                    <label>Store ID or Slug</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="vendora-main"
                      value={storeCode}
                      onChange={(e) => setStoreCode(e.target.value)}
                      required
                    />
                    <small style={{ color: '#64748b', fontSize: 11 }}>Example: <code>vendora-main</code> or your custom store slug</small>
                  </div>

                  <div className="field">
                    <label>Your Name (Optional)</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Om Shetkar or Ritu Sharma"
                      value={memberName}
                      onChange={(e) => setMemberName(e.target.value)}
                    />
                  </div>

                  <button type="submit" className="btn btn-primary" disabled={busy} style={{ marginTop: 8 }}>
                    <ArrowRight size={14} /> Sync This Device to Store
                  </button>
                </form>
              )}

              {/* Tab 2: Email & Password Login */}
              {activeTab === 'email_login' && (
                <form onSubmit={handleEmailLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 4px', lineHeight: 1.5 }}>
                    Log in with your Supabase account to automatically load all your stores and team permissions.
                  </p>

                  <div className="field">
                    <label>Email Address</label>
                    <input
                      type="email"
                      className="input"
                      placeholder="om@vendora.local"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="field">
                    <label>Password</label>
                    <input
                      type="password"
                      className="input"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>

                  <button type="submit" className="btn btn-primary" disabled={busy} style={{ marginTop: 8 }}>
                    <Lock size={14} /> Log In & Sync Databases
                  </button>
                </form>
              )}

              {/* Tab 3: Register New Store & Account */}
              {activeTab === 'signup' && (
                <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="field">
                    <label>Store / Business Name</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Om Electricals & Hardware"
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="field">
                    <label>Owner Full Name</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Om Shetkar"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="field">
                    <label>Email Address</label>
                    <input
                      type="email"
                      className="input"
                      placeholder="om@business.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="field">
                    <label>Create Password</label>
                    <input
                      type="password"
                      className="input"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>

                  <button type="submit" className="btn btn-primary" disabled={busy} style={{ marginTop: 8 }}>
                    <Building2 size={14} /> Create Store & Owner Account
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
