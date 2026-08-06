-- Hotel Management Module (tour-ops, supplier-independent)
-- Catalog / rates / reservations / tour assignments — separate from pickup_hotels

begin;

-- ---------- hotels ----------
create table if not exists public.hotels (
  hotel_id uuid primary key default gen_random_uuid(),
  supplier text not null,
  supplier_hotel_id text not null,
  name text not null,
  address text,
  city text,
  state text,
  country text default 'US',
  metadata_source text,
  metadata_external_id text,
  metadata_json jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotels_supplier_hotel_unique unique (supplier, supplier_hotel_id),
  constraint hotels_supplier_check check (
    supplier in ('wyndham', 'expedia_taap', 'hotelbeds', 'manual')
  ),
  constraint hotels_metadata_source_check check (
    metadata_source is null
    or metadata_source in ('stayapi', 'manual', 'supplier')
  )
);

create index if not exists hotels_city_idx on public.hotels (city);
create index if not exists hotels_name_idx on public.hotels (name);
create index if not exists hotels_is_active_idx on public.hotels (is_active);

comment on table public.hotels is
  'Supplier-neutral hotel catalog for tour operations (not customer booking, not pickup hotels).';
comment on column public.hotels.metadata_source is
  'Optional enrichment source (e.g. stayapi). Never used for reservations or cost.';

-- ---------- hotel_rooms ----------
create table if not exists public.hotel_rooms (
  room_id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels (hotel_id) on delete cascade,
  room_type text not null,
  bed_type text,
  capacity integer not null default 2,
  supplier_room_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotel_rooms_capacity_check check (capacity > 0)
);

create index if not exists hotel_rooms_hotel_id_idx on public.hotel_rooms (hotel_id);

comment on table public.hotel_rooms is
  'Room types for hotels in the tour-ops hotel catalog.';

-- ---------- hotel_rates ----------
create table if not exists public.hotel_rates (
  rate_id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels (hotel_id) on delete cascade,
  room_id uuid references public.hotel_rooms (room_id) on delete set null,
  supplier text not null,
  stay_date date not null,
  price numeric(12, 2) not null,
  currency text not null default 'USD',
  cancellation_policy text,
  cancellation_policy_json jsonb,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint hotel_rates_price_check check (price >= 0),
  constraint hotel_rates_supplier_hotel_date_room_unique
    unique (supplier, hotel_id, stay_date, room_id)
);

create index if not exists hotel_rates_hotel_date_idx
  on public.hotel_rates (hotel_id, stay_date);
create index if not exists hotel_rates_supplier_date_idx
  on public.hotel_rates (supplier, stay_date);

comment on table public.hotel_rates is
  'Latest checked rates per hotel/room/date from a supplier.';

-- ---------- hotel_rate_history ----------
create table if not exists public.hotel_rate_history (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels (hotel_id) on delete cascade,
  room_id uuid references public.hotel_rooms (room_id) on delete set null,
  supplier text not null,
  stay_date date not null,
  price numeric(12, 2) not null,
  previous_price numeric(12, 2),
  currency text not null default 'USD',
  recorded_at timestamptz not null default now()
);

create index if not exists hotel_rate_history_hotel_date_idx
  on public.hotel_rate_history (hotel_id, stay_date, recorded_at desc);

comment on table public.hotel_rate_history is
  'Price snapshots for trend tracking and decrease alerts.';

-- ---------- hotel_reservations ----------
create table if not exists public.hotel_reservations (
  reservation_id uuid primary key default gen_random_uuid(),
  supplier text not null,
  supplier_confirmation_number text,
  hotel_id uuid not null references public.hotels (hotel_id),
  room_id uuid references public.hotel_rooms (room_id) on delete set null,
  guest_count integer not null default 1,
  rooms integer not null default 1,
  check_in date not null,
  check_out date not null,
  status text not null default 'draft',
  total_cost numeric(12, 2),
  currency text not null default 'USD',
  guest_name text,
  supplier_payload jsonb not null default '{}'::jsonb,
  automation_artifact_path text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotel_reservations_guest_count_check check (guest_count > 0),
  constraint hotel_reservations_rooms_check check (rooms > 0),
  constraint hotel_reservations_dates_check check (check_out > check_in),
  constraint hotel_reservations_status_check check (
    status in (
      'draft',
      'pending',
      'confirmed',
      'cancelled',
      'failed',
      'needs_manual'
    )
  )
);

