-- products ↔ reservations RLS 상호 참조로 인한 무한 재귀 제거 (PostgREST 500 방지)
--
-- products_select_by_customer_reservation 가 reservations 를 invoker 컨텍스트로 조회하면
-- reservations_select_authenticated 의 EXISTS(products ...) 가 다시 products RLS 를 타며
-- 재귀가 발생할 수 있다. 예약·고객 매칭은 SECURITY DEFINER 로만 수행한다.
--
-- Depends: public.current_email(), public.session_email_from_auth_users() (211400 등)

begin;

create or replace function public.product_visible_for_customer_by_reservation(p_product_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_product_id is not null
  and (
    length(public.current_email()) > 0
    or length(public.session_email_from_auth_users()) > 0
  )
  and exists (
    select 1
    from public.reservations r
    inner join public.customers c on c.id = r.customer_id
    where r.product_id = p_product_id
      and (
        (
          length(public.current_email()) > 0
          and lower(trim(coalesce(c.email, ''))) = public.current_email()
        )
        or (
          length(public.session_email_from_auth_users()) > 0
          and lower(trim(coalesce(c.email, ''))) = public.session_email_from_auth_users()
        )
      )
  );
$$;

comment on function public.product_visible_for_customer_by_reservation(text) is
  'products RLS: 본인 예약으로 비활성 상품까지 조회 허용 (DEFINER, reservations↔products RLS 재귀 방지).';

drop policy if exists "products_select_by_customer_reservation" on public.products;

create policy "products_select_by_customer_reservation"
  on public.products for select to authenticated
  using (public.product_visible_for_customer_by_reservation(id));

commit;
