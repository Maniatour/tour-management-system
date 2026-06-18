-- 팀원 이메일 전역 변경
-- pocketace@yahoo.com → chrischong517@gmail.com
--
-- team.email 은 PK + FK 참조 → INSERT(새 이메일) → 참조 UPDATE → DELETE(구 이메일)
-- 존재하지 않는 테이블/컬럼은 자동으로 건너뜁니다.
--
-- Supabase SQL Editor에서 실행하세요.

CREATE OR REPLACE FUNCTION pg_temp.update_team_member_email_in_column(
  p_qualified_table text,
  p_column text,
  p_new_email text,
  p_old_lower text
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF to_regclass(p_qualified_table) IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = split_part(p_qualified_table, '.', 1)
      AND c.table_name = split_part(p_qualified_table, '.', 2)
      AND c.column_name = p_column
  ) THEN
    RETURN;
  END IF;

  EXECUTE format(
    'UPDATE %s SET %I = $1 WHERE lower(%I) = $2',
    p_qualified_table,
    p_column,
    p_column
  ) USING p_new_email, p_old_lower;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.replace_team_member_email_in_column(
  p_qualified_table text,
  p_column text,
  p_new_email text,
  p_old_email text
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF to_regclass(p_qualified_table) IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = split_part(p_qualified_table, '.', 1)
      AND c.table_name = split_part(p_qualified_table, '.', 2)
      AND c.column_name = p_column
  ) THEN
    RETURN;
  END IF;

  EXECUTE format(
    'UPDATE %s SET %I = regexp_replace(%I, $1, $2, ''gi'') WHERE %I ILIKE ''%%'' || $1 || ''%%''',
    p_qualified_table,
    p_column,
    p_column,
    p_column
  ) USING p_old_email, p_new_email;
END;
$$;

BEGIN;

