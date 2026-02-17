-- Add nick_name column to team table for short display names in tour tables
ALTER TABLE public.team ADD COLUMN IF NOT EXISTS nick_name VARCHAR(100);

COMMENT ON COLUMN team.nick_name IS '닉네임 (투어 테이블 등에서 간단히 표시할 이름)';
