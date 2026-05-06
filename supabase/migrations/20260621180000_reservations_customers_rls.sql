-- reservations / customers: 전역 SELECT·무제한 DELETE 제거
-- - 예약: 활성 상품 기준 공개(anon) 조회·삽입·갱신(예약 플로우), 인증은 소유·팀·가이드·카탈로그 OR
-- - 고객: anon 차단, 인증은 본인 이메일·팀·가이드(예약 경유)만
-- Depends: normalize_email_list, session_email_from_auth_users, is_staff*, is_team_member* (211600 등)

begin;

-- ---------- reservation_row_visible_for_policy (DEFINER: reservations RLS 재귀 방지) ----------
create or replace function public.reservation_row_visible_for_policy(p_reservation_id text)
returns boolean
language sql
stable
security definer
set search_path = public
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

comment on function public.reservation_row_visible_for_policy(text) is
  'reservations RLS: 스태프·팀·고객(이메일)·가이드 배정 행 (DEFINER, 자기참조 재귀 방지).';

-- ---------- customer_row_visible_for_policy ----------
create or replace function public.customer_row_visible_for_policy(p_customer_id text)
returns boolean
language sql
stable
security definer
set search_path = public
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

comment on function public.customer_row_visible_for_policy(text) is
  'customers RLS: 스태프·팀·본인 이메일·가이드(예약 투어) (DEFINER).';

-- ---------- reservations ----------
alter table public.reservations enable row level security;

drop policy if exists "reservations_select_all" on public.reservations;
drop policy if exists "reservations_select_staff_all" on public.reservations;
drop policy if exists "reservations_select_assigned_via_tour" on public.reservations;
drop policy if exists "reservations_modify_staff_only" on public.reservations;
drop policy if exists "reservations_insert_all" on public.reservations;
drop policy if exists "reservations_update_all" on public.reservations;
drop policy if exists "reservations_delete_all" on public.reservations;
drop policy if exists "reservations_insert_staff" on public.reservations;
drop policy if exists "reservations_update_staff" on public.reservations;
drop policy if exists "reservations_delete_staff" on public.reservations;
drop policy if exists "reservations_select_anon_catalog" on public.reservations;
drop policy if exists "reservations_select_authenticated" on public.reservations;
drop policy if exists "reservations_insert_accessible" on public.reservations;
drop policy if exists "reservations_update_anon_catalog" on public.reservations;
drop policy if exists "reservations_update_authenticated" on public.reservations;
drop policy if exists "reservations_update_staff_team" on public.reservations;
revoke all on table public.reservations from anon;
grant select, insert, update on table public.reservations to anon;

grant select, insert, update, delete on table public.reservations to authenticated;

create policy "reservations_select_anon_catalog"
  on public.reservations for select to anon
  using (
    product_id is not null
    and exists (
      select 1
      from public.products p
      where p.id = reservations.product_id
        and lower(trim(coalesce(p.status::text, ''))) = 'active'
    )
  );

create policy "reservations_select_authenticated"
  on public.reservations for select to authenticated
  using (
    public.reservation_row_visible_for_policy(id)
    or (
      product_id is not null
      and exists (
        select 1
        from public.products p
        where p.id = reservations.product_id
          and lower(trim(coalesce(p.status::text, ''))) = 'active'
      )
    )
  );

create policy "reservations_insert_accessible"
  on public.reservations for insert to anon, authenticated
  with check (
    public.is_staff()
    or public.is_staff_for_session()
    or public.is_team_member(public.current_email())
    or public.is_team_member_for_session()
    or public.is_team_member(public.session_email_from_auth_users())
    or (
      product_id is not null
      and exists (
        select 1
        from public.products p
        where p.id = reservations.product_id
          and lower(trim(coalesce(p.status::text, ''))) = 'active'
      )
    )
  );

create policy "reservations_update_anon_catalog"
  on public.reservations for update to anon
  using (
    product_id is not null
    and exists (
      select 1
      from public.products p
      where p.id = reservations.product_id
        and lower(trim(coalesce(p.status::text, ''))) = 'active'
    )
  )
  with check (
    product_id is not null
    and exists (
      select 1
      from public.products p
      where p.id = reservations.product_id
        and lower(trim(coalesce(p.status::text, ''))) = 'active'
    )
  );

create policy "reservations_update_authenticated"
  on public.reservations for update to authenticated
  using (public.reservation_row_visible_for_policy(id))
  with check (public.reservation_row_visible_for_policy(id));

create policy "reservations_update_staff_team"
  on public.reservations for update to authenticated
  using (
    public.is_staff()
    or public.is_staff_for_session()
    or public.is_team_member(public.current_email())
    or public.is_team_member_for_session()
    or public.is_team_member(public.session_email_from_auth_users())
  )
  with check (
    public.is_staff()
    or public.is_staff_for_session()
    or public.is_team_member(public.current_email())
    or public.is_team_member_for_session()
    or public.is_team_member(public.session_email_from_auth_users())
  );

create policy "reservations_delete_staff"
  on public.reservations for delete to authenticated
  using (public.is_staff() or public.is_staff_for_session());

-- ---------- customers ----------
alter table public.customers enable row level security;

drop policy if exists "customers_select_all" on public.customers;
drop policy if exists "customers_modify_staff_only" on public.customers;
drop policy if exists "customers_insert_staff" on public.customers;
drop policy if exists "customers_insert_accessible" on public.customers;
drop policy if exists "customers_update_staff" on public.customers;
drop policy if exists "customers_delete_staff" on public.customers;
drop policy if exists "customers_select_authenticated" on public.customers;
drop policy if exists "customers_insert_staff_only" on public.customers;
drop policy if exists "customers_update_accessible" on public.customers;
drop policy if exists "customers_delete_staff_only" on public.customers;

revoke all on table public.customers from anon;

grant select, insert, update, delete on table public.customers to authenticated;

create policy "customers_select_authenticated"
  on public.customers for select to authenticated
  using (public.customer_row_visible_for_policy(id));

create policy "customers_insert_accessible"
  on public.customers for insert to authenticated
  with check (
    public.is_staff()
    or public.is_staff_for_session()
    or public.is_team_member(public.current_email())
    or public.is_team_member_for_session()
    or public.is_team_member(public.session_email_from_auth_users())
  );

create policy "customers_update_accessible"
  on public.customers for update to authenticated
  using (
    public.is_staff()
    or public.is_staff_for_session()
    or (
      length(public.current_email()) > 0
      and lower(trim(coalesce(customers.email, ''))) = public.current_email()
    )
    or (
      length(public.session_email_from_auth_users()) > 0
      and lower(trim(coalesce(customers.email, ''))) = public.session_email_from_auth_users()
    )
  )
  with check (
    public.is_staff()
    or public.is_staff_for_session()
    or (
      length(public.current_email()) > 0
      and lower(trim(coalesce(customers.email, ''))) = public.current_email()
    )
    or (
      length(public.session_email_from_auth_users()) > 0
      and lower(trim(coalesce(customers.email, ''))) = public.session_email_from_auth_users()
    )
  );

create policy "customers_delete_staff"
  on public.customers for delete to authenticated
  using (public.is_staff() or public.is_staff_for_session());

commit;
