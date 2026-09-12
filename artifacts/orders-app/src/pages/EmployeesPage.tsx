import React, { useState, useEffect } from 'react';
import { useOrgAuth, UserRole } from '@/context/OrgAuthContext';
import {
  checkUserExists,
  inviteEmployee,
  getPendingInvitationsForOrg,
  cancelEmployeeInvitation,
  EmployeeInvitation
} from '@/lib/auth/userAuth';
import {
  Users, UserCheck, ShieldCheck, ShieldAlert, Shield, Plus, Check, X,
  Clock, ArrowRight, UserPlus, AlertCircle, RefreshCw, Sparkles, Lock
} from 'lucide-react';

// Module-level session cache (reverts on full page refresh)
let sessionInviteUsername = '';
let sessionInviteRole: 'operator' | 'manager' = 'operator';

export function EmployeesPage() {
  const { organization, members, currentMember, canManageSettings, currentUser } = useOrgAuth();

  // Invite Form State (Persisted in session across tab switches, resets on page refresh)
  const [inviteUsername, setInviteUsernameState] = useState(sessionInviteUsername);
  const [inviteRole, setInviteRoleState] = useState<'operator' | 'manager'>(sessionInviteRole);

  const setInviteUsername = (val: string) => {
    sessionInviteUsername = val;
    setInviteUsernameState(val);
  };

  const setInviteRole = (val: 'operator' | 'manager') => {
    sessionInviteRole = val;
    setInviteRoleState(val);
  };
  const [userLookupStatus, setUserLookupStatus] = useState<{ checked: boolean; exists: boolean; fullName?: string } | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Pending Invitations State
  const [pendingInvites, setPendingInvites] = useState<EmployeeInvitation[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const isOwner = canManageSettings || currentMember?.role === 'owner' || currentUser?.role === 'owner';

  const loadPendingInvites = async () => {
    if (!organization?.id) return;
    setLoadingInvites(true);
    const list = await getPendingInvitationsForOrg(organization.id);
    setPendingInvites(list);
    setLoadingInvites(false);
  };

  useEffect(() => {
    if (organization?.id && isOwner) {
      loadPendingInvites();
    }
  }, [organization?.id, isOwner]);

  const handleUsernameChange = async (val: string) => {
    const clean = val.trim().toLowerCase().replace(/^@/, '');
    setInviteUsername(clean);
    setFeedback(null);

    if (clean.length >= 3) {
      setLookupLoading(true);
      const res = await checkUserExists(clean);
      setLookupLoading(false);
      setUserLookupStatus({ checked: true, exists: res.exists, fullName: res.fullName });
    } else {
      setUserLookupStatus(null);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id) return;

    const clean = inviteUsername.trim().toLowerCase().replace(/^@/, '');
    if (!clean || clean.length < 3) {
      setFeedback({ type: 'error', message: 'Please enter a valid username of at least 3 characters.' });
      return;
    }

    setSendingInvite(true);
    setFeedback(null);

    const res = await inviteEmployee({
      orgId: organization.id,
      employeeUsername: clean,
      role: inviteRole,
    });

    setSendingInvite(false);

    if (res.ok) {
      setFeedback({
        type: 'success',
        message: `Invitation sent to @${clean} as ${inviteRole.toUpperCase()}! They can now accept it when signing in.`,
      });
      setInviteUsername('');
      setUserLookupStatus(null);
      loadPendingInvites();
    } else {
      setFeedback({ type: 'error', message: res.error || 'Failed to send invitation.' });
    }
  };

  const handleCancelInvite = async (invId: string) => {
    if (!window.confirm('Revoke this invitation?')) return;
    setCancellingId(invId);
    const res = await cancelEmployeeInvitation(invId);
    setCancellingId(null);
    if (res.ok) {
      loadPendingInvites();
    }
  };

  const getRoleBadge = (role: UserRole | string) => {
    switch (role) {
      case 'owner':
        return <span className="role-badge badge-owner"><ShieldCheck size={11} /> OWNER</span>;
      case 'manager':
        return <span className="role-badge badge-manager"><ShieldAlert size={11} /> MANAGER</span>;
      case 'operator':
      default:
        return <span className="role-badge badge-operator"><UserCheck size={11} /> OPERATOR</span>;
    }
  };

  // Filter out any raw invite: emails from the active members list
  const activeMembers = members.filter((m) => !m.email?.startsWith('invite:'));

  return (
    <div className="orders-page" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Top Banner & KPI Header */}
      <section className="command-hero">
        <div className="hero-content">
          <div className="hero-title-row">
            <h1>Store Employees & Team Roster</h1>
            <span className="live-pulse">SYNCED CLOUD</span>
          </div>
          <p className="hero-subtitle">
            Manage your store's workforce. Invite employees by their @username, assign operational roles, and review access boundaries.
          </p>

          <div className="hero-kpis">
            <div className="kpi-item">
              <span className="kpi-val">{activeMembers.length}</span>
              <span className="kpi-lbl">Active Staff</span>
            </div>
            {isOwner && (
              <div className="kpi-item">
                <span className="kpi-val" style={{ color: pendingInvites.length > 0 ? '#fbbf24' : undefined }}>
                  {pendingInvites.length}
                </span>
                <span className="kpi-lbl">Pending Invites</span>
              </div>
            )}
            <div className="kpi-item">
              <span className="kpi-val">{organization?.name || 'Store'}</span>
              <span className="kpi-lbl">Active Store Ledger</span>
            </div>
            <div className="kpi-item">
              <span className="kpi-val">
                {currentMember ? currentMember.role.toUpperCase() : 'OPERATOR'}
              </span>
              <span className="kpi-lbl">Your Authority</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Grid: Roster List & Invite Form */}
      <div className="content-grid" style={{ marginTop: 22 }}>
        {/* Left Column: Active Team Roster */}
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Active Team Roster</h2>
              <span className="minor">{activeMembers.length} active persons working in this store</span>
            </div>
            <Users size={16} style={{ color: 'var(--day-accent)' }} />
          </div>

          <div className="order-list" style={{ padding: '8px 12px' }}>
            {activeMembers.map((m) => (
              <div key={m.id} className="member-roster-row" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                marginBottom: '8px',
                background: m.id === currentMember?.id ? 'rgba(56, 189, 248, 0.05)' : 'rgba(255, 255, 255, 0.02)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="member-roster-avatar" style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    color: '#38bdf8',
                  }}>
                    {m.avatarInitials}
                  </div>
                  <div className="member-roster-info">
                    <div className="member-roster-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '0.95rem' }}>{m.name}</strong>
                      {getRoleBadge(m.role)}
                    </div>
                    <span className="member-roster-email" style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                      {m.email || 'Cloud Member'}
                    </span>
                  </div>
                </div>

                {m.id === currentMember?.id && (
                  <span className="active-badge" style={{
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    color: '#10b981',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                  }}>
                    You (Active Session)
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Pending Invitations Section (Inside left panel or below) */}
          {isOwner && pendingInvites.length > 0 && (
            <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '16px', padding: '0 12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={14} /> Pending Invitations ({pendingInvites.length})
                </span>
                <button
                  type="button"
                  onClick={loadPendingInvites}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <RefreshCw size={11} style={{ animation: loadingInvites ? 'spin 1s linear infinite' : 'none' }} />
                  <span>Refresh</span>
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {pendingInvites.map((inv) => (
                  <div key={inv.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'rgba(251, 191, 36, 0.05)',
                    border: '1px solid rgba(251, 191, 36, 0.2)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: 'rgba(251, 191, 36, 0.15)',
                        color: '#fbbf24',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                      }}>
                        @{inv.employeeUsername.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <strong style={{ display: 'block', fontSize: '0.88rem', color: '#f8fafc' }}>
                          @{inv.employeeUsername}
                        </strong>
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                          Role: <strong style={{ textTransform: 'uppercase', color: '#e2e8f0' }}>{inv.role}</strong> · Waiting for acceptance
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={cancellingId === inv.id}
                      onClick={() => handleCancelInvite(inv.id)}
                      style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        color: '#ef4444',
                        padding: '5px 10px',
                        borderRadius: '8px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                      title="Revoke Invitation"
                    >
                      <X size={12} />
                      <span>Cancel</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Right Column: Invite Employee Form (for Owner) OR Your Role Summary (for Employees) */}
        {isOwner ? (
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>Employ New Member</h2>
                <span className="minor">Input username to issue an invitation</span>
              </div>
              <UserPlus size={16} style={{ color: 'var(--day-accent)' }} />
            </div>

            <div style={{ padding: '20px 22px' }}>
              {feedback && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  marginBottom: '16px',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  border: feedback.type === 'success' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                  color: feedback.type === 'success' ? '#10b981' : '#ef4444',
                }}>
                  {feedback.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
                  <span>{feedback.message}</span>
                </div>
              )}

              <form onSubmit={handleSendInvite} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1' }}>
                      Employee Username
                    </label>
                    {lookupLoading && <span style={{ fontSize: '0.72rem', color: '#38bdf8' }}>Checking user...</span>}
                    {userLookupStatus?.checked && userLookupStatus.exists && (
                      <span style={{ fontSize: '0.72rem', color: '#4ade80' }}>
                        ✓ Registered ({userLookupStatus.fullName})
                      </span>
                    )}
                    {userLookupStatus?.checked && !userLookupStatus.exists && (
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        ℹ️ Unregistered (will be ready when they join)
                      </span>
                    )}
                  </div>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '14px', top: '11px', color: '#64748b', fontWeight: 600 }}>@</span>
                    <input
                      type="text"
                      required
                      placeholder="e.g. anand_ops"
                      value={inviteUsername}
                      onChange={(e) => handleUsernameChange(e.target.value)}
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
                  <small style={{ display: 'block', marginTop: '4px', fontSize: '0.72rem', color: '#94a3b8' }}>
                    Enter the exact username chosen by the employee when they created their account.
                  </small>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                    Assigned Role & Access Level
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as 'operator' | 'manager')}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '11px 14px',
                      borderRadius: '12px',
                      background: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#ffffff',
                      fontSize: '0.88rem',
                      outline: 'none',
                    }}
                  >
                    <option value="operator">Operator (Order Intake, Parsing, Statuses, Cashbook)</option>
                    <option value="manager">Manager (Approvals, Capacity Planning, Team Overview)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={sendingInvite || !inviteUsername.trim()}
                  style={{
                    marginTop: '4px',
                    padding: '12px',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.92rem',
                    cursor: sendingInvite || !inviteUsername.trim() ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
                    opacity: sendingInvite || !inviteUsername.trim() ? 0.6 : 1,
                  }}
                >
                  {sendingInvite ? (
                    <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <Plus size={16} />
                  )}
                  <span>Send Employee Invitation</span>
                </button>
              </form>
            </div>
          </section>
        ) : (
          /* For Employees (Operators / Managers): Show Role Capabilities */
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>Your Assigned Role & Authority</h2>
                <span className="minor">Operational privileges for this store</span>
              </div>
              <Shield size={16} style={{ color: 'var(--day-accent)' }} />
            </div>

            <div style={{ padding: '20px 22px' }}>
              <div style={{
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.2)',
                borderRadius: '14px',
                padding: '16px 18px',
                marginBottom: '16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <UserCheck size={18} style={{ color: '#38bdf8' }} />
                  <strong style={{ fontSize: '1rem', color: '#f8fafc' }}>
                    {currentMember?.role ? currentMember.role.toUpperCase() : 'OPERATOR'} ACCESS
                  </strong>
                </div>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.45 }}>
                  You are employed at <strong>{organization?.name || 'this store'}</strong>. You have full capability to capture customer orders, use live voice recording and WhatsApp message parsing, advance order statuses, and record balance payments.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem', color: '#94a3b8' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={14} style={{ color: '#10b981' }} />
                  <span>Universal voice & message order intake</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={14} style={{ color: '#10b981' }} />
                  <span>Update order statuses and track balances</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={14} style={{ color: '#10b981' }} />
                  <span>Real-time offline sync to store cloud</span>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Role & Capabilities Hierarchy Matrix */}
      <section className="panel" style={{ marginTop: 22 }}>
        <div className="panel-head">
          <div>
            <h2>Hierarchy & Capabilities Matrix</h2>
            <span className="minor">Clear division of authority across store roles</span>
          </div>
          <Lock size={16} style={{ color: 'var(--day-accent)' }} />
        </div>

        <div className="table-panel" style={{ overflowX: 'auto' }}>
          <div className="matrix-head">
            <span>Operational Capability</span>
            <span className="text-center">Operator</span>
            <span className="text-center">Manager</span>
            <span className="text-center">Owner</span>
          </div>

          <div className="matrix-row">
            <div>
              <strong>Order Intake & Customer WhatsApp Parsing</strong>
              <small>Capture orders via speech, counter, or text messages</small>
            </div>
            <span className="check-cell"><Check size={16} className="text-emerald" /></span>
            <span className="check-cell"><Check size={16} className="text-emerald" /></span>
            <span className="check-cell"><Check size={16} className="text-emerald" /></span>
          </div>

          <div className="matrix-row">
            <div>
              <strong>Update Order Status & Record Payments</strong>
              <small>Advance orders to Ready/Completed and log balance payments</small>
            </div>
            <span className="check-cell"><Check size={16} className="text-emerald" /></span>
            <span className="check-cell"><Check size={16} className="text-emerald" /></span>
            <span className="check-cell"><Check size={16} className="text-emerald" /></span>
          </div>

          <div className="matrix-row">
            <div>
              <strong>Approve Ambiguous Orders & Clarifications</strong>
              <small>Resolve flagged customer messages and override attributes</small>
            </div>
            <span className="check-cell"><X size={16} className="text-muted" /></span>
            <span className="check-cell"><Check size={16} className="text-emerald" /></span>
            <span className="check-cell"><Check size={16} className="text-emerald" /></span>
          </div>

          <div className="matrix-row">
            <div>
              <strong>Invite & Manage Store Employees</strong>
              <small>Input @username, send invitations, assign Operator/Manager roles</small>
            </div>
            <span className="check-cell"><X size={16} className="text-muted" /></span>
            <span className="check-cell"><X size={16} className="text-muted" /></span>
            <span className="check-cell"><Check size={16} className="text-emerald" /></span>
          </div>

          <div className="matrix-row">
            <div>
              <strong>Store Settings & Ledger Purge</strong>
              <small>Configure cloud sync, delete records, or export databases</small>
            </div>
            <span className="check-cell"><X size={16} className="text-muted" /></span>
            <span className="check-cell"><X size={16} className="text-muted" /></span>
            <span className="check-cell"><Check size={16} className="text-emerald" /></span>
          </div>
        </div>
      </section>
    </div>
  );
}
