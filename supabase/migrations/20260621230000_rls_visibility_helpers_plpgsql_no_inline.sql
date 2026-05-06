-- LANGUAGE sql RLS 헬퍼는 플래너가 정책 식에 인라인하면서
-- SECURITY DEFINER / row_security=off 가 적용되지 않아 customers↔reservations 재귀·500이 지속될 수 있다.
-- plpgsql 은 인라인되지 않아 별도 서브트랜잭션 컨텍스트에서 헬퍼가 확실히 실행된다.
--
-- Depends: 20260621220000 (같은 시그니처·의미 유지)

begin;

create or replace function public.reservation_row_visible_for_policy(p_reservation_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
begin
  if p_reservation_id is null then
    return false;
  end if;
  return exists (
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
end;
$$;

create or replace function public.customer_row_visible_for_policy(p_customer_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
begin
  if p_customer_id is null then
    return false;
  end if;
  return exists (
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
end;
$$;

create or replace function public.product_visible_for_customer_by_reservation(p_product_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
begin
  if p_product_id is null then
    return false;
  end if;
  if
    length(public.current_email()) <= 0
    and length(public.session_email_from_auth_users()) <= 0
  then
    return false;
  end if;
  return exists (
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
end;
$$;

create or replace function public.reservation_id_in_active_product_catalog(p_reservation_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
begin
  if p_reservation_id is null then
    return false;
  end if;
  return exists (
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
end;
$$;

commit;
