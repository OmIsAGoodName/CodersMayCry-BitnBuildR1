import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase, CloudMember, CloudOrganization } from '@/lib/supabase';

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

const DEFAULT_ORG: CloudOrganization = {
  id: 'org_vendora_main',
  name: 'Vendora Flagship Ledger',
  slug: 'vendora-main',
  capacity: 15,
  currency: 'INR'
};

const DEFAULT_MEMBERS: OrgMemberProfile[] = [
  { id: 'mem_om', name: 'Om Shetkar', role: 'owner', email: 'om@vendora.local', avatarInitials: 'OS' },
  { id: 'mem_ritu', name: 'Ritu Sharma', role: 'manager', email: 'ritu@vendora.local', avatarInitials: 'RS' },
  { id: 'mem_kabir', name: 'Kabir Khan', role: 'operator', email: 'kabir@vendora.local', avatarInitials: 'KK' }
];

const OrgAuthContext = createContext<OrgAuthContextType | undefined>(undefined);

export function OrgAuthProvider({ children }: { children: ReactNode }) {
  const [organization, setOrganization] = useState<CloudOrganization>(DEFAULT_ORG);
  const [members, setMembers] = useState<OrgMemberProfile[]>(() => {
    try {
      const cached = localStorage.getItem('vendora_org_members');
      return cached ? JSON.parse(cached) : DEFAULT_MEMBERS;
    } catch {
      return DEFAULT_MEMBERS;
    }
  });

  const [currentMemberId, setCurrentMemberId] = useState<string>(() => {
    try {
      return localStorage.getItem('vendora_active_member_id') || 'mem_om';
    } catch {
      return 'mem_om';
    }
  });

  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(new Date());

  const currentMember = members.find((m) => m.id === currentMemberId) || members[0];

  // Role permissions
  const canManageSettings = currentMember.role === 'owner';
  const canApproveOrders = currentMember.role === 'owner' || currentMember.role === 'manager';
  const canDeleteRecords = currentMember.role === 'owner';
  const canIntakeOrders = true;

  // Track online/offline browser state
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

  // Sync members with Supabase on mount
  useEffect(() => {
    async function loadCloudMembers() {
      try {
        const { data, error } = await supabase
          .from('organization_members')
          .select('*')
          .eq('org_id', organization.id);

        if (!error && data && data.length > 0) {
          const mapped: OrgMemberProfile[] = data.map((d: any) => ({
            id: d.id,
            name: d.member_name,
            role: d.role as UserRole,
            email: d.email,
            avatarInitials: d.avatar_initials || d.member_name.slice(0, 2).toUpperCase()
          }));
          setMembers(mapped);
          localStorage.setItem('vendora_org_members', JSON.stringify(mapped));
        }
      } catch (err) {
        console.warn('Using local fallback for organization members:', err);
      }
    }

    if (isOnline) {
      loadCloudMembers();
    }
  }, [isOnline, organization.id]);

  const switchMember = (memberId: string) => {
    setCurrentMemberId(memberId);
    try {
      localStorage.setItem('vendora_active_member_id', memberId);
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
      id: mem_,
      name,
      role,
      email,
      avatarInitials: initials
    };

    const updated = [...members, newMember];
    setMembers(updated);
    try {
      localStorage.setItem('vendora_org_members', JSON.stringify(updated));
    } catch {}

    // Cloud backup to Supabase
    if (isOnline) {
      try {
        await supabase.from('organization_members').insert({
          id: newMember.id,
          org_id: organization.id,
          member_name: newMember.name,
          role: newMember.role,
          email: newMember.email || '',
          avatar_initials: newMember.avatarInitials
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
        syncNow
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
