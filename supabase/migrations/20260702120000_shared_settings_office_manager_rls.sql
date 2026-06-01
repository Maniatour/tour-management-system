-- shared_settings: Office Manager(매니저)도 공유 설정을 저장할 수 있도록 허용
-- 기존 정책은 team.position = 'super' / 'admin' 만 INSERT/UPDATE/DELETE 가능했음.
-- 스케줄 뷰의 팀원·상품 선택을 Office Manager 가 모든 사용자에게 공유 적용할 수 있도록
-- 직책 화이트리스트에 office manager / manager / 매니저 를 추가한다.

alter table public.shared_settings enable row level security;

-- 공통: 공유 설정 쓰기 가능한 직책 판별 헬퍼 (super / admin / office manager / manager / 매니저)
create or replace function public.shared_settings_can_write(p_email text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  em text := lower(nullif(trim(coalesce(p_email, '')), ''));
  pos text;
begin
  if em is null or length(em) = 0 then
    return false;
  end if;
  if em in ('info@maniatour.com', 'wooyong.shim09@gmail.com') then
    return true;
  end if;
  select lower(trim(coalesce(t.position::text, '')))
  into pos
  from public.team t
  where lower(t.email) = em
    and coalesce(t.is_active, true) = true
  limit 1;
  if pos is null then
    return false;
  end if;
  pos := lower(replace(pos, '_', ' '));
  return pos in (
    'super',
    'admin',
    'office manager',
    'manager',
    '매니저'
  );
end;
$$;

create or replace function public.shared_settings_can_write()
returns boolean
language sql
stable
set search_path = public
as $$
  select public.shared_settings_can_write(lower(trim(coalesce(auth.jwt() ->> 'email', ''))));
$$;

-- 기존 정책 교체
drop policy if exists "shared_settings_insert_admin" on public.shared_settings;
drop policy if exists "shared_settings_update_admin" on public.shared_settings;
drop policy if exists "shared_settings_delete_admin" on public.shared_settings;

create policy "shared_settings_insert_admin"
  on public.shared_settings for insert to authenticated
  with check (public.shared_settings_can_write());

create policy "shared_settings_update_admin"
  on public.shared_settings for update to authenticated
  using (public.shared_settings_can_write())
  with check (public.shared_settings_can_write());

create policy "shared_settings_delete_admin"
  on public.shared_settings for delete to authenticated
  using (public.shared_settings_can_write());
