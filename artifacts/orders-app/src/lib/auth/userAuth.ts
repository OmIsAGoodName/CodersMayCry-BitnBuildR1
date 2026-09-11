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

/**
 * Client-side cryptographic SHA-256 password hash using standard Web Crypto API.
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + SALT);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Retrieve all local cached users
 */
export function getLocalUsers(): AppUser[] {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Save user into local storage
 */
export function saveLocalUser(user: AppUser): void {
  try {
    const users = getLocalUsers().filter((u) => u.username.toLowerCase() !== user.username.toLowerCase());
    users.push(user);
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
  } catch (err) {
    console.warn('Failed to save local user cache:', err);
  }
}

/**
 * Check if a username is already taken (case-insensitive)
 */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  const clean = username.trim().toLowerCase();
  if (!clean || clean.length < 3) return false;

  // 1. Check local cache
  const localUsers = getLocalUsers();
  if (localUsers.some((u) => u.username.toLowerCase() === clean)) {
    return false;
  }

  // 2. Check Supabase app_users table
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
    // If table doesn't exist yet or offline, proceed with local check result
  }

  return true;
}

/**
 * Register a new user and create their dedicated organisation as Owner
 */
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
    return { ok: false, error: "Username \"" + cleanUsername + "\" is already taken. Please choose another." };
  }

  const passwordHash = await hashPassword(password);
  const orgId = org__;
  const userId = usr__;
  const memberId = mem__;
  const slug = (cleanStoreName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "store") + "-" + Math.random().toString(36).slice(2, 5);
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
    email: cleanUsername + "@vendora.store",
  };

  // 1. Save locally
  saveLocalUser(newUser);

  try {
    const existingOrgs: CloudOrganization[] = JSON.parse(localStorage.getItem('vendora_all_orgs') || '[]');
    const updatedOrgs = [...existingOrgs.filter((o) => o.id !== orgId), newOrg];
    localStorage.setItem('vendora_all_orgs', JSON.stringify(updatedOrgs));
    localStorage.setItem(endora_org_members_, JSON.stringify([
      { id: memberId, name: cleanFullName, role: 'owner', avatarInitials: initials, email: ownerMember.email },
    ]));
    localStorage.setItem('vendora_active_org_id', orgId);
    localStorage.setItem(endora_active_member_, memberId);
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(newUser));
  } catch (err) {
    console.warn('LocalStorage error during register:', err);
  }

  // 2. Sync to Supabase Cloud
  try {
    // Insert organisation
    await supabase.from('organizations').insert({
      id: newOrg.id,
      name: newOrg.name,
      slug: newOrg.slug,
      capacity: newOrg.capacity,
      currency: newOrg.currency,
    });

    // Insert owner member
    await supabase.from('organization_members').insert({
      id: ownerMember.id,
      org_id: ownerMember.org_id,
      member_name: ownerMember.member_name,
      role: ownerMember.role,
      avatar_initials: ownerMember.avatar_initials,
      email: ownerMember.email,
    });

    // Insert user into app_users table
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
}

/**
 * Log in with existing username & password
 */
export async function loginUser({
  username,
  password,
}: {
  username: string;
  password: string;
}): Promise<{ ok: boolean; user?: AppUser; error?: string }> {
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
        // Update local cache
        saveLocalUser(matchedUser);
      } else {
        return { ok: false, error: 'Incorrect password. Please try again.' };
      }
    }
  } catch {
    // If Supabase is unreachable or app_users table is pending, fallback to local
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
    return { ok: false, error: "Account with username \"" + cleanUsername + "\" was not found." };
  }

  // Set active session
  try {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(matchedUser));
    localStorage.setItem('vendora_active_org_id', matchedUser.orgId);
  } catch {}

  // Fetch or setup organization details
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
}

/**
 * Get current authenticated user
 */
export function getCurrentUser(): AppUser | null {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Sign out current user
 */
export function logoutUser(): void {
  try {
    localStorage.removeItem(CURRENT_USER_KEY);
    localStorage.removeItem('vendora_active_org_id');
  } catch {}
}
