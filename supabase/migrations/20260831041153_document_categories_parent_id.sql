-- Nested folders under document categories.

alter table public.document_categories
  add column if not exists parent_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'document_categories_parent_id_fkey'
  ) then
    alter table public.document_categories
      add constraint document_categories_parent_id_fkey
      foreign key (parent_id)
      references public.document_categories(id)
      on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'document_categories_parent_not_self'
  ) then
    alter table public.document_categories
      add constraint document_categories_parent_not_self
      check (parent_id is distinct from id);
  end if;
end $$;

create index if not exists document_categories_parent_id_idx
  on public.document_categories (parent_id);
