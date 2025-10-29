-- 태그 번역 관리를 위한 테이블 생성

-- 1. tags 테이블 생성 (태그 마스터)
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  key VARCHAR(255) UNIQUE NOT NULL, -- 영어 키 (예: 'popular', 'las_vegas')
  is_system BOOLEAN DEFAULT false, -- 시스템 태그인지 여부
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. tag_translations 테이블 생성 (태그 번역)
CREATE TABLE IF NOT EXISTS tag_translations (
  id TEXT PRIMARY KEY,
  tag_id TEXT REFERENCES tags(id) ON DELETE CASCADE,
  locale VARCHAR(10) NOT NULL, -- 'ko', 'en', 'ja' 등
  label VARCHAR(255) NOT NULL, -- 번역된 레이블
  pronunciation VARCHAR(255), -- 발음 (선택사항) - 예: "라스베이거스|라스베가스"
  notes TEXT, -- 메모 (선택사항)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tag_id, locale)
);

-- 3. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_tags_key ON tags(key);
CREATE INDEX IF NOT EXISTS idx_tag_translations_tag_id ON tag_translations(tag_id);
CREATE INDEX IF NOT EXISTS idx_tag_translations_locale ON tag_translations(locale);

-- 4. 기존 기본 태그들 삽입
INSERT INTO tags (id, key, is_system) VALUES
  (gen_random_uuid()::text, 'popular', true),
  (gen_random_uuid()::text, 'new', true),
  (gen_random_uuid()::text, 'hot', true),
  (gen_random_uuid()::text, 'recommended', true),
  (gen_random_uuid()::text, 'las_vegas', false),
  (gen_random_uuid()::text, 'grand_canyon', false)
ON CONFLICT (key) DO NOTHING;

-- 5. 기본 태그 번역 삽입
INSERT INTO tag_translations (id, tag_id, locale, label, pronunciation)
SELECT 
  gen_random_uuid()::text,
  t.id,
  'ko',
  CASE t.key
    WHEN 'popular' THEN '인기'
    WHEN 'new' THEN '신규'
    WHEN 'hot' THEN '인기순위'
    WHEN 'recommended' THEN '추천'
    WHEN 'las_vegas' THEN '라스베가스'
    WHEN 'grand_canyon' THEN '그랜드 캐니언'
  END,
  CASE t.key
    WHEN 'las_vegas' THEN '라스베가스|라스베이거스'
    ELSE NULL
  END
FROM tags t
ON CONFLICT (tag_id, locale) DO NOTHING;

INSERT INTO tag_translations (id, tag_id, locale, label)
SELECT 
  gen_random_uuid()::text,
  t.id,
  'en',
  CASE t.key
    WHEN 'popular' THEN 'Popular'
    WHEN 'new' THEN 'New'
    WHEN 'hot' THEN 'Trending'
    WHEN 'recommended' THEN 'Recommended'
    WHEN 'las_vegas' THEN 'Las Vegas'
    WHEN 'grand_canyon' THEN 'Grand Canyon'
  END
FROM tags t
ON CONFLICT (tag_id, locale) DO NOTHING;

-- 6. 뷰 생성 (태그 + 번역 조인)
CREATE OR REPLACE VIEW tags_with_translations AS
SELECT 
  t.id,
  t.key,
  t.is_system,
  t.created_at as tag_created_at,
  tt.locale,
  tt.label,
  tt.pronunciation,
  tt.notes,
  tt.updated_at as translation_updated_at
FROM tags t
LEFT JOIN tag_translations tt ON t.id = tt.tag_id;

-- 7. 트리거 함수: updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_tag_translations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_tag_translations_updated_at
  BEFORE UPDATE ON tag_translations
  FOR EACH ROW
  EXECUTE FUNCTION update_tag_translations_updated_at();

-- 8. RLS 정책 설정 (필요한 경우)
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_translations ENABLE ROW LEVEL SECURITY;

-- 관리자는 모든 태그 볼 수 있음
CREATE POLICY "Anyone can view tags" ON tags FOR SELECT USING (true);
CREATE POLICY "Anyone can view tag_translations" ON tag_translations FOR SELECT USING (true);

-- 관리자는 태그 생성/수정/삭제 가능
CREATE POLICY "Admins can manage tags" ON tags FOR ALL USING (true);
CREATE POLICY "Admins can manage tag_translations" ON tag_translations FOR ALL USING (true);
