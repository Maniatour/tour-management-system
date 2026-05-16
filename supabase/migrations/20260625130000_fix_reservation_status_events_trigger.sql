-- reservation_status_events: 트리거 INSERT가 RLS에 막히는 경우 복구 + audit_logs 누락분 백필
-- (테이블 최신 occurred_at이 마이그레이션/백필 시각에서 멈춘 채 status 변경이 쌓이지 않을 때)

begin;

create or replace function public.record_reservation_status_event()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
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
  'reservations.status 변경 시 reservation_status_events에 1행 기록 (SECURITY DEFINER, row_security=off).';

drop trigger if exists reservations_record_status_event on public.reservations;
create trigger reservations_record_status_event
  after update of status on public.reservations
  for each row
  when (old.status is distinct from new.status)
  execute function public.record_reservation_status_event();

grant select on table public.reservation_status_events to authenticated;
grant all on table public.reservation_status_events to service_role;

-- audit_logs에만 있고 events에 없는 status 전환(마이그레이션 이후·트리거 실패분 포함)
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
where al.table_name = 'reservations'
  and al.action = 'UPDATE'
  and al.changed_fields @> array['status']::text[]
  and (al.old_values ->> 'status') is distinct from (al.new_values ->> 'status')
  and exists (select 1 from public.reservations r where r.id = al.record_id)
  and not exists (
    select 1
    from public.reservation_status_events e
    where e.reservation_id = al.record_id
      and e.occurred_at = al.created_at
      and e.from_status is not distinct from (al.old_values ->> 'status')
      and e.to_status is not distinct from (al.new_values ->> 'status')
  );

analyze public.reservation_status_events;

commit;