create index if not exists hotel_reservations_hotel_id_idx
  on public.hotel_reservations (hotel_id);
create index if not exists hotel_reservations_status_idx
  on public.hotel_reservations (status);
create index if not exists hotel_reservations_check_in_idx
  on public.hotel_reservations (check_in);
create index if not exists hotel_reservations_confirmation_idx
  on public.hotel_reservations (supplier_confirmation_number);

comment on table public.hotel_reservations is
  'Supplier-backed hotel reservations for tour operations.';

-- ---------- tour_hotel_assignments ----------
create table if not exists public.tour_hotel_assignments (
  id uuid primary key default gen_random_uuid(),
  tour_id text not null references public.tours (id) on delete cascade,
  reservation_id uuid not null
    references public.hotel_reservations (reservation_id) on delete cascade,
  assigned_date date not null,
  created_at timestamptz not null default now(),
  constraint tour_hotel_assignments_unique
    unique (tour_id, reservation_id, assigned_date)
);

create index if not exists tour_hotel_assignments_tour_id_idx
  on public.tour_hotel_assignments (tour_id);
create index if not exists tour_hotel_assignments_reservation_id_idx
  on public.tour_hotel_assignments (reservation_id);

comment on table public.tour_hotel_assignments is
  'Links a supplier hotel reservation night to a tour instance.';

-- ---------- hotel_price_alerts ----------
create table if not exists public.hotel_price_alerts (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels (hotel_id) on delete cascade,
  room_id uuid references public.hotel_rooms (room_id) on delete set null,
  supplier text not null,
  stay_date date not null,
  previous_price numeric(12, 2) not null,
  new_price numeric(12, 2) not null,
  currency text not null default 'USD',
  message text not null,
  notified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists hotel_price_alerts_created_idx
  on public.hotel_price_alerts (created_at desc);

-- ---------- hotel_automation_jobs ----------
create table if not exists public.hotel_automation_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  supplier text,
  status text not null default 'running',
  summary jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint hotel_automation_jobs_status_check check (
    status in ('running', 'succeeded', 'failed', 'partial')
  )
);

create index if not exists hotel_automation_jobs_started_idx
  on public.hotel_automation_jobs (started_at desc);

-- ---------- Link existing ops ledger ----------
alter table public.tour_hotel_bookings
  add column if not exists hotel_reservation_id uuid null
    references public.hotel_reservations (reservation_id) on delete set null;

create index if not exists tour_hotel_bookings_hotel_reservation_id_idx
  on public.tour_hotel_bookings (hotel_reservation_id);

comment on column public.tour_hotel_bookings.hotel_reservation_id is
  'Optional link to supplier-backed hotel_reservations (Wyndham / Expedia TAAP / etc.).';

-- ---------- RLS ----------
alter table public.hotels enable row level security;
alter table public.hotel_rooms enable row level security;
alter table public.hotel_rates enable row level security;
alter table public.hotel_rate_history enable row level security;
alter table public.hotel_reservations enable row level security;
alter table public.tour_hotel_assignments enable row level security;
alter table public.hotel_price_alerts enable row level security;
alter table public.hotel_automation_jobs enable row level security;

revoke all on table public.hotels from anon;
revoke all on table public.hotel_rooms from anon;
revoke all on table public.hotel_rates from anon;
revoke all on table public.hotel_rate_history from anon;
revoke all on table public.hotel_reservations from anon;
revoke all on table public.tour_hotel_assignments from anon;
revoke all on table public.hotel_price_alerts from anon;
revoke all on table public.hotel_automation_jobs from anon;

