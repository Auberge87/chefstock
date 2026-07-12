-- Chef Stock: initial multi-tenant schema
-- Every tenant-owned table carries organization_id (never a raw user_id) so multiple
-- staff can share one restaurant's data later without a schema change.

create extension if not exists pgcrypto;

-- ============================================================
-- ORGANIZATIONS + MEMBERSHIP
-- ============================================================

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Nouveau restaurant',
  city text,
  contact text,
  email text,
  signature text,
  units text[] not null default '{}',
  anthropic_model text default 'claude-sonnet-4-6',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type org_role as enum ('owner', 'staff');

create table organization_members (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role org_role not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

-- Central RLS helper: every tenant table's policy calls this, so there is one
-- place to audit tenant isolation.
create or replace function is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from organization_members
    where organization_id = org_id and user_id = auth.uid()
  );
$$;

alter table organizations enable row level security;
create policy "org members can view/update their org" on organizations
  for all using (is_org_member(id)) with check (is_org_member(id));

alter table organization_members enable row level security;
create policy "org members can view membership" on organization_members
  for select using (is_org_member(organization_id));
create policy "owners can manage membership" on organization_members
  for insert with check (is_org_member(organization_id));
create policy "owners can remove membership" on organization_members
  for delete using (is_org_member(organization_id));

-- ============================================================
-- SUPPLIERS
-- ============================================================

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  icon text not null default '📦',
  ordering_method text not null default 'email', -- email | phone | website
  email text,
  phone text,
  website text,
  min_order_amount numeric(10,2) not null default 100,
  delivery_days text[] not null default '{}',
  order_deadline text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_suppliers_org on suppliers(organization_id);

alter table suppliers enable row level security;
create policy "org members can CRUD suppliers" on suppliers
  for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));

-- ============================================================
-- PRODUCTS + MULTI-SUPPLIER JOIN + PRICE HISTORY
-- ============================================================

create table products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  category text not null default 'Divers',
  unit text not null default 'pièce',
  packaging text default '',
  primary_supplier_id uuid references suppliers(id) on delete set null,
  quick_quantities numeric[] not null default '{}',
  estimated_price numeric(10,2) not null default 0,
  price_basis text not null default 'unit', -- unit | kg | piece
  unit_weight_kg numeric(10,3) not null default 0,
  pieces_per_unit numeric(10,3) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_products_org on products(organization_id);

alter table products enable row level security;
create policy "org members can CRUD products" on products
  for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));

create table product_suppliers (
  product_id uuid not null references products(id) on delete cascade,
  supplier_id uuid not null references suppliers(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  primary key (product_id, supplier_id)
);
create index idx_product_suppliers_org on product_suppliers(organization_id);
create index idx_product_suppliers_supplier on product_suppliers(supplier_id);

alter table product_suppliers enable row level security;
create policy "org members can CRUD product_suppliers" on product_suppliers
  for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));

create table price_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  supplier_id uuid references suppliers(id) on delete set null,
  price numeric(10,2) not null,
  recorded_at timestamptz not null default now(),
  source text -- manual | order | ai-scan
);
create index idx_price_history_product on price_history(product_id, recorded_at);
create index idx_price_history_org on price_history(organization_id);

alter table price_history enable row level security;
create policy "org members can CRUD price_history" on price_history
  for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));

-- ============================================================
-- ORDERS + ORDER ITEMS
-- ============================================================

create type order_status as enum ('sent', 'received');

create table orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  supplier_id uuid not null references suppliers(id),
  status order_status not null default 'sent',
  received_via text, -- quick | reconciled | null
  delivery_label text,
  delivery_date date not null default current_date,
  note text,
  sent_at timestamptz not null default now(),
  received_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_orders_org_date on orders(organization_id, delivery_date);
create index idx_orders_org_status on orders(organization_id, status);

alter table orders enable row level security;
create policy "org members can CRUD orders" on orders
  for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  name_snapshot text not null,
  qty numeric(10,2) not null default 0,
  unit text,
  packaging text,
  price numeric(10,2),
  delivered boolean not null default false
);
create index idx_order_items_order on order_items(order_id);
create index idx_order_items_org on order_items(organization_id);

alter table order_items enable row level security;
create policy "org members can CRUD order_items" on order_items
  for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));

-- ============================================================
-- SAVED DRAFTS + INVENTORY + DISMISSED ALERTS
-- ============================================================

create table saved_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  cart jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index idx_saved_drafts_org on saved_drafts(organization_id);

alter table saved_drafts enable row level security;
create policy "org members can CRUD saved_drafts" on saved_drafts
  for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));

create table inventory (
  organization_id uuid not null references organizations(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  current numeric(10,2) not null default 0,
  min_qty numeric(10,2) not null default 0,
  max_qty numeric(10,2) not null default 0,
  unit text,
  updated_at timestamptz not null default now(),
  primary key (organization_id, product_id)
);

alter table inventory enable row level security;
create policy "org members can CRUD inventory" on inventory
  for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));

create table dismissed_alerts (
  organization_id uuid not null references organizations(id) on delete cascade,
  alert_id text not null,
  dismissed_by uuid references auth.users(id),
  dismissed_at timestamptz not null default now(),
  primary key (organization_id, alert_id)
);

alter table dismissed_alerts enable row level security;
create policy "org members can CRUD dismissed_alerts" on dismissed_alerts
  for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));

-- ============================================================
-- updated_at TRIGGERS
-- ============================================================

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_organizations_updated_at before update on organizations
  for each row execute function set_updated_at();
create trigger trg_suppliers_updated_at before update on suppliers
  for each row execute function set_updated_at();
create trigger trg_products_updated_at before update on products
  for each row execute function set_updated_at();
create trigger trg_inventory_updated_at before update on inventory
  for each row execute function set_updated_at();

-- ============================================================
-- NEW USER -> AUTO-PROVISION ORGANIZATION
-- ============================================================

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
begin
  insert into organizations (name) values ('Nouveau restaurant') returning id into new_org_id;
  insert into organization_members (organization_id, user_id, role)
    values (new_org_id, new.id, 'owner');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
