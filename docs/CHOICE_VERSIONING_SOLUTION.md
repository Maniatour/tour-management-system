# 초이스 구조 변경 문제 해결 방안

## 문제 상황

### 시나리오
- **2025년 12월 31일까지**: 앤텔롭 캐년 초이스 그룹 하나 (Lower or X Canyon)
- **2026년 1월 1일부터**: 앤텔롭 캐년 초이스 그룹 + 국립공원 입장료 초이스 그룹 (2개)

### 발생하는 문제
1. **동적 가격 (`dynamic_pricing.choices_pricing`)**
   - 기존: `{choice_id_old}+option_1` 형식으로 저장
   - 초이스 수정 후: `choice_id`가 변경되어 기존 가격 데이터와 매칭 실패
   - 결과: 기존 날짜의 가격 정보 손실

2. **예약 데이터 (`reservation_choices`)**
   - 기존: `choice_id`, `option_id`로 저장
   - 초이스 수정 후: ID가 변경되어 예약과 매칭 실패
   - 결과: 예약 내역에서 초이스 정보 표시 불가

3. **인보이스 (`invoices.items`)**
   - 초이스 정보가 JSON으로 저장되어 있지만, 초이스 구조 변경 시 표시 문제 발생

## 해결 방안

### 1. 안정적인 식별자 사용 (이미 부분적으로 구현됨)

현재 시스템에는 이미 `choice_group_key`와 `option_key`가 있지만, `choices_pricing`에서 제대로 활용되지 않음.

#### 개선 사항:
- `dynamic_pricing.choices_pricing` 키 형식을 `{choice_id}+option_1` → `{choice_group_key}+{option_key}`로 변경
- 기존 데이터 마이그레이션 필요

### 2. 날짜별 초이스 버전 관리

초이스 구조가 변경되어도 기존 날짜의 데이터는 유지하고, 새로운 날짜부터 새 구조 적용.

#### 구현 방법:
- `product_choices`에 `valid_from_date`, `valid_to_date` 컬럼 추가 (선택사항)
- 또는 초이스 변경 시 기존 데이터를 보존하고 새 초이스를 추가만 함

### 3. 데이터 마이그레이션 전략

#### Step 1: 기존 `choices_pricing` 데이터 변환
```sql
-- dynamic_pricing.choices_pricing의 키를 안정적인 식별자로 변환
-- {choice_id}+option_1 → {choice_group_key}+{option_key}
```

#### Step 2: 예약 데이터 복구
```sql
-- reservation_choices의 choice_group, option_key가 이미 있으므로
-- 이를 활용하여 choice_id, option_id 복구
```

#### Step 3: 초이스 저장 로직 개선
- 초이스 저장 시 기존 초이스를 삭제하지 않고, `is_active` 플래그로 관리
- 또는 날짜 범위로 초이스 버전 관리

## 권장 해결책

### 즉시 적용 가능한 해결책

1. **`choices_pricing` 키 형식 변경**
   - `{choice_group_key}+{option_key}` 형식 사용
   - 기존 데이터 마이그레이션

2. **초이스 저장 로직 개선**
   - 기존 초이스 삭제 대신 `is_active = false` 처리
   - 새로운 초이스는 `is_active = true`로 추가

3. **데이터 조회 시 안정적인 식별자 우선 사용**
   - `choice_id` 매칭 실패 시 `choice_group_key` + `option_key`로 매칭

### 장기적 해결책

1. **초이스 버전 관리 시스템**
   - 초이스 변경 이력 추적
   - 날짜별로 유효한 초이스 구조 관리

2. **데이터 마이그레이션 도구**
   - 초이스 구조 변경 시 자동으로 기존 데이터 변환
   - 사용자 확인 후 실행

## 마이그레이션 스크립트

별도 파일로 제공: `supabase/migrations/YYYYMMDDHHMMSS_fix_choices_pricing_keys.sql`

