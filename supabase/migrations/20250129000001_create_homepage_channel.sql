-- Create Homepage Channel
-- Migration: 20250129000001_create_homepage_channel
-- 
-- This migration creates a homepage channel for self channels.
-- The homepage channel is separate from the SELF integrated channel
-- which contains sub-channels like Kakaotalk, Blog, etc.

-- Check if homepage channel already exists
DO $$
DECLARE
    homepage_exists BOOLEAN;
BEGIN
    -- Check if a homepage channel already exists
    SELECT EXISTS(
        SELECT 1 FROM channels 
        WHERE id = 'M00001' 
           OR id = 'HOMEPAGE'
           OR (name ILIKE '%홈페이지%' OR name ILIKE '%homepage%' OR name ILIKE '%website%')
           AND category IN ('Own', 'Self')
           AND id != 'SELF'
    ) INTO homepage_exists;
    
    -- Create homepage channel if it doesn't exist
    IF NOT homepage_exists THEN
        -- Insert homepage channel with only required fields
        -- Optional fields (customer_website, admin_website) will be added if they exist
        INSERT INTO channels (
            id,
            name,
            type,
            category,
            website,
            commission,
            commission_percent,
            base_price,
            markup,
            status,
            description,
            pricing_type,
            sub_channels,
            created_at
        ) VALUES (
            'M00001',
            '홈페이지',
            'Website',
            'Own',
            NULL,  -- website URL (can be updated later)
            0.00,
            0.00,
            0.00,
            0.00,
            'active',
            '자체 홈페이지 채널',
            'separate',
            ARRAY[]::TEXT[],  -- No sub-channels for homepage
            NOW()
        )
        ON CONFLICT (id) DO NOTHING;
        
        -- Update customer_website and admin_website if columns exist
        -- (These columns may not exist in all database versions)
        BEGIN
            UPDATE channels 
            SET customer_website = NULL, 
                admin_website = NULL
            WHERE id = 'M00001';
        EXCEPTION WHEN undefined_column THEN
            -- Columns don't exist, skip update
            NULL;
        END;
        
        RAISE NOTICE 'Homepage channel created successfully';
    ELSE
        RAISE NOTICE 'Homepage channel already exists, skipping creation';
    END IF;
END $$;

-- Verify the homepage channel was created
SELECT 
    id,
    name,
    type,
    category,
    status,
    website
FROM channels
WHERE id = 'M00001'
   OR id = 'HOMEPAGE'
   OR ((name ILIKE '%홈페이지%' OR name ILIKE '%homepage%')
   AND category IN ('Own', 'Self')
   AND id != 'SELF');

