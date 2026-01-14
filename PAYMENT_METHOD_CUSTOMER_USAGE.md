# Payment Method 고객 결제 내역 사용 가이드

## 개요

`payment_methods` 테이블을 고객의 결제 내역(`payment_records`)에서도 사용할 수 있도록 확장했습니다.

## 변경 사항

### 1. 데이터베이스 스키마 변경

- `payment_methods.user_email` 컬럼을 **nullable**로 변경
  - **직원용 결제 방법**: `user_email`에 직원 이메일 설정
  - **고객용 결제 방법**: `user_email`을 `NULL`로 설정

### 2. 사용 방법

#### 고객용 결제 방법 생성

1. **Payment Method Manager**에서 결제 방법 생성 시:
   - 사용자를 선택하지 않으면 → 고객용 결제 방법으로 생성됨 (`user_email = NULL`)
   - 사용자를 선택하면 → 직원용 결제 방법으로 생성됨 (`user_email = 선택한 사용자 이메일`)

2. **구글 시트 동기화**:
   - `User` 필드가 비어있거나 빈 값이면 → 고객용 결제 방법으로 생성
   - `User` 필드에 이메일이 있으면 → 직원용 결제 방법으로 생성

#### 고객 결제 내역에서 사용

`PaymentRecordForm` 컴포넌트에서 자동으로:
- 모든 활성 결제 방법을 표시 (직원용 + 고객용)
- 고객 결제 내역 입력 시 선택 가능

## 마이그레이션

다음 SQL을 Supabase에서 실행하세요:

```sql
-- supabase/migrations/20250203000001_make_payment_methods_user_email_nullable.sql
```

또는 직접 실행:

```sql
ALTER TABLE payment_methods 
  ALTER COLUMN user_email DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_methods_user_email_null 
  ON payment_methods(user_email) 
  WHERE user_email IS NULL;
```

## 예시

### 고객용 결제 방법 생성 예시

```typescript
// Payment Method Manager에서
{
  id: "PAYM-CUSTOMER-CASH",
  method: "현금",
  method_type: "cash",
  user_email: null,  // 고객용
  status: "active"
}
```

### 직원용 결제 방법 생성 예시

```typescript
{
  id: "PAYM-STAFF-CC4052",
  method: "CC 4052",
  method_type: "card",
  user_email: "staff@example.com",  // 직원용
  status: "active"
}
```

## API 사용

### 모든 결제 방법 조회 (직원용 + 고객용)

```typescript
const options = await paymentMethodIntegration.getPaymentMethodOptions(
  undefined,  // userEmail 없음
  true        // includeCustomerMethods = true
)
```

### 특정 직원의 결제 방법만 조회

```typescript
const options = await paymentMethodIntegration.getPaymentMethodOptions(
  "staff@example.com"  // 특정 직원 이메일
)
```

## 주의사항

1. **한도 관리**: 고객용 결제 방법은 일반적으로 한도 관리가 필요 없을 수 있습니다. 필요시 `limit_amount`, `monthly_limit`, `daily_limit`을 설정하세요.

2. **사용량 추적**: 고객용 결제 방법도 사용량 추적이 가능합니다. 필요에 따라 `current_month_usage`, `current_day_usage`를 업데이트할 수 있습니다.

3. **필터링**: 
   - 직원용만 조회: `user_email IS NOT NULL`
   - 고객용만 조회: `user_email IS NULL`
   - 모두 조회: 필터 없음

## 관련 파일

- `supabase/migrations/20250203000001_make_payment_methods_user_email_nullable.sql`
- `src/lib/paymentMethodIntegration.ts`
- `src/components/PaymentMethodManager.tsx`
- `src/components/PaymentRecordForm.tsx`
- `src/app/api/payment-methods/route.ts`
