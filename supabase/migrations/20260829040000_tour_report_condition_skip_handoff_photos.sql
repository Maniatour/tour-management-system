-- Tour report: company-vehicle condition, skipped stops, next-team handoff, issue photos.

alter table public.tour_reports
  add column if not exists vehicle_condition_tags text[] not null default '{}',
  add column if not exists vehicle_condition_note text,
  add column if not exists skipped_stops jsonb not null default '{}'::jsonb,
  add column if not exists handoff_note text,
  add column if not exists issue_photo_urls text[] not null default '{}';

comment on column public.tour_reports.vehicle_condition_tags is
  '회사 차량 상태 태그 (렌트카는 비움).';
comment on column public.tour_reports.vehicle_condition_note is
  '회사 차량 상태 추가 메모.';
comment on column public.tour_reports.skipped_stops is
  '스킵한 관광지: { courseId: { reason, note } }.';
comment on column public.tour_reports.handoff_note is
  '다음 팀 인수인계 메모.';
comment on column public.tour_reports.issue_photo_urls is
  '이슈 사진 공개 URL 목록.';
