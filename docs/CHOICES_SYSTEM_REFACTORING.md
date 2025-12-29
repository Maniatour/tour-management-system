# 초이스 시스템 대대적 개선 가이드

## 문제점

1. **ID 기반 매칭의 한계**
   - `products`의 초이스를 수정하면 새로운 UUID가 생성됨
   - 예전 예약의 `reservation_choices`가 새로운 ID와 매칭되지 않음
   - `option_id`와 `choice_id`가 변경되어 데이터 손실 위험

2. **불필요한 테이블 존재**
   - 여러 번 변경되면서 생성된 불필요한 테이블/뷰 존재
   - `products.choices` JSONB 컬럼과 `reservation_choices` 테이블이 혼재

3. **식별자 혼란**
   - `choice_group`과 `choice_id`가 혼재되어 사용
   - `option_key`가 있지만 제대로 활용되지 않음

## 해결 방안

### 1. 안정적인 식별자 도입

- **`choice_group_key`**: 상품별 초이스 그룹의 안정적인 식별자
- **`option_key`**: 옵션의 안정적인 식별자
- **`reservation_choices`에 저장**: ID와 함께 안정적인 식별자도 저장

### 2. 구조 개선

```
product_choices
├── id (UUID) - 내부 참조용
├── product_id
├── choice_group_key (안정적인 식별자) ✅ NEW
├── choice_group_ko
└── choice_group_en

choice_options
├── id (UUID) - 내부 참조용
├── choice_id
├── option_key (안정적인 식별자) ✅ 기존
├── option_name
└── option_name_ko

reservation_choices
├── reservation_id
├── choice_id (UUID) - 빠른 조회용
├── option_id (UUID) - 빠른 조회용
├── choice_group (안정적인 식별자) ✅ NEW
├── option_key (안정적인 식별자) ✅ NEW
├── quantity
└── total_price
```

### 3. 매칭 전략

1. **1차**: `choice_id`와 `option_id`로 직접 매칭 (빠름)
2. **2차**: `choice_group`과 `option_key`로 매칭 (안정적)
3. **자동 복구**: ID가 변경되어 매칭 실패 시 안정적인 식별자로 복구

## 마이그레이션 단계

### Step 1: 마이그레이션 실행

```sql
-- 1. 안정적인 식별자 컬럼 추가 및 데이터 채우기
\i supabase/migrations/20250203000000_refactor_choices_system_with_stable_keys.sql

-- 2. 기존 데이터 복구
SELECT * FROM repair_reservation_choices();

-- 3. 불필요한 테이블 정리 (주의: 사용 여부 확인 후 실행)
\i supabase/migrations/20250203000001_cleanup_unused_choice_tables.sql
```

### Step 2: 코드 업데이트

#### ReservationForm.tsx

```typescript
// 기존: ID만 사용
const { data } = await supabase
  .from('reservation_choices')
  .select('choice_id, option_id, ...')

// 개선: 안정적인 식별자도 함께 사용
const { data } = await supabase
  .from('reservation_choices')
  .select('choice_id, option_id, choice_group, option_key, ...')
```

#### 매칭 로직 개선

```typescript
// 1차: ID로 매칭 (빠름)
if (rc.choice_id && rc.option_id) {
  const matched = allChoices.find(c => 
    c.id === rc.choice_id && 
    c.options.some(o => o.id === rc.option_id)
  )
}

// 2차: 안정적인 식별자로 매칭 (안정적)
if (!matched && rc.choice_group && rc.option_key) {
  const matched = allChoices.find(c => 
    c.choice_group_key === rc.choice_group && 
    c.options.some(o => o.option_key === rc.option_key)
  )
}
```

### Step 3: 데이터 검증

```sql
-- 1. 매칭 실패한 예약 확인
SELECT 
  rc.reservation_id,
  rc.choice_group,
  rc.option_key,
  r.product_id,
  COUNT(*) as count
FROM reservation_choices rc
JOIN reservations r ON r.id = rc.reservation_id
LEFT JOIN product_choices pc ON (
  pc.product_id = r.product_id 
  AND pc.choice_group_key = rc.choice_group
)
LEFT JOIN choice_options co ON (
  co.choice_id = pc.id 
  AND co.option_key = rc.option_key
)
WHERE pc.id IS NULL OR co.id IS NULL
GROUP BY rc.reservation_id, rc.choice_group, rc.option_key, r.product_id;

-- 2. 통계 확인
SELECT 
  COUNT(*) as total_reservations,
  COUNT(DISTINCT reservation_id) as unique_reservations,
  COUNT(*) FILTER (WHERE choice_group IS NOT NULL) as with_choice_group,
  COUNT(*) FILTER (WHERE option_key IS NOT NULL) as with_option_key
FROM reservation_choices;
```

## 주의사항

1. **백업 필수**: 마이그레이션 전 반드시 데이터베이스 백업
2. **단계별 실행**: 한 번에 모든 마이그레이션 실행하지 말고 단계별로 검증
3. **롤백 계획**: 문제 발생 시 롤백 방법 준비
4. **테스트 환경**: 먼저 테스트 환경에서 검증

## 향후 개선 사항

1. **`choice_group_key` 자동 생성**: `choice_group_ko`에서 자동 생성
2. **`option_key` 검증**: UNIQUE 제약 강화
3. **마이그레이션 모니터링**: 실패한 매칭 추적 및 알림
4. **자동 복구 스케줄**: 주기적으로 `repair_reservation_choices()` 실행

## 롤백 방법

```sql
-- 1. 추가된 컬럼 제거 (주의: 데이터 손실)
ALTER TABLE reservation_choices 
DROP COLUMN IF EXISTS choice_group,
DROP COLUMN IF EXISTS option_key;

ALTER TABLE product_choices 
DROP COLUMN IF EXISTS choice_group_key;

-- 2. 트리거 제거
DROP TRIGGER IF EXISTS trigger_auto_fill_choice_identifiers ON reservation_choices;
DROP FUNCTION IF EXISTS auto_fill_choice_identifiers();

-- 3. 함수 및 뷰 제거
DROP FUNCTION IF EXISTS repair_reservation_choices();
DROP VIEW IF EXISTS reservation_choices_with_names;
```

