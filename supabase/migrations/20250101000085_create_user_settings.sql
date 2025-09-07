-- Create user settings table for storing user preferences
-- Migration: 20250101000085_create_user_settings

CREATE TABLE IF NOT EXISTS user_settings (
    id TEXT DEFAULT gen_random_uuid()::text PRIMARY KEY,
    user_id TEXT NOT NULL, -- 사용자 ID (이메일 또는 사용자 식별자)
    setting_key VARCHAR(255) NOT NULL, -- 설정 키 (예: 'schedule_selected_products', 'schedule_selected_team_members')
    setting_value JSONB NOT NULL, -- 설정 값 (JSON 형태로 저장)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 사용자별 설정 키는 유일해야 함
    UNIQUE(user_id, setting_key)
);

-- 인덱스 생성
CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX idx_user_settings_setting_key ON user_settings(setting_key);

-- RLS 활성화
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- RLS 정책 (모든 사용자가 읽기/쓰기 가능)
CREATE POLICY "Enable all access for user_settings" ON user_settings FOR ALL USING (true);

-- 업데이트 시간 자동 갱신을 위한 트리거
CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_settings_updated_at_trigger
    BEFORE UPDATE ON user_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_user_settings_updated_at();
