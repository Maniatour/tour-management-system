-- Make phone field optional in team table
-- Update team table to make phone field nullable

-- First, update the existing team table to make phone nullable
ALTER TABLE public.team ALTER COLUMN phone DROP NOT NULL;

-- Update the comment to reflect that phone is now optional
COMMENT ON COLUMN team.phone IS '전화번호 (선택사항)';
