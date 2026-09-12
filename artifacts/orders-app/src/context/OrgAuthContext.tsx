import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase, CloudOrganization } from '@/lib/supabase';
import { syncStoreOrders } from '@/lib/sync/offlineSyncManager';
import { AppUser, getCurrentUser, logoutUser } from '@/lib/auth/userAuth';
import { User, Session } from '@supabase/supabase-js';

export type UserRole = 'owner' | 'manager' | 'operator';

export interface OrgMemberProfile {
  id: string;
  name: string;
  role: UserRole;
  email?: string;
  avatarInitials: string;
  userId?: string;
  status?: 'active' | 'pending';
}

interface OrgAuthContextType {
  // Authentication & Current User
  currentUser: AppUser | null;
  isAuthenticated: boolean;
  logout: () => void;

  // Multi-tenancy
  organization: CloudOrganization | null;
  organizations: CloudOrganization[];
  switchOrganization: (orgId: string) => void;
  createOrganization: (orgName: string, ownerName: string) => Promise<void>;

  // Member & Hierarchy
  currentMember: OrgMemberProfile | null;
  members: OrgMemberProfile[];
  refreshMembers: () => Promise<void>;
  switchMember: (memberId: string) => void;
  addMember: (name: string, role: UserRole, email?: string) => Promise<void>;

  // Legacy Supabase session support
  user: User | null;
  session: Session | null;

  // Permissions
  canManageSettings: boolean;
  canApproveOrders: boolean;
  canDeleteRecords: boolean;
  canIntakeOrders: boolean;

  // Connection & Sync
  isOnline: boolean;
  pendingSyncCount: number;
  setPendingSyncCount: React.Dispatch<React.SetStateAction<number>>;
  lastSyncedAt: Date | null;
  setLastSyncedAt: React.Dispatch<React.SetStateAction<Date | null>>;
  syncNow: () => Promise<void>;
}

const OrgAuthContext = createContext<OrgAuthContextType | undefined>(undefined);

