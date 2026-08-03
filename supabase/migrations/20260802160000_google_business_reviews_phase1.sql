-- Google Business Profile review integration — Phase 1
-- Tables: google_business_connections, google_reviews, review_products

begin;

-- ---------- google_business_connections ----------
create table if not exists public.google_business_connections (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operators(id) on delete cascade,
  connected_email text not null,
  google_account_name text,
  google_account_display_name text,
  google_location_name text,
  google_location_title text,
  refresh_token_ciphertext text not null,
  connected_by_email text,
  connected_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint google_business_connections_operator_unique unique (operator_id)
);

create index if not exists idx_google_business_connections_operator_id
  on public.google_business_connections (operator_id);

comment on table public.google_business_connections is
  'Google Business Profile OAuth connection per operator; refresh_token stored encrypted server-side.';
comment on column public.google_business_connections.refresh_token_ciphertext is
  'AES-256-GCM encrypted refresh token (GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEY).';

-- ---------- google_reviews ----------
create table if not exists public.google_reviews (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operators(id) on delete cascade,
  google_review_id text not null,
  google_location_name text not null,
  author_name text,
  author_photo_url text,
  rating smallint check (rating >= 1 and rating <= 5),
  comment text,
  review_reply text,
  review_created_at timestamptz,
  review_updated_at timestamptz,
  import_status text not null default 'pending'
    check (import_status in ('pending', 'approved', 'rejected', 'hidden')),
  classification_method text,
  classification_confidence numeric(5, 4),
  classified_at timestamptz,
  classified_by text,
  raw_payload jsonb,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint google_reviews_operator_review_unique unique (operator_id, google_review_id)
);

create index if not exists idx_google_reviews_operator_id
  on public.google_reviews (operator_id);
create index if not exists idx_google_reviews_import_status_created
  on public.google_reviews (operator_id, import_status, review_created_at desc);
create index if not exists idx_google_reviews_location
  on public.google_reviews (google_location_name);

comment on table public.google_reviews is
  'Imported Google Business Profile reviews (Phase 1 schema; import logic added later).';

-- ---------- review_products ----------
create table if not exists public.review_products (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operators(id) on delete cascade,
  google_review_id uuid not null references public.google_reviews(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  is_primary boolean not null default true,
  match_method text,
  match_confidence numeric(5, 4),
  created_at timestamptz not null default now(),
  created_by_email text,
  constraint review_products_review_product_unique unique (google_review_id, product_id)
);

create index if not exists idx_review_products_operator_id
  on public.review_products (operator_id);
create index if not exists idx_review_products_product_id
  on public.review_products (product_id);

comment on table public.review_products is
  'Maps imported Google reviews to tour products (classification / manual assignment).';

-- ---------- RLS ----------
alter table public.google_business_connections enable row level security;
alter table public.google_reviews enable row level security;
alter table public.review_products enable row level security;

revoke all on table public.google_business_connections from anon;
revoke all on table public.google_reviews from anon;
revoke all on table public.review_products from anon;

grant select, insert, update, delete on table public.google_business_connections to authenticated;
grant select, insert, update, delete on table public.google_reviews to authenticated;
grant select, insert, update, delete on table public.review_products to authenticated;

-- Token table: admin only (same pattern as gmail_connections)
create policy "google_business_connections_select_admin"
  on public.google_business_connections for select to authenticated
  using (public.is_admin_user(public.current_email()));

create policy "google_business_connections_insert_admin"
  on public.google_business_connections for insert to authenticated
  with check (public.is_admin_user(public.current_email()));

create policy "google_business_connections_update_admin"
  on public.google_business_connections for update to authenticated
  using (public.is_admin_user(public.current_email()))
  with check (public.is_admin_user(public.current_email()));

create policy "google_business_connections_delete_admin"
  on public.google_business_connections for delete to authenticated
  using (public.is_admin_user(public.current_email()));

-- Reviews: staff read; admin write (import/moderation)
create policy "google_reviews_select_staff"
  on public.google_reviews for select to authenticated
  using (public.is_staff());

create policy "google_reviews_write_admin"
  on public.google_reviews for all to authenticated
  using (public.is_admin_user(public.current_email()))
  with check (public.is_admin_user(public.current_email()));

create policy "review_products_select_staff"
  on public.review_products for select to authenticated
  using (public.is_staff());

create policy "review_products_write_admin"
  on public.review_products for all to authenticated
  using (public.is_admin_user(public.current_email()))
  with check (public.is_admin_user(public.current_email()));

commit;