grant select, insert, update, delete on table public.hotels to authenticated;
grant select, insert, update, delete on table public.hotel_rooms to authenticated;
grant select, insert, update, delete on table public.hotel_rates to authenticated;
grant select, insert, update, delete on table public.hotel_rate_history to authenticated;
grant select, insert, update, delete on table public.hotel_reservations to authenticated;
grant select, insert, update, delete on table public.tour_hotel_assignments to authenticated;
grant select, insert, update, delete on table public.hotel_price_alerts to authenticated;
grant select, insert, update, delete on table public.hotel_automation_jobs to authenticated;

-- hotels
drop policy if exists "hotels_select_staff" on public.hotels;
create policy "hotels_select_staff"
  on public.hotels for select to authenticated
  using (public.rls_is_staff_session_ok());

drop policy if exists "hotels_insert_staff" on public.hotels;
create policy "hotels_insert_staff"
  on public.hotels for insert to authenticated
  with check (public.rls_is_staff_session_ok());

drop policy if exists "hotels_update_staff" on public.hotels;
create policy "hotels_update_staff"
  on public.hotels for update to authenticated
  using (public.rls_is_staff_session_ok())
  with check (public.rls_is_staff_session_ok());

drop policy if exists "hotels_delete_staff" on public.hotels;
create policy "hotels_delete_staff"
  on public.hotels for delete to authenticated
  using (public.rls_is_staff_session_ok());

-- hotel_rooms
drop policy if exists "hotel_rooms_select_staff" on public.hotel_rooms;
create policy "hotel_rooms_select_staff"
  on public.hotel_rooms for select to authenticated
  using (public.rls_is_staff_session_ok());

drop policy if exists "hotel_rooms_insert_staff" on public.hotel_rooms;
create policy "hotel_rooms_insert_staff"
  on public.hotel_rooms for insert to authenticated
  with check (public.rls_is_staff_session_ok());

drop policy if exists "hotel_rooms_update_staff" on public.hotel_rooms;
create policy "hotel_rooms_update_staff"
  on public.hotel_rooms for update to authenticated
  using (public.rls_is_staff_session_ok())
  with check (public.rls_is_staff_session_ok());

drop policy if exists "hotel_rooms_delete_staff" on public.hotel_rooms;
create policy "hotel_rooms_delete_staff"
  on public.hotel_rooms for delete to authenticated
  using (public.rls_is_staff_session_ok());

-- hotel_rates
drop policy if exists "hotel_rates_select_staff" on public.hotel_rates;
create policy "hotel_rates_select_staff"
  on public.hotel_rates for select to authenticated
  using (public.rls_is_staff_session_ok());

drop policy if exists "hotel_rates_insert_staff" on public.hotel_rates;
create policy "hotel_rates_insert_staff"
  on public.hotel_rates for insert to authenticated
  with check (public.rls_is_staff_session_ok());

drop policy if exists "hotel_rates_update_staff" on public.hotel_rates;
create policy "hotel_rates_update_staff"
  on public.hotel_rates for update to authenticated
  using (public.rls_is_staff_session_ok())
  with check (public.rls_is_staff_session_ok());

drop policy if exists "hotel_rates_delete_staff" on public.hotel_rates;
create policy "hotel_rates_delete_staff"
  on public.hotel_rates for delete to authenticated
  using (public.rls_is_staff_session_ok());

-- hotel_rate_history
drop policy if exists "hotel_rate_history_select_staff" on public.hotel_rate_history;
create policy "hotel_rate_history_select_staff"
  on public.hotel_rate_history for select to authenticated
  using (public.rls_is_staff_session_ok());

drop policy if exists "hotel_rate_history_insert_staff" on public.hotel_rate_history;
create policy "hotel_rate_history_insert_staff"
  on public.hotel_rate_history for insert to authenticated
  with check (public.rls_is_staff_session_ok());

