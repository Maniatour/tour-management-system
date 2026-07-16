-- Fix remaining storage.objects policies TO public that reference privileged tables.
-- Postgres evaluates those expressions for anon and raises "permission denied for table …"
-- instead of treating the policy as false — which breaks tour-photos .list() for guests.

begin;

drop policy if exists "Users can view their own documents" on storage.objects;
create policy "Users can view their own documents"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'document-files'
    and (
      (auth.uid())::text = (storage.foldername(name))[1]
      or exists (
        select 1
        from public.documents d
        where d.file_path = objects.name
          and (
            d.created_by = auth.uid()
            or exists (
              select 1
              from public.document_permissions dp
              where dp.document_id = d.id
                and dp.user_id = auth.uid()
                and (dp.permission_type)::text = any (array[
                  'view'::text,
                  'edit'::text,
                  'delete'::text
                ])
            )
          )
      )
    )
  );

drop policy if exists "Guides can view their documents" on storage.objects;
create policy "Guides can view their documents"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'uploads'
    and (storage.foldername(name))[1] = 'guide-documents'
  );

drop policy if exists "Allow authenticated users to view customer documents" on storage.objects;
create policy "Allow authenticated users to view customer documents"
  on storage.objects for select to authenticated
  using (bucket_id = 'customer-documents');

-- ALL + public is unnecessary; keep authenticated-only equivalent
drop policy if exists "Allow all authenticated users" on storage.objects;
create policy "Allow all authenticated users"
  on storage.objects for all to authenticated
  using (true)
  with check (true);

commit;
