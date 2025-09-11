-- Temporarily disable RLS for debugging
-- Migration: 20250101000108_disable_rls_temporarily

-- Disable RLS on vehicles table temporarily
ALTER TABLE vehicles DISABLE ROW LEVEL SECURITY;

-- Disable RLS on chat_rooms table temporarily  
ALTER TABLE chat_rooms DISABLE ROW LEVEL SECURITY;

-- Disable RLS on chat_messages table temporarily
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;

-- Disable RLS on chat_participants table temporarily
ALTER TABLE chat_participants DISABLE ROW LEVEL SECURITY;

-- Add comment
COMMENT ON TABLE vehicles IS 'RLS temporarily disabled for debugging';
COMMENT ON TABLE chat_rooms IS 'RLS temporarily disabled for debugging';
COMMENT ON TABLE chat_messages IS 'RLS temporarily disabled for debugging';
COMMENT ON TABLE chat_participants IS 'RLS temporarily disabled for debugging';
