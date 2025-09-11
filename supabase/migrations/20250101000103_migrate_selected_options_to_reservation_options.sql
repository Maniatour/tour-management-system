-- Migrate selected_options JSONB data to reservation_options table
-- Migration: 20250101000103_migrate_selected_options_to_reservation_options

-- Function to migrate selected_options to reservation_options
CREATE OR REPLACE FUNCTION migrate_selected_options_to_reservation_options()
RETURNS INTEGER AS $$
DECLARE
    reservation_record RECORD;
    option_key TEXT;
    option_data JSONB;
    choice_id TEXT;
    choice_data JSONB;
    new_option_id TEXT;
    migrated_count INTEGER := 0;
BEGIN
    -- Loop through all reservations with selected_options
    FOR reservation_record IN 
        SELECT id, selected_options 
        FROM reservations 
        WHERE selected_options IS NOT NULL 
        AND selected_options != '{}'::jsonb
    LOOP
        -- Loop through each option in selected_options
        FOR option_key IN 
            SELECT jsonb_object_keys(reservation_record.selected_options)
        LOOP
            option_data := reservation_record.selected_options->option_key;
            
            -- Check if option_data is an array (old format) or object (new format)
            IF jsonb_typeof(option_data) = 'array' THEN
                -- Old format: array of choice IDs
                FOR choice_id IN 
                    SELECT jsonb_array_elements_text(option_data)
                LOOP
                    new_option_id := gen_random_uuid()::text;
                    
                    INSERT INTO reservation_options (
                        id,
                        reservation_id,
                        option_id,
                        ea,
                        price,
                        status
                    ) VALUES (
                        new_option_id,
                        reservation_record.id,
                        option_key,
                        1, -- Default quantity
                        0, -- Default price (will be updated from pricing data)
                        'active'
                    );
                    
                    migrated_count := migrated_count + 1;
                END LOOP;
            ELSIF jsonb_typeof(option_data) = 'object' THEN
                -- New format: object with choiceId, price, quantity
                new_option_id := gen_random_uuid()::text;
                
                INSERT INTO reservation_options (
                    id,
                    reservation_id,
                    option_id,
                    ea,
                    price,
                    status
                ) VALUES (
                    new_option_id,
                    reservation_record.id,
                    option_key,
                    COALESCE((option_data->>'quantity')::integer, 1),
                    COALESCE((option_data->>'price')::decimal, 0),
                    'active'
                );
                
                migrated_count := migrated_count + 1;
            END IF;
        END LOOP;
    END LOOP;
    
    RETURN migrated_count;
END;
$$ LANGUAGE plpgsql;

-- Execute the migration
SELECT migrate_selected_options_to_reservation_options() as migrated_records;

-- Drop the migration function
DROP FUNCTION migrate_selected_options_to_reservation_options();

-- Add comment
COMMENT ON TABLE reservation_options IS 'Migrated from selected_options JSONB data for Google Sheets compatibility';
