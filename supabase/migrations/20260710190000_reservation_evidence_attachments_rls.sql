-- 예약 증빙 첨부: staff(office manager 포함) RLS + images/reservation-evidence 스토리지 정책
-- Office Manager 등 localStorage JWT 세션에서 API 경유 업로드·조회 가능

begin;

alter table public.reservation_evidence_attachments enable row level security;

drop policy if exists reservation_evidence_staff_select on public.reservation_evidence_attachments;
drop policy if exists reservation_evidence_staff_insert on public.reservation_evidence_attachments;
drop policy if exists reservation_evidence_staff_delete on public.reservation_evidence_attachments;

create policy reservation_evidence_staff_select
  on public.reservation_evidence_attachments
  for select
  to authenticated
  using (
    public.is_staff()
    or public.is_staff_for_session()
  );

create policy reservation_evidence_staff_insert
  on public.reservation_evidence_attachments
  for insert
  to authenticated
  with check (
    public.is_staff()
    or public.is_staff_for_session()
  );

create policy reservation_evidence_staff_delete
  on public.reservation_evidence_attachments
  for delete
  to authenticated
  using (
    public.is_staff()
    or public.is_staff_for_session()
  );

-- images 버킷 reservation-evidence 폴더 (없으면 생성)
insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do nothing;

drop policy if exists images_reservation_evidence_authenticated_insert on storage.objects;
drop policy if exists images_reservation_evidence_authenticated_select on storage.objects;
drop policy if exists images_reservation_evidence_authenticated_delete on storage.objects;
drop policy if exists images_reservation_evidence_public_read on storage.objects;

create policy images_reservation_evidence_authenticated_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = 'reservation-evidence'
    and (
      public.is_staff()
      or public.is_staff_for_session()
    )
  );

create policy images_reservation_evidence_authenticated_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = 'reservation-evidence'
    and (
      public.is_staff()
      or public.is_staff_for_session()
    )
  );

create policy images_reservation_evidence_authenticated_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = 'reservation-evidence'
    and (
      public.is_staff()
      or public.is_staff_for_session()
    )
  );

create policy images_reservation_evidence_public_read
  on storage.objects
  for select
  to public
  using (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = 'reservation-evidence'
  );

commit;
