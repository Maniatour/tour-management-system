-- vehicle_maintenance: authenticated GRANT + OP·office manager 등 세션 쓰기 허용
-- Depends: customer_insert_team_role_ok (20260628120000), rls_is_staff_session_ok (20260621260000)
begin;

grant select, insert, update, delete on table public.vehicle_maintenance to authenticated;

create or replace function public.rls_vehicle_maintenance_write_ok()
returns boolean
language sql
stable
set search_path = public
as $$
  select
    public.rls_is_staff_session_ok()
    or public.customer_insert_team_role_ok(public.current_email())
    or public.customer_insert_team_role_ok(public.session_email_from_auth_users());
$$;

comment on function public.rls_vehicle_maintenance_write_ok() is
  'vehicle_maintenance INSERT/UPDATE/DELETE: staff 세션 또는 op·office manager 등 운영 직책.';

drop policy if exists "vehicle_maintenance_insert_staff" on public.vehicle_maintenance;
drop policy if exists "vehicle_maintenance_update_staff" on public.vehicle_maintenance;
drop policy if exists "vehicle_maintenance_delete_staff" on public.vehicle_maintenance;

create policy "vehicle_maintenance_insert_staff"
  on public.vehicle_maintenance for insert to authenticated
  with check (public.rls_vehicle_maintenance_write_ok());

create policy "vehicle_maintenance_update_staff"
  on public.vehicle_maintenance for update to authenticated
  using (public.rls_vehicle_maintenance_write_ok())
  with check (public.rls_vehicle_maintenance_write_ok());

create policy "vehicle_maintenance_delete_staff"
  on public.vehicle_maintenance for delete to authenticated
  using (public.rls_vehicle_maintenance_write_ok());

commit;
