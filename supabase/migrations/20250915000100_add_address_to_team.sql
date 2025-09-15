-- Add address column to team table to match application usage

ALTER TABLE public.team
  ADD COLUMN IF NOT EXISTS address TEXT;

COMMENT ON COLUMN public.team.address IS '주소';


