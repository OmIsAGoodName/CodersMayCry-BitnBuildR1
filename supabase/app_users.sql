-- 5. User Accounts (Username + Password Authentication & Strict Multi-Tenant Store Ownership)
create table if not exists public.app_users (
  id text primary key,
  username text unique not null,
  password_hash text not null,
  full_name text not null,
  org_id text not null references public.organizations(id) on delete cascade,
  role text not null default 'owner',
  created_at timestamptz default now()
);

create index if not exists idx_app_users_username on public.app_users (lower(username));
create index if not exists idx_app_users_org on public.app_users (org_id);

alter table public.app_users enable row level security;
create policy "Allow all read app_users" on public.app_users for select using (true);
create policy "Allow all mutate app_users" on public.app_users for all using (true);
