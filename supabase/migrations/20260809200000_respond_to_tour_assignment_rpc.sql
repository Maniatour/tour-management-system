-- 배정된 가이드/어시스턴트가 tours.assignment_status 를 직접 UPDATE 할 수 없음
-- (tours_update_accessible = write position only).
-- 컨펌/거절은 security definer RPC 로만 허용하고, 본인 팝업도 함께 ack 한다.
-- 컨펌: 다른 수신자 미응답 팝업이 있으면 투어는 assigned 유지(본인 버튼만 숨김), 없으면 confirmed.

create or replace function public.respond_to_tour_assignment(
  p_tour_id text,
  p_decision text,
  p_recipient_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_decision text := lower(trim(coalesce(p_decision, '')));
  v_tour public.tours%rowtype;
  v_actor_emails text[];
  v_ack_emails text[];
  v_recipient text := lower(trim(coalesce(p_recipient_email, '')));
  v_is_assigned boolean := false;
  v_can_write boolean := false;
  v_now timestamptz := now();
  v_other_pending int := 0;
  v_new_status text;
begin
  if p_tour_id is null or length(trim(p_tour_id)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'tour_id_required');
  end if;

  if v_decision not in ('confirmed', 'rejected') then
    return jsonb_build_object('ok', false, 'error', 'invalid_decision');
  end if;

  select * into v_tour
  from public.tours
  where id = trim(p_tour_id)
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'tour_not_found');
  end if;

  v_actor_emails := public.tours_actor_emails();
  v_can_write := public.tours_write_position_ok();

  if length(v_recipient) > 0 then
    if not (v_recipient = any (v_actor_emails) or v_can_write) then
      return jsonb_build_object('ok', false, 'error', 'not_allowed');
    end if;
    v_is_assigned :=
      v_recipient = any (public.tours_normalize_email_list(v_tour.tour_guide_id))
      or v_recipient = any (public.tours_normalize_email_list(v_tour.assistant_id));
    if not v_is_assigned then
      return jsonb_build_object('ok', false, 'error', 'not_assigned');
    end if;
    v_ack_emails := array[v_recipient];
  else
    v_is_assigned := exists (
      select 1
      from unnest(v_actor_emails) as actor(email)
      where actor.email = any (public.tours_normalize_email_list(v_tour.tour_guide_id))
         or actor.email = any (public.tours_normalize_email_list(v_tour.assistant_id))
    );
    if not v_is_assigned and not v_can_write then
      return jsonb_build_object('ok', false, 'error', 'not_allowed');
    end if;
    v_ack_emails := v_actor_emails;
  end if;

  update public.guide_schedule_confirm_popups p
  set acknowledged_at = coalesce(p.acknowledged_at, v_now)
  where p.tour_id = v_tour.id
    and p.acknowledged_at is null
    and lower(trim(p.recipient_email)) = any (v_ack_emails);

  -- 팝업 미발송 상태에서도 본인 응답 기록이 남도록 stub ack 생성
  insert into public.guide_schedule_confirm_popups (
    tour_id,
    recipient_email,
    recipient_role,
    title,
    site_message_body,
    sms_body,
    acknowledged_at,
    sms_status,
    sms_error
  )
  select
    v_tour.id,
    e.email,
    case
      when e.email = any (public.tours_normalize_email_list(v_tour.assistant_id))
        and not (e.email = any (public.tours_normalize_email_list(v_tour.tour_guide_id)))
      then 'assistant'
      else 'guide'
    end,
    'Assignment response',
    'Responded from guide dashboard',
    '',
    v_now,
    'skipped',
    'client_response_stub'
  from unnest(v_ack_emails) as e(email)
  where (
      e.email = any (public.tours_normalize_email_list(v_tour.tour_guide_id))
      or e.email = any (public.tours_normalize_email_list(v_tour.assistant_id))
    )
    and not exists (
      select 1
      from public.guide_schedule_confirm_popups p2
      where p2.tour_id = v_tour.id
        and lower(trim(p2.recipient_email)) = e.email
    );

  if lower(trim(coalesce(v_tour.assignment_status, ''))) in ('confirmed', 'rejected') then
    return jsonb_build_object(
      'ok', true,
      'assignment_status', lower(trim(v_tour.assignment_status)),
      'already_final', true,
      'personal_responded', true
    );
  end if;

  if v_decision = 'rejected' then
    v_new_status := 'rejected';
  elsif v_can_write and length(v_recipient) = 0 then
    -- 스케줄뷰 등 관리자 직접 변경: 다른 미응답과 무관하게 즉시 반영
    v_new_status := 'confirmed';
  else
    select count(*)::int into v_other_pending
    from public.guide_schedule_confirm_popups p
    where p.tour_id = v_tour.id
      and p.acknowledged_at is null
      and not (lower(trim(p.recipient_email)) = any (v_ack_emails));

    -- 다른 배정 스태프 미응답 팝업이 있으면 assigned 유지 (본인은 personal_responded 로 버튼 숨김)
    if v_other_pending > 0 then
      v_new_status := 'assigned';
    else
      v_new_status := 'confirmed';
    end if;
  end if;

  if v_new_status is distinct from lower(trim(coalesce(v_tour.assignment_status, ''))) then
    update public.tours
    set assignment_status = v_new_status
    where id = v_tour.id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'assignment_status', v_new_status,
    'already_final', false,
    'personal_responded', true
  );
end;
$$;

comment on function public.respond_to_tour_assignment(text, text, text) is
  '배정 스태프 확정/거절. 본인 팝업 ack. 전원 응답 시 confirmed, 거절 즉시 rejected.';

revoke all on function public.respond_to_tour_assignment(text, text, text) from public;
grant execute on function public.respond_to_tour_assignment(text, text, text) to authenticated;
grant execute on function public.respond_to_tour_assignment(text, text, text) to service_role;

-- 본인이 ack 한 투어 id 목록 (관리자 시뮬레이션 시 recipient 지정 조회 허용)
create or replace function public.list_personally_responded_tour_ids(
  p_recipient_email text
)
returns text[]
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_recipient text := lower(trim(coalesce(p_recipient_email, '')));
  v_actor_emails text[] := public.tours_actor_emails();
begin
  if length(v_recipient) = 0 then
    return array[]::text[];
  end if;

  if not (v_recipient = any (v_actor_emails) or public.tours_write_position_ok()) then
    return array[]::text[];
  end if;

  return coalesce(
    (
      select array_agg(distinct p.tour_id)
      from public.guide_schedule_confirm_popups p
      where lower(trim(p.recipient_email)) = v_recipient
        and p.acknowledged_at is not null
    ),
    array[]::text[]
  );
end;
$$;

comment on function public.list_personally_responded_tour_ids(text) is
  '가이드 스케줄 컨펌에 이미 응답한 tour_id 목록. 본인 또는 write position만 조회.';

revoke all on function public.list_personally_responded_tour_ids(text) from public;
grant execute on function public.list_personally_responded_tour_ids(text) to authenticated;
grant execute on function public.list_personally_responded_tour_ids(text) to service_role;
