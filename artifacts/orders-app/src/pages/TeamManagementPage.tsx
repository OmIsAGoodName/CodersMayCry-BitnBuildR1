import React, { useState } from 'react';
import { useOrgAuth, UserRole } from '@/context/OrgAuthContext';
import { ShieldCheck, ShieldAlert, UserCheck, Users, Plus, Check, X, Building2, Lock, Sparkles } from 'lucide-react';

export function TeamManagementPage() {
  const { organization, members, currentMember, addMember, canManageSettings } = useOrgAuth();

  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('operator');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setSubmitting(true);
    try {
      await addMember(newName.trim(), newRole, newEmail.trim() || undefined);
      setNewName('');
      setNewEmail('');
      setNewRole('operator');
      setFeedback(Added  as  to );
      setTimeout(() => setFeedback(null), 4000);
    } catch {
      setFeedback('Failed to add member');
    } finally {
      setSubmitting(false);
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

  return (
    <div className="page team-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Multi-Tenant Hierarchy</div>
          <h1>Team & Organization Roles</h1>
          <p className="subheading">
            Manage organization members, permission hierarchies, and multi-operator sync across {organization.name}.
          </p>
        </div>
      </div>

      {/* Organization Overview Banner */}
      <section className="panel org-overview-panel">
        <div className="org-banner-inner">
          <div className="org-brand-box">
            <Building2 size={24} style={{ color: 'var(--day-accent)' }} />
            <div>
              <h2>{organization.name}</h2>
              <span className="minor">Tenant Slug: {organization.slug} · ID: {organization.id}</span>
            </div>
          </div>
          <div className="org-kpi-row">
            <div className="kpi-item">
              <span className="kpi-val">{members.length}</span>
              <span className="kpi-lbl">Active Roster</span>
            </div>
            <div className="kpi-item">
              <span className="kpi-val">{organization.capacity} items</span>
              <span className="kpi-lbl">Weekly Capacity</span>
            </div>
            <div className="kpi-item">
              <span className="kpi-val">Supabase</span>
              <span className="kpi-lbl">Cloud Backend</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Grid: Roster List & Add Member Form */}
      <div className="content-grid" style={{ marginTop: 22 }}>
        {/* Left: Team Members Roster */}
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Organization Roster</h2>
              <span className="minor">{members.length} active persons synced</span>
            </div>
            <span className="minor">Current: {currentMember.name} ({currentMember.role.toUpperCase()})</span>
          </div>

          <div className="order-list">
            {members.map((m) => (
              <div key={m.id} className="member-roster-row">
                <div className="member-roster-avatar">{m.avatarInitials}</div>
                <div className="member-roster-info">
                  <div className="member-roster-header">
                    <strong>{m.name}</strong>
                    {getRoleBadge(m.role)}
                  </div>
                  <span className="member-roster-email">{m.email || 'No email registered (Local Terminal)'}</span>
                </div>
                {m.id === currentMember.id && (
                  <span className="active-badge">Active Session</span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Right: Add New Member Form */}
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Add Team Member</h2>
              <span className="minor">Assign role & access boundary</span>
            </div>
            <Users size={16} style={{ color: 'var(--day-accent)' }} />
          </div>

          <div style={{ padding: '18px 20px' }}>
            {feedback && (
              <div className="team-feedback-pill">
                <Check size={14} /> {feedback}
              </div>
            )}

            <form onSubmit={handleAddMember} className="member-form">
              <div className="field">
                <label>Full Name</label>
                <input
                  type="text"
                  className="input"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Anand Verma"
                  required
                />
              </div>

              <div className="field">
                <label>Role & Permission Hierarchy</label>
                <select
                  className="input"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                >
                  <option value="operator">Operator (Order Intake, Processing, Cashbook)</option>
                  <option value="manager">Manager (Approvals, Capacity Planning, Audits)</option>
                  <option value="owner">Owner (Full Store Authority & Settings)</option>
                </select>
              </div>

              <div className="field">
                <label>Email Address (Optional)</label>
                <input
                  type="email"
                  className="input"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="anand@kirana.local"
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: 8 }}
                disabled={submitting}
              >
                <Plus size={14} /> Add Member to Cloud
              </button>
            </form>
          </div>
        </section>
      </div>

      {/* Role Permission Matrix */}
      <section className="panel" style={{ marginTop: 22 }}>
        <div className="panel-head">
          <div>
            <h2>Hierarchy & Capabilities Matrix</h2>
            <span className="minor">Clear division of authority for store operations</span>
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
              <strong>Weekly Capacity Allocation & Workshop Balancing</strong>
              <small>Change max item capacity and reassign overdue workloads</small>
            </div>
            <span className="check-cell"><X size={16} className="text-muted" /></span>
            <span className="check-cell"><Check size={16} className="text-emerald" /></span>
            <span className="check-cell"><Check size={16} className="text-emerald" /></span>
          </div>

          <div className="matrix-row">
            <div>
              <strong>Manage Team Roster & Organization Roles</strong>
              <small>Add or remove members, assign Operator / Manager roles</small>
            </div>
            <span className="check-cell"><X size={16} className="text-muted" /></span>
            <span className="check-cell"><X size={16} className="text-muted" /></span>
            <span className="check-cell"><Check size={16} className="text-emerald" /></span>
          </div>

          <div className="matrix-row">
            <div>
              <strong>Ledger Reset & Sovereign Cloud Sync Settings</strong>
              <small>Configure Supabase credentials, full data purge or exports</small>
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
