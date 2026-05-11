-- OP checklist (op_todos): optional scheduled reminders + per-user snooze

alter table public.op_todos
  add column if not exists notify_enabled boolean not null default false,
  add column if not exists notify_time text,
  add column if not exists notify_weekday smallint,
  add column if not exists notify_day_of_month smallint,
  add column if not exists notify_month smallint,
  add column if not exists next_notify_at timestamptz;

comment on column public.op_todos.notify_enabled is '체크리스트 알림 사용 여부';
comment on column public.op_todos.notify_time is '알림 시각 HH:mm (Asia/Seoul 기준)';
comment on column public.op_todos.notify_weekday is '주간: 0=일 … 6=토 (dayjs 기준)';
comment on column public.op_todos.notify_day_of_month is '월간: 1–31';
comment on column public.op_todos.notify_month is '연간: 1–12';
comment on column public.op_todos.next_notify_at is '다음 알림 시각(UTC)';

create index if not exists idx_op_todos_next_notify_at
  on public.op_todos (next_notify_at)
  where notify_enabled = true and completed = false;

create table if not exists public.op_todo_notify_snooze (
  id uuid primary key default gen_random_uuid(),
  todo_id uuid not null references public.op_todos(id) on delete cascade,
  user_email text not null,
  suppress_until timestamptz not null,
  updated_at timestamptz not null default now(),
  unique (todo_id, user_email)
);

comment on table public.op_todo_notify_snooze is '체크리스트 알림 사용자별 다시 알림(스누즈)';

create index if not exists idx_op_todo_notify_snooze_user on public.op_todo_notify_snooze (lower(user_email));

alter table public.op_todo_notify_snooze enable row level security;

drop policy if exists "op_todo_notify_snooze_select" on public.op_todo_notify_snooze;
create policy "op_todo_notify_snooze_select" on public.op_todo_notify_snooze
  for select using (public.team_board_request_is_member());

drop policy if exists "op_todo_notify_snooze_ins" on public.op_todo_notify_snooze;
create policy "op_todo_notify_snooze_ins" on public.op_todo_notify_snooze
  for insert with check (
    public.team_board_request_is_member()
    and public.team_board_email_matches(user_email)
  );

drop policy if exists "op_todo_notify_snooze_upd" on public.op_todo_notify_snooze;
create policy "op_todo_notify_snooze_upd" on public.op_todo_notify_snooze
  for update using (
    public.team_board_request_is_member()
    and public.team_board_email_matches(user_email)
  )
  with check (
    public.team_board_request_is_member()
    and public.team_board_email_matches(user_email)
  );

drop policy if exists "op_todo_notify_snooze_del" on public.op_todo_notify_snooze;
create policy "op_todo_notify_snooze_del" on public.op_todo_notify_snooze
  for delete using (
    public.team_board_request_is_member()
    and public.team_board_email_matches(user_email)
  );

-- 알림 모달에서 팀원이 완료 처리 + 다음 알림 시각 갱신(RLS와 무관하게 공통 체크리스트 지원)
create or replace function public.op_todo_notify_handle_complete(p_todo_id uuid, p_next_notify_at timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.team_board_request_is_member() then
    raise exception 'forbidden';
  end if;

  update public.op_todos
  set
    completed = true,
    completed_at = now(),
    next_notify_at = p_next_notify_at,
    updated_at = now()
  where id = p_todo_id;
end;
$$;

comment on function public.op_todo_notify_handle_complete(uuid, timestamptz) is
  '체크리스트 알림에서 처리 완료 시 완료 처리 및 next_notify_at 설정';

revoke all on function public.op_todo_notify_handle_complete(uuid, timestamptz) from public;
grant execute on function public.op_todo_notify_handle_complete(uuid, timestamptz) to authenticated;