DO $$
DECLARE
  v_old_email constant text := 'pocketace@yahoo.com';
  v_new_email constant text := 'chrischong517@gmail.com';
  v_old_lower constant text := lower(v_old_email);
  v_new_lower constant text := lower(v_new_email);
  v_old_exists boolean;
  v_new_exists boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.team WHERE lower(email) = v_old_lower) INTO v_old_exists;
  SELECT EXISTS (SELECT 1 FROM public.team WHERE lower(email) = v_new_lower) INTO v_new_exists;

  IF NOT v_old_exists AND NOT v_new_exists THEN
    RAISE EXCEPTION 'team 테이블에 % 도 % 도 없습니다.', v_old_email, v_new_email;
  END IF;

  IF v_old_exists AND v_new_exists THEN
    RAISE EXCEPTION 'team 테이블에 % 와 % 가 모두 존재합니다. 중복 병합이 필요합니다.', v_old_email, v_new_email;
  END IF;

  -- 아직 마이그레이션 전: 새 team 행 생성
  IF v_old_exists AND NOT v_new_exists THEN
    INSERT INTO public.team (
      email,
      name_ko,
      name_en,
      phone,
      position,
      languages,
      avatar_url,
      is_active,
      hire_date,
      status,
      created_at,
      updated_at,
      emergency_contact,
      date_of_birth,
      ssn,
      personal_car_model,
      car_year,
      car_plate,
      bank_name,
      account_holder,
      bank_number,
      routing_number,
      cpr,
      cpr_acquired,
      cpr_expired,
      medical_report,
      medical_acquired,
      medical_expired,
      nick_name,
      display_name,
      home_address,
      cdl_driver_license,
      role_id
    )
    SELECT
      v_new_email,
      name_ko,
      name_en,
      phone,
      position,
      languages,
      avatar_url,
      is_active,
      hire_date,
      status,
      created_at,
      now(),
      emergency_contact,
      date_of_birth,
      ssn,
      personal_car_model,
      car_year,
      car_plate,
      bank_name,
      account_holder,
      bank_number,
      routing_number,
      cpr,
      cpr_acquired,
      cpr_expired,
      medical_report,
      medical_acquired,
      medical_expired,
      nick_name,
      display_name,
      home_address,
      cdl_driver_license,
      role_id
    FROM public.team
    WHERE lower(email) = v_old_lower;
  END IF;

  -- FK 참조 + 이메일 텍스트 컬럼 (테이블/컬럼 없으면 skip)
  PERFORM pg_temp.update_team_member_email_in_column('public.off_schedules', 'team_email', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.off_schedules', 'approved_by', v_new_email, v_old_lower);

  PERFORM pg_temp.update_team_member_email_in_column('public.tour_tip_shares', 'guide_email', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.tour_tip_shares', 'assistant_email', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.tour_tip_shares', 'op_email', v_new_email, v_old_lower);

  PERFORM pg_temp.update_team_member_email_in_column('public.op_shares', 'op_email', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.employee_hourly_rate_periods', 'employee_email', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.attendance_records', 'employee_email', v_new_email, v_old_lower);

  PERFORM pg_temp.replace_team_member_email_in_column('public.tours', 'tour_guide_id', v_new_email, v_old_email);
  PERFORM pg_temp.replace_team_member_email_in_column('public.tours', 'assistant_id', v_new_email, v_old_email);

  PERFORM pg_temp.update_team_member_email_in_column('public.monthly_attendance_stats', 'employee_email', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.office_meal_log', 'employee_email', v_new_email, v_old_lower);

  PERFORM pg_temp.update_team_member_email_in_column('public.payment_methods', 'user_email', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.payment_methods', 'created_by', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.payment_methods', 'updated_by', v_new_email, v_old_lower);

  PERFORM pg_temp.update_team_member_email_in_column('public.company_expenses', 'submit_by', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.company_expenses', 'approved_by', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.company_expenses', 'paid_by', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.company_expenses', 'created_by', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.company_expenses', 'updated_by', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.company_expenses', 'paid_to_employee_email', v_new_email, v_old_lower);

  PERFORM pg_temp.update_team_member_email_in_column('public.payment_records', 'submit_by', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.payment_records', 'confirmed_by', v_new_email, v_old_lower);

  PERFORM pg_temp.update_team_member_email_in_column('public.cash_transactions', 'created_by', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.cash_transaction_history', 'modified_by', v_new_email, v_old_lower);

  PERFORM pg_temp.update_team_member_email_in_column('public.reservation_expenses', 'submitted_by', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.reservation_expenses', 'audited_by', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.reservation_expenses', 'checked_by', v_new_email, v_old_lower);

  PERFORM pg_temp.update_team_member_email_in_column('public.ticket_bookings', 'submitted_by', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.ticket_bookings', 'deletion_requested_by', v_new_email, v_old_lower);

  PERFORM pg_temp.update_team_member_email_in_column('public.tour_hotel_bookings', 'submitted_by', v_new_email, v_old_lower);

  PERFORM pg_temp.update_team_member_email_in_column('public.tour_reports', 'user_email', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.guide_documents', 'user_email', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.todo_click_logs', 'user_email', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.op_todo_notifications', 'user_email', v_new_email, v_old_lower);

  PERFORM pg_temp.update_team_member_email_in_column('public.tasks', 'created_by', v_new_email, v_old_lower);

  PERFORM pg_temp.update_team_member_email_in_column('public.team_announcements', 'created_by', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.team_announcement_comments', 'created_by', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.team_announcement_acknowledgments', 'ack_by', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.team_board_comments', 'created_by', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.team_board_status_logs', 'changed_by', v_new_email, v_old_lower);

  PERFORM pg_temp.update_team_member_email_in_column('public.team_chat_rooms', 'created_by', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.team_chat_messages', 'sender_email', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.team_chat_participants', 'participant_email', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.team_chat_read_status', 'reader_email', v_new_email, v_old_lower);

  PERFORM pg_temp.update_team_member_email_in_column('public.tour_photos', 'uploaded_by', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.chat_rooms', 'created_by', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.chat_messages', 'sender_email', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.chat_bans', 'banned_by', v_new_email, v_old_lower);

  PERFORM pg_temp.update_team_member_email_in_column('public.email_logs', 'sent_by', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.audit_logs', 'user_email', v_new_email, v_old_lower);

  PERFORM pg_temp.update_team_member_email_in_column('public.tour_bonuses', 'guide_email', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.tour_bonuses', 'driver_email', v_new_email, v_old_lower);

  PERFORM pg_temp.update_team_member_email_in_column('public.product_schedules', 'assigned_guide_1', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.product_schedules', 'assigned_guide_2', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.product_schedules', 'assigned_driver', v_new_email, v_old_lower);

  PERFORM pg_temp.update_team_member_email_in_column('public.partner_funds', 'created_by', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.partner_funds_history', 'changed_by', v_new_email, v_old_lower);

  PERFORM pg_temp.update_team_member_email_in_column('public.company_sop_signatures', 'signer_email', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.company_sop_signatures', 'user_email', v_new_email, v_old_lower);

  PERFORM pg_temp.update_team_member_email_in_column('public.reservation_status_events', 'user_email', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.date_notes', 'created_by', v_new_email, v_old_lower);

  PERFORM pg_temp.update_team_member_email_in_column('public.report_email_schedules', 'created_by', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.report_email_schedules', 'updated_by', v_new_email, v_old_lower);

  PERFORM pg_temp.update_team_member_email_in_column('public.projects', 'created_by', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.issues', 'reported_by', v_new_email, v_old_lower);

  PERFORM pg_temp.update_team_member_email_in_column('public.estimates', 'sent_by', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.estimates', 'created_by', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.invoices', 'sent_by', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.invoices', 'created_by', v_new_email, v_old_lower);

  PERFORM pg_temp.update_team_member_email_in_column('public.reservation_pricing_audit_requests', 'requested_by_email', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.reservation_pricing_audit_requests', 'reviewed_by_email', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.reservation_pricing', 'audited_by_email', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.reconciliation_match_audit', 'actor_email', v_new_email, v_old_lower);
  PERFORM pg_temp.update_team_member_email_in_column('public.reconciliation_match_audit', 'updated_by', v_new_email, v_old_lower);

  -- 구 team 행 삭제 (이미 삭제됐으면 0건)
  DELETE FROM public.team
  WHERE lower(email) = v_old_lower;

  RAISE NOTICE 'team 및 참조 데이터 이메일 변경 완료: % → %', v_old_email, v_new_email;
END $$;

-- Supabase Auth (로그인 이메일)
UPDATE auth.users
SET
  email = 'chrischong517@gmail.com',
  raw_user_meta_data = jsonb_set(
    coalesce(raw_user_meta_data, '{}'::jsonb),
    '{email}',
    to_jsonb('chrischong517@gmail.com'::text)
  ),
  updated_at = now()
WHERE lower(email) = lower('pocketace@yahoo.com');

UPDATE auth.identities
SET
  identity_data = jsonb_set(
    identity_data,
    '{email}',
    to_jsonb('chrischong517@gmail.com'::text)
  ),
  updated_at = now()
WHERE lower(identity_data ->> 'email') = lower('pocketace@yahoo.com');

COMMIT;

-- ===== 실행 후 확인 =====
SELECT 'team' AS tbl, email FROM public.team WHERE lower(email) = lower('chrischong517@gmail.com');
SELECT 'auth.users' AS tbl, email FROM auth.users WHERE lower(email) = lower('chrischong517@gmail.com');

SELECT 'tours.guide' AS src, count(*) FROM public.tours WHERE tour_guide_id ILIKE '%pocketace@yahoo.com%'
UNION ALL
SELECT 'tours.assistant', count(*) FROM public.tours WHERE assistant_id ILIKE '%pocketace@yahoo.com%'
UNION ALL
SELECT 'off_schedules', count(*) FROM public.off_schedules WHERE lower(team_email) = lower('pocketace@yahoo.com')
UNION ALL
SELECT 'attendance', count(*) FROM public.attendance_records WHERE lower(employee_email) = lower('pocketace@yahoo.com');

-- 롤백이 필요하면 COMMIT 전에: ROLLBACK;
