-- Add language column to push_subscriptions table
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'ko';

-- Create index for language
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_language ON push_subscriptions(language);