export function OrgAuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => getCurrentUser());

  const [organizations, setOrganizations] = useState<CloudOrganization[]>(() => {
    try {
      const cached = localStorage.getItem('vendora_all_orgs');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [activeOrgId, setActiveOrgId] = useState<string>(() => {
    try {
      const user = getCurrentUser();
      return user?.orgId || localStorage.getItem('vendora_active_org_id') || '';
    } catch {
      return '';
    }
  });

  const [members, setMembers] = useState<OrgMemberProfile[]>(() => {
    try {
      if (!activeOrgId) return [];
      const cached = localStorage.getItem('vendora_org_members_' + activeOrgId);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [currentMemberId, setCurrentMemberId] = useState<string>(() => {
    try {
      if (!activeOrgId) return '';
      return localStorage.getItem('vendora_active_member_' + activeOrgId) || '';
    } catch {
      return '';
    }
  });

  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(new Date());
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  // Keep currentUser in sync if changed
  useEffect(() => {
    const handleStorage = () => {
      const updatedUser = getCurrentUser();
      setCurrentUser(updatedUser);
      if (updatedUser && updatedUser.orgId !== activeOrgId) {
        setActiveOrgId(updatedUser.orgId);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [activeOrgId]);

  // Network listeners
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

  // Sync organizations from Supabase Cloud if online
  useEffect(() => {
    if (!isOnline || !activeOrgId) return;

    async function loadCloudOrg() {
      try {
        const { data, error } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', activeOrgId)
          .limit(1);

        if (!error && data && data.length > 0) {
          const org = data[0];
          setOrganizations((prev) => {
            const exists = prev.find((o) => o.id === org.id);
            const updated = exists ? prev.map((o) => (o.id === org.id ? org : o)) : [...prev, org];
            try {
              localStorage.setItem('vendora_all_orgs', JSON.stringify(updated));
            } catch {}
            return updated;
          });
        }
      } catch (err) {
        console.warn('Could not pull cloud organization:', err);
      }
    }

    loadCloudOrg();
  }, [isOnline, activeOrgId]);

  // Refresh organization members from cloud (combines organization_members and app_users)
  const refreshMembers = async () => {
    if (!activeOrgId || !isOnline) return;
    try {
      // 1. Pull from organization_members
      const { data, error } = await supabase
        .from('organization_members')
        .select('*')
        .eq('org_id', activeOrgId);

      // 2. Pull from app_users
      const { data: usersData } = await supabase
        .from('app_users')
        .select('*')
        .eq('org_id', activeOrgId);

      const memberMap = new Map<string, OrgMemberProfile>();

      if (!error && data) {
        for (const m of data) {
          const isInvite = Boolean(m.email && m.email.startsWith('invite:'));
          memberMap.set(m.id, {
            id: m.id,
            name: m.member_name,
            role: m.role as UserRole,
            email: m.email,
            avatarInitials: m.avatar_initials || (m.member_name ? m.member_name.slice(0, 2).toUpperCase() : 'EM'),
            status: isInvite ? 'pending' : 'active',
          });
        }
      }

      // Also merge any users registered under this org_id
      if (usersData) {
        for (const u of usersData) {
          const existing = Array.from(memberMap.values()).find(
            (m) =>
              m.id === u.id ||
              m.email?.toLowerCase() === `${u.username}@vendora.store`.toLowerCase() ||
              m.name.toLowerCase() === u.full_name.toLowerCase()
          );

          if (!existing) {
            const initials =
              u.full_name
                .split(' ')
                .map((w: string) => w[0])
                .join('')
                .slice(0, 2)
                .toUpperCase() || 'EM';
            memberMap.set(u.id, {
              id: u.id,
              name: u.full_name,
              role: u.role as UserRole,
              email: `${u.username}@vendora.store`,
              avatarInitials: initials,
              status: 'active',
            });
          }
        }
      }

      const mapped = Array.from(memberMap.values());
      if (mapped.length > 0) {
        setMembers(mapped);
        try {
          localStorage.setItem('vendora_org_members_' + activeOrgId, JSON.stringify(mapped));
        } catch {}

        if (currentUser) {
          const matching = mapped.find(
            (m) =>
              m.email?.toLowerCase().startsWith(currentUser.username.toLowerCase() + '@') ||
              m.name.toLowerCase() === currentUser.fullName.toLowerCase() ||
              m.id === currentUser.id
          );
          if (matching) {
            setCurrentMemberId(matching.id);
            try {
              localStorage.setItem('vendora_active_member_' + activeOrgId, matching.id);
            } catch {}
          }
        }
      }
    } catch (err) {
      console.warn('Could not pull members:', err);
    }
  };

  useEffect(() => {
    if (isOnline && activeOrgId) {
      refreshMembers();
    }
  }, [isOnline, activeOrgId]);

  const organization = organizations.find((o) => o.id === activeOrgId) || (currentUser ? {
    id: currentUser.orgId,
    name: 'My Store',
    slug: 'my-store',
    capacity: 15,
    currency: 'INR'
  } : null);

  // Authenticated user is the absolute authority for identity and permissions
  const currentMember: OrgMemberProfile | null = currentUser ? {
    id: currentUser.id,
    name: currentUser.fullName,
    role: currentUser.role, // STRICTLY LOCKED TO AUTHENTICATED USER'S ASSIGNED ROLE
    avatarInitials: currentUser.fullName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'EM',
    email: `${currentUser.username}@vendora.store`
  } : null;

  // Role permissions
  const role: UserRole = currentUser?.role || 'operator';
  const canManageSettings = role === 'owner';
  const canApproveOrders = role === 'owner' || role === 'manager';
  const canDeleteRecords = role === 'owner';
  const canIntakeOrders = true;

  const logout = () => {
    logoutUser();
    setCurrentUser(null);
    setActiveOrgId('');
    setMembers([]);
    setCurrentMemberId('');
    try {
      localStorage.removeItem('vendora_active_org_id');
      localStorage.removeItem('vendora_current_user');
    } catch {}
    window.location.reload();
  };

  const switchOrganization = (orgId: string) => {
    setActiveOrgId(orgId);
    try {
      localStorage.setItem('vendora_active_org_id', orgId);
    } catch {}
    window.location.reload();
  };

  const createOrganization = async (orgName: string, ownerName: string) => {
    const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'store';
    const newOrgId = 'org_' + Date.now().toString(36);

    const newOrg: CloudOrganization = {
      id: newOrgId,
      name: orgName.trim(),
      slug: slug + "-" + Math.random().toString(36).slice(2, 5),
      capacity: 15,
      currency: 'INR',
    };

    const ownerInitials = ownerName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'OW';
    const ownerMember: OrgMemberProfile = {
      id: 'mem_' + Date.now().toString(36),
      name: ownerName.trim(),
      role: 'owner',
      avatarInitials: ownerInitials,
    };

    const updatedOrgs = [...organizations, newOrg];
    setOrganizations(updatedOrgs);
    setActiveOrgId(newOrgId);
    setMembers([ownerMember]);
    setCurrentMemberId(ownerMember.id);

    try {
      localStorage.setItem('vendora_all_orgs', JSON.stringify(updatedOrgs));
      localStorage.setItem('vendora_org_members_' + newOrgId, JSON.stringify([ownerMember]));
      localStorage.setItem('vendora_active_member_' + newOrgId, ownerMember.id);
      localStorage.setItem('vendora_active_org_id', newOrgId);
    } catch {}

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
  };

  const switchMember = (_memberId: string) => {
    // Identity is strictly bound to the authenticated session; role switching is disabled for security
  };

  const addMember = async (name: string, role: UserRole, email?: string) => {
    const initials = name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'OP';

    const newMember: OrgMemberProfile = {
      id: 'mem_' + Date.now().toString(36),
      name,
      role,
      email,
      avatarInitials: initials,
    };

    const updated = [...members, newMember];
    setMembers(updated);
    try {
      localStorage.setItem('vendora_org_members_' + activeOrgId, JSON.stringify(updated));
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
    if (activeOrgId) {
      await syncStoreOrders(activeOrgId);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('vendora:sync-complete'));
      }
    }
    setLastSyncedAt(new Date());
  };

  return (
    <OrgAuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        logout,
        organization,
        organizations,
        switchOrganization,
        createOrganization,
        currentMember,
        members,
        refreshMembers,
        switchMember,
        addMember,
        user,
        session,
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
