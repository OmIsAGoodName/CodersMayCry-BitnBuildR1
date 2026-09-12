import { AuthModal } from '@/components/AuthModal';
import { Laptop } from 'lucide-react';
import React, { useState } from 'react';
import { useOrgAuth, UserRole } from '@/context/OrgAuthContext';
import { ShieldCheck, ShieldAlert, UserCheck, Cloud, CloudOff, RefreshCw, ChevronDown, Check, Building2, Plus, X } from 'lucide-react';

export function OrgHeader() {
  const {
    organization,
    organizations,
    switchOrganization,
    createOrganization,
    currentMember,
    members,
    switchMember,
    isOnline,
    pendingSyncCount,
    syncNow
  } = useOrgAuth();

  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false);
  const [orgModalOpen, setOrgModalOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const { currentUser, canManageSettings } = useOrgAuth();
  const isOwner = canManageSettings || currentMember?.role === 'owner' || currentUser?.role === 'owner';
  const [syncing, setSyncing] = useState(false);

  // New Organization Form State
  const [newOrgName, setNewOrgName] = useState('');
  const [newOwnerName, setNewOwnerName] = useState('');
  const [creatingOrg, setCreatingOrg] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    await syncNow();
    setTimeout(() => setSyncing(false), 600);
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim() || !newOwnerName.trim()) return;
    setCreatingOrg(true);
    try {
      await createOrganization(newOrgName.trim(), newOwnerName.trim());
      setOrgModalOpen(false);
    } catch {
      setCreatingOrg(false);
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'owner':
        return <span className="role-badge badge-owner"><ShieldCheck size={11} /> OWNER</span>;
      case 'manager':
        return <span className="role-badge badge-manager"><ShieldAlert size={11} /> MANAGER</span>;
      case 'operator':
        return <span className="role-badge badge-operator"><UserCheck size={11} /> OPERATOR</span>;
    }
  };

  if (!organization || !currentMember) return null;

  return (
    <>
      <div className="org-header-bar">
        {/* Organization and Active Role Switcher */}
        <div className="org-identity-group">
          <div className="org-details" style={{ cursor: isOwner ? 'pointer' : 'default' }} onClick={() => isOwner && setOrgModalOpen(true)} title={isOwner ? "Click to switch or create store" : "Active store ledger"}>
            <span className="org-label">ORGANIZATION • STORE TENANT</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="org-name">{organization.name}</span>
              {isOwner && <span className="org-switch-pill">Switch Store <ChevronDown size={11} /></span>}
            </div>
          </div>

          <div className="member-switcher-wrap" style={{ cursor: 'default' }} title={`Authenticated as @${currentUser?.username || 'user'} (${currentMember.role.toUpperCase()})`}>
            <div className="member-switch-btn" style={{ cursor: 'default' }}>
              <span className="avatar-pill">{currentMember.avatarInitials}</span>
              <div className="member-meta">
                <span className="member-name">{currentMember.name}</span>
                {getRoleBadge(currentMember.role)}
              </div>
            </div>
          </div>
        </div>

        {/* Sovereign Offline vs Cloud Sync Status */}
        <div className="sync-status-group">
          <div
            className={`sync-badge ${isOnline ? (pendingSyncCount > 0 ? 'sync-pending' : 'sync-online') : 'sync-offline'}`}
            title={isOnline ? 'Connected to Supabase cloud ledger' : 'Offline: operating on local sovereign bench'}
          >
            {isOnline ? (
              pendingSyncCount > 0 ? (
                <>
                  <RefreshCw size={12} className="spin" />
                  <span>SYNCING ({pendingSyncCount} QUEUED)</span>
                </>
              ) : (
                <>
                  <Cloud size={12} />
                  <span>CLOUD BACKUP ACTIVE</span>
                </>
              )
            ) : (
              <>
                <CloudOff size={12} />
                <span>SOVEREIGN OFFLINE BENCH</span>
              </>
            )}
          </div>

          {isOnline && (
            <button
              type="button"
              className="sync-trigger-btn"
              onClick={handleSync}
              disabled={syncing}
              title="Force immediate backup to Supabase"
            >
              <RefreshCw size={12} className={syncing ? 'spin' : ''} />
              <span>Backup Now</span>
            </button>
          )}

        </div>
      </div>

      {/* Multi-Tenant Organization Switcher & Creation Modal */}
      {orgModalOpen && (
        <div className="modal-backdrop" onClick={() => setOrgModalOpen(false)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <span className="eyebrow">Multi-Tenant Store Engine</span>
                <h2>Stores & Organizations</h2>
              </div>
              <button className="icon-btn" onClick={() => setOrgModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <div style={{ marginBottom: 16 }}>
                <span style={{ font: '10px var(--app-font-mono)', color: '#64748b', textTransform: 'uppercase' }}>
                  ACTIVE STORES & LEDGERS
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  {organizations.map((org) => (
                    <div
                      key={org.id}
                      onClick={() => {
                        if (org.id !== organization.id) switchOrganization(org.id);
                        setOrgModalOpen(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 14px',
                        borderRadius: 8,
                        background: org.id === organization.id ? '#1c2433' : '#0d1117',
                        border: org.id === organization.id ? '1px solid var(--day-accent)' : '1px solid #232c3d',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Building2 size={18} color="var(--day-accent)" />
                        <div>
                          <strong style={{ display: 'block', color: '#fff', fontSize: 13 }}>{org.name}</strong>
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>ID: {org.id} · Capacity: {org.capacity}</span>
                        </div>
                      </div>
                      {org.id === organization.id && <span className="active-badge">Active Store</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Create New Store Form */}
              <div style={{ borderTop: '1px solid #1c2331', paddingTop: 16 }}>
                <span style={{ font: '10px var(--app-font-mono)', color: '#64748b', textTransform: 'uppercase' }}>
                  CREATE NEW SEPARATE STORE / TENANT
                </span>
                <p style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 12px' }}>
                  Deploying or sharing with a friend? Creating a new store isolates orders, team members, and capacity completely in Supabase!
                </p>

                <form onSubmit={handleCreateOrg} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="field">
                    <label>Store / Business Name</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Royal Tailoring & Drycleaners"
                      value={newOrgName}
                      onChange={(e) => setNewOrgName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="field">
                    <label>Store Owner Name</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Rohan Mehra"
                      value={newOwnerName}
                      onChange={(e) => setNewOwnerName(e.target.value)}
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={creatingOrg} style={{ marginTop: 6 }}>
                    <Plus size={14} /> Create Store & Set as Owner
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </>
  );
}
