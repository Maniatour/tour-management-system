-- 운영 허브 문서(company_knowledge_articles) 저장·복원 버전 이력
-- body_structure 등 본문/메타 변경 전 OLD 스냅샷을 자동 보관. 복원 RPC 제공.

begin;

create table if not exists public.company_knowledge_article_revisions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.company_knowledge_articles (id) on delete cascade,
  revision integer not null default 0,
  action text not null default 'save'
    check (action in ('save', 'restore', 'seed')),
  restored_from_id uuid references public.company_knowledge_article_revisions (id) on delete set null,
  snapshot jsonb not null,
  note text,
  saved_by uuid references auth.users (id) on delete set null,
  saved_by_email text,
  saved_by_name text,
  created_at timestamptz not null default now(),
  constraint company_knowledge_article_revisions_unique_rev unique (article_id, revision)
);

create index if not exists idx_knowledge_article_revisions_article_created
  on public.company_knowledge_article_revisions (article_id, created_at desc);

create index if not exists idx_knowledge_article_revisions_article_revision
  on public.company_knowledge_article_revisions (article_id, revision desc);

comment on table public.company_knowledge_article_revisions is
  '운영 허브 문서 저장·복원 스냅샷. UPDATE 직전 OLD 상태를 보관.';

create or replace function public.company_knowledge_article_revisions_set_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select coalesce(max(revision), 0) + 1
  into new.revision
  from public.company_knowledge_article_revisions
  where article_id = new.article_id;
  return new;
end;
$$;

drop trigger if exists trg_knowledge_article_revisions_revision
  on public.company_knowledge_article_revisions;
create trigger trg_knowledge_article_revisions_revision
  before insert on public.company_knowledge_article_revisions
  for each row
  execute function public.company_knowledge_article_revisions_set_revision();

create or replace function public.company_knowledge_article_snapshot(a public.company_knowledge_articles)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'slug', a.slug,
    'title_ko', a.title_ko,
    'title_en', a.title_en,
    'summary_ko', a.summary_ko,
    'summary_en', a.summary_en,
    'hub_category', a.hub_category,
    'content_type', a.content_type,
    'target_roles', to_jsonb(a.target_roles),
    'body_structure', a.body_structure,
    'sort_order', a.sort_order,
    'is_published', a.is_published,
    'published_at', a.published_at
  );
$$;

create or replace function public.company_knowledge_articles_capture_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_name text;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if old.body_structure is not distinct from new.body_structure
     and old.title_ko is not distinct from new.title_ko
     and old.title_en is not distinct from new.title_en
     and old.summary_ko is not distinct from new.summary_ko
     and old.summary_en is not distinct from new.summary_en
     and old.slug is not distinct from new.slug
     and old.hub_category is not distinct from new.hub_category
     and old.content_type is not distinct from new.content_type
     and old.target_roles is not distinct from new.target_roles
     and old.sort_order is not distinct from new.sort_order
     and old.is_published is not distinct from new.is_published
  then
    return new;
  end if;

  v_email := lower(nullif(trim(public.current_email()), ''));
  if v_email is not null then
    select coalesce(
      nullif(trim(t.display_name), ''),
      nullif(trim(t.name_en), ''),
      nullif(trim(t.name_ko), '')
    )
    into v_name
    from public.team t
    where lower(trim(t.email)) = v_email
    limit 1;
  end if;

  -- OLD(덮어쓰기 직전) 상태를 보관 → 이후 복원 가능
  insert into public.company_knowledge_article_revisions (
    article_id,
    action,
    snapshot,
    saved_by,
    saved_by_email,
    saved_by_name
  ) values (
    old.id,
    'save',
    public.company_knowledge_article_snapshot(old),
    auth.uid(),
    v_email,
    v_name
  );

  return new;
end;
$$;

drop trigger if exists trg_knowledge_articles_capture_revision
  on public.company_knowledge_articles;
create trigger trg_knowledge_articles_capture_revision
  before update on public.company_knowledge_articles
  for each row
  execute function public.company_knowledge_articles_capture_revision();

