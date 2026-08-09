-- 기피(경고만) vs 절대 금지 구분
alter table public.team
  add column if not exists avoid_team_with text[] not null default '{}'::text[];

comment on column public.team.do_not_team_with is
  '같이 투어 팀을 절대 꾸리면 안 되는 팀원 email 목록 (배정 차단)';
comment on column public.team.avoid_team_with is
  '같이 투어 팀을 기피하는 팀원 email 목록 (배정 시 경고)';

-- 기존 do_not_team_with는 경고만 하던 데이터이므로 기피로 이관
update public.team
set
  avoid_team_with = (
    select coalesce(array_agg(distinct lower(trim(e))), '{}'::text[])
    from unnest(coalesce(do_not_team_with, '{}'::text[])) as e
    where nullif(trim(e), '') is not null
  ),
  do_not_team_with = '{}'::text[]
where coalesce(cardinality(do_not_team_with), 0) > 0;
