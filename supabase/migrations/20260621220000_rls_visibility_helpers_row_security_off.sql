-- RLS 헬퍼(SECURITY DEFINER) 내부에서도 RLS가 적용되면
-- customers ↔ reservations ↔ customers 무한 재귀가 발생할 수 있다.
-- (Supabase에서 함수 소유자가 테이블 소유자와 달라 RLS 우회가 안 되는 경우 등)
-- DEFINER 본문 실행 동안만 row_security = off 로 조인·존재 여부만 평가한다.
--
-- Depends: 20260621180000, 20260621190000, 20260621210000

begin;

create or replace function public.reservation_row_visible_for_policy(p_reservation_id text)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select p_reservation_id is not null
  and exists (
    select 1
    from public.reservations r
    where r.id = p_reservation_id
      and (
        public.is_staff()
        or public.is_staff_for_session()
        or public.is_team_member(public.current_email())
        or public.is_team_member_for_session()
        or public.is_team_member(public.session_email_from_auth_users())
        or (
          r.customer_id is not null
          and exists (
            select 1
            from public.customers c
            where c.id = r.customer_id
              and length(trim(coalesce(c.email, ''))) > 0
              and (
                (
                  length(public.current_email()) > 0
                  and lower(trim(c.email)) = public.current_email()
                )
                or (
                  length(public.session_email_from_auth_users()) > 0
                  and lower(trim(c.email)) = public.session_email_from_auth_users()
                )
              )
          )
        )
        or (
          r.tour_id is not null
          and exists (
            select 1
            from public.tours t
            where t.id = r.tour_id
              and (
                public.current_email() = any (public.normalize_email_list(coalesce(t.tour_guide_id, '')))
                or public.current_email() = any (public.normalize_email_list(coalesce(t.assistant_id, '')))
                or public.session_email_from_auth_users() = any (public.normalize_email_list(coalesce(t.tour_guide_id, '')))
                or public.session_email_from_auth_users() = any (public.normalize_email_list(coalesce(t.assistant_id, '')))
              )
          )
        )
      )
  );
$$;

create or replace function public.customer_row_visible_for_policy(p_customer_id text)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select p_customer_id is not null
  and exists (
    select 1
    from public.customers c
    where c.id = p_customer_id
      and (
        public.is_staff()
        or public.is_staff_for_session()
        or public.is_team_member(public.current_email())
        or public.is_team_member_for_session()
        or public.is_team_member(public.session_email_from_auth_users())
        or (
          length(trim(coalesce(c.email, ''))) > 0
          and (
            (
              length(public.current_email()) > 0
              and lower(trim(c.email)) = public.current_email()
            )
            or (
              length(public.session_email_from_auth_users()) > 0
              and lower(trim(c.email)) = public.session_email_from_auth_users()
            )
          )
        )
        or exists (
          select 1
          from public.reservations r
          inner join public.tours t on t.id = r.tour_id
          where r.customer_id = c.id
            and (
              public.current_email() = any (public.normalize_email_list(coalesce(t.tour_guide_id, '')))
              or public.current_email() = any (public.normalize_email_list(coalesce(t.assistant_id, '')))
              or public.session_email_from_auth_users() = any (public.normalize_email_list(coalesce(t.tour_guide_id, '')))
              or public.session_email_from_auth_users() = any (public.normalize_email_list(coalesce(t.assistant_id, '')))
            )
        )
      )
  );
$$;

create or replace function public.product_visible_for_customer_by_reservation(p_product_id text)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
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

create or replace function public.reservation_id_in_active_product_catalog(p_reservation_id text)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select p_reservation_id is not null
  and exists (
    select 1
    from public.reservations r
    where r.id = p_reservation_id
      and r.product_id is not null
      and exists (
        select 1
        from public.products p
        where p.id = r.product_id
          and lower(trim(coalesce(p.status::text, ''))) = 'active'
      )
  );
$$;

commit;
