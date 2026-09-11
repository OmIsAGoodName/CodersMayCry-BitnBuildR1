import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase, CloudOrganization } from '@/lib/supabase';

export type UserRole = 'owner' | 'manager' | 'operator';

export interface OrgMemberProfile {
  id: string;
  name: string;
  role: UserRole;
  email?: string;
  avatarInitials: string;
}

interface OrgAuthContextType {
  organization: CloudOrganization;
  organizations: CloudOrganization[];
  switchOrganization: (orgId: string) => void;
  createOrganization: (orgName: string, ownerName: string) => Promise<void>;
  currentMember: OrgMemberProfile;
  members: OrgMemberProfile[];
  switchMember: (memberId: string) => void;
  addMember: (name: string, role: UserRole, email?: string) => Promise<void>;
  // Role permission helpers
  canManageSettings: boolean;
  canApproveOrders: boolean;
  canDeleteRecords: boolean;
  canIntakeOrders: boolean;
  // Connection status
  isOnline: boolean;
  pendingSyncCount: number;
  setPendingSyncCount: React.Dispatch<React.SetStateAction<number>>;
  lastSyncedAt: Date | null;
  setLastSyncedAt: React.Dispatch<React.SetStateAction<Date | null>>;
  syncNow: () => Promise<void>;
}

const DEFAULT_ORGS: CloudOrganization[] = [
  {
    id: 'org_vendora_main',
    name: 'Vendora Flagship Ledger',
    slug: 'vendora-main',
    capacity: 15,
    currency: 'INR',
  },
];

const DEFAULT_MEMBERS: OrgMemberProfile[] = [
  { id: 'mem_om', name: 'Om Shetkar', role: 'owner', email: 'om@vendora.local', avatarInitials: 'OS' },
  { id: 'mem_ritu', name: 'Ritu Sharma', role: 'manager', email: 'ritu@vendora.local', avatarInitials: 'RS' },
  { id: 'mem_kabir', name: 'Kabir Khan', role: 'operator', email: 'kabir@vendora.local', avatarInitials: 'KK' },
];

const OrgAuthContext = createContext<OrgAuthContextType | undefined>(undefined);

