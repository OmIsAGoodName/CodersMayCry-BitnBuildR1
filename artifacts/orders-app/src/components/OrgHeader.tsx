import React, { useState } from 'react';
import { useOrgAuth, UserRole } from '@/context/OrgAuthContext';
import { ShieldCheck, ShieldAlert, UserCheck, Cloud, CloudOff, RefreshCw, Users, Check, ChevronDown } from 'lucide-react';

export function OrgHeader() {
  const {
    organization,
    currentMember,
    members,
    switchMember,
    isOnline,
    pendingSyncCount,
    lastSyncedAt,
    syncNow
  } = useOrgAuth();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    await syncNow();
    setTimeout(() => setSyncing(false), 600);
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

  return (
    <div className="org-header-bar">
      {/* Organization and Active Role Switcher */}
      <div className="org-identity-group">
        <div className="org-details">
          <span className="org-label">ORGANIZATION</span>
          <span className="org-name">{organization.name}</span>
        </div>

        <div className="member-switcher-wrap">
          <button
            type="button"
            className="member-switch-btn"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            title="Switch between team hierarchy profiles (Owner, Manager, Operator)"
          >
            <span className="avatar-pill">{currentMember.avatarInitials}</span>
            <div className="member-meta">
              <span className="member-name">{currentMember.name}</span>
              {getRoleBadge(currentMember.role)}
            </div>
            <ChevronDown size={14} style={{ color: '#94a3b8' }} />
          </button>

          {dropdownOpen && (
            <div className="member-dropdown-menu">
              <div className="dropdown-title">
                <span>TEAM HIERARCHY SWITCHER</span>
                <small>Select active profile</small>
              </div>
              <div className="dropdown-list">
                {members.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={dropdown-item }
                    onClick={() => {
                      switchMember(m.id);
                      setDropdownOpen(false);
                    }}
                  >
                    <span className="avatar-pill">{m.avatarInitials}</span>
                    <div className="item-details">
                      <strong>{m.name}</strong>
                      <div className="item-role-line">
                        {getRoleBadge(m.role)}
                        {m.email && <span className="item-email">{m.email}</span>}
                      </div>
                    </div>
                    {m.id === currentMember.id && <Check size={14} color="var(--day-accent)" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sovereign Offline vs Cloud Sync Status */}
      <div className="sync-status-group">
        <div
          className={sync-badge }
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
  );
}
