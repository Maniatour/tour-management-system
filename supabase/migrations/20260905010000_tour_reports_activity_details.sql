-- Tour report field details: Horseshoe Bend activity, goblin sunrise log,
-- and driving roster / claims between paired guides.

begin;

alter table public.tour_reports
  add column if not exists activity_details jsonb not null default '{}'::jsonb;

comment on column public.tour_reports.activity_details is
  '홀스슈밴드 활동, 밤도깨비 일출 기록, 드라이빙 일정표·클레임';

commit;
