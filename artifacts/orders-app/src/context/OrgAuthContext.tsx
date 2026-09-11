import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase, CloudOrganization } from '@/lib/supabase';
import { User, Session } from '@supabase/supabase-js';

export type UserRole = 'owner' | 'manager' | 'operator';

export interface OrgMemberProfile {
  id: string;
  name: string;
  role: UserRole;
  email?: string;
  avatarInitials: string;
  userId?: string;
}

interface OrgAuthContextType {
  // Multi-tenancy
  organization: CloudOrganization;
  organizations: CloudOrganization[];
  switchOrganization: (orgId: string) => void;
  createOrganization: (orgName: string, ownerName: string) => Promise<void>;
  
  // Member & Hierarchy
  currentMember: OrgMemberProfile;
  members: OrgMemberProfile[];
  switchMember: (memberId: string) => void;
  addMember: (name: string, role: UserRole, email?: string) => Promise<void>;
  
  // Supabase Auth & Multi-Device Login
  user: User | null;
  session: Session | null;
  loginWithEmail: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signUpWithEmail: (email: string, password: string, fullName: string, storeName: string) => Promise<{ ok: boolean; error?: string }>;
  loginWithStoreCode: (code: string, memberName?: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  
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

  // Supabase Auth State
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(new Date());

  const organization = organizations.find((o) => o.id === activeOrgId) || organizations[0];
  const currentMember = members.find((m) => m.id === currentMemberId) || members[0] || {
    id: 'mem_om',
    name: 'Om Shetkar',
    role: 'owner',
    avatarInitials: 'OS',
  };

  // Role permissions
  const canManageSettings = currentMember.role === 'owner';
  const canApproveOrders = currentMember.role === 'owner' || currentMember.role === 'manager';
  const canDeleteRecords = currentMember.role === 'owner';
  const canIntakeOrders = true;

  // Listen for Supabase Auth state changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Track online/offline status
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

  // Fetch all organizations from Supabase
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

  // Load members for current organization from Supabase
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

  // Auth: Log in with email & password across devices
  const loginWithEmail = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        return { ok: false, error: error.message };
      }

      setSession(data.session);
      setUser(data.user);

      // Check if user has an associated organization or member profile
      const { data: memberData } = await supabase
        .from('organization_members')
        .select('*, organizations(*)')
        .eq('email', email.trim());

      if (memberData && memberData.length > 0) {
        const primary = memberData[0];
        setActiveOrgId(primary.org_id);
        setCurrentMemberId(primary.id);
        try {
          localStorage.setItem('vendora_active_org_id', primary.org_id);
          localStorage.setItem(`vendora_active_member_${primary.org_id}`, primary.id);
        } catch {}
      }

      window.location.reload();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Login failed' };
    }
  };

  // Auth: Sign up with email & create organization
  const signUpWithEmail = async (email: string, password: string, fullName: string, storeName: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim(), store_name: storeName.trim() },
        },
      });

      if (error) {
        return { ok: false, error: error.message };
      }

      // Create new organization for this user
      await createOrganization(storeName, fullName);
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Sign up failed' };
    }
  };

  // Auth: Instant multi-device sync via Store Code / Slug
  const loginWithStoreCode = async (code: string, memberName?: string) => {
    const cleanCode = code.trim().toLowerCase();
    try {
      // Find organization by ID or slug
      const { data: orgData, error: orgErr } = await supabase
        .from('organizations')
        .select('*')
        .or(`id.eq.${code.trim()},slug.eq.${cleanCode}`)
        .limit(1);

      if (orgErr || !orgData || orgData.length === 0) {
        return { ok: false, error: 'Store not found with that Store ID or Slug' };
      }

      const foundOrg = orgData[0];
      setActiveOrgId(foundOrg.id);
      try {
        localStorage.setItem('vendora_active_org_id', foundOrg.id);
      } catch {}

      // Fetch members of that org
      const { data: memberData } = await supabase
        .from('organization_members')
        .select('*')
        .eq('org_id', foundOrg.id);

      if (memberData && memberData.length > 0) {
        let match = memberData[0];
        if (memberName) {
          const found = memberData.find((m: any) => m.member_name.toLowerCase().includes(memberName.toLowerCase()));
          if (found) match = found;
        }
        setCurrentMemberId(match.id);
        try {
          localStorage.setItem(`vendora_active_member_${foundOrg.id}`, match.id);
        } catch {}
      }

      window.location.reload();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Store connection failed' };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    try {
      localStorage.removeItem('vendora_active_org_id');
      localStorage.removeItem('vendora_active_member_id');
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

    const updatedOrgs = [...organizations, newOrg];
    setOrganizations(updatedOrgs);
    try {
      localStorage.setItem('vendora_all_orgs', JSON.stringify(updatedOrgs));
      localStorage.setItem(`vendora_org_members_${newOrgId}`, JSON.stringify([ownerMember]));
      localStorage.setItem(`vendora_active_member_${newOrgId}`, ownerMember.id);
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
        user,
        session,
        loginWithEmail,
        signUpWithEmail,
        loginWithStoreCode,
        logout,
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
