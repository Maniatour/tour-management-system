-- 도시락 체크 Todo: 투어별 도시락 주문 기록
begin;

create table if not exists public.tour_bento_orders (
  id uuid primary key default gen_random_uuid(),
  tour_id text not null references public.tours(id) on delete cascade,
  tour_date date not null,
  total_quantity integer not null default 0,
  order_details jsonb not null default '[]'::jsonb,
  ordered_at timestamptz not null default now(),
  ordered_by_email text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tour_bento_orders_tour_id_unique unique (tour_id)
);

create index if not exists tour_bento_orders_tour_date_idx
  on public.tour_bento_orders (tour_date);

comment on table public.tour_bento_orders is
  '도시락 체크 Todo에서 투어별 도시락 주문 완료 기록.';

alter table public.tour_bento_orders enable row level security;

revoke all on table public.tour_bento_orders from anon;
grant select, insert, update, delete on table public.tour_bento_orders to authenticated;

create policy "tour_bento_orders_select_staff"
  on public.tour_bento_orders for select to authenticated
  using (public.rls_is_staff_session_ok());

create policy "tour_bento_orders_insert_staff"
  on public.tour_bento_orders for insert to authenticated
  with check (public.rls_is_staff_session_ok());

create policy "tour_bento_orders_update_staff"
  on public.tour_bento_orders for update to authenticated
  using (public.rls_is_staff_session_ok())
  with check (public.rls_is_staff_session_ok());

create policy "tour_bento_orders_delete_staff"
  on public.tour_bento_orders for delete to authenticated
  using (public.rls_is_staff_session_ok());

commit;
