-- Add target_positions to announcements for group-based targeting

ALTER TABLE public.team_announcements
  ADD COLUMN IF NOT EXISTS target_positions text[] DEFAULT '{}'::text[];

COMMENT ON COLUMN public.team_announcements.target_positions IS 'Target team positions (e.g., OP, tour guide); used to expand recipients at creation time';


