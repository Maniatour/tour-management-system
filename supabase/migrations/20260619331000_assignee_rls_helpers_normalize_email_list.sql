-- tour_expense_row_accessible_as_assignee / reservation_expense_row_accessible_as_assignee
-- used simple lower(tour_guide_id) = current_email(), which breaks when tours store
-- comma-separated or decorated multi-email lists.
-- That caused ticket_bookings / tour_hotel_bookings / tour_expenses / reservation_expenses
-- INSERT/UPDATE to fail for correctly assigned guides.
--
-- normalize_email_list: 202509160005 와 동일. 일부 DB에는 해당 마이그레이션이 없어 여기서 보장.

begin;

create or replace function public.normalize_email_list(p text)
returns text[]
language plpgsql
immutable
set search_path = public
as $$
declare
  cleaned text;
  arr text[];
begin
  cleaned := lower(btrim(coalesce(p, '')));
  if cleaned = '' then
    return array[]::text[];
  end if;
  cleaned := replace(cleaned, '[', '');
  cleaned := replace(cleaned, ']', '');
  cleaned := replace(cleaned, '"', '');
  arr := regexp_split_to_array(cleaned, '\s*,\s*');
  return arr;
end;
$$;

comment on function public.normalize_email_list(text) is
  'tour_guide_id / assistant_id 등에 콤마·JSON 꾸밈이 섞인 이메일 목록을 소문자 배열로 분해';

create or replace function public.tour_expense_row_accessible_as_assignee(p_tour_id text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select p_tour_id is not null
  and exists (
    select 1
    from public.tours t
    where t.id = p_tour_id
      and (
        public.current_email() = any (public.normalize_email_list(t.tour_guide_id))
        or public.current_email() = any (public.normalize_email_list(t.assistant_id))
      )
  );
$$;

comment on function public.tour_expense_row_accessible_as_assignee(text) is
  'RLS helper: JWT 사용자가 해당 투어의 가이드 또는 어시스턴트인지 (normalize_email_list로 복수 배정 지원).';

create or replace function public.reservation_expense_row_accessible_as_assignee(p_reservation_id text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select p_reservation_id is not null
  and exists (
    select 1
    from public.reservations r
    inner join public.tours t on t.id = r.tour_id
    where r.id = p_reservation_id
      and (
        public.current_email() = any (public.normalize_email_list(t.tour_guide_id))
        or public.current_email() = any (public.normalize_email_list(t.assistant_id))
      )
  );
$$;

comment on function public.reservation_expense_row_accessible_as_assignee(text) is
  'RLS helper: JWT 사용자가 해당 예약 투어의 가이드 또는 어시스턴트인지 (normalize_email_list).';

commit;
