-- Step 7 (RLS hardening): vehicle_maintenance, reconciliation_match_events,
--   dynamic_pricing, channel_products
-- Replaces USING(true) / WITH CHECK(true) open policies.

begin;

-- ---------- vehicle_maintenance ----------
alter table public.vehicle_maintenance enable row level security;

drop policy if exists "vehicle_maintenance_select_all" on public.vehicle_maintenance;
drop policy if exists "vehicle_maintenance_insert_staff" on public.vehicle_maintenance;
drop policy if exists "vehicle_maintenance_update_staff" on public.vehicle_maintenance;
drop policy if exists "vehicle_maintenance_delete_staff" on public.vehicle_maintenance;

revoke all on table public.vehicle_maintenance from anon;

create policy "vehicle_maintenance_select_staff"
  on public.vehicle_maintenance for select to authenticated
  using (public.is_staff());

create policy "vehicle_maintenance_insert_staff"
  on public.vehicle_maintenance for insert to authenticated
  with check (public.is_staff());

create policy "vehicle_maintenance_update_staff"
  on public.vehicle_maintenance for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "vehicle_maintenance_delete_staff"
  on public.vehicle_maintenance for delete to authenticated
  using (public.is_staff());

-- ---------- reconciliation_match_events ----------
alter table public.reconciliation_match_events enable row level security;

drop policy if exists "reconciliation_match_events_select_all" on public.reconciliation_match_events;
drop policy if exists "reconciliation_match_events_insert_staff" on public.reconciliation_match_events;

revoke all on table public.reconciliation_match_events from anon;

create policy "reconciliation_match_events_select_staff"
  on public.reconciliation_match_events for select to authenticated
  using (public.is_staff());

create policy "reconciliation_match_events_insert_staff"
  on public.reconciliation_match_events for insert to authenticated
  with check (public.is_staff());

create policy "reconciliation_match_events_update_staff"
  on public.reconciliation_match_events for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "reconciliation_match_events_delete_staff"
  on public.reconciliation_match_events for delete to authenticated
  using (public.is_staff());

grant select, insert, update, delete on table public.reconciliation_match_events to authenticated, service_role;

-- ---------- dynamic_pricing ----------
alter table public.dynamic_pricing enable row level security;

drop policy if exists "Allow public access" on public.dynamic_pricing;

revoke all on table public.dynamic_pricing from anon;

create policy "dynamic_pricing_select_staff"
  on public.dynamic_pricing for select to authenticated
  using (public.is_staff());

create policy "dynamic_pricing_insert_staff"
  on public.dynamic_pricing for insert to authenticated
  with check (public.is_staff());

create policy "dynamic_pricing_update_staff"
  on public.dynamic_pricing for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "dynamic_pricing_delete_staff"
  on public.dynamic_pricing for delete to authenticated
  using (public.is_staff());

-- ---------- channel_products ----------
alter table public.channel_products enable row level security;

drop policy if exists "Allow public access to channel_products" on public.channel_products;

revoke all on table public.channel_products from anon;

create policy "channel_products_select_staff"
  on public.channel_products for select to authenticated
  using (public.is_staff());

create policy "channel_products_insert_staff"
  on public.channel_products for insert to authenticated
  with check (public.is_staff());

create policy "channel_products_update_staff"
  on public.channel_products for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "channel_products_delete_staff"
  on public.channel_products for delete to authenticated
  using (public.is_staff());

commit;
