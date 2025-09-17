begin;

-- 0) 기존 정책 제거
drop policy if exists "Allow all for authenticated users" on public.product_details;
drop policy if exists "Allow read for anonymous users" on public.product_details;

-- 1) staff 판별 함수 (이미 존재할 수 있으므로 확인)
create or replace function public.is_staff(p_email text)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.team
    where lower(email) = lower(p_email) and is_active = true
  );
$$;

-- 2) 세션 이메일 읽기 함수 (이미 존재할 수 있으므로 확인)
create or replace function public.current_email()
returns text language sql stable as $$
  select lower(btrim(coalesce(auth.jwt() ->> 'email', '')))
$$;

-- 3) RLS 재적용: staff는 모든 작업 허용, 익명 사용자는 읽기만
alter table public.product_details enable row level security;

-- staff에게 모든 작업 허용
create policy "product_details_staff_all" on public.product_details
  for all using (public.is_staff(public.current_email()))
  with check (public.is_staff(public.current_email()));

-- 익명 사용자에게 읽기 허용
create policy "product_details_anon_read" on public.product_details
  for select using (true);

-- RLS가 활성화되어 있는지 확인
select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where tablename = 'product_details';

-- 정책 확인
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where tablename = 'product_details';

commit;
