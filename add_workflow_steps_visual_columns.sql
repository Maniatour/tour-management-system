-- consultation_workflow_steps 테이블에 시각적 스타일링 컬럼 추가
-- 프론트엔드에서 사용하는 node_color, text_color, node_shape 컬럼들을 추가

-- 1. node_color 컬럼 추가 (노드 배경색)
ALTER TABLE consultation_workflow_steps 
ADD COLUMN IF NOT EXISTS node_color VARCHAR(7) DEFAULT NULL;

-- 2. text_color 컬럼 추가 (텍스트 색상)
ALTER TABLE consultation_workflow_steps 
ADD COLUMN IF NOT EXISTS text_color VARCHAR(7) DEFAULT NULL;

-- 3. node_shape 컬럼 추가 (노드 모양)
ALTER TABLE consultation_workflow_steps 
ADD COLUMN IF NOT EXISTS node_shape VARCHAR(20) DEFAULT 'rectangle' 
CHECK (node_shape IN ('rectangle', 'rounded', 'diamond', 'oval', 'circle'));

-- 4. position 컬럼 추가 (노드 위치 정보)
ALTER TABLE consultation_workflow_steps 
ADD COLUMN IF NOT EXISTS position JSONB DEFAULT NULL;

-- 5. group_id 컬럼 추가 (노드 그룹핑)
ALTER TABLE consultation_workflow_steps 
ADD COLUMN IF NOT EXISTS group_id VARCHAR(50) DEFAULT NULL;

-- 컬럼 코멘트 추가
COMMENT ON COLUMN consultation_workflow_steps.node_color IS '워크플로우 노드 배경색 (HEX 코드)';
COMMENT ON COLUMN consultation_workflow_steps.text_color IS '워크플로우 노드 텍스트 색상 (HEX 코드)';
COMMENT ON COLUMN consultation_workflow_steps.node_shape IS '워크플로우 노드 모양 (rectangle, rounded, diamond, oval, circle)';
COMMENT ON COLUMN consultation_workflow_steps.position IS '워크플로우 노드 위치 정보 (JSON: {x, y})';
COMMENT ON COLUMN consultation_workflow_steps.group_id IS '워크플로우 노드 그룹 ID';

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_workflow_steps_group ON consultation_workflow_steps(group_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_shape ON consultation_workflow_steps(node_shape);

-- 기존 데이터에 기본값 설정
UPDATE consultation_workflow_steps 
SET node_shape = 'rectangle' 
WHERE node_shape IS NULL;

-- 확인 쿼리
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'consultation_workflow_steps' 
  AND column_name IN ('node_color', 'text_color', 'node_shape', 'position', 'group_id')
ORDER BY column_name;
