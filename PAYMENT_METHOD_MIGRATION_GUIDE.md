# Payment Method 마이그레이션 가이드

## 개요

기존 시스템에서 `payment_records`, `company_expenses`, `reservation_expenses`, `tour_expenses` 등의 테이블에서 `payment_method` 필드에 "PAYM032" 같은 ID를 문자열로 저장했습니다. 이제 이 값들을 `payment_methods` 테이블과 연결하는 마이그레이션을 수행합니다.

## 마이그레이션 방법

### 방법 1: SQL 마이그레이션 (권장)

Supabase SQL Editor에서 다음 마이그레이션을 실행하세요:

```sql
-- supabase/migrations/20250203000002_migrate_existing_payment_methods.sql
```

이 마이그레이션은:
1. 모든 테이블에서 고유한 `payment_method` 값들을 수집
2. `payment_methods` 테이블에 없는 ID들을 자동으로 생성
3. `method_type`을 자동으로 감지 (cash, card, transfer, mobile, other)

### 방법 2: API를 통한 마이그레이션

#### 1. 마이그레이션 전 확인

```bash
GET /api/payment-methods/migrate
```

응답 예시:
```json
{
  "success": true,
  "total": 15,
  "toCreate": 10,
  "alreadyExist": 5,
  "methodsToCreate": ["PAYM032", "PAYM033", "현금", ...],
  "methodsAlreadyExist": ["PAYM001", "PAYM002", ...]
}
```

#### 2. 마이그레이션 실행

```bash
POST /api/payment-methods/migrate
```

응답 예시:
```json
{
  "success": true,
  "message": "총 15개의 payment_method 중 10개 생성, 5개 건너뜀",
  "total": 15,
  "created": 10,
  "skipped": 5,
  "errors": []
}
```

## 마이그레이션 동작 방식

### 1. 기존 데이터 수집

다음 테이블들에서 `payment_method` 값을 수집합니다:
- `payment_records`
- `company_expenses`
- `reservation_expenses`
- `tour_expenses`

### 2. 자동 생성 규칙

- **ID 형식**: 기존 `payment_method` 값이 그대로 `payment_methods.id`로 사용됩니다
  - 예: `PAYM032` → `id: "PAYM032"`

- **Method 이름**: ID에서 자동으로 생성
  - `PAYM032` → `method: "PAYM032"`
  - `현금` 또는 `cash` 포함 → `method: "현금"`
  - `계좌이체` 또는 `transfer` 포함 → `method: "계좌이체"`

- **Method Type**: 자동 감지
  - `cash`, `현금` 포함 → `method_type: "cash"`
  - `card`, `cc`, 4자리 숫자 → `method_type: "card"`
  - `transfer`, `이체`, `계좌` 포함 → `method_type: "transfer"`
  - `mobile`, `모바일` 포함 → `method_type: "mobile"`
  - 기타 → `method_type: "other"`

- **User Email**: `NULL` (고객용으로 간주, 필요시 수동 수정)

- **Status**: `active`

### 3. 중복 방지

이미 `payment_methods` 테이블에 존재하는 ID는 건너뜁니다.

## 마이그레이션 후 작업

### 1. 수동 수정이 필요한 경우

일부 payment_method는 자동 감지가 정확하지 않을 수 있습니다. Payment Method Manager에서 수동으로 수정하세요:

1. `/admin/payment-methods` 페이지 접속
2. 생성된 payment_method 확인
3. 필요시 `method`, `method_type`, `user_email` 등 수정

### 2. 기존 데이터와의 호환성

마이그레이션 후에도 기존 테이블의 `payment_method` 필드는 그대로 유지됩니다:
- `payment_records.payment_method = "PAYM032"`
- `payment_methods.id = "PAYM032"` (자동 생성됨)

이제 두 값이 연결되어 있습니다.

### 3. 향후 사용

새로운 데이터 입력 시:
- `PaymentRecordForm`에서 `payment_methods` 테이블의 ID를 선택
- 선택한 ID가 `payment_records.payment_method`에 저장됨
- `paymentMethodIntegration.resolvePaymentMethodName()`으로 ID를 이름으로 변환 가능

## 코드에서 사용

### Payment Method ID를 이름으로 변환

```typescript
import { paymentMethodMigration } from '@/lib/paymentMethodMigration'

// ID를 이름으로 변환
const methodName = await paymentMethodMigration.resolvePaymentMethodName('PAYM032')
// 결과: "PAYM032" 또는 payment_methods 테이블의 method 값
```

### Payment Method 존재 확인

```typescript
const exists = await paymentMethodMigration.validatePaymentMethodExists('PAYM032')
// 결과: true 또는 false
```

## 주의사항

1. **데이터 백업**: 마이그레이션 전에 데이터베이스 백업을 권장합니다.

2. **중복 실행**: 마이그레이션을 여러 번 실행해도 안전합니다 (중복 방지 로직 포함).

3. **수동 수정**: 자동 생성된 payment_method는 기본값으로 생성되므로, 필요시 수동으로 수정하세요.

4. **기존 데이터 유지**: 기존 테이블의 `payment_method` 필드는 변경되지 않습니다. 새로운 시스템과 호환되도록 연결만 됩니다.

## 관련 파일

- `supabase/migrations/20250203000002_migrate_existing_payment_methods.sql` - SQL 마이그레이션
- `src/lib/paymentMethodMigration.ts` - 마이그레이션 유틸리티
- `src/app/api/payment-methods/migrate/route.ts` - 마이그레이션 API
