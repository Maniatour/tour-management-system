-- 채널 커미션율(%) 변경 이력
-- channels.commission_percent(또는 레거시 commission)이 바뀔 때 자동 기록
-- 기존 예약(reservation_pricing) 스냅샷에는 영향 없음

begin;

create table if not exists public.channel_commission_rate_history (
  id uuid primary key default gen_random_uuid(),
  channel_id text not null references public.channels (id) on delete cascade,
  operator_id uuid,
  old_percent numeric(8, 4),
  new_percent numeric(8, 4) not null,
  note text,
  changed_by text,
  changed_at timestamptz not null default now()
);

create index if not exists idx_channel_commission_rate_history_channel_at
  on public.channel_commission_rate_history (channel_id, changed_at desc);

comment on table public.channel_commission_rate_history is
  '채널별 커미션율(%) 변경 이력. 예약 가격 스냅샷과는 별개.';

create or replace function public.log_channel_commission_rate_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old numeric(8, 4);
  v_new numeric(8, 4);
  v_actor text;
begin
  v_actor := nullif(trim(coalesce(current_setting('app.current_user_email', true), '')), '');
  if v_actor is null then
    v_actor := nullif(trim(coalesce(auth.jwt() ->> 'email', '')), '');
  end if;

  if tg_op = 'INSERT' then
    v_new := coalesce(new.commission_percent, new.commission, 0);
    insert into public.channel_commission_rate_history (
      channel_id,
      operator_id,
      old_percent,
      new_percent,
      note,
      changed_by,
      changed_at
    ) values (
      new.id,
      new.operator_id,
      null,
      v_new,
      '채널 생성 시 초기 요율',
      v_actor,
      now()
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    v_old := coalesce(old.commission_percent, old.commission);
    v_new := coalesce(new.commission_percent, new.commission);
    if v_old is distinct from v_new then
      insert into public.channel_commission_rate_history (
        channel_id,
        operator_id,
        old_percent,
        new_percent,
        note,
        changed_by,
        changed_at
      ) values (
        new.id,
        new.operator_id,
        v_old,
        coalesce(v_new, 0),
        null,
        v_actor,
        now()
      );
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_channel_commission_rate_history on public.channels;
create trigger trg_channel_commission_rate_history
  after insert or update of commission_percent, commission on public.channels
  for each row
  execute function public.log_channel_commission_rate_history();

-- 기존 채널의 현재 요율을 기준 스냅샷으로 남김 (이후 변경부터 old→new 추적)
insert into public.channel_commission_rate_history (
  channel_id,
  operator_id,
  old_percent,
  new_percent,
  note,
  changed_by,
  changed_at
)
select
  c.id,
  c.operator_id,
  null,
  coalesce(c.commission_percent, c.commission, 0),
  '마이그레이션 시점 스냅샷',
  null,
  now()
from public.channels c
where not exists (
  select 1
  from public.channel_commission_rate_history h
  where h.channel_id = c.id
);

alter table public.channel_commission_rate_history enable row level security;

revoke all on table public.channel_commission_rate_history from anon;
grant select on table public.channel_commission_rate_history to authenticated;

drop policy if exists channel_commission_rate_history_staff_select
  on public.channel_commission_rate_history;
create policy channel_commission_rate_history_staff_select
  on public.channel_commission_rate_history for select
  to authenticated
  using (public.is_staff());

-- 트리거(security definer)가 기록하므로 클라이언트 INSERT 정책은 두지 않음
-- (필요 시 staff note 보강용으로 나중에 추가 가능)

commit;
