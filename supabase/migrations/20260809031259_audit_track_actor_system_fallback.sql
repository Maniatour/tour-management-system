-- 빈 user_email 을 스킵하지 않고 'system' 으로 기록한다.
-- 가능하면 트리거한 사람(JWT / app.current_user_email / auth.users / added_by)을 추적한다.
-- 자동 투어 배정 등 연쇄 변경은 세션에 이메일을 전파하고, 없으면 system + audit_cause 를 남긴다.

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

    -- JWT에 email claim 이 없을 때 uid로 auth.users 조회
    IF current_user_email IS NULL AND auth.uid() IS NOT NULL THEN
        SELECT NULLIF(TRIM(u.email), '')
          INTO current_user_email
          FROM auth.users u
         WHERE u.id = auth.uid();
    END IF;

    -- 예약: added_by 를 작성자로 사용 (INSERT/UPDATE 모두)
    IF current_user_email IS NULL AND TG_TABLE_NAME = 'reservations' THEN
        current_user_email := NULLIF(TRIM(COALESCE(to_jsonb(NEW) ->> 'added_by', '')), '');
        IF current_user_email IS NULL AND TG_OP = 'DELETE' THEN
            current_user_email := NULLIF(TRIM(COALESCE(to_jsonb(OLD) ->> 'added_by', '')), '');
        END IF;
    END IF;

    -- 그래도 없으면 시스템 변경으로 기록 (로그를 버리지 않음)
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
            table_name,
            record_id,
            action,
            old_values,
            new_values,
            changed_fields,
            user_email,
            ip_address,
            user_agent
        ) VALUES (
            TG_TABLE_NAME,
            OLD.id::TEXT,
            TG_OP,
            old_data,
            new_data,
            changed_fields,
            current_user_email,
            inet_client_addr(),
            user_agent_val
        );
        RETURN OLD;
    ELSIF TG_OP = 'INSERT' THEN
        new_data := to_jsonb(NEW);
        INSERT INTO audit_logs (
            table_name,
            record_id,
            action,
            old_values,
            new_values,
            changed_fields,
            user_email,
            ip_address,
            user_agent
        ) VALUES (
            TG_TABLE_NAME,
            NEW.id::TEXT,
            TG_OP,
            old_data,
            new_data,
            changed_fields,
            current_user_email,
            inet_client_addr(),
            user_agent_val
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
                table_name,
                record_id,
                action,
                old_values,
                new_values,
                changed_fields,
                user_email,
                ip_address,
                user_agent
            ) VALUES (
                TG_TABLE_NAME,
                NEW.id::TEXT,
                TG_OP,
                old_data,
                new_data,
                changed_fields,
                current_user_email,
                inet_client_addr(),
                user_agent_val
            );
        END IF;
        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth;

COMMENT ON FUNCTION public.audit_trigger_function() IS
  'Audit: resolve actor via app.current_user_email, JWT, auth.users, reservations.added_by; fallback user_email=system (never skip). Optional app.audit_cause stored in user_agent.';

-- 예약 INSERT/UPDATE 시 자동 투어 배정: 트리거한 사람 이메일을 세션에 전파
CREATE OR REPLACE FUNCTION auto_create_or_update_tour()
RETURNS TRIGGER AS $$
DECLARE
    product_sub_category TEXT;
    existing_tour_id TEXT;
    new_tour_id TEXT;
    actor_email TEXT;
BEGIN
    actor_email := NULLIF(TRIM(COALESCE(current_setting('app.current_user_email', true), '')), '');
    IF actor_email IS NULL THEN
        actor_email := NULLIF(TRIM(COALESCE(auth.jwt() ->> 'email', '')), '');
    END IF;
    IF actor_email IS NULL AND auth.uid() IS NOT NULL THEN
        SELECT NULLIF(TRIM(u.email), '')
          INTO actor_email
          FROM auth.users u
         WHERE u.id = auth.uid();
    END IF;
    IF actor_email IS NULL THEN
        actor_email := NULLIF(TRIM(COALESCE(NEW.added_by, '')), '');
    END IF;

    IF actor_email IS NULL THEN
        PERFORM set_config('app.current_user_email', 'system', true);
        PERFORM set_config('app.audit_cause', 'auto_tour_assign', true);
    ELSE
        PERFORM set_config('app.current_user_email', actor_email, true);
        -- 사람이 트리거했지만 연쇄 투어 갱신임을 표시
        PERFORM set_config('app.audit_cause', 'auto_tour_assign', true);
    END IF;

    SELECT sub_category INTO product_sub_category
    FROM products
    WHERE id = NEW.product_id;

    IF product_sub_category IN ('Mania Tour', 'Mania Service') THEN
        SELECT id INTO existing_tour_id
        FROM tours
        WHERE product_id = NEW.product_id
          AND tour_date = NEW.tour_date
        LIMIT 1;

        IF existing_tour_id IS NOT NULL THEN
            UPDATE tours
            SET reservation_ids = CASE
                WHEN reservation_ids IS NOT NULL AND reservation_ids @> ARRAY[NEW.id::text] THEN reservation_ids
                WHEN reservation_ids IS NULL THEN ARRAY[NEW.id::text]
                ELSE array_append(reservation_ids, NEW.id::text)
            END
            WHERE id = existing_tour_id;

            UPDATE reservations
            SET tour_id = existing_tour_id
            WHERE id = NEW.id;
        ELSE
            INSERT INTO tours (
                product_id,
                tour_date,
                reservation_ids,
                tour_status
            ) VALUES (
                NEW.product_id,
                NEW.tour_date,
                ARRAY[NEW.id::text],
                'scheduled'
            ) RETURNING id INTO new_tour_id;

            UPDATE reservations
            SET tour_id = new_tour_id
            WHERE id = NEW.id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public, auth;

COMMENT ON FUNCTION auto_create_or_update_tour() IS
  'Auto-assign reservation to tour; propagates actor email (or system) + audit_cause=auto_tour_assign for nested audits.';
