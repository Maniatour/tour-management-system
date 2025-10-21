# 수량 기반 다중 선택 숙박 초이스 시스템 사용 가이드

## 개요

수량 기반 다중 선택 시스템을 통해 고객이 여러 숙박 타입을 조합하여 예약할 수 있습니다. 예를 들어, 5인 가족이 2인실 1개 + 3인실 1개를 선택하는 것이 가능합니다.

## 주요 기능

### 1. 다중 선택 지원
- 여러 숙박 타입을 동시에 선택 가능
- 각 타입별로 수량 지정 가능
- 총 수용 인원이 예약 인원과 일치하는지 자동 검증

### 2. 자동 조합 제안
- "최적 조합 자동 선택" 버튼으로 효율적인 조합 자동 생성
- 인원당 가격이 가장 낮은 조합 우선 제안

### 3. 실시간 가격 계산
- 선택한 조합의 총 가격 실시간 계산
- 성인/아동/유아별 가격 적용

## 데이터베이스 구조

### Products 테이블 choices 구조
```json
{
  "required": [
    {
      "id": "accommodation_choice",
      "name": "Accommodation Choice",
      "name_ko": "숙박 선택",
      "type": "multiple_quantity",
      "description": "필요한 숙박 타입과 수량을 선택하세요",
      "validation": {
        "min_selections": 1,
        "max_selections": 10,
        "require_capacity_match": true
      },
      "options": [
        {
          "id": "single_room",
          "name": "1인 1실",
          "name_ko": "1인 1실",
          "adult_price": 50000,
          "child_price": 30000,
          "infant_price": 0,
          "capacity_per_room": 1,
          "max_quantity": 20
        }
      ]
    }
  ]
}
```

### Reservations 테이블 choices 구조
```json
{
  "required": [
    {
      "id": "accommodation_choice",
      "selections": [
        {
          "option_id": "double_room",
          "option": { /* 옵션 정보 */ },
          "quantity": 1,
          "total_capacity": 2,
          "total_price": 210000
        },
        {
          "option_id": "triple_room",
          "option": { /* 옵션 정보 */ },
          "quantity": 1,
          "total_capacity": 3,
          "total_price": 320000
        }
      ],
      "total_capacity": 5,
      "total_price": 530000,
      "timestamp": "2024-01-01T00:00:00Z"
    }
  ]
}
```

## 사용 방법

### 1. 상품 설정
```sql
-- 숙박 투어 상품에 수량 기반 다중 선택 초이스 추가
UPDATE products 
SET choices = jsonb_build_object(
  'required', jsonb_build_array(
    jsonb_build_object(
      'id', 'accommodation_choice',
      'name', 'Accommodation Choice',
      'name_ko', '숙박 선택',
      'type', 'multiple_quantity',
      'options', jsonb_build_array(
        -- 숙박 옵션들...
      )
    )
  )
)
WHERE id = 'YOUR_ACCOMMODATION_TOUR_PRODUCT_ID';
```

**주의사항**: 상품 가격은 `dynamic_pricing` 테이블에서 채널별, 날짜별로 관리되므로, `products` 테이블에는 `base_price`만 설정하고 실제 가격은 `choices` 옵션 내의 `adult_price`, `child_price`, `infant_price` 필드에 설정합니다.

### 2. 예약 생성
1. 상품 선택 시 자동으로 수량 기반 초이스 섹션이 표시됩니다
2. 필요한 숙박 타입을 체크박스로 선택합니다
3. 각 타입별로 수량을 지정합니다
4. "최적 조합 자동 선택" 버튼으로 자동 조합을 생성할 수 있습니다
5. 총 수용 인원이 예약 인원과 일치하는지 확인됩니다

### 3. 가격 계산
- 각 선택된 옵션의 가격 = 수량 × (성인가격 × 성인수 + 아동가격 × 아동수 + 유아가격 × 유아수)
- 총 가격 = 모든 선택된 옵션의 가격 합계

## 예시 시나리오

### 5인 가족 예약
- **예약 인원**: 성인 4명, 아동 1명 (총 5명)
- **선택 조합**: 2인실 1개 + 3인실 1개
- **가격 계산**:
  - 2인실: 1 × (80,000 × 2 + 50,000 × 1) = 210,000원
  - 3인실: 1 × (120,000 × 2 + 80,000 × 1) = 320,000원
  - **총 가격**: 530,000원

### 13인 단체 예약
- **예약 인원**: 성인 10명, 아동 3명 (총 13명)
- **선택 조합**: 4인실 3개 + 1인실 1개
- **가격 계산**:
  - 4인실: 3 × (150,000 × 10 + 100,000 × 3) = 1,800,000원
  - 1인실: 1 × (50,000 × 1) = 50,000원
  - **총 가격**: 1,850,000원

## 검증 규칙

### 1. 수용 인원 검증
- 선택한 숙박의 총 수용 인원 ≥ 예약 인원
- 부족한 경우 에러 메시지 표시

### 2. 선택 수량 제한
- 최소 선택 수량: 1개
- 최대 선택 수량: 10개 (설정 가능)

### 3. 개별 옵션 수량 제한
- 각 옵션별 최대 수량 제한 (예: 20개)

## 헬퍼 함수

### calculate_accommodation_total()
```sql
SELECT calculate_accommodation_total(
  selections_jsonb,
  adults_count,
  children_count,
  infants_count
) as total_price;
```

### validate_accommodation_capacity()
```sql
SELECT validate_accommodation_capacity(
  selections_jsonb,
  total_people_count
) as is_valid;
```

## 프론트엔드 컴포넌트

### QuantityBasedAccommodationSelector
- 수량 기반 다중 선택 UI 컴포넌트
- 체크박스 + 수량 입력
- 실시간 가격 계산 및 검증
- 자동 조합 제안 기능

### 주요 Props
- `choice`: 초이스 정보
- `adults`, `children`, `infants`: 예약 인원
- `totalPeople`: 총 예약 인원
- `onSelectionChange`: 선택 변경 콜백

## 주의사항

1. **상품 ID 변경**: 실제 사용 시 `ACCOMMODATION_TOUR_TEST`를 실제 상품 ID로 변경하세요
2. **가격 설정**: 각 숙박 타입의 가격을 실제 비즈니스 요구사항에 맞게 조정하세요
3. **수량 제한**: `max_quantity` 값을 적절히 설정하여 무제한 선택을 방지하세요
4. **검증 규칙**: `require_capacity_match`를 true로 설정하여 수용 인원 검증을 활성화하세요

## 문제 해결

### 일반적인 오류
1. **수용 인원 부족**: 더 많은 숙박을 선택하거나 수량을 늘리세요
2. **가격 계산 오류**: 성인/아동/유아 수가 올바른지 확인하세요
3. **선택 제한 초과**: 최대 선택 수량을 확인하세요

### 디버깅
- 브라우저 개발자 도구의 콘솔에서 선택 데이터 확인
- 데이터베이스에서 `choices` 컬럼의 JSON 구조 확인
- 헬퍼 함수로 가격 계산 및 검증 테스트
