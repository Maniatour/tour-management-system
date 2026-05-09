begin;

-- Existing helper is public.is_super_admin(p_email text DEFAULT NULL).
-- Drop the no-arg overload if a previous failed attempt created it; otherwise
-- calls to public.is_super_admin() are ambiguous with the default-arg function.
drop function if exists public.is_super_admin();

alter table public.reservation_pricing
  add column if not exists audited boolean not null default false,
  add column if not exists audited_at timestamptz,
  add column if not exists audited_by_email text,
  add column if not exists audited_by_name text,
  add column if not exists audited_by_nick_name text;

comment on column public.reservation_pricing.audited is 'Super 관리자 검수 완료 여부. true면 super 외 가격 수정 불가.';
comment on column public.reservation_pricing.audited_by_nick_name is '검수한 team.nick_name 표시용.';

create table if not exists public.reservation_pricing_modification_requests (
  id uuid primary key default gen_random_uuid(),
  reservation_id text not null references public.reservations(id) on delete cascade,
  reservation_pricing_id text references public.reservation_pricing(id) on delete set null,
  requested_by_email text not null,
  requested_by_name text,
  requested_by_nick_name text,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'resolved', 'rejected')),
  reviewed_by_email text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_reservation_pricing_mod_requests_reservation_id
  on public.reservation_pricing_modification_requests(reservation_id);
create index if not exists idx_reservation_pricing_mod_requests_status
  on public.reservation_pricing_modification_requests(status);

create trigger reservation_pricing_mod_requests_updated_at
  before update on public.reservation_pricing_modification_requests
  for each row
  execute function public.update_updated_at_column();

create table if not exists public.reservation_pricing_audit_notifications (
  id uuid primary key default gen_random_uuid(),
  reservation_id text not null references public.reservations(id) on delete cascade,
  reservation_pricing_id text references public.reservation_pricing(id) on delete set null,
  request_id uuid references public.reservation_pricing_modification_requests(id) on delete cascade,
  recipient_email text not null,
  actor_email text not null,
  actor_name text,
  actor_nick_name text,
  notification_type text not null check (notification_type in ('modification_request', 'audited_pricing_updated')),
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_reservation_pricing_audit_notifications_recipient
  on public.reservation_pricing_audit_notifications(lower(recipient_email), read_at, created_at desc);

alter table public.reservation_pricing_modification_requests enable row level security;
alter table public.reservation_pricing_audit_notifications enable row level security;

drop policy if exists "reservation_pricing_update_staff" on public.reservation_pricing;
create policy "reservation_pricing_update_staff_unless_audited"
  on public.reservation_pricing
  for update
  to authenticated
  using (
    public.is_staff()
    and (
      coalesce(audited, false) = false
      or public.is_super_admin(public.current_email())
    )
  )
  with check (
    public.is_staff()
    and (
      coalesce(audited, false) = false
      or public.is_super_admin(public.current_email())
    )
  );

drop policy if exists "reservation_pricing_insert_staff" on public.reservation_pricing;
create policy "reservation_pricing_insert_staff_unless_audited"
  on public.reservation_pricing
  for insert
  to authenticated
  with check (
    public.is_staff()
    and (
      coalesce(audited, false) = false
      or public.is_super_admin(public.current_email())
    )
  );

create policy "reservation_pricing_mod_requests_select_related"
  on public.reservation_pricing_modification_requests
  for select
  to authenticated
  using (
    public.is_super_admin(public.current_email())
    or lower(requested_by_email) = public.current_email()
  );

create policy "reservation_pricing_mod_requests_insert_staff"
  on public.reservation_pricing_modification_requests
  for insert
  to authenticated
  with check (
    public.is_staff()
    and lower(requested_by_email) = public.current_email()
  );

create policy "reservation_pricing_mod_requests_update_super"
  on public.reservation_pricing_modification_requests
  for update
  to authenticated
  using (public.is_super_admin(public.current_email()))
  with check (public.is_super_admin(public.current_email()));

create policy "reservation_pricing_audit_notifications_select_recipient"
  on public.reservation_pricing_audit_notifications
  for select
  to authenticated
  using (
    public.is_super_admin(public.current_email())
    and lower(recipient_email) = public.current_email()
  );

create policy "reservation_pricing_audit_notifications_insert_staff"
  on public.reservation_pricing_audit_notifications
  for insert
  to authenticated
  with check (public.is_staff());

create policy "reservation_pricing_audit_notifications_update_recipient"
  on public.reservation_pricing_audit_notifications
  for update
  to authenticated
  using (
    public.is_super_admin(public.current_email())
    and lower(recipient_email) = public.current_email()
  )
  with check (
    public.is_super_admin(public.current_email())
    and lower(recipient_email) = public.current_email()
  );

commit;
