import { supabase, CloudOrganization } from '@/lib/supabase';

export interface AppUser {
  id: string;
  username: string;
  passwordHash: string;
  fullName: string;
  orgId: string;
  role: 'owner' | 'manager' | 'operator';
  createdAt: string;
}

const LOCAL_USERS_KEY = 'vendora_local_users';
const CURRENT_USER_KEY = 'vendora_current_user';
const SALT = '::vendora_sovereign_salt_2026';

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + SALT);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function getLocalUsers(): AppUser[] {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalUser(user: AppUser): void {
  try {
    const users = getLocalUsers().filter((u) => u.username.toLowerCase() !== user.username.toLowerCase());
    users.push(user);
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
  } catch (err) {
    console.warn('Failed to save local user cache:', err);
  }
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const clean = username.trim().toLowerCase();
  if (!clean || clean.length < 3) return false;

  const localUsers = getLocalUsers();
  if (localUsers.some((u) => u.username.toLowerCase() === clean)) {
    return false;
  }

  try {
    const { data, error } = await supabase
      .from('app_users')
      .select('username')
      .ilike('username', clean)
      .limit(1);

    if (!error && data && data.length > 0) {
      return false;
    }
  } catch {
    // Offline or table pending
  }

  return true;
}

export async function registerUser({
  username,
  password,
  fullName,
  storeName,
}: {
  username: string;
  password: string;
  fullName: string;
  storeName: string;
}): Promise<{ ok: boolean; user?: AppUser; error?: string }> {
  try {
    const cleanUsername = username.trim().toLowerCase();
    const cleanFullName = fullName.trim();
    const cleanStoreName = storeName.trim();

    if (cleanUsername.length < 3) {
      return { ok: false, error: 'Username must be at least 3 characters long.' };
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(cleanUsername)) {
      return { ok: false, error: 'Username can only contain letters, numbers, hyphens, and underscores.' };
    }
    if (password.length < 4) {
      return { ok: false, error: 'Password must be at least 4 characters long.' };
    }
    if (!cleanFullName) {
      return { ok: false, error: 'Please enter your full name.' };
    }
    if (!cleanStoreName) {
      return { ok: false, error: 'Please enter a store or organisation name.' };
    }

    const available = await isUsernameAvailable(cleanUsername);
    if (!available) {
      return { ok: false, error: 'Username "' + cleanUsername + '" is already taken. Please choose another.' };
    }

    const passwordHash = await hashPassword(password);
    const timestamp = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 6);
    const orgId = 'org_' + timestamp + '_' + rand;
    const userId = 'usr_' + timestamp + '_' + rand;
    const memberId = 'mem_' + timestamp + '_' + rand;
    const slugClean = cleanStoreName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'store';
    const slug = slugClean + '-' + Math.random().toString(36).slice(2, 5);
    const initials = cleanFullName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'OW';

    const newOrg: CloudOrganization = {
      id: orgId,
      name: cleanStoreName,
      slug,
      capacity: 15,
      currency: 'INR',
    };

    const newUser: AppUser = {
      id: userId,
      username: cleanUsername,
      passwordHash,
      fullName: cleanFullName,
      orgId,
      role: 'owner',
      createdAt: new Date().toISOString(),
    };

    const ownerMember = {
      id: memberId,
      org_id: orgId,
      member_name: cleanFullName,
      role: 'owner' as const,
      avatar_initials: initials,
      email: cleanUsername + '@vendora.store',
    };

    // 1. Save locally
    saveLocalUser(newUser);

    try {
      const existingOrgs: CloudOrganization[] = JSON.parse(localStorage.getItem('vendora_all_orgs') || '[]');
      const updatedOrgs = [...existingOrgs.filter((o) => o.id !== orgId), newOrg];
      localStorage.setItem('vendora_all_orgs', JSON.stringify(updatedOrgs));
      localStorage.setItem('vendora_org_members_' + orgId, JSON.stringify([
        { id: memberId, name: cleanFullName, role: 'owner', avatarInitials: initials, email: ownerMember.email },
      ]));
      localStorage.setItem('vendora_active_org_id', orgId);
      localStorage.setItem('vendora_active_member_' + orgId, memberId);
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(newUser));
      localStorage.setItem('vendora_onboarded', 'true');
    } catch (err) {
      console.warn('LocalStorage error during register:', err);
    }

    // 2. Sync to Supabase Cloud
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
        org_id: ownerMember.org_id,
        member_name: ownerMember.member_name,
        role: ownerMember.role,
        avatar_initials: ownerMember.avatar_initials,
        email: ownerMember.email,
      });

      await supabase.from('app_users').insert({
        id: newUser.id,
        username: newUser.username,
        password_hash: newUser.passwordHash,
        full_name: newUser.fullName,
        org_id: newUser.orgId,
        role: newUser.role,
      });
    } catch (err) {
      console.warn('Could not sync user to cloud database (offline or table pending):', err);
    }

    return { ok: true, user: newUser };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Failed to create user account' };
  }
}