-- hotel_reservations
drop policy if exists "hotel_reservations_select_staff" on public.hotel_reservations;
create policy "hotel_reservations_select_staff"
  on public.hotel_reservations for select to authenticated
  using (public.rls_is_staff_session_ok());

drop policy if exists "hotel_reservations_insert_staff" on public.hotel_reservations;
create policy "hotel_reservations_insert_staff"
  on public.hotel_reservations for insert to authenticated
  with check (public.rls_is_staff_session_ok());

drop policy if exists "hotel_reservations_update_staff" on public.hotel_reservations;
create policy "hotel_reservations_update_staff"
  on public.hotel_reservations for update to authenticated
  using (public.rls_is_staff_session_ok())
  with check (public.rls_is_staff_session_ok());

drop policy if exists "hotel_reservations_delete_staff" on public.hotel_reservations;
create policy "hotel_reservations_delete_staff"
  on public.hotel_reservations for delete to authenticated
  using (public.rls_is_staff_session_ok());

-- tour_hotel_assignments
drop policy if exists "tour_hotel_assignments_select_staff" on public.tour_hotel_assignments;
create policy "tour_hotel_assignments_select_staff"
  on public.tour_hotel_assignments for select to authenticated
  using (public.rls_is_staff_session_ok());

drop policy if exists "tour_hotel_assignments_insert_staff" on public.tour_hotel_assignments;
create policy "tour_hotel_assignments_insert_staff"
  on public.tour_hotel_assignments for insert to authenticated
  with check (public.rls_is_staff_session_ok());

drop policy if exists "tour_hotel_assignments_update_staff" on public.tour_hotel_assignments;
create policy "tour_hotel_assignments_update_staff"
  on public.tour_hotel_assignments for update to authenticated
  using (public.rls_is_staff_session_ok())
  with check (public.rls_is_staff_session_ok());

drop policy if exists "tour_hotel_assignments_delete_staff" on public.tour_hotel_assignments;
create policy "tour_hotel_assignments_delete_staff"
  on public.tour_hotel_assignments for delete to authenticated
  using (public.rls_is_staff_session_ok());

-- hotel_price_alerts
drop policy if exists "hotel_price_alerts_select_staff" on public.hotel_price_alerts;
create policy "hotel_price_alerts_select_staff"
  on public.hotel_price_alerts for select to authenticated
  using (public.rls_is_staff_session_ok());

drop policy if exists "hotel_price_alerts_insert_staff" on public.hotel_price_alerts;
create policy "hotel_price_alerts_insert_staff"
  on public.hotel_price_alerts for insert to authenticated
  with check (public.rls_is_staff_session_ok());

drop policy if exists "hotel_price_alerts_update_staff" on public.hotel_price_alerts;
create policy "hotel_price_alerts_update_staff"
  on public.hotel_price_alerts for update to authenticated
  using (public.rls_is_staff_session_ok())
  with check (public.rls_is_staff_session_ok());

-- hotel_automation_jobs
drop policy if exists "hotel_automation_jobs_select_staff" on public.hotel_automation_jobs;
create policy "hotel_automation_jobs_select_staff"
  on public.hotel_automation_jobs for select to authenticated
  using (public.rls_is_staff_session_ok());

drop policy if exists "hotel_automation_jobs_insert_staff" on public.hotel_automation_jobs;
create policy "hotel_automation_jobs_insert_staff"
  on public.hotel_automation_jobs for insert to authenticated
  with check (public.rls_is_staff_session_ok());

drop policy if exists "hotel_automation_jobs_update_staff" on public.hotel_automation_jobs;
create policy "hotel_automation_jobs_update_staff"
  on public.hotel_automation_jobs for update to authenticated
  using (public.rls_is_staff_session_ok())
  with check (public.rls_is_staff_session_ok());

commit;
