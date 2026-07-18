-- 상품 고객 배포(노출) 여부 — 판매 상태(status)와 별도
-- 기존 active 상품은 기본 true 로 고객 노출 유지

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.products.is_published IS
  '고객 사이트 배포 여부. false면 status가 active여도 고객 카탈로그/RLS에서 숨김. 관리자·예약 연결 조회는 가능.';

CREATE INDEX IF NOT EXISTS products_is_published_idx
  ON public.products (is_published)
  WHERE is_published = true;

-- 공개 카탈로그 RLS: active + published
begin;

drop policy if exists "products_select_anon_active" on public.products;
drop policy if exists "products_select_authenticated_active" on public.products;

create policy "products_select_anon_active"
  on public.products for select to anon
  using (
    lower(trim(coalesce(status::text, ''))) = 'active'
    and is_published = true
  );

create policy "products_select_authenticated_active"
  on public.products for select to authenticated
  using (
    lower(trim(coalesce(status::text, ''))) = 'active'
    and is_published = true
  );

commit;
