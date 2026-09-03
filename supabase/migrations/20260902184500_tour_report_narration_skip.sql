-- Tour report: staff can record that narration was not played, with a reason
-- or a check that they explained the tour sufficiently without audio.

alter table public.tour_reports
  add column if not exists narration_not_played boolean not null default false,
  add column if not exists narration_explained_in_person boolean not null default false,
  add column if not exists narration_skip_reason text;

comment on column public.tour_reports.narration_not_played is
  'Staff marked that tour narration audio was not played.';
comment on column public.tour_reports.narration_explained_in_person is
  'Staff marked that they did not play narration but explained the tour sufficiently.';
comment on column public.tour_reports.narration_skip_reason is
  'Reason narration audio was not played.';