export async function loginUser({
  username,
  password,
}: {
  username: string;
  password: string;
}): Promise<{ ok: boolean; user?: AppUser; error?: string }> {
  try {
    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername || !password) {
      return { ok: false, error: 'Please enter both username and password.' };
    }

    const expectedHash = await hashPassword(password);
    let matchedUser: AppUser | null = null;

    // 1. Try Supabase cloud lookup first
    try {
      const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .ilike('username', cleanUsername)
        .limit(1);

      if (!error && data && data.length > 0) {
        const row = data[0];
        if (row.password_hash === expectedHash) {
          matchedUser = {
            id: row.id,
            username: row.username,
            passwordHash: row.password_hash,
            fullName: row.full_name,
            orgId: row.org_id,
            role: row.role || 'owner',
            createdAt: row.created_at || new Date().toISOString(),
          };
          saveLocalUser(matchedUser);
        } else {
          return { ok: false, error: 'Incorrect password. Please try again.' };
        }
      }
    } catch {
      // Fallback
    }

    // 2. Fallback to local user cache
    if (!matchedUser) {
      const localUsers = getLocalUsers();
      const found = localUsers.find((u) => u.username.toLowerCase() === cleanUsername);
      if (found) {
        if (found.passwordHash === expectedHash) {
          matchedUser = found;
        } else {
          return { ok: false, error: 'Incorrect password. Please try again.' };
        }
      }
    }

    if (!matchedUser) {
      return { ok: false, error: 'Account with username "' + cleanUsername + '" was not found.' };
    }

    try {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(matchedUser));
      localStorage.setItem('vendora_onboarded', 'true');
      localStorage.setItem('vendora_active_org_id', matchedUser.orgId);
    } catch {}

    try {
      const { data: orgData } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', matchedUser.orgId)
        .limit(1);

      if (orgData && orgData.length > 0) {
        const org = orgData[0];
        const existingOrgs: CloudOrganization[] = JSON.parse(localStorage.getItem('vendora_all_orgs') || '[]');
        const updated = [...existingOrgs.filter((o) => o.id !== org.id), org];
        localStorage.setItem('vendora_all_orgs', JSON.stringify(updated));
      }
    } catch {}

    return { ok: true, user: matchedUser };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Login failed' };
  }
}

