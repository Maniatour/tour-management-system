-- 서비스 롤 예약 UPDATE 가 added_by(최초 작성자)로 오인되지 않게 한다.
-- 픽업 안내 발송은 RPC 로 실제 발송자 이메일을 audit 에 남긴다.

CREATE OR REPLACE FUNCTION public.audit_trigger_function() RETURNS TRIGGER AS $$
DECLARE
    old_data JSONB;
    new_data JSONB;
    changed_fields TEXT[];
    field_name TEXT;
    current_user_email TEXT;
    audit_cause TEXT;
    user_agent_val TEXT;
BEGIN
    current_user_email := NULLIF(TRIM(COALESCE(current_setting('app.current_user_email', true), '')), '');

    IF current_user_email IS NULL THEN
        current_user_email := NULLIF(TRIM(COALESCE(auth.jwt() ->> 'email', '')), '');
    END IF;

    IF current_user_email IS NULL AND auth.uid() IS NOT NULL THEN
        SELECT NULLIF(TRIM(u.email), '')
          INTO current_user_email
          FROM auth.users u
         WHERE u.id = auth.uid();
    END IF;

    -- 예약 INSERT 만 added_by 폴백 (UPDATE 는 서비스 롤+added_by 오인 방지)
    IF current_user_email IS NULL AND TG_TABLE_NAME = 'reservations' AND TG_OP = 'INSERT' THEN
        current_user_email := NULLIF(TRIM(COALESCE(to_jsonb(NEW) ->> 'added_by', '')), '');
    END IF;

    IF current_user_email IS NULL THEN
        current_user_email := 'system';
    END IF;

    audit_cause := NULLIF(TRIM(COALESCE(current_setting('app.audit_cause', true), '')), '');
    user_agent_val := NULLIF(TRIM(COALESCE(current_setting('app.current_user_agent', true), '')), '');
    IF audit_cause IS NOT NULL THEN
        IF user_agent_val IS NULL THEN
            user_agent_val := 'cause:' || audit_cause;
        ELSIF position('cause:' in user_agent_val) = 0 THEN
            user_agent_val := user_agent_val || '; cause:' || audit_cause;
        END IF;
    END IF;

    old_data := '{}';
    new_data := '{}';
    changed_fields := '{}';

    IF TG_OP = 'DELETE' THEN
        old_data := to_jsonb(OLD);
        INSERT INTO audit_logs (
            table_name, record_id, action, old_values, new_values, changed_fields,
            user_email, ip_address, user_agent
        ) VALUES (
            TG_TABLE_NAME, OLD.id::TEXT, TG_OP, old_data, new_data, changed_fields,
            current_user_email, inet_client_addr(), user_agent_val
        );
        RETURN OLD;
    ELSIF TG_OP = 'INSERT' THEN
        new_data := to_jsonb(NEW);
        INSERT INTO audit_logs (
            table_name, record_id, action, old_values, new_values, changed_fields,
            user_email, ip_address, user_agent
        ) VALUES (
            TG_TABLE_NAME, NEW.id::TEXT, TG_OP, old_data, new_data, changed_fields,
            current_user_email, inet_client_addr(), user_agent_val
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        old_data := to_jsonb(OLD);
        new_data := to_jsonb(NEW);

        FOR field_name IN SELECT jsonb_object_keys(new_data) LOOP
            IF old_data->>field_name IS DISTINCT FROM new_data->>field_name THEN
                changed_fields := array_append(changed_fields, field_name);
            END IF;
        END LOOP;

        IF array_length(changed_fields, 1) > 0 THEN
            INSERT INTO audit_logs (
                table_name, record_id, action, old_values, new_values, changed_fields,
                user_email, ip_address, user_agent
            ) VALUES (
                TG_TABLE_NAME, NEW.id::TEXT, TG_OP, old_data, new_data, changed_fields,
                current_user_email, inet_client_addr(), user_agent_val
            );
        END IF;
        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth;

COMMENT ON FUNCTION public.audit_trigger_function() IS
  'Audit actor: app.current_user_email, JWT, auth.users; reservations.added_by only on INSERT; else system.';

-- 픽업 안내 발송 플래그 + 실제 발송자 audit (단일 트랜잭션)
CREATE OR REPLACE FUNCTION public.mark_pickup_notification_sent(
  p_reservation_id text,
  p_actor_email text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  actor text;
BEGIN
  actor := NULLIF(TRIM(COALESCE(p_actor_email, '')), '');
  IF actor IS NULL THEN
    actor := NULLIF(TRIM(COALESCE(auth.jwt() ->> 'email', '')), '');
  END IF;
  IF actor IS NULL AND auth.uid() IS NOT NULL THEN
    SELECT NULLIF(TRIM(u.email), '') INTO actor FROM auth.users u WHERE u.id = auth.uid();
  END IF;
  IF actor IS NULL THEN
    actor := 'system';
  END IF;

  PERFORM set_config('app.current_user_email', actor, true);
  PERFORM set_config('app.audit_cause', 'pickup_notification_email', true);

  UPDATE public.reservations
     SET pickup_notification_sent = true,
         updated_at = now()
   WHERE id = p_reservation_id;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_pickup_notification_sent(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_pickup_notification_sent(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_pickup_notification_sent(text, text) TO service_role;

COMMENT ON FUNCTION public.mark_pickup_notification_sent(text, text) IS
  'Set pickup_notification_sent=true and attribute audit to p_actor_email (not reservations.added_by).';
