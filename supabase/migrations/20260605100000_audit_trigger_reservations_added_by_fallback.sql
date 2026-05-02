-- 예약 가져오기(서비스 롤 insert) 등 JWT에 이메일이 없을 때 감사 로그 user_email이 비는 문제
-- reservations INSERT 시 added_by(등록자 이메일)를 작성자로 기록

CREATE OR REPLACE FUNCTION audit_trigger_function() RETURNS TRIGGER AS $$
DECLARE
    old_data JSONB;
    new_data JSONB;
    changed_fields TEXT[];
    field_name TEXT;
    current_user_email TEXT;
BEGIN
    current_user_email := NULLIF(TRIM(COALESCE(current_setting('app.current_user_email', true), '')), '');
    IF current_user_email IS NULL THEN
        current_user_email := NULLIF(TRIM(COALESCE(auth.jwt() ->> 'email', '')), '');
    END IF;

    -- 서비스 롤 등: 예약 생성 행의 added_by를 감사 로그 작성자로 사용
    IF current_user_email IS NULL AND TG_TABLE_NAME = 'reservations' AND TG_OP = 'INSERT' THEN
        current_user_email := NULLIF(TRIM(COALESCE(to_jsonb(NEW) ->> 'added_by', '')), '');
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

COMMENT ON FUNCTION audit_trigger_function() IS 'Audit: user_email from app.current_user_email, auth.jwt() email, or reservations.added_by on INSERT when JWT empty (e.g. service role import)';