export function getCurrentUser(): AppUser | null {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function logoutUser(): void {
  try {
    localStorage.removeItem(CURRENT_USER_KEY);
    localStorage.removeItem('vendora_active_org_id');
  } catch {}
}


// ==========================================
// EMPLOYEE & INVITATION WORKFLOWS
// ==========================================

export interface EmployeeInvitation {
  id: string;
  orgId: string;
  orgName?: string;
  employeeUsername: string;
  role: 'operator' | 'manager';
  createdAt: string;
}

export async function checkUserExists(username: string): Promise<{ exists: boolean; fullName?: string }> {
  const clean = username.trim().toLowerCase().replace(/^@/, '');
  if (!clean) return { exists: false };
  try {
    const { data, error } = await supabase
      .from('app_users')
      .select('username, full_name')
      .ilike('username', clean)
      .limit(1);
    if (!error && data && data.length > 0) {
      return { exists: true, fullName: data[0].full_name };
    }
  } catch {}

  const local = getLocalUsers().find((u) => u.username.toLowerCase() === clean);
  if (local) return { exists: true, fullName: local.fullName };
  return { exists: false };
}

export async function registerEmployeeUser({
  username,
  password,
  fullName,
}: {
  username: string;
  password: string;
  fullName: string;
}): Promise<{ ok: boolean; user?: AppUser; error?: string }> {
  try {
    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
    const cleanFullName = fullName.trim();

    if (cleanUsername.length < 3) {
      return { ok: false, error: 'Username must be at least 3 characters long.' };
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(cleanUsername)) {
      return { ok: false, error: 'Username can only contain letters, numbers, hyphens, and underscores.' };
    }
    if (password.length < 4) {
      return { ok: false, error: 'Password must be at least 4 characters long.' };
    }
    if (!cleanFullName) {
      return { ok: false, error: 'Please enter your full name.' };
    }

    const available = await isUsernameAvailable(cleanUsername);
    if (!available) {
      return { ok: false, error: 'Username "' + cleanUsername + '" is already taken. Please choose another or sign in.' };
    }

    const passwordHash = await hashPassword(password);
    const timestamp = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 6);
    const userId = 'usr_' + timestamp + '_' + rand;
    const initials = cleanFullName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'EM';

    // Check if there is an existing pending invite from an owner
    let targetOrgId = 'org_employee_lobby';
    let assignedRole: 'operator' | 'manager' = 'operator';
    let matchedInviteId: string | null = null;

    try {
      const { data: invites } = await supabase
        .from('organization_members')
        .select('*')
        .ilike('email', 'invite:' + cleanUsername)
        .limit(1);

      if (invites && invites.length > 0) {
        targetOrgId = invites[0].org_id;
        assignedRole = (invites[0].role as 'operator' | 'manager') || 'operator';
        matchedInviteId = invites[0].id;
      }
    } catch {}

    const newUser: AppUser = {
      id: userId,
      username: cleanUsername,
      passwordHash,
      fullName: cleanFullName,
      orgId: targetOrgId,
      role: assignedRole,
      createdAt: new Date().toISOString(),
    };

    saveLocalUser(newUser);

    // Save to Supabase Cloud
    try {
      await supabase.from('app_users').insert({
        id: newUser.id,
        username: newUser.username,
        password_hash: newUser.passwordHash,
        full_name: newUser.fullName,
        org_id: newUser.orgId,
        role: newUser.role,
      });

      // If matched invite was found, activate the member row
      if (matchedInviteId && targetOrgId !== 'org_employee_lobby') {
        await supabase.from('organization_members').update({
          member_name: cleanFullName,
          email: cleanUsername + '@vendora.store',
          avatar_initials: initials,
          role: assignedRole,
        }).eq('id', matchedInviteId);
      }
    } catch (err) {
      console.warn('Cloud sync error during employee registration:', err);
    }

    try {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(newUser));
      localStorage.setItem('vendora_onboarded', 'true');
      localStorage.setItem('vendora_active_org_id', newUser.orgId);
    } catch {}

    return { ok: true, user: newUser };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Failed to create employee account' };
  }
}

export async function inviteEmployee({
  orgId,
  employeeUsername,
  role = 'operator',
}: {
  orgId: string;
  employeeUsername: string;
  role: 'operator' | 'manager';
}): Promise<{ ok: boolean; invitation?: EmployeeInvitation; error?: string }> {
  try {
    const clean = employeeUsername.trim().toLowerCase().replace(/^@/, '');
    if (!clean || clean.length < 3) {
      return { ok: false, error: 'Please enter a valid employee username (at least 3 characters).' };
    }

    // Check if already invited or active in this org
    try {
      const { data: existing } = await supabase
        .from('organization_members')
        .select('*')
        .eq('org_id', orgId)
        .or(`email.eq.invite:${clean},email.eq.${clean}@vendora.store`);

      if (existing && existing.length > 0) {
        return { ok: false, error: `@${clean} is already a member or has a pending invitation for this store.` };
      }
    } catch {}

    const invId = 'inv_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    const initials = clean.slice(0, 2).toUpperCase() || 'EM';

    const { error: insErr } = await supabase.from('organization_members').insert({
      id: invId,
      org_id: orgId,
      member_name: '@' + clean,
      email: 'invite:' + clean,
      role: role,
      avatar_initials: initials,
    });

    if (insErr) {
      return { ok: false, error: insErr.message || 'Failed to send invitation to cloud' };
    }

    const invitation: EmployeeInvitation = {
      id: invId,
      orgId,
      employeeUsername: clean,
      role,
      createdAt: new Date().toISOString(),
    };

    return { ok: true, invitation };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Failed to send invitation' };
  }
}

