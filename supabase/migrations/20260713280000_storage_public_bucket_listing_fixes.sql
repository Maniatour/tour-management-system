-- Security Advisor P1: public_bucket_allows_listing (12 buckets)
-- Drops broad SELECT policies on public buckets (listing). Direct public URLs still work.
-- Adds authenticated staff/team SELECT only where admin UI needs .list().

begin;

-- Helper: drop named policies if they exist
do $$
declare
  pol record;
begin
  for pol in
    select *
    from (values
      ('company-expense-files-public-read'),
      ('hotel-booking-files-public-read'),
      ('maintenance-files-public-read'),
      ('reservation-expense-files-public-read'),
      ('ticket-booking-files-public-read'),
      ('Allow public access'),
      ('Allow public access to product media'),
      ('product-media Public Access'),
      ('Allow authenticated users to view product media'),
      ('Anyone can view tag icons'),
      ('팀원은 파일을 조회할 수 있음'),
      ('tour_course_photos_storage_select_policy'),
      ('팀은 투어 코스 사진을 볼 수 있음'),
      ('투어 자료 읽기 1ciiuwn_0'),
      ('Open objects'),
      ('tour-photos-manage-files'),
      ('tour-photos-public-read'),
      ('tour_photos_anon_read'),
      ('tour_photos_authenticated_full_access')
    ) as t(policy_name)
  loop
    execute format('drop policy if exists %I on storage.objects', pol.policy_name);
  end loop;
end$$;

-- Staff-only listing for internal expense / booking file buckets
do $$
declare
  b text;
begin
  foreach b in array array[
    'company-expense-files',
    'hotel-booking-files',
    'maintenance-files',
    'reservation-expense-files',
    'ticket-booking-files'
  ]
  loop
    execute format(
      'drop policy if exists %I on storage.objects',
      replace(b, '-', '_') || '_select_staff'
    );
    execute format($sql$
      create policy %I
        on storage.objects for select to authenticated
        using (bucket_id = %L and public.rls_is_staff_session_ok())
    $sql$, replace(b, '-', '_') || '_select_staff', b);
  end loop;
end$$;

-- images — remove bucket-wide public read; keep path-scoped policies from other migrations
drop policy if exists images_select_staff on storage.objects;
create policy images_select_staff
  on storage.objects for select to authenticated
  using (
    bucket_id = 'images'
    and public.rls_is_staff_session_ok()
  );

-- product-media — staff listing for admin; public URLs unchanged
drop policy if exists product_media_select_staff on storage.objects;
create policy product_media_select_staff
  on storage.objects for select to authenticated
  using (
    bucket_id = 'product-media'
    and public.rls_is_staff_session_ok()
  );

-- tag-icons — staff listing only
drop policy if exists tag_icons_select_staff on storage.objects;
create policy tag_icons_select_staff
  on storage.objects for select to authenticated
  using (
    bucket_id = 'tag-icons'
    and public.rls_is_staff_session_ok()
  );

-- team-chat-files — team listing
drop policy if exists team_chat_files_select_team on storage.objects;
create policy team_chat_files_select_team
  on storage.objects for select to authenticated
  using (
    bucket_id = 'team-chat-files'
    and public.rls_team_member_session_ok()
  );

-- tour-course-photos — team listing
drop policy if exists tour_course_photos_select_team on storage.objects;
create policy tour_course_photos_select_team
  on storage.objects for select to authenticated
  using (
    bucket_id = 'tour-course-photos'
    and public.rls_team_member_session_ok()
  );

-- tour-materials — team listing
drop policy if exists tour_materials_select_team on storage.objects;
create policy tour_materials_select_team
  on storage.objects for select to authenticated
  using (
    bucket_id = 'tour-materials'
    and public.rls_team_member_session_ok()
  );

-- tour-photos — staff listing
drop policy if exists tour_photos_select_staff on storage.objects;
create policy tour_photos_select_staff
  on storage.objects for select to authenticated
  using (
    bucket_id = 'tour-photos'
    and public.rls_is_staff_session_ok()
  );

commit;
