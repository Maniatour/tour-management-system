-- i18n 번역 관리를 위한 테이블 생성

-- 1. translations 테이블 생성 (번역 마스터)
CREATE TABLE IF NOT EXISTS translations (
  id TEXT PRIMARY KEY,
  namespace VARCHAR(100) NOT NULL, -- 'common', 'options', 'tagTranslations' 등
  key_path TEXT NOT NULL, -- 'title', 'add', 'form.name' 등
  is_system BOOLEAN DEFAULT false, -- 시스템 번역인지 여부
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(namespace, key_path)
);

-- 2. translation_values 테이블 생성 (실제 번역 값)
CREATE TABLE IF NOT EXISTS translation_values (
  id TEXT PRIMARY KEY,
  translation_id TEXT REFERENCES translations(id) ON DELETE CASCADE,
  locale VARCHAR(10) NOT NULL, -- 'ko', 'en', 'ja' 등
  value TEXT NOT NULL, -- 실제 번역 텍스트
  notes TEXT, -- 메모 (선택사항)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(translation_id, locale)
);

-- 3. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_translations_namespace ON translations(namespace);
CREATE INDEX IF NOT EXISTS idx_translations_key_path ON translations(key_path);
CREATE INDEX IF NOT EXISTS idx_translation_values_translation_id ON translation_values(translation_id);
CREATE INDEX IF NOT EXISTS idx_translation_values_locale ON translation_values(locale);

-- 4. 트리거 함수: updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_translation_values_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_translation_values_updated_at
  BEFORE UPDATE ON translation_values
  FOR EACH ROW
  EXECUTE FUNCTION update_translation_values_updated_at();

-- 5. 뷰 생성
CREATE OR REPLACE VIEW translations_with_values AS
SELECT 
  t.id,
  t.namespace,
  t.key_path,
  t.is_system,
  t.created_at as translation_created_at,
  tv.locale,
  tv.value,
  tv.notes,
  tv.updated_at as value_updated_at
FROM translations t
LEFT JOIN translation_values tv ON t.id = tv.translation_id;

-- 6. RLS 정책 설정
ALTER TABLE translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE translation_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view translations" ON translations FOR SELECT USING (true);
CREATE POLICY "Anyone can view translation_values" ON translation_values FOR SELECT USING (true);
CREATE POLICY "Admins can manage translations" ON translations FOR ALL USING (true);
CREATE POLICY "Admins can manage translation_values" ON translation_values FOR ALL USING (true);

-- 7. 샘플 데이터 삽입 (기존 i18n의 일부 키)
INSERT INTO translations (id, namespace, key_path, is_system) VALUES
  (gen_random_uuid()::text, 'common', 'title', true),
  (gen_random_uuid()::text, 'common', 'home', true),
  (gen_random_uuid()::text, 'common', 'dashboard', true),
  (gen_random_uuid()::text, 'tagTranslations', 'title', false),
  (gen_random_uuid()::text, 'tagTranslations', 'addTag', false)
ON CONFLICT (namespace, key_path) DO NOTHING;

-- 8. 한국어 번역 삽입
INSERT INTO translation_values (id, translation_id, locale, value)
SELECT 
  gen_random_uuid()::text,
  t.id,
  'ko',
  CASE 
    WHEN t.namespace = 'common' AND t.key_path = 'title' THEN 'MANIA TOUR'
    WHEN t.namespace = 'common' AND t.key_path = 'home' THEN '홈'
    WHEN t.namespace = 'common' AND t.key_path = 'dashboard' THEN '대시보드'
    WHEN t.namespace = 'tagTranslations' AND t.key_path = 'title' THEN '태그 번역 관리'
    WHEN t.namespace = 'tagTranslations' AND t.key_path = 'addTag' THEN '새 태그 추가'
  END
FROM translations t
WHERE t.namespace IN ('common', 'tagTranslations')
  AND t.key_path IN ('title', 'home', 'dashboard', 'addTag')
ON CONFLICT (translation_id, locale) DO NOTHING;

-- 9. 영어 번역 삽입
INSERT INTO translation_values (id, translation_id, locale, value)
SELECT 
  gen_random_uuid()::text,
  t.id,
  'en',
  CASE 
    WHEN t.namespace = 'common' AND t.key_path = 'title' THEN 'MANIA TOUR'
    WHEN t.namespace = 'common' AND t.key_path = 'home' THEN 'Home'
    WHEN t.namespace = 'common' AND t.key_path = 'dashboard' THEN 'Dashboard'
    WHEN t.namespace = 'tagTranslations' AND t.key_path = 'title' THEN 'Tag Translation Management'
    WHEN t.namespace = 'tagTranslations' AND t.key_path = 'addTag' THEN 'Add New Tag'
  END
FROM translations t
WHERE t.namespace IN ('common', 'tagTranslations')
  AND t.key_path IN ('title', 'home', 'dashboard', 'addTag')
ON CONFLICT (translation_id, locale) DO NOTHING;

