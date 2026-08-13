-- Fix ambiguous published_at in restore_company_knowledge_article_revision.
-- PL/pgSQL variable published_at collided with company_knowledge_articles.published_at
-- (Postgres 42702) when restoring a hub article revision.

create or replace function public.restore_company_knowledge_article_revision(
  p_revision_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  rev public.company_knowledge_article_revisions%rowtype;
  snap jsonb;
  v_published boolean;
  v_published_at timestamptz;
begin
  if not public.can_manage_company_sop() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select * into rev
  from public.company_knowledge_article_revisions
  where id = p_revision_id;

  if not found then
    raise exception 'revision not found';
  end if;

  snap := rev.snapshot;
  if snap is null or jsonb_typeof(snap) <> 'object' then
    raise exception 'invalid revision snapshot';
  end if;

  v_published := coalesce((snap->>'is_published')::boolean, false);
  v_published_at := case
    when v_published then coalesce((snap->>'published_at')::timestamptz, now())
    else null
  end;

  -- BEFORE UPDATE 트리거가 현재(덮어쓰기 전) 상태를 save 이력으로 보관
  update public.company_knowledge_articles as a
  set
    slug = coalesce(nullif(trim(snap->>'slug'), ''), a.slug),
    title_ko = coalesce(snap->>'title_ko', a.title_ko),
    title_en = coalesce(snap->>'title_en', a.title_en),
    summary_ko = coalesce(snap->>'summary_ko', ''),
    summary_en = coalesce(snap->>'summary_en', ''),
    hub_category = coalesce(snap->>'hub_category', a.hub_category),
    content_type = coalesce(snap->>'content_type', a.content_type),
    target_roles = coalesce(
      array(select jsonb_array_elements_text(coalesce(snap->'target_roles', '[]'::jsonb))),
      '{}'::text[]
    ),
    body_structure = coalesce(snap->'body_structure', a.body_structure),
    sort_order = coalesce((snap->>'sort_order')::integer, a.sort_order),
    is_published = v_published,
    published_at = v_published_at,
    updated_by = auth.uid()
  where a.id = rev.article_id;

  if not found then
    raise exception 'article not found';
  end if;

  insert into public.company_knowledge_article_revisions (
    article_id,
    action,
    restored_from_id,
    snapshot,
    note,
    saved_by,
    saved_by_email,
    saved_by_name
  )
  select
    rev.article_id,
    'restore',
    rev.id,
    snap,
    format('Restored from revision %s', rev.revision),
    auth.uid(),
    lower(nullif(trim(public.current_email()), '')),
    (
      select coalesce(
        nullif(trim(t.display_name), ''),
        nullif(trim(t.name_en), ''),
        nullif(trim(t.name_ko), '')
      )
      from public.team t
      where lower(trim(t.email)) = lower(nullif(trim(public.current_email()), ''))
      limit 1
    );

  return jsonb_build_object(
    'ok', true,
    'article_id', rev.article_id,
    'restored_from_id', rev.id,
    'revision', rev.revision
  );
end;
$$;
