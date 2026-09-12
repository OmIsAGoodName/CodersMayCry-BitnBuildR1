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

  const isOwner = currentMember?.role === 'owner';

  // Load pending invites if owner
  const loadPendingInvites = async () => {
    if (!organization?.id || !isOwner) return;
    setLoadingInvites(true);
    try {
      const invites = await getPendingInvitationsForOrg(organization.id);
      setPendingInvites(invites);
    } catch (err) {
      console.error('Failed to load pending invites:', err);
    } finally {
      setLoadingInvites(false);
    }
  };

  useEffect(() => {
    loadPendingInvites();
  }, [organization?.id, isOwner]);

  // Debounced username lookup
  useEffect(() => {
    const trimmed = inviteUsername.trim().replace(/^@/, '');
    if (!trimmed || trimmed.length < 3) {
      setUserLookupStatus(null);
      return;
    }

    const timer = setTimeout(async () => {
      setLookupLoading(true);
      try {
        const res = await checkUserExists(trimmed);
        setUserLookupStatus({
          checked: true,
          exists: res.exists,
          fullName: res.user?.fullName
        });
      } catch (err) {
        setUserLookupStatus(null);
      } finally {
        setLookupLoading(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [inviteUsername]);

  const handleUsernameChange = (val: string) => {
    setInviteUsername(val.toLowerCase().replace(/[^a-z0-9_]/g, ''));
    setFeedback(null);
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = inviteUsername.trim().replace(/^@/, '');
    if (!cleanUsername) return;

    if (!organization?.id || !currentUser?.id) {
      setFeedback({ type: 'error', message: 'Missing organization session context' });
      return;
    }

    setSendingInvite(true);
    setFeedback(null);

    try {
      const res = await inviteEmployee(organization.id, currentUser.id, cleanUsername, inviteRole);
      if (res.success) {
        setFeedback({
          type: 'success',
          message: `Invitation issued to @${cleanUsername} as ${inviteRole.toUpperCase()}! They will receive it in their lobby.`
        });
        setInviteUsername('');
        setUserLookupStatus(null);
        loadPendingInvites();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to issue invitation' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Network error issuing invitation' });
    } finally {
      setSendingInvite(false);
    }
  };

  const handleCancelInvite = async (invitationId: string) => {
    setCancellingId(invitationId);
    try {
      const ok = await cancelEmployeeInvitation(invitationId);
      if (ok) {
        setPendingInvites(prev => prev.filter(i => i.id !== invitationId));
      }
    } catch (err) {
      console.error('Failed to cancel invite:', err);
    } finally {
      setCancellingId(null);
    }
  };

  const activeMembers = members.filter(m => m.status === 'active');

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'owner':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 6,
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#10b981',
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase'
          }}>
            <ShieldCheck size={12} /> Owner
          </span>
        );
      case 'manager':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 6,
            background: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            color: '#f59e0b',
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase'
          }}>
            <ShieldAlert size={12} /> Manager
          </span>
        );
      default:
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 6,
            background: 'rgba(56, 189, 248, 0.15)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            color: '#38bdf8',
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase'
          }}>
            <UserCheck size={12} /> Operator
          </span>
        );
    }
  };

  return (
    <div className="page">
      {/* Top Banner & Heading */}
      <div className="page-heading">
        <div>
          <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span>STORE WORKFORCE &amp; ACCESS CONTROL</span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '2px 8px',
                borderRadius: 20,
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.4px',
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
              SYNCED CLOUD
            </span>
          </div>
          <h1>Store Employees &amp; Team Roster</h1>
          <p className="subheading">
            Manage your store's workforce. Invite employees by their @username, assign operational roles, and review access boundaries.
          </p>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card featured">
          <div className="stat-label">Active Staff</div>
          <div className="stat-value">{activeMembers.length}</div>
          <div className="stat-meta">Verified members in this store</div>
          <Users className="stat-icon" size={44} />
        </div>

        {isOwner && (
          <div className="stat-card">
            <div className="stat-label">Pending Invites</div>
            <div className="stat-value" style={{ color: pendingInvites.length > 0 ? '#fbbf24' : 'inherit' }}>
              {pendingInvites.length}
            </div>
            <div className="stat-meta">{pendingInvites.length > 0 ? 'Awaiting employee acceptance' : 'No pending invitations'}</div>
            <Clock className="stat-icon" size={44} />
          </div>
        )}

        <div className="stat-card">
          <div className="stat-label">Active Store Ledger</div>
          <div className="stat-value" style={{ fontSize: 20, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {organization?.name || 'Store'}
          </div>
          <div className="stat-meta">Commercial tenant workspace</div>
          <ShieldCheck className="stat-icon" size={44} />
        </div>

        <div className="stat-card">
          <div className="stat-label">Your Authority</div>
          <div className="stat-value" style={{ fontSize: 20, color: '#38bdf8' }}>
            {currentMember ? currentMember.role.toUpperCase() : 'OPERATOR'}
          </div>
          <div className="stat-meta">{isOwner ? 'Full store governance' : 'Operational privileges'}</div>
          <Shield className="stat-icon" size={44} />
        </div>
      </div>

      {/* Main Grid: Roster List & Invite Form */}
      <div className="content-grid" style={{ marginTop: 24, gap: 20 }}>
        {/* Left Column: Active Team Roster */}
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Active Team Roster</h2>
              <span className="minor">{activeMembers.length} active persons working in this store</span>
            </div>
            <Users size={16} style={{ color: 'var(--day-accent)' }} />
          </div>

          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {activeMembers.map((m) => (
              <div
                key={m.id}
                className="member-roster-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: '1px solid hsl(var(--border))',
                  background: m.id === currentMember?.id ? 'rgba(56, 189, 248, 0.06)' : 'hsl(var(--card))',
                  transition: 'border-color 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    className="member-roster-avatar"
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: 'hsl(var(--muted)/.6)',
                      border: '1px solid hsl(var(--border))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: 14,
                      color: '#38bdf8',
                    }}
                  >
                    {m.avatarInitials}
                  </div>
                  <div className="member-roster-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <strong style={{ fontSize: 15 }}>{m.name}</strong>
                      {getRoleBadge(m.role)}
                    </div>
                    <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>
                      {m.email || 'Cloud Member'}
                    </span>
                  </div>
                </div>

                {m.id === currentMember?.id && (
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      background: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      color: '#10b981',
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    You (Active Session)
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Pending Invitations Section */}
          {isOwner && pendingInvites.length > 0 && (
            <div style={{ margin: '0 20px 20px', borderTop: '1px solid hsl(var(--border))', paddingTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={15} /> Pending Invitations ({pendingInvites.length})
                </span>
                <button
                  type="button"
                  onClick={loadPendingInvites}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'hsl(var(--muted-foreground))',
                    fontSize: 12,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <RefreshCw size={12} style={{ animation: loadingInvites ? 'spin 1s linear infinite' : 'none' }} />
                  <span>Refresh</span>
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pendingInvites.map((inv) => (
                  <div
                    key={inv.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 10,
                      background: 'rgba(251, 191, 36, 0.05)',
                      border: '1px solid rgba(251, 191, 36, 0.25)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          background: 'rgba(251, 191, 36, 0.15)',
                          color: '#fbbf24',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: 12,
                        }}
                      >
                        @{inv.employeeUsername.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <strong style={{ display: 'block', fontSize: 13, color: '#f8fafc' }}>
                          @{inv.employeeUsername}
                        </strong>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>
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
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                      title="Revoke Invitation"
                    >
                      <X size={13} />
                      <span>Cancel</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Right Column: Invite Employee Form (for Owner) OR Role Summary (for Employees) */}
        {isOwner ? (
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>Employ New Member</h2>
                <span className="minor">Input username to issue an invitation</span>
              </div>
              <UserPlus size={16} style={{ color: 'var(--day-accent)' }} />
            </div>

            <div style={{ padding: '20px 24px' }}>
              {feedback && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 10,
                    marginBottom: 16,
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    border: feedback.type === 'success' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                    color: feedback.type === 'success' ? '#10b981' : '#ef4444',
                  }}
                >
                  {feedback.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
                  <span>{feedback.message}</span>
                </div>
              )}

              <form onSubmit={handleSendInvite} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: 'inherit' }}>
                      Employee Username
                    </label>
                    {lookupLoading && <span style={{ fontSize: 11, color: '#38bdf8' }}>Checking user...</span>}
                    {userLookupStatus?.checked && userLookupStatus.exists && (
                      <span style={{ fontSize: 11, color: '#4ade80' }}>
                        ✓ Registered ({userLookupStatus.fullName})
                      </span>
                    )}
                    {userLookupStatus?.checked && !userLookupStatus.exists && (
                      <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
                        ℹ️ Unregistered (will be ready when they join)
                      </span>
                    )}
                  </div>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 14, top: 11, color: '#64748b', fontWeight: 600 }}>@</span>
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
                        borderRadius: 10,
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        color: 'inherit',
                        fontSize: 14,
                        outline: 'none',
                      }}
                    />
                  </div>
                  <small style={{ display: 'block', marginTop: 6, fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>
                    Enter the exact username chosen by the employee when they created their account.
                  </small>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'inherit' }}>
                    Assigned Role &amp; Access Level
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as 'operator' | 'manager')}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '11px 14px',
                      borderRadius: 10,
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      color: 'inherit',
                      fontSize: 13,
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
                  className="btn btn-primary"
                  style={{
                    marginTop: 6,
                    padding: '12px',
                    borderRadius: 10,
                    fontWeight: 700,
                    fontSize: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    opacity: sendingInvite || !inviteUsername.trim() ? 0.6 : 1,
                    cursor: sendingInvite || !inviteUsername.trim() ? 'not-allowed' : 'pointer',
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
                <h2>Your Assigned Role &amp; Authority</h2>
                <span className="minor">Operational privileges for this store</span>
              </div>
              <Shield size={16} style={{ color: 'var(--day-accent)' }} />
            </div>

            <div style={{ padding: '20px 24px' }}>
              <div
                style={{
                  background: 'rgba(56, 189, 248, 0.08)',
                  border: '1px solid rgba(56, 189, 248, 0.2)',
                  borderRadius: 12,
                  padding: '16px 18px',
                  marginBottom: 16,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <UserCheck size={18} style={{ color: '#38bdf8' }} />
                  <strong style={{ fontSize: 15, color: '#f8fafc' }}>
                    {currentMember?.role ? currentMember.role.toUpperCase() : 'OPERATOR'} ACCESS
                  </strong>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: '#cbd5e1', lineHeight: 1.5 }}>
                  You are employed at <strong>{organization?.name || 'this store'}</strong>. You have full capability to capture customer orders, use live voice recording and WhatsApp message parsing, advance order statuses, and record balance payments.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Check size={15} style={{ color: '#10b981' }} />
                  <span>Universal voice &amp; message order intake</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Check size={15} style={{ color: '#10b981' }} />
                  <span>Update order statuses and track balances</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Check size={15} style={{ color: '#10b981' }} />
                  <span>Real-time offline sync to store cloud</span>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Role & Capabilities Hierarchy Matrix */}
      <section className="panel" style={{ marginTop: 24 }}>
        <div className="panel-head">
          <div>
            <h2>Hierarchy &amp; Capabilities Matrix</h2>
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
              <strong>Order Intake &amp; Customer WhatsApp Parsing</strong>
              <small>Capture orders via speech, counter, or text messages</small>
            </div>
            <span className="check-cell"><Check size={16} className="text-emerald" /></span>
            <span className="check-cell"><Check size={16} className="text-emerald" /></span>
            <span className="check-cell"><Check size={16} className="text-emerald" /></span>
          </div>

          <div className="matrix-row">
            <div>
              <strong>Update Order Status &amp; Record Payments</strong>
              <small>Advance orders to Ready/Completed and log balance payments</small>
            </div>
            <span className="check-cell"><Check size={16} className="text-emerald" /></span>
            <span className="check-cell"><Check size={16} className="text-emerald" /></span>
            <span className="check-cell"><Check size={16} className="text-emerald" /></span>
          </div>

          <div className="matrix-row">
            <div>
              <strong>Approve Ambiguous Orders &amp; Clarifications</strong>
              <small>Resolve flagged customer messages and override attributes</small>
            </div>
            <span className="check-cell"><X size={16} className="text-muted" /></span>
            <span className="check-cell"><Check size={16} className="text-emerald" /></span>
            <span className="check-cell"><Check size={16} className="text-emerald" /></span>
          </div>

          <div className="matrix-row">
            <div>
              <strong>Invite &amp; Manage Store Employees</strong>
              <small>Input @username, send invitations, assign Operator/Manager roles</small>
            </div>
            <span className="check-cell"><X size={16} className="text-muted" /></span>
            <span className="check-cell"><X size={16} className="text-muted" /></span>
            <span className="check-cell"><Check size={16} className="text-emerald" /></span>
          </div>

          <div className="matrix-row">
            <div>
              <strong>Store Settings &amp; Ledger Purge</strong>
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
