-- anon은 chat_rooms / chat_messages / chat_participants를 직접 SELECT할 수 없게 하고,
-- room_code를 아는 경우에만 SECURITY DEFINER RPC로 조회한다.

begin;

drop policy if exists "chat_rooms_anon_select_active" on public.chat_rooms;
drop policy if exists "chat_messages_anon_select_active_room" on public.chat_messages;
drop policy if exists "chat_participants_anon_select_active_room" on public.chat_participants;

-- 공개 채팅(/chat/{code}): 활성 방 + room_code 일치 시 방 JSON + 투어 요약
create or replace function public.get_public_chat_room_bundle_by_code(p_room_code text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'room', to_jsonb(cr),
    'tour', jsonb_build_object(
      'id', t.id,
      'product_id', t.product_id,
      'tour_date', t.tour_date,
      'tour_status', t.tour_status
    )
  )
  from public.chat_rooms cr
  inner join public.tours t on t.id = cr.tour_id
  where cr.is_active is true
    and cr.room_code = nullif(btrim(p_room_code), '')
  limit 1;
$$;

-- room_code 일치하는 활성 방의 메시지 (최신순, 상한 500)
create or replace function public.get_chat_messages_by_room_code(p_room_code text, p_limit integer default 200)
returns setof public.chat_messages
language sql
stable
security definer
set search_path = public
as $$
  select m.*
  from public.chat_messages m
  inner join public.chat_rooms cr on cr.id = m.room_id
  where cr.is_active is true
    and cr.room_code = nullif(btrim(p_room_code), '')
  order by m.created_at desc
  limit greatest(1, least(coalesce(nullif(p_limit, 0), 200), 500));
$$;

create or replace function public.get_chat_participants_by_room_code(p_room_code text)
returns setof public.chat_participants
language sql
stable
security definer
set search_path = public
as $$
  select p.*
  from public.chat_participants p
  inner join public.chat_rooms cr on cr.id = p.room_id
  where cr.is_active is true
    and cr.room_code = nullif(btrim(p_room_code), '')
    and p.is_active is true;
$$;

create or replace function public.get_chat_message_count_by_room_code(p_room_code text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.chat_messages m
  inner join public.chat_rooms cr on cr.id = m.room_id
  where cr.is_active is true
    and cr.room_code = nullif(btrim(p_room_code), '');
$$;

grant execute on function public.get_public_chat_room_bundle_by_code(text) to anon, authenticated;
grant execute on function public.get_chat_messages_by_room_code(text, integer) to anon, authenticated;
grant execute on function public.get_chat_participants_by_room_code(text) to anon, authenticated;
grant execute on function public.get_chat_message_count_by_room_code(text) to anon, authenticated;

comment on function public.get_public_chat_room_bundle_by_code(text) is
  '공개 투어 채팅: room_code·활성 방만. anon chat_rooms 직접 SELECT 대체.';
comment on function public.get_chat_messages_by_room_code(text, integer) is
  '공개 투어 채팅: room_code로 메시지 조회. anon chat_messages 직접 SELECT 대체.';
comment on function public.get_chat_participants_by_room_code(text) is
  '공개 투어 채팅: room_code로 참여자 조회. anon chat_participants 직접 SELECT 대체.';

commit;
