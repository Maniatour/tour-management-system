-- 팀원 개인 노트 (스케줄 뷰 가이드 이름 호버용)
alter table public.team
  add column if not exists notes text null;

comment on column public.team.notes is
  'Admin note for the team member; shown on hover in schedule guide name.';
