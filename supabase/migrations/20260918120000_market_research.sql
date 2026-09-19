-- 경쟁사 OTA 시세 조사 (시장조사). 자사 ota_channel_inventory / dynamic_pricing 과 분리.
begin;

create table if not exists public.market_competitors (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null default 'a0000000-0000-4000-8000-000000000001'::uuid
    references public.operators(id) on delete cascade,
  name text not null,
  website_url text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_market_competitors_operator
  on public.market_competitors (operator_id, is_active, name);

comment on table public.market_competitors is
  'Competitor tour operators tracked for OTA listing price research.';

create table if not exists public.market_competitor_listings (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null default 'a0000000-0000-4000-8000-000000000001'::uuid
    references public.operators(id) on delete cascade,
  competitor_id uuid not null references public.market_competitors(id) on delete cascade,
  ota_platform text not null
    check (ota_platform in (
      'viator', 'getyourguide', 'klook', 'kkday', 'tripadvisor',
      'tripcom', 'myrealtrip', 'expedia', 'other'
    )),
  listing_url text not null,
  listing_title text,
  mapped_product_id text references public.products(id) on delete set null,
  mapped_channel_id text references public.channels(id) on delete set null,
  has_lower boolean not null default true,
  has_antelope_x boolean not null default true,
  has_all_inclusive boolean not null default true,
  has_sale_plus_excluded boolean not null default true,
  watch_enabled boolean not null default true,
  last_fetch_status text not null default 'never'
    check (last_fetch_status in ('ok', 'needs_manual', 'parse_failed', 'http_error', 'never')),
  last_fetched_at timestamptz,
  last_success_at timestamptz,
  last_fetch_error text,
  duration_note text,
  pickup_note text,
  group_size_note text,
  cancellation_note text,
  language_note text,
  itinerary_note text,
  diff_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (operator_id, listing_url)
);

create index if not exists idx_market_listings_competitor
  on public.market_competitor_listings (competitor_id, ota_platform);

create index if not exists idx_market_listings_operator_watch
  on public.market_competitor_listings (operator_id, watch_enabled);

comment on table public.market_competitor_listings is
  'One competitor product URL on one OTA, mapped to our catalog product/channel.';

create table if not exists public.market_competitor_price_snapshots (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null default 'a0000000-0000-4000-8000-000000000001'::uuid
    references public.operators(id) on delete cascade,
  listing_id uuid not null references public.market_competitor_listings(id) on delete cascade,
  observed_on date not null,
  source text not null check (source in ('auto', 'manual')),
  canyon_variant text not null
    check (canyon_variant in ('lower', 'antelope_x', 'unspecified')),
  offer_type text not null
    check (offer_type in ('all_inclusive', 'sale_plus_excluded')),
  currency text not null default 'USD',
  adult_sale_price numeric not null,
  adult_not_included numeric not null default 0,
  adult_total numeric generated always as (adult_sale_price + adult_not_included) stored,
  child_sale_price numeric,
  child_not_included numeric,
  rating numeric,
  review_count integer,
  raw_extract jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (listing_id, observed_on, canyon_variant, offer_type)
);

create index if not exists idx_market_snapshots_listing_date
  on public.market_competitor_price_snapshots (listing_id, observed_on desc);

create index if not exists idx_market_snapshots_operator_date
  on public.market_competitor_price_snapshots (operator_id, observed_on desc);

comment on table public.market_competitor_price_snapshots is
  'Daily listing From-price points by canyon and inclusive vs sale+excluded.';

create table if not exists public.market_competitor_price_alerts (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null default 'a0000000-0000-4000-8000-000000000001'::uuid
    references public.operators(id) on delete cascade,
  listing_id uuid references public.market_competitor_listings(id) on delete cascade,
  kind text not null check (kind in ('price_changed', 'fetch_failed', 'stale')),
  title text not null,
  body text not null default '',
  canyon_variant text,
  offer_type text,
  old_adult_total numeric,
  new_adult_total numeric,
  created_at timestamptz not null default now()
);

create index if not exists idx_market_price_alerts_created
  on public.market_competitor_price_alerts (created_at desc);

create index if not exists idx_market_price_alerts_operator
  on public.market_competitor_price_alerts (operator_id, created_at desc);

comment on table public.market_competitor_price_alerts is
  'Staff inbox rows for competitor price changes, fetch failures, and stale listings.';

alter table public.market_competitors enable row level security;
alter table public.market_competitor_listings enable row level security;
alter table public.market_competitor_price_snapshots enable row level security;
alter table public.market_competitor_price_alerts enable row level security;

revoke all on table public.market_competitors from anon;
revoke all on table public.market_competitor_listings from anon;
revoke all on table public.market_competitor_price_snapshots from anon;
revoke all on table public.market_competitor_price_alerts from anon;

grant select, insert, update, delete on table public.market_competitors to authenticated;
grant select, insert, update, delete on table public.market_competitor_listings to authenticated;
grant select, insert, update, delete on table public.market_competitor_price_snapshots to authenticated;
grant select on table public.market_competitor_price_alerts to authenticated;
grant all on table public.market_competitors to service_role;
grant all on table public.market_competitor_listings to service_role;
grant all on table public.market_competitor_price_snapshots to service_role;
grant all on table public.market_competitor_price_alerts to service_role;

drop policy if exists market_competitors_staff_select on public.market_competitors;
create policy market_competitors_staff_select
  on public.market_competitors for select to authenticated
  using (public.is_staff() or public.rls_is_staff_session_ok());

drop policy if exists market_competitors_staff_insert on public.market_competitors;
create policy market_competitors_staff_insert
  on public.market_competitors for insert to authenticated
  with check (public.is_staff() or public.rls_is_staff_session_ok());

drop policy if exists market_competitors_staff_update on public.market_competitors;
create policy market_competitors_staff_update
  on public.market_competitors for update to authenticated
  using (public.is_staff() or public.rls_is_staff_session_ok())
  with check (public.is_staff() or public.rls_is_staff_session_ok());

drop policy if exists market_competitors_staff_delete on public.market_competitors;
create policy market_competitors_staff_delete
  on public.market_competitors for delete to authenticated
  using (public.is_staff() or public.rls_is_staff_session_ok());

drop policy if exists market_listings_staff_select on public.market_competitor_listings;
create policy market_listings_staff_select
  on public.market_competitor_listings for select to authenticated
  using (public.is_staff() or public.rls_is_staff_session_ok());

drop policy if exists market_listings_staff_insert on public.market_competitor_listings;
create policy market_listings_staff_insert
  on public.market_competitor_listings for insert to authenticated
  with check (public.is_staff() or public.rls_is_staff_session_ok());

drop policy if exists market_listings_staff_update on public.market_competitor_listings;
create policy market_listings_staff_update
  on public.market_competitor_listings for update to authenticated
  using (public.is_staff() or public.rls_is_staff_session_ok())
  with check (public.is_staff() or public.rls_is_staff_session_ok());

drop policy if exists market_listings_staff_delete on public.market_competitor_listings;
create policy market_listings_staff_delete
  on public.market_competitor_listings for delete to authenticated
  using (public.is_staff() or public.rls_is_staff_session_ok());

drop policy if exists market_snapshots_staff_select on public.market_competitor_price_snapshots;
create policy market_snapshots_staff_select
  on public.market_competitor_price_snapshots for select to authenticated
  using (public.is_staff() or public.rls_is_staff_session_ok());

drop policy if exists market_snapshots_staff_insert on public.market_competitor_price_snapshots;
create policy market_snapshots_staff_insert
  on public.market_competitor_price_snapshots for insert to authenticated
  with check (public.is_staff() or public.rls_is_staff_session_ok());

drop policy if exists market_snapshots_staff_update on public.market_competitor_price_snapshots;
create policy market_snapshots_staff_update
  on public.market_competitor_price_snapshots for update to authenticated
  using (public.is_staff() or public.rls_is_staff_session_ok())
  with check (public.is_staff() or public.rls_is_staff_session_ok());

drop policy if exists market_snapshots_staff_delete on public.market_competitor_price_snapshots;
create policy market_snapshots_staff_delete
  on public.market_competitor_price_snapshots for delete to authenticated
  using (public.is_staff() or public.rls_is_staff_session_ok());

drop policy if exists market_price_alerts_staff_select on public.market_competitor_price_alerts;
create policy market_price_alerts_staff_select
  on public.market_competitor_price_alerts for select to authenticated
  using (public.is_staff() or public.rls_is_staff_session_ok());

do $$
begin
  alter publication supabase_realtime add table public.market_competitor_price_alerts;
exception
  when duplicate_object then null;
end $$;

commit;
