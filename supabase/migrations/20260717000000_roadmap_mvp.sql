-- Ready for Supabase when you connect a free project.
-- Until then the app persists to browser localStorage (solo / free).

create table if not exists agents_settings (
  agent_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  brand_name text not null default '',
  role_line text not null default '',
  phone text not null default '',
  email text not null default '',
  mark_letter text not null default 'R',
  brand_color text not null default '#1F3D2B',
  accent_color text not null default '#B8862F',
  default_rate numeric not null default 6.5,
  default_tax_pct numeric not null default 1.0,
  default_insurance_yr numeric not null default 1400,
  default_closing_pct numeric not null default 3,
  default_pmi_pct numeric not null default 0.6,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references auth.users (id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  email text not null default '',
  phone text not null default '',
  time_to_buy text not null check (time_to_buy in ('0-3', '3-9', '9+')),
  stage text not null default 'lead' check (
    stage in (
      'lead',
      'roadmap_done',
      'working_gap',
      'mortgage_ready',
      'shopping',
      'closed',
      'nurture'
    )
  ),
  crm_external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists roadmaps (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  agent_id uuid not null references auth.users (id) on delete cascade,
  version int not null,
  inputs jsonb not null,
  outputs jsonb not null,
  pdf_url text,
  created_at timestamptz not null default now(),
  unique (client_id, version)
);

create table if not exists dpa_programs (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references auth.users (id) on delete cascade,
  name text not null,
  amount numeric not null default 0,
  type text not null default 'grant',
  county text,
  notes text not null default '',
  active boolean not null default true
);

create index if not exists clients_agent_id_idx on clients (agent_id);
create index if not exists roadmaps_client_id_idx on roadmaps (client_id);
create index if not exists dpa_programs_county_idx on dpa_programs (county);

alter table agents_settings enable row level security;
alter table clients enable row level security;
alter table roadmaps enable row level security;
alter table dpa_programs enable row level security;

create policy "own settings" on agents_settings
  for all using (agent_id = auth.uid()) with check (agent_id = auth.uid());

create policy "own clients" on clients
  for all using (agent_id = auth.uid()) with check (agent_id = auth.uid());

create policy "own roadmaps" on roadmaps
  for all using (agent_id = auth.uid()) with check (agent_id = auth.uid());

create policy "read dpa" on dpa_programs
  for select using (active and (agent_id is null or agent_id = auth.uid()));

create policy "write own dpa" on dpa_programs
  for all using (agent_id = auth.uid()) with check (agent_id = auth.uid());