-- 기존 문서 현재 상태를 seed 스냅샷으로 보관 (이미 지워진 내용은 복구 불가)
insert into public.company_knowledge_article_revisions (
  article_id,
  action,
  snapshot,
  note,
  saved_by_email,
  saved_by_name
)
select
  a.id,
  'seed',
  public.company_knowledge_article_snapshot(a),
  'Baseline snapshot at revision history rollout',
  'system',
  'System'
from public.company_knowledge_articles a
where not exists (
  select 1
  from public.company_knowledge_article_revisions r
  where r.article_id = a.id
);

alter table public.company_knowledge_article_revisions enable row level security;

revoke all on table public.company_knowledge_article_revisions from anon;
grant select on table public.company_knowledge_article_revisions to authenticated;

drop policy if exists "knowledge_article_revisions_select_managers"
  on public.company_knowledge_article_revisions;
create policy "knowledge_article_revisions_select_managers"
  on public.company_knowledge_article_revisions for select to authenticated
  using (public.can_manage_company_sop());

-- 이력은 트리거/SECURITY DEFINER RPC만 INSERT. 클라이언트 직접 INSERT 방지.
revoke insert, update, delete on table public.company_knowledge_article_revisions from authenticated;

create or replace function public.list_company_knowledge_article_revisions(
  p_article_id uuid,
  p_limit int default 40
)
returns table (
  id uuid,
  article_id uuid,
  revision integer,
  action text,
  restored_from_id uuid,
  note text,
  saved_by_email text,
  saved_by_name text,
  created_at timestamptz,
  title_ko text,
  title_en text,
  body_chars integer
)
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
begin
  if not public.can_manage_company_sop() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  select
    r.id,
    r.article_id,
    r.revision,
    r.action,
    r.restored_from_id,
    r.note,
    r.saved_by_email,
    r.saved_by_name,
    r.created_at,
    coalesce(r.snapshot->>'title_ko', '')::text,
    coalesce(r.snapshot->>'title_en', '')::text,
    length(coalesce(r.snapshot->>'body_structure', ''))::integer
  from public.company_knowledge_article_revisions r
  where r.article_id = p_article_id
  order by r.revision desc, r.created_at desc
  limit greatest(1, least(coalesce(p_limit, 40), 100));
end;
$$;

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
  published boolean;
  published_at timestamptz;
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

  published := coalesce((snap->>'is_published')::boolean, false);
  published_at := case
    when published then coalesce((snap->>'published_at')::timestamptz, now())
    else null
  end;

  -- BEFORE UPDATE 트리거가 현재(덮어쓰기 전) 상태를 save 이력으로 보관
  update public.company_knowledge_articles
  set
    slug = coalesce(nullif(trim(snap->>'slug'), ''), slug),
    title_ko = coalesce(snap->>'title_ko', title_ko),
    title_en = coalesce(snap->>'title_en', title_en),
    summary_ko = coalesce(snap->>'summary_ko', ''),
    summary_en = coalesce(snap->>'summary_en', ''),
    hub_category = coalesce(snap->>'hub_category', hub_category),
    content_type = coalesce(snap->>'content_type', content_type),
    target_roles = coalesce(
      array(select jsonb_array_elements_text(coalesce(snap->'target_roles', '[]'::jsonb))),
      '{}'::text[]
    ),
    body_structure = coalesce(snap->'body_structure', body_structure),
    sort_order = coalesce((snap->>'sort_order')::integer, sort_order),
    is_published = published,
    published_at = published_at,
    updated_by = auth.uid()
  where id = rev.article_id;

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

revoke all on function public.list_company_knowledge_article_revisions(uuid, int) from public, anon;
revoke all on function public.restore_company_knowledge_article_revision(uuid) from public, anon;
grant execute on function public.list_company_knowledge_article_revisions(uuid, int) to authenticated;
grant execute on function public.restore_company_knowledge_article_revision(uuid) to authenticated;

revoke all on function public.company_knowledge_article_snapshot(public.company_knowledge_articles) from public, anon;
revoke all on function public.company_knowledge_articles_capture_revision() from public, anon;
revoke all on function public.company_knowledge_article_revisions_set_revision() from public, anon;

commit;
