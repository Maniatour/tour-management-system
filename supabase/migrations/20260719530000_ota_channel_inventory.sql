-- OTA 채널별 수동 가격·재고 추적 (API 연동 전 운영팀 수동 관리)

begin;

create table if not exists public.ota_channel_inventory (
  id uuid primary key default gen_random_uuid(),
  operator_id text not null default 'M00001',
  product_id text not null references public.products(id) on delete cascade,
  channel_id text not null references public.channels(id) on delete cascade,
  variant_key text not null default 'default',
  inventory_date date not null,
  antelope_x_seats integer,
  antelope_l_seats integer,
  vehicle_seats integer,
  sale_status text not null default 'on_sale'
    check (sale_status in ('on_sale', 'low', 'sold_out', 'not_for_sale')),
  notes text,
  updated_by_email text,
  updated_by_name text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (product_id, channel_id, variant_key, inventory_date)
);

create index if not exists idx_ota_channel_inventory_lookup
  on public.ota_channel_inventory (product_id, channel_id, variant_key, inventory_date);

create index if not exists idx_ota_channel_inventory_operator
  on public.ota_channel_inventory (operator_id, inventory_date desc);

comment on table public.ota_channel_inventory is
  'OTA 채널별 일자 수동 재고·판매상태 (API 연동 전 운영 추적)';

create table if not exists public.ota_inventory_watch_dates (
  id uuid primary key default gen_random_uuid(),
  operator_id text not null default 'M00001',
  product_id text not null references public.products(id) on delete cascade,
  channel_id text not null references public.channels(id) on delete cascade,
  variant_key text not null default 'default',
  watch_date date not null,
  marked_by_email text,
  created_at timestamptz not null default now(),
  unique (product_id, channel_id, variant_key, watch_date)
);

create index if not exists idx_ota_inventory_watch_dates_lookup
  on public.ota_inventory_watch_dates (product_id, channel_id, variant_key, watch_date);

comment on table public.ota_inventory_watch_dates is
  'OTA 재고 달력 — 주시(모니터링) 대상 날짜';

alter table public.ota_channel_inventory enable row level security;
alter table public.ota_inventory_watch_dates enable row level security;

drop policy if exists ota_channel_inventory_staff_select on public.ota_channel_inventory;
create policy ota_channel_inventory_staff_select
  on public.ota_channel_inventory for select
  to authenticated
  using (public.is_staff());

drop policy if exists ota_channel_inventory_staff_insert on public.ota_channel_inventory;
create policy ota_channel_inventory_staff_insert
  on public.ota_channel_inventory for insert
  to authenticated
  with check (public.is_staff());

drop policy if exists ota_channel_inventory_staff_update on public.ota_channel_inventory;
create policy ota_channel_inventory_staff_update
  on public.ota_channel_inventory for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists ota_channel_inventory_staff_delete on public.ota_channel_inventory;
create policy ota_channel_inventory_staff_delete
  on public.ota_channel_inventory for delete
  to authenticated
  using (public.is_staff());

drop policy if exists ota_inventory_watch_dates_staff_select on public.ota_inventory_watch_dates;
create policy ota_inventory_watch_dates_staff_select
  on public.ota_inventory_watch_dates for select
  to authenticated
  using (public.is_staff());

drop policy if exists ota_inventory_watch_dates_staff_insert on public.ota_inventory_watch_dates;
create policy ota_inventory_watch_dates_staff_insert
  on public.ota_inventory_watch_dates for insert
  to authenticated
  with check (public.is_staff());

drop policy if exists ota_inventory_watch_dates_staff_delete on public.ota_inventory_watch_dates;
create policy ota_inventory_watch_dates_staff_delete
  on public.ota_inventory_watch_dates for delete
  to authenticated
  using (public.is_staff());

commit;
