-- Deactivate chat rooms for tours that have passed
-- This will set is_active = false for chat rooms where the tour date is in the past

begin;

-- Update chat rooms to inactive where tour date has passed
UPDATE public.chat_rooms 
SET 
  is_active = false,
  updated_at = NOW()
WHERE 
  is_active = true 
  AND tour_id IN (
    SELECT t.id 
    FROM public.tours t 
    WHERE t.tour_date < CURRENT_DATE
  );

-- Log the number of updated chat rooms
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % chat rooms to inactive for past tours', updated_count;
END $$;

commit;
