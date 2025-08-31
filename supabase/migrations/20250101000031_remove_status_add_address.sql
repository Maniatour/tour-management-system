-- Remove status column and add address column to team table
-- Since status and is_active are redundant, we'll keep is_active and remove status

-- Add address column
ALTER TABLE public.team ADD COLUMN IF NOT EXISTS address TEXT;

-- Remove status column
ALTER TABLE public.team DROP COLUMN IF EXISTS status;

-- Drop the status index since we're removing the column
DROP INDEX IF EXISTS idx_team_status;

-- Add comment for address column
COMMENT ON COLUMN team.address IS '주소 정보';

-- Update existing data to set address to NULL for now
UPDATE public.team SET address = NULL WHERE address IS NULL;
