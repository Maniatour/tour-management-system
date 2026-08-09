-- 같이 팀을 꾸리면 안 되는 가이드(이메일) 목록
alter table public.team
  add column if not exists do_not_team_with text[] not null default '{}'::text[];

comment on column public.team.do_not_team_with is
  '같이 투어 팀(가이드·어시스턴트)을 꾸리면 안 되는 팀원 email 목록';
