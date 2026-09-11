-- ============================================================================
-- VENDORA MULTI-TENANT & SOVEREIGN OFFLINE LEDGER SCHEMA
-- Track 3: Jan Jeevan / Bit N Build 2026
-- ============================================================================

-- 1. Organizations (Multi-Store / Tenant Isolation)
create table if not exists public.organizations (
  id text primary key,
  name text not null,
  slug text unique not null,
  capacity int not null default 15,
  currency text not null default 'INR',
  created_at timestamptz default now()
);

-- 2. Organization Members & Role-Based Hierarchy (Owner, Manager, Operator)
create table if not exists public.organization_members (
  id text primary key,
  org_id text not null references public.organizations(id) on delete cascade,
  member_name text not null,
  email text,
  role text not null check (role in ('owner', 'manager', 'operator')) default 'operator',
  avatar_initials text not null default 'OP',
  created_at timestamptz default now()
);

-- 3. Sovereign Orders Ledger
create table if not exists public.orders (
  id text primary key,
  org_id text not null references public.organizations(id) on delete cascade,
  customer text not null,
  phone text default '',
  amount numeric not null default 0,
  paid_amount numeric not null default 0,
  due_date text not null,
  status text not null default 'new',
  items jsonb not null default '[]'::jsonb,
  notes text default '',
  needs_clarification boolean not null default false,
  source text default 'counter',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  version int not null default 1,
  updated_by text default 'system'
);

-- 4. CRDT Mutation Log (Deterministic Conflict Convergence across Multi-Operators)
create table if not exists public.crdt_oplog (
  id text primary key,
  org_id text not null references public.organizations(id) on delete cascade,
  order_id text not null,
  client_id text not null,
  op_type text not null,
  patch jsonb not null,
  hlc text not null,
  timestamp bigint not null default (extract(epoch from now()) * 1000)::bigint
);

-- Indexes for performance
create index if not exists idx_orders_org_due on public.orders (org_id, due_date);
create index if not exists idx_orders_org_status on public.orders (org_id, status);
create index if not exists idx_members_org on public.organization_members (org_id);
create index if not exists idx_oplog_org on public.crdt_oplog (org_id, timestamp desc);

-- Realtime publication enablement for instant multi-operator sync
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.organization_members;

-- Row Level Security (RLS) policies
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.orders enable row level security;
alter table public.crdt_oplog enable row level security;

-- Anon / Local-first access policies (for sovereign counter devices using anon key)
create policy "Allow all read organizations" on public.organizations for select using (true);
create policy "Allow all insert/update organizations" on public.organizations for all using (true);

create policy "Allow all read members" on public.organization_members for select using (true);
create policy "Allow all mutate members" on public.organization_members for all using (true);

create policy "Allow all read orders" on public.orders for select using (true);
create policy "Allow all mutate orders" on public.orders for all using (true);

create policy "Allow all read oplog" on public.crdt_oplog for select using (true);
create policy "Allow all mutate oplog" on public.crdt_oplog for all using (true);

-- Seed Initial Flagship Organization & Hierarchy Members
insert into public.organizations (id, name, slug, capacity, currency)
values ('org_vendora_main', 'Vendora Flagship Ledger', 'vendora-main', 15, 'INR')
on conflict (id) do nothing;

insert into public.organization_members (id, org_id, member_name, email, role, avatar_initials)
values
  ('mem_om', 'org_vendora_main', 'Om Shetkar', 'om@vendora.local', 'owner', 'OS'),
  ('mem_ritu', 'org_vendora_main', 'Ritu Sharma', 'ritu@vendora.local', 'manager', 'RS'),
  ('mem_kabir', 'org_vendora_main', 'Kabir Khan', 'kabir@vendora.local', 'operator', 'KK')
on conflict (id) do nothing;
