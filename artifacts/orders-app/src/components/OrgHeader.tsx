import React, { useState } from 'react';
import { useOrgAuth, UserRole } from '@/context/OrgAuthContext';
import { ShieldCheck, ShieldAlert, UserCheck, Cloud, CloudOff, RefreshCw } from 'lucide-react';

export function OrgHeader() {
  const {
    organization,
    currentMember,
    isOnline,
    pendingSyncCount,
    syncNow,
    currentUser
  } = useOrgAuth();

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

  if (!organization || !currentMember) return null;

  return (
    <div className="org-header-bar">
      {/* Active Store and User Identity */}
      <div className="org-identity-group">
        <div className="org-details" style={{ cursor: 'default' }} title="Active Store">
          <span className="org-label">STORE</span>
          <span className="org-name">{organization.name}</span>
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
  );
}
