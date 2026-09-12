import React, { useState, useEffect } from 'react';
import { useOrgAuth } from '@/context/OrgAuthContext';
import {
  getPendingInvitationsForEmployee,
  acceptEmployeeInvitation,
  cancelEmployeeInvitation,
  EmployeeInvitation
} from '@/lib/auth/userAuth';
import { Store, UserCheck, Check, X, RefreshCw, Copy, LogOut, Sparkles, Clock, ShieldCheck } from 'lucide-react';

export function EmployeeLobbyModal() {
  const { currentUser, logout, switchOrganization } = useOrgAuth();
  const [invitations, setInvitations] = useState<EmployeeInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const fetchInvites = async () => {
    if (!currentUser?.username) return;
    setLoading(true);
    const list = await getPendingInvitationsForEmployee(currentUser.username);
    setInvitations(list);
    setLoading(false);
  };

  useEffect(() => {
    fetchInvites();
    // Check every 10 seconds while in lobby
    const interval = setInterval(fetchInvites, 10000);
    return () => clearInterval(interval);
  }, [currentUser?.username]);

  // If user is not in lobby and has no pending invitations, don't show modal
  if (!currentUser || (currentUser.orgId !== 'org_employee_lobby' && invitations.length === 0)) {
    return null;
  }

  const handleCopyUsername = () => {
    if (currentUser?.username) {
      navigator.clipboard.writeText(currentUser.username);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAccept = async (inv: EmployeeInvitation) => {
    if (!currentUser) return;
    setProcessingId(inv.id);
    setStatusMsg(`Joining ${inv.orgName || 'Store'}...`);

    const res = await acceptEmployeeInvitation({
      invitationId: inv.id,
      userId: currentUser.id,
      orgId: inv.orgId,
      role: inv.role,
      fullName: currentUser.fullName,
      username: currentUser.username,
    });

    setProcessingId(null);
    if (res.ok) {
      switchOrganization(inv.orgId);
      window.location.href = '/orders';
    } else {
      setStatusMsg(res.error || 'Failed to accept invitation.');
    }
  };

  const handleDecline = async (invId: string) => {
    if (!window.confirm('Are you sure you want to decline this invitation?')) return;
    setProcessingId(invId);
    await cancelEmployeeInvitation(invId);
    setProcessingId(null);
    fetchInvites();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(5, 7, 13, 0.88)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '20px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '520px',
        background: 'rgba(18, 24, 38, 0.95)',
        border: '1px solid rgba(255, 255, 255, 0.14)',
        borderRadius: '24px',
        padding: '36px 30px',
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
        position: 'relative',
        animation: 'fadeIn 0.3s ease-out',
      }}>
        {/* Top Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 14px rgba(139, 92, 246, 0.4)',
            }}>
              <UserCheck size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc' }}>
                Employee Portal
              </h2>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Signed in as <strong>{currentUser.fullName}</strong>
              </span>
            </div>
          </div>

          <button
            onClick={() => logout()}
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#ef4444',
              borderRadius: '10px',
              padding: '6px 12px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title="Log Out"
          >
            <LogOut size={13} />
            <span>Sign Out</span>
          </button>
        </div>

        {statusMsg && (
          <div style={{
            background: 'rgba(56, 189, 248, 0.15)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '10px',
            padding: '10px 14px',
            marginBottom: '16px',
            fontSize: '0.84rem',
            color: '#38bdf8',
          }}>
            {statusMsg}
          </div>
        )}

        {/* Username Copy Card */}
        <div style={{
          background: 'rgba(10, 14, 23, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '16px 20px',
          marginBottom: '22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <span style={{ display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', fontWeight: 700 }}>
              Your Employee Username
            </span>
            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#38bdf8', letterSpacing: '-0.01em' }}>
              @{currentUser.username}
            </span>
          </div>

          <button
            type="button"
            onClick={handleCopyUsername}
            style={{
              background: copied ? 'rgba(74, 222, 128, 0.2)' : 'rgba(56, 189, 248, 0.15)',
              border: copied ? '1px solid rgba(74, 222, 128, 0.4)' : '1px solid rgba(56, 189, 248, 0.3)',
              color: copied ? '#4ade80' : '#38bdf8',
              padding: '8px 14px',
              borderRadius: '10px',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>
        </div>

        {/* INVITATION AVAILABLE SECTION */}
        {invitations.length > 0 ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Sparkles size={16} style={{ color: '#fbbf24' }} />
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#f1f5f9' }}>
                Store Invitations ({invitations.length})
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {invitations.map((inv) => (
                <div
                  key={inv.id}
                  style={{
                    background: 'rgba(30, 41, 59, 0.7)',
                    border: '1px solid rgba(139, 92, 246, 0.35)',
                    borderRadius: '16px',
                    padding: '18px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ef4444',
                      }}>
                        <Store size={20} />
                      </div>
                      <div>
                        <strong style={{ display: 'block', fontSize: '1rem', color: '#ffffff' }}>
                          {inv.orgName || 'Store'}
                        </strong>
                        <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                          Invited to join as <span style={{
                            fontWeight: 700,
                            color: inv.role === 'manager' ? '#38bdf8' : '#34d399',
                            textTransform: 'uppercase',
                          }}>{inv.role}</span>
                        </span>
                      </div>
                    </div>

                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '8px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      background: 'rgba(251, 191, 36, 0.15)',
                      color: '#fbbf24',
                      border: '1px solid rgba(251, 191, 36, 0.3)',
                    }}>
                      Pending Invite
                    </span>
                  </div>

                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                    Accepting this invitation will connect you to this store ledger. You can capture orders, manage statuses, and view records according to your role.
                  </p>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                    <button
                      type="button"
                      disabled={processingId === inv.id}
                      onClick={() => handleAccept(inv)}
                      style={{
                        flex: 1,
                        padding: '11px',
                        borderRadius: '12px',
                        border: 'none',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: '0.88rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                      }}
                    >
                      {processingId === inv.id ? (
                        <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} />
                      ) : (
                        <Check size={16} />
                      )}
                      <span>Accept & Enter Store</span>
                    </button>

                    <button
                      type="button"
                      disabled={processingId === inv.id}
                      onClick={() => handleDecline(inv.id)}
                      style={{
                        padding: '11px 16px',
                        borderRadius: '12px',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        background: 'rgba(15, 23, 42, 0.6)',
                        color: '#94a3b8',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <X size={15} />
                      <span>Decline</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* WAITING ROOM (NO INVITATIONS YET) */
          <div style={{
            background: 'rgba(30, 41, 59, 0.4)',
            border: '1px dashed rgba(255, 255, 255, 0.15)',
            borderRadius: '16px',
            padding: '24px 20px',
            textAlign: 'center',
          }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8',
              margin: '0 auto 12px',
            }}>
              <Clock size={22} />
            </div>

            <h3 style={{ margin: '0 0 6px', fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
              Waiting for Store Owner's Invitation
            </h3>
            <p style={{ margin: '0 auto 16px', fontSize: '0.82rem', color: '#94a3b8', maxWidth: '360px', lineHeight: 1.45 }}>
              Ask your store owner to open their <strong>Employees</strong> tab in the left side menu and invite your username: <strong style={{ color: '#38bdf8' }}>@{currentUser.username}</strong>
            </p>

            <button
              type="button"
              disabled={loading}
              onClick={fetchInvites}
              style={{
                padding: '9px 18px',
                borderRadius: '10px',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                background: 'rgba(56, 189, 248, 0.12)',
                color: '#38bdf8',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              <span>{loading ? 'Checking...' : 'Check for Invites'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
