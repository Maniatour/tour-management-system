-- 운영 허브 문서 숙지 서명(규정·계약). 기본값은 none — 매뉴얼은 서명하지 않음.

alter table public.company_knowledge_articles
  add column if not exists acknowledgment_mode text not null default 'none';

alter table public.company_knowledge_articles
  drop constraint if exists company_knowledge_articles_acknowledgment_mode_chk;

alter table public.company_knowledge_articles
  add constraint company_knowledge_articles_acknowledgment_mode_chk
  check (acknowledgment_mode in ('none', 'signature'));

comment on column public.company_knowledge_articles.acknowledgment_mode is
  'none = 매뉴얼(서명 없음). signature = 숙지 서명 + PDF 사본. 로그인 게이트는 signature만.';

create table if not exists public.company_knowledge_article_sign_versions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.company_knowledge_articles (id) on delete cascade,
  version_number integer not null,
  title text not null default '',
  body_structure jsonb not null,
  published_at timestamptz not null default now(),
  published_by uuid references auth.users (id) on delete set null,
  constraint company_knowledge_article_sign_versions_positive
    check (version_number >= 1),
  constraint company_knowledge_article_sign_versions_unique
    unique (article_id, version_number)
);

create index if not exists idx_hub_article_sign_versions_article
  on public.company_knowledge_article_sign_versions (article_id, version_number desc);

create table if not exists public.company_knowledge_article_signatures (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.company_knowledge_article_sign_versions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  signer_email text not null,
  signer_name text not null,
  pdf_storage_path text not null,
  signed_at timestamptz not null default now(),
  constraint company_knowledge_article_signatures_unique unique (version_id, user_id)
);

create index if not exists idx_hub_article_signatures_version
  on public.company_knowledge_article_signatures (version_id);
create index if not exists idx_hub_article_signatures_user
  on public.company_knowledge_article_signatures (user_id);

alter table public.company_knowledge_article_sign_versions enable row level security;
alter table public.company_knowledge_article_signatures enable row level security;

drop policy if exists "hub_article_sign_versions_select_staff"
  on public.company_knowledge_article_sign_versions;
create policy "hub_article_sign_versions_select_staff"
  on public.company_knowledge_article_sign_versions for select to authenticated
  using (public.is_staff());

drop policy if exists "hub_article_sign_versions_insert_managers"
  on public.company_knowledge_article_sign_versions;
create policy "hub_article_sign_versions_insert_managers"
  on public.company_knowledge_article_sign_versions for insert to authenticated
  with check (public.can_manage_company_sop());

drop policy if exists "hub_article_signatures_select_staff"
  on public.company_knowledge_article_signatures;
create policy "hub_article_signatures_select_staff"
  on public.company_knowledge_article_signatures for select to authenticated
  using (
    public.is_staff()
    and (
      user_id = auth.uid()
      or public.can_manage_company_sop()
    )
  );

drop policy if exists "hub_article_signatures_insert_own"
  on public.company_knowledge_article_signatures;
create policy "hub_article_signatures_insert_own"
  on public.company_knowledge_article_signatures for insert to authenticated
  with check (
    public.is_staff()
    and user_id = auth.uid()
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'hub-article-signatures',
  'hub-article-signatures',
  false,
  15728640,
  array['application/pdf']::text[]
)
on conflict (id) do nothing;

drop policy if exists "hub_article_signatures_storage_insert_own" on storage.objects;
create policy "hub_article_signatures_storage_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'hub-article-signatures'
    and public.is_staff()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "hub_article_signatures_storage_select_own_or_manager" on storage.objects;
create policy "hub_article_signatures_storage_select_own_or_manager"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'hub-article-signatures'
    and public.is_staff()
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.can_manage_company_sop()
    )
  );

drop policy if exists "hub_article_signatures_storage_update_own" on storage.objects;
create policy "hub_article_signatures_storage_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'hub-article-signatures'
    and public.is_staff()
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'hub-article-signatures'
    and public.is_staff()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

comment on table public.company_knowledge_article_sign_versions is
  '허브 문서 숙지 서명용 고정 버전(본문 변경 시 새 행).';
comment on table public.company_knowledge_article_signatures is
  '직원별 허브 문서 서명 및 PDF 저장 경로.';
