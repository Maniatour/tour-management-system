-- Create chat_bans table for managing banned users in chat rooms
CREATE TABLE IF NOT EXISTS public.chat_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  client_id TEXT, -- For anonymous users (browser-based tracking)
  customer_name TEXT, -- For named customers
  banned_until TIMESTAMPTZ, -- Optional: temporary ban with expiration
  reason TEXT, -- Reason for the ban
  banned_by VARCHAR(255) NOT NULL, -- Who banned the user
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Ensure at least one identifier is provided
  CONSTRAINT check_ban_identifier CHECK (
    (client_id IS NOT NULL AND client_id != '') OR 
    (customer_name IS NOT NULL AND customer_name != '')
  )
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_bans_room_id ON public.chat_bans(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_bans_client_id ON public.chat_bans(client_id);
CREATE INDEX IF NOT EXISTS idx_chat_bans_customer_name ON public.chat_bans(customer_name);
CREATE INDEX IF NOT EXISTS idx_chat_bans_banned_until ON public.chat_bans(banned_until);

-- Enable RLS
ALTER TABLE public.chat_bans ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$ BEGIN
  -- Allow staff to manage bans
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_bans' AND policyname = 'chat_bans_staff_all') THEN
    CREATE POLICY "chat_bans_staff_all" ON public.chat_bans 
    FOR ALL TO authenticated 
    USING (public.is_staff(public.current_email())) 
    WITH CHECK (public.is_staff(public.current_email()));
  END IF;

  -- Allow public read access for checking bans (needed for customer-side ban checking)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_bans' AND policyname = 'chat_bans_public_read') THEN
    CREATE POLICY "chat_bans_public_read" ON public.chat_bans 
    FOR SELECT TO anon, authenticated 
    USING (true);
  END IF;
END $$;

-- Update trigger
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_chat_bans_updated_at') THEN
    CREATE TRIGGER update_chat_bans_updated_at 
    BEFORE UPDATE ON public.chat_bans 
    FOR EACH ROW 
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;
