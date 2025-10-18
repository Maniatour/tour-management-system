-- consultation_workflow_steps 테이블에 리치 텍스트 필드 추가
-- 리치 텍스트 에디터에서 사용하는 필드들을 추가

-- 1. rich_description_ko 컬럼 추가 (한국어 리치 텍스트 설명)
ALTER TABLE consultation_workflow_steps 
ADD COLUMN IF NOT EXISTS rich_description_ko TEXT DEFAULT NULL;

-- 2. rich_description_en 컬럼 추가 (영어 리치 텍스트 설명)
ALTER TABLE consultation_workflow_steps 
ADD COLUMN IF NOT EXISTS rich_description_en TEXT DEFAULT NULL;

-- 3. links 컬럼 추가 (링크 정보)
ALTER TABLE consultation_workflow_steps 
ADD COLUMN IF NOT EXISTS links JSONB DEFAULT NULL;

-- 4. images 컬럼 추가 (이미지 정보)
ALTER TABLE consultation_workflow_steps 
ADD COLUMN IF NOT EXISTS images JSONB DEFAULT NULL;

-- 5. notes_ko 컬럼 추가 (한국어 메모)
ALTER TABLE consultation_workflow_steps 
ADD COLUMN IF NOT EXISTS notes_ko TEXT DEFAULT NULL;

-- 6. notes_en 컬럼 추가 (영어 메모)
ALTER TABLE consultation_workflow_steps 
ADD COLUMN IF NOT EXISTS notes_en TEXT DEFAULT NULL;

-- 7. tags 컬럼 추가 (태그 배열)
ALTER TABLE consultation_workflow_steps 
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT NULL;

-- 8. priority 컬럼 추가 (우선순위)
ALTER TABLE consultation_workflow_steps 
ADD COLUMN IF NOT EXISTS priority VARCHAR(10) DEFAULT 'medium' 
CHECK (priority IN ('low', 'medium', 'high'));

-- 9. estimated_time 컬럼 추가 (예상 소요 시간)
ALTER TABLE consultation_workflow_steps 
ADD COLUMN IF NOT EXISTS estimated_time INTEGER DEFAULT 0;

-- 컬럼 코멘트 추가
COMMENT ON COLUMN consultation_workflow_steps.rich_description_ko IS '한국어 리치 텍스트 설명 (HTML 형태)';
COMMENT ON COLUMN consultation_workflow_steps.rich_description_en IS '영어 리치 텍스트 설명 (HTML 형태)';
COMMENT ON COLUMN consultation_workflow_steps.links IS '링크 정보 (JSON 배열)';
COMMENT ON COLUMN consultation_workflow_steps.images IS '이미지 정보 (JSON 배열)';
COMMENT ON COLUMN consultation_workflow_steps.notes_ko IS '한국어 메모';
COMMENT ON COLUMN consultation_workflow_steps.notes_en IS '영어 메모';
COMMENT ON COLUMN consultation_workflow_steps.tags IS '태그 배열';
COMMENT ON COLUMN consultation_workflow_steps.priority IS '우선순위 (low, medium, high)';
COMMENT ON COLUMN consultation_workflow_steps.estimated_time IS '예상 소요 시간 (분)';

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_workflow_steps_priority ON consultation_workflow_steps(priority);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_tags ON consultation_workflow_steps USING GIN(tags);

-- 확인 쿼리
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'consultation_workflow_steps' 
AND column_name IN ('rich_description_ko', 'rich_description_en', 'links', 'images', 'notes_ko', 'notes_en', 'tags', 'priority', 'estimated_time')
ORDER BY column_name;
