-- 예약 status 변경만 얇은 테이블에 적재·조회 (admin 목록·차트가 audit_logs 430만+ 행을 스캔하지 않도록)
-- - AFTER UPDATE 트리거로 이벤트 INSERT (SECURITY DEFINER: RLS 없이 기록)
-- - SELECT: 스태프·세션 스태프 또는 예약 가시성(reservation_row_visible_for_policy)
-- - audit_logs에서 status 변경 행만 백필 (마이그레이션 1회)

begin;

create table if not exists public.reservation_status_events (
  id uuid primary key default gen_random_uuid(),
  reservation_id text not null references public.reservations (id) on delete cascade,
  from_status text,
  to_status text,
  occurred_at timestamptz not null default now(),
  user_email text,
  created_at timestamptz not null default now(),
  constraint reservation_status_events_from_to_distinct
    check (from_status is distinct from to_status)
);

comment on table public.reservation_status_events is
  '예약 status 전환 전용(목록·등록/취소 차트). 일반 감사는 audit_logs 유지.';

create index if not exists idx_reservation_status_events_reservation_occurred
  on public.reservation_status_events (reservation_id, occurred_at desc);

create index if not exists idx_reservation_status_events_occurred_reservation
  on public.reservation_status_events (occurred_at desc, reservation_id);

-- ---------- 트리거: status 변경 시 1행 추가 (감사 트리거와 동일한 작성자 이메일 해석) ----------
create or replace function public.record_reservation_status_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  if tg_op <> 'update' then
    return new;
  end if;
  if old.status is not distinct from new.status then
    return new;
  end if;

  v_email := nullif(trim(coalesce(current_setting('app.current_user_email', true), '')), '');
  if v_email is null then
    v_email := nullif(trim(coalesce(auth.jwt() ->> 'email', '')), '');
  end if;

  insert into public.reservation_status_events (
    reservation_id,
    from_status,
    to_status,
    occurred_at,
    user_email
  ) values (
    new.id::text,
    old.status,
    new.status,
    now(),
    v_email
  );

  return new;
end;
$$;

comment on function public.record_reservation_status_event() is
  'reservations.status 변경 시 reservation_status_events에 1행 기록 (RLS 우회 DEFINER).';

drop trigger if exists reservations_record_status_event on public.reservations;
create trigger reservations_record_status_event
  after update of status on public.reservations
  for each row
  when (old.status is distinct from new.status)
  execute function public.record_reservation_status_event();

-- ---------- RLS ----------
alter table public.reservation_status_events enable row level security;

drop policy if exists "reservation_status_events_select_visible" on public.reservation_status_events;

create policy "reservation_status_events_select_visible"
  on public.reservation_status_events
  for select
  to authenticated
  using (
    public.is_staff()
    or public.is_staff_for_session()
    or public.reservation_row_visible_for_policy(reservation_id)
  );

revoke all on table public.reservation_status_events from public;
revoke all on table public.reservation_status_events from anon;
grant select on table public.reservation_status_events to authenticated;

-- service_role: 기본 BYPASSRLS

-- ---------- 백필 (audit_logs 중 status 필드 변경만; 예약 행이 남아 있는 것만) ----------
-- 이미 행이 있으면 스킵(재적용 시 audit_logs 전량 이중 삽입 방지)
insert into public.reservation_status_events (
  reservation_id,
  from_status,
  to_status,
  occurred_at,
  user_email
)
select
  al.record_id,
  al.old_values ->> 'status',
  al.new_values ->> 'status',
  al.created_at,
  al.user_email
from public.audit_logs al
where not exists (select 1 from public.reservation_status_events limit 1)
  and al.table_name = 'reservations'
  and al.action = 'UPDATE'
  and al.changed_fields @> array['status']::text[]
  and (al.old_values ->> 'status') is distinct from (al.new_values ->> 'status')
  and exists (select 1 from public.reservations r where r.id = al.record_id);

analyze public.reservation_status_events;

commit;