export async function getPendingInvitationsForOrg(orgId: string): Promise<EmployeeInvitation[]> {
  try {
    const { data, error } = await supabase
      .from('organization_members')
      .select('*')
      .eq('org_id', orgId)
      .like('email', 'invite:%');

    if (!error && data) {
      return data.map((m: any) => ({
        id: m.id,
        orgId: m.org_id,
        employeeUsername: (m.email || '').replace(/^invite:/, ''),
        role: m.role as 'operator' | 'manager',
        createdAt: m.created_at || new Date().toISOString(),
      }));
    }
  } catch (err) {
    console.warn('Failed to load pending invites:', err);
  }
  return [];
}

export async function getPendingInvitationsForEmployee(username: string): Promise<EmployeeInvitation[]> {
  const clean = username.trim().toLowerCase().replace(/^@/, '');
  if (!clean) return [];

  try {
    const { data: memberRows, error } = await supabase
      .from('organization_members')
      .select('*')
      .ilike('email', 'invite:' + clean);

    if (!error && memberRows && memberRows.length > 0) {
      const orgIds = Array.from(new Set(memberRows.map((r: any) => r.org_id)));
      const { data: orgData } = await supabase
        .from('organizations')
        .select('id, name')
        .in('id', orgIds);

      const orgMap: Record<string, string> = {};
      if (orgData) {
        orgData.forEach((o: any) => { orgMap[o.id] = o.name; });
      }

      return memberRows.map((m: any) => ({
        id: m.id,
        orgId: m.org_id,
        orgName: orgMap[m.org_id] || 'Vendora Store',
        employeeUsername: clean,
        role: m.role as 'operator' | 'manager',
        createdAt: m.created_at || new Date().toISOString(),
      }));
    }
  } catch (err) {
    console.warn('Failed to pull employee invitations:', err);
  }
  return [];
}

export async function acceptEmployeeInvitation({
  invitationId,
  userId,
  orgId,
  role,
  fullName,
  username,
}: {
  invitationId: string;
  userId: string;
  orgId: string;
  role: 'operator' | 'manager';
  fullName: string;
  username: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
    const initials = fullName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'EM';

    // 1. Update organization_members row from invite to active
    await supabase.from('organization_members').update({
      member_name: fullName,
      email: cleanUsername + '@vendora.store',
      avatar_initials: initials,
      role: role,
    }).eq('id', invitationId);

    // 2. Update app_users
    await supabase.from('app_users').update({
      org_id: orgId,
      role: role,
    }).eq('id', userId);

    // 3. Update current user in localStorage
    const cur = getCurrentUser();
    if (cur) {
      cur.orgId = orgId;
      cur.role = role;
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(cur));
      localStorage.setItem('vendora_active_org_id', orgId);
    }

    // 4. Cache org info if available
    try {
      const { data: orgData } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .limit(1);
      if (orgData && orgData.length > 0) {
        const org = orgData[0];
        const existingOrgs: CloudOrganization[] = JSON.parse(localStorage.getItem('vendora_all_orgs') || '[]');
        const updated = [...existingOrgs.filter((o) => o.id !== org.id), org];
        localStorage.setItem('vendora_all_orgs', JSON.stringify(updated));
      }
    } catch {}

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Failed to accept invitation' };
  }
}

export async function cancelEmployeeInvitation(invitationId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('organization_members').delete().eq('id', invitationId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Failed to cancel invitation' };
  }
}
