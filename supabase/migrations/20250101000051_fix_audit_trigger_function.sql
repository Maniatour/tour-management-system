-- Fix audit_trigger_function to handle mixed ID types
-- Migration: 20250101000051_fix_audit_trigger_function.sql

-- Update the audit_trigger_function to handle both UUID and TEXT record_id types
CREATE OR REPLACE FUNCTION audit_trigger_function() RETURNS TRIGGER AS $$
DECLARE
    old_data JSONB;
    new_data JSONB;
    changed_fields TEXT[];
    field_name TEXT;
BEGIN
    -- Initialize old_data and new_data
    old_data := '{}';
    new_data := '{}';
    changed_fields := '{}';

    -- Handle different trigger operations
    IF TG_OP = 'DELETE' THEN
        old_data := to_jsonb(OLD);
        -- For DELETE, we need to get the record_id from OLD
        -- Since record_id can be either UUID or TEXT, we'll cast it to TEXT
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
            current_setting('app.current_user_email', true),
            inet_client_addr(),
            current_setting('app.current_user_agent', true)
        );
        RETURN OLD;
    ELSIF TG_OP = 'INSERT' THEN
        new_data := to_jsonb(NEW);
        -- For INSERT, we need to get the record_id from NEW
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
            current_setting('app.current_user_email', true),
            inet_client_addr(),
            current_setting('app.current_user_agent', true)
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        old_data := to_jsonb(OLD);
        new_data := to_jsonb(NEW);
        
        -- Find changed fields
        FOR field_name IN SELECT jsonb_object_keys(new_data) LOOP
            IF old_data->>field_name IS DISTINCT FROM new_data->>field_name THEN
                changed_fields := array_append(changed_fields, field_name);
            END IF;
        END LOOP;
        
        -- Only log if there are actual changes
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
                current_setting('app.current_user_email', true),
                inet_client_addr(),
                current_setting('app.current_user_agent', true)
            );
        END IF;
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Add comment to document the fix
COMMENT ON FUNCTION audit_trigger_function() IS 'Updated audit trigger function to handle both UUID and TEXT record_id types by casting to TEXT';
