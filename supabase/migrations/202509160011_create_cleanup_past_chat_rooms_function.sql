-- Create a function to clean up chat rooms for tours that ended more than a week ago
-- This can be called periodically or manually

begin;

-- Function to deactivate chat rooms for tours that ended more than a week ago
CREATE OR REPLACE FUNCTION public.cleanup_past_tour_chat_rooms()
RETURNS TABLE(
  deactivated_count INTEGER,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- Update chat rooms to inactive where tour date was more than a week ago
  UPDATE public.chat_rooms 
  SET 
    is_active = false,
    updated_at = NOW()
  WHERE 
    is_active = true 
    AND tour_id IN (
      SELECT t.id 
      FROM public.tours t 
      WHERE t.tour_date < CURRENT_DATE - INTERVAL '7 days'
    );
  
  -- Get the number of updated rows
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  -- Return the result
  RETURN QUERY SELECT 
    updated_count,
    'Deactivated ' || updated_count || ' chat rooms for tours ended more than a week ago'::TEXT;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.cleanup_past_tour_chat_rooms() TO authenticated;

-- Create a scheduled job (if pg_cron extension is available)
-- This will run daily at 2 AM to clean up chat rooms for tours ended more than a week ago
-- Uncomment the following lines if you want to enable automatic cleanup:
/*
SELECT cron.schedule(
  'cleanup-past-chat-rooms',
  '0 2 * * *', -- Daily at 2 AM
  'SELECT public.cleanup_past_tour_chat_rooms();'
);
*/

commit;
