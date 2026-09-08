-- 매일 라스베이거스 21시 Google 리뷰 가져오기 결과를 관리자 분류 모달이 구독할 수 있게 합니다.
begin;

create table if not exists public.google_review_import_notifications (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operators(id) on delete cascade,
  imported_count integer not null default 0,
  updated_count integer not null default 0,
  classified_count integer not null default 0,
  unclassified_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_google_review_import_notifications_created
  on public.google_review_import_notifications (created_at desc);

create index if not exists idx_google_review_import_notifications_operator
  on public.google_review_import_notifications (operator_id, created_at desc);

comment on table public.google_review_import_notifications is
  'Nightly Google review incremental import summary for the staff classify modal.';

alter table public.google_review_import_notifications enable row level security;

revoke all on table public.google_review_import_notifications from anon;
grant select on table public.google_review_import_notifications to authenticated;

drop policy if exists "google_review_import_notifications_select_staff"
  on public.google_review_import_notifications;

create policy "google_review_import_notifications_select_staff"
  on public.google_review_import_notifications for select to authenticated
  using (public.is_staff() or public.rls_is_staff_session_ok());

do $$
begin
  alter publication supabase_realtime add table public.google_review_import_notifications;
exception
  when duplicate_object then null;
end $$;

commit;
