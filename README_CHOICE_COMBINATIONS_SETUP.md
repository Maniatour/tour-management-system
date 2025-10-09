# 초이스 조합 테이블 생성 가이드

## 오류 해결

`dynamic_pricing_rules` 테이블이 존재하지 않아서 발생한 오류를 해결했습니다.

## 수정된 SQL 파일

`create_choice_combinations_table.sql` 파일을 다음과 같이 수정했습니다:

```sql
-- 기존 (오류 발생)
pricing_rule_id UUID REFERENCES dynamic_pricing_rules(id) ON DELETE CASCADE,

-- 수정 (올바른 테이블 참조)
pricing_rule_id UUID REFERENCES dynamic_pricing(id) ON DELETE CASCADE,
```

## 실행 방법

### 방법 1: Supabase 대시보드에서 실행

1. Supabase 대시보드에 로그인
2. 프로젝트 선택
3. SQL Editor로 이동
4. `create_choice_combinations_table.sql` 파일의 내용을 복사하여 실행

### 방법 2: 로컬 Supabase 실행 후 실행

```bash
# Supabase 시작
supabase start

# SQL 파일 실행
supabase db reset --local
```

### 방법 3: 직접 SQL 실행

Supabase 대시보드의 SQL Editor에서 다음 SQL을 실행:

```sql
-- 초이스 조합 가격 테이블 생성
CREATE TABLE IF NOT EXISTS choice_combinations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  pricing_rule_id UUID REFERENCES dynamic_pricing(id) ON DELETE CASCADE,
  combination_key TEXT NOT NULL,
  combination_name TEXT NOT NULL,
  combination_name_ko TEXT,
  adult_price DECIMAL(10,2) DEFAULT 0,
  child_price DECIMAL(10,2) DEFAULT 0,
  infant_price DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(product_id, pricing_rule_id, combination_key)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_choice_combinations_product_id ON choice_combinations(product_id);
CREATE INDEX IF NOT EXISTS idx_choice_combinations_pricing_rule_id ON choice_combinations(pricing_rule_id);
CREATE INDEX IF NOT EXISTS idx_choice_combinations_combination_key ON choice_combinations(combination_key);

-- RLS 활성화
ALTER TABLE choice_combinations ENABLE ROW LEVEL SECURITY;

-- RLS 정책 생성 (팀 기반 접근)
CREATE POLICY "choice_combinations_team_access" ON choice_combinations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM products p
      JOIN teams t ON p.team_id = t.id
      WHERE p.id = choice_combinations.product_id
      AND t.id = auth.jwt() ->> 'team_id'
    )
  );

-- 업데이트 시간 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_choice_combinations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_choice_combinations_updated_at
  BEFORE UPDATE ON choice_combinations
  FOR EACH ROW
  EXECUTE FUNCTION update_choice_combinations_updated_at();

-- 테이블 코멘트
COMMENT ON TABLE choice_combinations IS '초이스 그룹 조합별 가격 정보를 저장하는 테이블';
COMMENT ON COLUMN choice_combinations.combination_key IS '초이스 조합을 식별하는 키 (예: "antelope_lower+single_room")';
COMMENT ON COLUMN choice_combinations.combination_name IS '초이스 조합의 표시명 (영문)';
COMMENT ON COLUMN choice_combinations.combination_name_ko IS '초이스 조합의 표시명 (한글)';
```

## 확인 방법

테이블이 성공적으로 생성되었는지 확인:

```sql
-- 테이블 존재 확인
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'choice_combinations';

-- 테이블 구조 확인
\d choice_combinations;
```

## 다음 단계

테이블이 성공적으로 생성되면:

1. 동적 가격 설정에서 그룹 조합 가격 기능 사용 가능
2. 초이스 그룹이 2개 이상인 상품에서 조합 가격 설정 가능
3. 각 조합별로 성인/아동/유아 가격 개별 설정 가능

## 문제 해결

만약 여전히 오류가 발생한다면:

1. `dynamic_pricing` 테이블이 존재하는지 확인
2. `products` 테이블이 존재하는지 확인
3. 필요한 권한이 있는지 확인
4. Supabase 프로젝트 설정 확인
