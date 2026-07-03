-- OP Todo List: Las Vegas (America/Los_Angeles) 03:00 기준 주기별 자동 리셋
-- daily   → 매일 03:00
-- weekly  → 매주 월요일 03:00
-- monthly → 매월 1일 03:00
-- yearly  → 매년 1월 1일 03:00

begin;

-- weekly 카테고리 허용
alter table public.op_todos drop constraint if exists op_todos_category_check;
alter table public.op_todos
  add constraint op_todos_category_check
  check (category in ('daily', 'weekly', 'monthly', 'yearly'));

-- 클릭 로그 테이블 (없으면 생성)
create table if not exists public.todo_click_logs (
  id uuid primary key default gen_random_uuid(),
  todo_id uuid not null references public.op_todos(id) on delete cascade,
  user_email text not null,
  action text not null check (action in ('completed', 'uncompleted')),
  timestamp timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_todo_click_logs_todo_id on public.todo_click_logs(todo_id);
create index if not exists idx_todo_click_logs_timestamp on public.todo_click_logs(timestamp);

alter table public.todo_click_logs enable row level security;

drop policy if exists "Team members can view todo click logs" on public.todo_click_logs;
drop policy if exists "Team members can insert todo click logs" on public.todo_click_logs;
drop policy if exists "Allow manual reset for team members" on public.todo_click_logs;
drop policy if exists "todo_click_logs_select_team" on public.todo_click_logs;
create policy "todo_click_logs_select_team" on public.todo_click_logs
  for select using (public.team_board_request_is_member());

drop policy if exists "todo_click_logs_insert_team" on public.todo_click_logs;
create policy "todo_click_logs_insert_team" on public.todo_click_logs
  for insert with check (
    user_email = 'system@auto-reset.com'
    or (
      public.team_board_request_is_member()
      and public.team_board_email_matches(user_email)
    )
  );

-- 카테고리별 현재 주기 시작 시각 (Las Vegas / America/Los_Angeles 03:00 기준)
create or replace function public.op_todo_period_start(p_category text)
returns timestamptz
language sql
stable
set search_path = public
as $$
  with adjusted as (
    select ((now() at time zone 'America/Los_Angeles') - interval '3 hours') as ts
  )
  select case p_category
    when 'daily' then
      (date_trunc('day', ts) + interval '3 hours') at time zone 'America/Los_Angeles'
    when 'weekly' then
      (date_trunc('day', ts) - (extract(isodow from ts)::int - 1) * interval '1 day' + interval '3 hours')
        at time zone 'America/Los_Angeles'
    when 'monthly' then
      (date_trunc('month', ts) + interval '3 hours') at time zone 'America/Los_Angeles'
    when 'yearly' then
      (date_trunc('year', ts) + interval '3 hours') at time zone 'America/Los_Angeles'
    else now()
  end
  from adjusted;
$$;

comment on function public.op_todo_period_start(text) is
  'OP Todo 주기 시작 시각(Las Vegas / America/Los_Angeles 03:00). daily/weekly/monthly/yearly';

-- 기한이 지난 완료 항목만 리셋
create or replace function public.reset_op_todos_category_if_due(p_category text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  period_start timestamptz;
  reset_count integer := 0;
begin
  if p_category not in ('daily', 'weekly', 'monthly', 'yearly') then
    raise exception 'invalid category: %', p_category;
  end if;

  period_start := public.op_todo_period_start(p_category);

  with reset_rows as (
    update public.op_todos t
    set
      completed = false,
      completed_at = null,
      updated_at = now()
    where t.category = p_category
      and t.completed = true
      and (t.completed_at is null or t.completed_at < period_start)
    returning t.id
  ),
  logged as (
    insert into public.todo_click_logs (todo_id, user_email, action, timestamp)
    select id, 'system@auto-reset.com', 'uncompleted', now()
    from reset_rows
    returning 1
  )
  select count(*)::integer into reset_count from reset_rows;

  return reset_count;
end;
$$;

-- 모든 카테고리 lazy reset (페이지 로드·cron 공용)
create or replace function public.apply_due_op_todo_resets()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cat text;
  cnt integer;
  result jsonb := '{}'::jsonb;
begin
  foreach cat in array array['daily', 'weekly', 'monthly', 'yearly'] loop
    cnt := public.reset_op_todos_category_if_due(cat);
    result := result || jsonb_build_object(cat, cnt);
  end loop;

  return result;
end;
$$;

comment on function public.apply_due_op_todo_resets() is
  'OP Todo: 주기 경과 후 미리셋된 완료 항목을 일괄 해제 (Las Vegas / America/Los_Angeles 03:00 기준)';

-- 강제 리셋 (수동): completed=true인 항목만 대상
create or replace function public._force_reset_op_todos_category(p_category text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  reset_count integer := 0;
begin
  with reset_rows as (
    update public.op_todos t
    set completed = false, completed_at = null, updated_at = now()
    where t.category = p_category and t.completed = true
    returning t.id
  ),
  logged as (
    insert into public.todo_click_logs (todo_id, user_email, action, timestamp)
    select id, 'system@auto-reset.com', 'uncompleted', now()
    from reset_rows
    returning 1
  )
  select count(*)::integer into reset_count from reset_rows;

  return reset_count;
end;
$$;

create or replace function public.reset_daily_todos()
returns void
language plpgsql
security definer
set search_path = public
as $$ begin perform public._force_reset_op_todos_category('daily'); end; $$;

create or replace function public.reset_weekly_todos()
returns void
language plpgsql
security definer
set search_path = public
as $$ begin perform public._force_reset_op_todos_category('weekly'); end; $$;

create or replace function public.reset_monthly_todos()
returns void
language plpgsql
security definer
set search_path = public
as $$ begin perform public._force_reset_op_todos_category('monthly'); end; $$;

create or replace function public.reset_yearly_todos()
returns void
language plpgsql
security definer
set search_path = public
as $$ begin perform public._force_reset_op_todos_category('yearly'); end; $$;

create or replace function public.reset_all_todos()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._force_reset_op_todos_category('daily');
  perform public._force_reset_op_todos_category('weekly');
  perform public._force_reset_op_todos_category('monthly');
  perform public._force_reset_op_todos_category('yearly');
end;
$$;

create or replace function public.manual_reset_todos(category_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  cnt integer;
begin
  if not public.team_board_request_is_member() then
    raise exception 'forbidden';
  end if;

  case category_name
    when 'daily' then
      cnt := public._force_reset_op_todos_category('daily');
      return format('일일 체크리스트 %s건이 리셋되었습니다.', cnt);
    when 'weekly' then
      cnt := public._force_reset_op_todos_category('weekly');
      return format('주간 체크리스트 %s건이 리셋되었습니다.', cnt);
    when 'monthly' then
      cnt := public._force_reset_op_todos_category('monthly');
      return format('월간 체크리스트 %s건이 리셋되었습니다.', cnt);
    when 'yearly' then
      cnt := public._force_reset_op_todos_category('yearly');
      return format('연간 체크리스트 %s건이 리셋되었습니다.', cnt);
    when 'all' then
      perform public.reset_all_todos();
      return '모든 체크리스트가 리셋되었습니다.';
    else
      return '잘못된 카테고리입니다. (daily, weekly, monthly, yearly, all 중 하나를 선택하세요)';
  end case;
end;
$$;

revoke all on function public.op_todo_period_start(text) from public;
revoke all on function public.reset_op_todos_category_if_due(text) from public;
revoke all on function public.apply_due_op_todo_resets() from public;
revoke all on function public._force_reset_op_todos_category(text) from public;
revoke all on function public.reset_daily_todos() from public;
revoke all on function public.reset_weekly_todos() from public;
revoke all on function public.reset_monthly_todos() from public;
revoke all on function public.reset_yearly_todos() from public;
revoke all on function public.reset_all_todos() from public;
revoke all on function public.manual_reset_todos(text) from public;

grant execute on function public.apply_due_op_todo_resets() to authenticated, service_role;
grant execute on function public.manual_reset_todos(text) to authenticated;
grant execute on function public.reset_daily_todos() to service_role;
grant execute on function public.reset_weekly_todos() to service_role;
grant execute on function public.reset_monthly_todos() to service_role;
grant execute on function public.reset_yearly_todos() to service_role;
grant execute on function public.reset_all_todos() to service_role;

commit;
