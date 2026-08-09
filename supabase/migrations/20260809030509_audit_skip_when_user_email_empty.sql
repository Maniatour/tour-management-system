-- user_email 이 비어 있으면 감사 로그를 만들지 않는다.
-- 작성자: app.current_user_email → JWT email → auth.users.email → (reservations INSERT) added_by
-- 그래도 없으면 audit_logs INSERT 를 건너뛴다.
-- 기존 빈 로그 정리는 별도 배치(scripts)로 수행 — 대량 DELETE 타임아웃 방지.

CREATE OR REPLACE FUNCTION public.audit_trigger_function() RETURNS TRIGGER AS $$
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

    -- JWT에 email claim 이 없을 때 uid로 auth.users 조회
    IF current_user_email IS NULL AND auth.uid() IS NOT NULL THEN
        SELECT NULLIF(TRIM(u.email), '')
          INTO current_user_email
          FROM auth.users u
         WHERE u.id = auth.uid();
    END IF;

    -- 서비스 롤 예약 생성: added_by 를 작성자로 사용
    IF current_user_email IS NULL AND TG_TABLE_NAME = 'reservations' AND TG_OP = 'INSERT' THEN
        current_user_email := NULLIF(TRIM(COALESCE(to_jsonb(NEW) ->> 'added_by', '')), '');
    END IF;

    -- 작성자를 알 수 없으면 감사 로그를 남기지 않음
    IF current_user_email IS NULL THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        END IF;
        RETURN NEW;
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
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth;

COMMENT ON FUNCTION public.audit_trigger_function() IS
  'Audit: user_email required. Sources: app.current_user_email, JWT email, auth.users, reservations.added_by(INSERT). Skip insert when email unknown.';
