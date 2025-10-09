# 초이스 그룹 조합 가격 설정 기능

## 개요

동적 가격 설정에서 여러 그룹의 초이스 조합에 따른 가격을 설정할 수 있는 기능을 구현했습니다.

## 주요 기능

### 1. 그룹 조합 가격 설정
- 여러 초이스 그룹이 있을 때 각 그룹의 조합별로 가격을 설정할 수 있습니다
- 예: 앤텔롭캐년 그룹 + 호텔 그룹의 모든 조합에 대한 가격 설정
- Lower Antelope Canyon + 1인 1실, Lower Antelope Canyon + 2인 1실 등

### 2. 사용자 인터페이스
- "그룹 조합 가격으로" 버튼으로 모드 전환
- 조합 생성 버튼으로 자동 조합 생성
- 각 조합별로 성인/아동/유아 가격 입력

## 데이터베이스 스키마

### choice_combinations 테이블
```sql
CREATE TABLE choice_combinations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  pricing_rule_id UUID REFERENCES dynamic_pricing_rules(id) ON DELETE CASCADE,
  combination_key TEXT NOT NULL, -- 예: "antelope_lower+single_room"
  combination_name TEXT NOT NULL, -- 예: "Lower Antelope Canyon + 1인 1실"
  combination_name_ko TEXT, -- 예: "로어 앤텔로프 캐년 + 1인 1실"
  adult_price DECIMAL(10,2) DEFAULT 0,
  child_price DECIMAL(10,2) DEFAULT 0,
  infant_price DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(product_id, pricing_rule_id, combination_key)
);
```

## 설치 및 설정

### 1. 데이터베이스 테이블 생성
Supabase 대시보드의 SQL Editor에서 `create_choice_combinations_table.sql` 파일의 내용을 실행하세요.

### 2. 초이스 그룹 설정
1. 상품 편집 페이지의 "초이스 관리" 탭에서 그룹을 생성합니다
2. 각 그룹에 초이스 옵션을 추가합니다
3. 최소 2개 이상의 그룹이 있어야 조합 가격 설정이 가능합니다

### 3. 그룹 조합 가격 설정
1. 상품 편집 페이지의 "동적 가격" 탭으로 이동
2. 초이스 가격 설정 섹션에서 "그룹 조합 가격으로" 버튼 클릭
3. "조합 생성" 버튼을 클릭하여 모든 조합을 자동 생성
4. 각 조합별로 가격을 입력
5. 저장 버튼을 클릭하여 설정 저장

## 사용 예시

### 1박2일 투어 예시
- **앤텔롭캐년 그룹**: Lower Antelope Canyon, Antelope X Canyon
- **호텔 그룹**: 1인 1실, 2인 1실

생성되는 조합:
- Lower Antelope Canyon + 1인 1실
- Lower Antelope Canyon + 2인 1실  
- Antelope X Canyon + 1인 1실
- Antelope X Canyon + 2인 1실

각 조합별로 성인/아동/유아 가격을 개별 설정할 수 있습니다.

## 기술적 구현

### 프론트엔드
- `DynamicPricingManager.tsx`: 그룹 조합 가격 설정 UI
- `ChoiceGroup`, `ChoiceCombination` 타입 정의
- 조합 생성 알고리즘 구현

### 백엔드
- `choice_combinations` 테이블로 조합 데이터 저장
- RLS 정책으로 팀 기반 접근 제어
- 자동 업데이트 트리거

## 주의사항

1. **그룹 수 제한**: 최소 2개 이상의 그룹이 필요합니다
2. **조합 수**: 그룹 수가 많을 경우 조합 수가 기하급수적으로 증가할 수 있습니다
3. **성능**: 많은 조합이 있을 경우 UI 성능에 영향을 줄 수 있습니다
4. **데이터 일관성**: 조합 가격과 개별 초이스 가격은 별도로 관리됩니다

## 향후 개선사항

1. **조합 필터링**: 특정 조합만 활성화/비활성화
2. **가격 템플릿**: 기본 가격 템플릿 적용
3. **일괄 편집**: 여러 조합의 가격을 한 번에 수정
4. **가격 검증**: 조합 가격의 합리성 검증
