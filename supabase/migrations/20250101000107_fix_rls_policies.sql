-- Fix RLS policies for vehicles and chat_rooms tables
-- Migration: 20250101000107_fix_rls_policies

-- Enable RLS on vehicles table if not already enabled
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for vehicles table
CREATE POLICY "Enable all access for vehicles" ON vehicles FOR ALL USING (true);

-- Fix chat_rooms RLS policies (some might be missing)
-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Guides can view rooms they created" ON chat_rooms;
DROP POLICY IF EXISTS "Admins can view all rooms" ON chat_rooms;
DROP POLICY IF EXISTS "Public access for active rooms" ON chat_rooms;
DROP POLICY IF EXISTS "Guides can create rooms" ON chat_rooms;
DROP POLICY IF EXISTS "Admins can create rooms" ON chat_rooms;
DROP POLICY IF EXISTS "Guides can update their own rooms" ON chat_rooms;
DROP POLICY IF EXISTS "Admins can update all rooms" ON chat_rooms;

-- Recreate chat_rooms policies
CREATE POLICY "Enable all access for chat_rooms" ON chat_rooms FOR ALL USING (true);

-- Fix chat_messages RLS policies
DROP POLICY IF EXISTS "Guides can view messages in their rooms" ON chat_messages;
DROP POLICY IF EXISTS "Admins can view all messages" ON chat_messages;
DROP POLICY IF EXISTS "Public access for active room messages" ON chat_messages;
DROP POLICY IF EXISTS "Guides can insert messages" ON chat_messages;
DROP POLICY IF EXISTS "Admins can insert messages" ON chat_messages;
DROP POLICY IF EXISTS "Public can insert messages in active rooms" ON chat_messages;

-- Recreate chat_messages policies
CREATE POLICY "Enable all access for chat_messages" ON chat_messages FOR ALL USING (true);

-- Fix chat_participants RLS policies
DROP POLICY IF EXISTS "Guides can view participants in their rooms" ON chat_participants;
DROP POLICY IF EXISTS "Admins can view all participants" ON chat_participants;
DROP POLICY IF EXISTS "Public access for active room participants" ON chat_participants;
DROP POLICY IF EXISTS "Guides can manage participants" ON chat_participants;
DROP POLICY IF EXISTS "Admins can manage all participants" ON chat_participants;
DROP POLICY IF EXISTS "Public can manage participants in active rooms" ON chat_participants;

-- Recreate chat_participants policies
CREATE POLICY "Enable all access for chat_participants" ON chat_participants FOR ALL USING (true);

-- Add comments
COMMENT ON TABLE vehicles IS 'Vehicle management table with RLS enabled for all access';
COMMENT ON TABLE chat_rooms IS 'Chat rooms table with RLS enabled for all access';
COMMENT ON TABLE chat_messages IS 'Chat messages table with RLS enabled for all access';
COMMENT ON TABLE chat_participants IS 'Chat participants table with RLS enabled for all access';
