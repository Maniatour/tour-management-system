-- 예약 수정 이력 등 audit_logs에 수정자(user_email)가 기록되도록 트리거 수정
-- app.current_user_email 세션 변수가 없을 때 auth.jwt() ->> 'email' 사용 (Supabase 클라이언트 로그인 시 JWT에 이메일 포함)

CREATE OR REPLACE FUNCTION audit_trigger_function() RETURNS TRIGGER AS $$
DECLARE
    old_data JSONB;
    new_data JSONB;
    changed_fields TEXT[];
    field_name TEXT;
    current_user_email TEXT;
BEGIN
    -- 수정자 이메일: 세션 변수 우선, 없으면 JWT 이메일 사용
    current_user_email := NULLIF(TRIM(COALESCE(current_setting('app.current_user_email', true), '')), '');
    IF current_user_email IS NULL THEN
        current_user_email := NULLIF(TRIM(COALESCE(auth.jwt() ->> 'email', '')), '');
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
            current_setting('app.current_user_agent', true)
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
            current_setting('app.current_user_agent', true)
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
                current_setting('app.current_user_agent', true)
            );
        END IF;
        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION audit_trigger_function() IS 'Audit trigger: records user_email from app.current_user_email or auth.jwt() email for reservation/edit history';
