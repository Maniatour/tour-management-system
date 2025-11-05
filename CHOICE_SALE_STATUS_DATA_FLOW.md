# 초이스별 판매 상태 데이터 관리 구조

## 데이터 저장 흐름

### 1. 사용자 액션 (초이스 달력 관리)
```
사용자가 초이스를 선택
  ↓
해당 초이스의 달력 표시
  ↓
날짜를 더블클릭하여 판매/마감 상태 토글
  ↓
즉시 저장
```

### 2. 코드 흐름

#### Step 1: SaleStatusModal (UI)
```typescript
// src/components/dynamic-pricing/SaleStatusModal.tsx

// 사용자가 날짜를 더블클릭
handleChoiceDateStatusToggle(date, currentStatus)
  ↓
// 로컬 상태 업데이트
choiceDateStatusMap[choiceId][date] = newStatus
  ↓
// onSave 콜백 호출
onSave([dateObj], 'sale', { [choiceId]: isSaleAvailable })
```

#### Step 2: DynamicPricingManager (비즈니스 로직)
```typescript
// src/components/DynamicPricingManager.tsx

handleSaveSaleStatus(dates, status, choiceStatusMap)
  ↓
// choices_pricing 구조 생성
choicesPricing[choiceId] = {
  adult_price,
  child_price,
  infant_price,
  is_sale_available: boolean
}
  ↓
// 각 날짜와 채널별로 저장
for (channelId of channelIds) {
  for (date of dates) {
    savePricingRule({
      product_id,
      channel_id: channelId,
      date,
      choices_pricing: choicesPricing
    })
  }
}
```

#### Step 3: useDynamicPricing Hook (데이터 저장)
```typescript
// src/hooks/useDynamicPricing.ts

savePricingRule(ruleData)
  ↓
// 기존 레코드 확인
SELECT id, choices_pricing FROM dynamic_pricing
WHERE product_id = ? AND channel_id = ? AND date = ?
  ↓
// 기존 choices_pricing과 병합
mergedChoicesPricing = {
  ...existingChoicesPricing,
  ...newChoicesPricing
}
  ↓
// UPSERT (UPDATE 또는 INSERT)
UPDATE dynamic_pricing SET choices_pricing = mergedChoicesPricing
WHERE id = existingId
```

### 3. 데이터베이스 구조

#### 테이블: `dynamic_pricing`
```sql
CREATE TABLE dynamic_pricing (
  id UUID PRIMARY KEY,
  product_id UUID,        -- 상품 ID
  channel_id UUID,        -- 채널 ID (예: 자체 채널, Viator 등)
  date DATE,              -- 날짜
  adult_price DECIMAL,    -- 성인 기본 가격
  child_price DECIMAL,    -- 아동 기본 가격
  infant_price DECIMAL,   -- 유아 기본 가격
  choices_pricing JSONB,  -- 초이스별 가격 및 판매 상태
  is_sale_available BOOLEAN, -- 전체 상품 판매 가능 여부
  ...
  UNIQUE(product_id, channel_id, date)  -- 유니크 제약조건
);
```

#### choices_pricing JSONB 구조
```json
{
  "choice_combination_id_1": {
    "adult_price": 100,
    "child_price": 80,
    "infant_price": 60,
    "is_sale_available": true
  },
  "choice_combination_id_2": {
    "adult_price": 120,
    "child_price": 100,
    "infant_price": 80,
    "is_sale_available": false
  }
}
```

### 4. 데이터 관리 방식

#### 유니크 키
- `(product_id, channel_id, date)` 조합이 유니크 키
- 같은 상품, 같은 채널, 같은 날짜에 대해 하나의 레코드만 존재

#### choices_pricing 병합 로직
- **기존 데이터 보존**: 기존 `choices_pricing`에 있던 다른 초이스 설정은 유지
- **새로운 설정 추가**: 새로 저장하는 초이스만 추가/업데이트
- **병합 방식**: `{ ...existingChoicesPricing, ...newChoicesPricing }`

#### 예시 시나리오

**시나리오 1: 처음 설정**
```
날짜: 2025-11-26
초이스: "로어 앤텔롭 캐년" → 마감

저장 결과:
{
  "lower_antelope_canyon": {
    "adult_price": 100,
    "child_price": 80,
    "infant_price": 60,
    "is_sale_available": false
  }
}
```

**시나리오 2: 추가 설정**
```
날짜: 2025-11-26 (기존 레코드 존재)
초이스: "앤텔롭 X 캐년" → 판매 가능

저장 결과:
{
  "lower_antelope_canyon": {
    "adult_price": 100,
    "child_price": 80,
    "infant_price": 60,
    "is_sale_available": false  // 기존 데이터 유지
  },
  "antelope_x_canyon": {
    "adult_price": 120,
    "child_price": 100,
    "infant_price": 80,
    "is_sale_available": true  // 새로 추가
  }
}
```

### 5. 데이터 조회 (고객용 부킹 플로우)

```typescript
// src/components/booking/BookingFlow.tsx

// 동적 가격 데이터 조회
SELECT date, is_sale_available, choices_pricing
FROM dynamic_pricing
WHERE product_id = ? AND date >= ?

// 초이스별 판매 상태 확인
choiceAvailability[date][choiceId] = choices_pricing[choiceId].is_sale_available

// 마감된 초이스 비활성화
if (!isChoiceCombinationAvailable(choiceId, optionId)) {
  // 옵션 비활성화 및 "마감" 뱃지 표시
}
```

### 6. 주요 특징

1. **날짜별 독립 관리**: 각 날짜마다 독립적으로 초이스별 판매 상태 설정 가능
2. **채널별 독립 관리**: 같은 날짜라도 채널별로 다른 설정 가능
3. **초이스별 독립 관리**: 같은 날짜에 여러 초이스를 각각 다른 상태로 설정 가능
4. **데이터 병합**: 기존 설정을 덮어쓰지 않고 병합하여 저장
5. **즉시 저장**: 달력에서 날짜를 더블클릭하면 즉시 저장 (실시간 반영)

### 7. 주의사항

- **데이터 손실 방지**: 기존 `choices_pricing`을 조회하여 병합해야 함
- **채널별 관리**: 채널을 선택하지 않으면 자체 채널에만 저장
- **날짜 범위**: 여러 날짜를 한 번에 설정할 수 있지만, 각 날짜별로 개별 레코드 생성