export function OrgAuthProvider({ children }: { children: ReactNode }) {
  const [organizations, setOrganizations] = useState<CloudOrganization[]>(() => {
    try {
      const cached = localStorage.getItem('vendora_all_orgs');
      return cached ? JSON.parse(cached) : DEFAULT_ORGS;
    } catch {
      return DEFAULT_ORGS;
    }
  });

  const [activeOrgId, setActiveOrgId] = useState<string>(() => {
    try {
      return localStorage.getItem('vendora_active_org_id') || 'org_vendora_main';
    } catch {
      return 'org_vendora_main';
    }
  });

  const [members, setMembers] = useState<OrgMemberProfile[]>(() => {
    try {
      const cached = localStorage.getItem(`vendora_org_members_${activeOrgId}`);
      return cached ? JSON.parse(cached) : DEFAULT_MEMBERS;
    } catch {
      return DEFAULT_MEMBERS;
    }
  });

  const [currentMemberId, setCurrentMemberId] = useState<string>(() => {
    try {
      return localStorage.getItem(`vendora_active_member_${activeOrgId}`) || (members[0]?.id || 'mem_om');
    } catch {
      return 'mem_om';
    }
  });

  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(new Date());

  const organization = organizations.find((o) => o.id === activeOrgId) || organizations[0];
  const currentMember = members.find((m) => m.id === currentMemberId) || members[0] || {
    id: 'mem_fallback',
    name: 'Store Operator',
    role: 'owner',
    avatarInitials: 'OP',
  };

  // Role permissions
  const canManageSettings = currentMember.role === 'owner';
  const canApproveOrders = currentMember.role === 'owner' || currentMember.role === 'manager';
  const canDeleteRecords = currentMember.role === 'owner';
  const canIntakeOrders = true;

  // Track online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch organizations from Supabase
  useEffect(() => {
    async function loadCloudOrgs() {
      try {
        const { data, error } = await supabase.from('organizations').select('*');
        if (!error && data && data.length > 0) {
          setOrganizations(data);
          localStorage.setItem('vendora_all_orgs', JSON.stringify(data));
        }
      } catch (err) {
        console.warn('Failed to load cloud orgs:', err);
      }
    }
    if (isOnline) {
      loadCloudOrgs();
    }
  }, [isOnline]);

  // Load members for current organization
  useEffect(() => {
    async function loadOrgMembers() {
      try {
        const { data, error } = await supabase
          .from('organization_members')
          .select('*')
          .eq('org_id', activeOrgId);

        if (!error && data && data.length > 0) {
          const mapped: OrgMemberProfile[] = data.map((d: any) => ({
            id: d.id,
            name: d.member_name,
            role: d.role as UserRole,
            email: d.email,
            avatarInitials: d.avatar_initials || d.member_name.slice(0, 2).toUpperCase(),
          }));
          setMembers(mapped);
          localStorage.setItem(`vendora_org_members_${activeOrgId}`, JSON.stringify(mapped));
          if (!mapped.some((m) => m.id === currentMemberId)) {
            setCurrentMemberId(mapped[0].id);
          }
        }
      } catch (err) {
        console.warn('Failed to load cloud members:', err);
      }
    }

    if (isOnline) {
      loadOrgMembers();
    }
  }, [isOnline, activeOrgId]);

  const switchOrganization = (orgId: string) => {
    setActiveOrgId(orgId);
    try {
      localStorage.setItem('vendora_active_org_id', orgId);
    } catch {}
    // Trigger reload or state flush for new org
    window.location.reload();
  };

  const createOrganization = async (orgName: string, ownerName: string) => {
    const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'store';
    const newOrgId = `org_${Date.now().toString(36)}`;

    const newOrg: CloudOrganization = {
      id: newOrgId,
      name: orgName.trim(),
      slug: `${slug}-${Math.random().toString(36).slice(2, 5)}`,
      capacity: 15,
      currency: 'INR',
    };

    const ownerInitials = ownerName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'OW';
    const ownerMember: OrgMemberProfile = {
      id: `mem_${Date.now().toString(36)}`,
      name: ownerName.trim(),
      role: 'owner',
      avatarInitials: ownerInitials,
    };

    // Update local state immediately
    const updatedOrgs = [...organizations, newOrg];
    setOrganizations(updatedOrgs);
    try {
      localStorage.setItem('vendora_all_orgs', JSON.stringify(updatedOrgs));
      localStorage.setItem(`vendora_org_members_${newOrgId}`, JSON.stringify([ownerMember]));
      localStorage.setItem(`vendora_active_member_${newOrgId}`, ownerMember.id);
      localStorage.setItem('vendora_active_org_id', newOrgId);
    } catch {}

    // Cloud backup to Supabase
    if (isOnline) {
      try {
        await supabase.from('organizations').insert({
          id: newOrg.id,
          name: newOrg.name,
          slug: newOrg.slug,
          capacity: newOrg.capacity,
          currency: newOrg.currency,
        });

        await supabase.from('organization_members').insert({
          id: ownerMember.id,
          org_id: newOrg.id,
          member_name: ownerMember.name,
          role: ownerMember.role,
          avatar_initials: ownerMember.avatarInitials,
        });
      } catch (err) {
        console.warn('Failed to push new org to cloud:', err);
      }
    }

    // Switch to the newly created organization!
    window.location.reload();
  };

  const switchMember = (memberId: string) => {
    setCurrentMemberId(memberId);
    try {
      localStorage.setItem(`vendora_active_member_${activeOrgId}`, memberId);
    } catch {}
  };

  const addMember = async (name: string, role: UserRole, email?: string) => {
    const initials = name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'OP';

    const newMember: OrgMemberProfile = {
      id: `mem_${Date.now().toString(36)}`,
      name,
      role,
      email,
      avatarInitials: initials,
    };

    const updated = [...members, newMember];
    setMembers(updated);
    try {
      localStorage.setItem(`vendora_org_members_${activeOrgId}`, JSON.stringify(updated));
    } catch {}

    if (isOnline) {
      try {
        await supabase.from('organization_members').insert({
          id: newMember.id,
          org_id: activeOrgId,
          member_name: newMember.name,
          role: newMember.role,
          email: newMember.email || '',
          avatar_initials: newMember.avatarInitials,
        });
      } catch (err) {
        console.warn('Failed to push member to cloud:', err);
      }
    }
  };

  const syncNow = async () => {
    setLastSyncedAt(new Date());
  };

  return (
    <OrgAuthContext.Provider
      value={{
        organization,
        organizations,
        switchOrganization,
        createOrganization,
        currentMember,
        members,
        switchMember,
        addMember,
        canManageSettings,
        canApproveOrders,
        canDeleteRecords,
        canIntakeOrders,
        isOnline,
        pendingSyncCount,
        setPendingSyncCount,
        lastSyncedAt,
        setLastSyncedAt,
        syncNow,
      }}
    >
      {children}
    </OrgAuthContext.Provider>
  );
}

export function useOrgAuth() {
  const context = useContext(OrgAuthContext);
  if (!context) {
    throw new Error('useOrgAuth must be used within an OrgAuthProvider');
  }
  return context;
}
