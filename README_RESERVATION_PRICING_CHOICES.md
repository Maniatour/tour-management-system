# Reservation Pricing Choices 시스템 업데이트

## 개요

`reservation_pricing` 테이블을 `choices` 시스템에 맞게 업데이트하여, 기존의 `required_options`와 `required_option_total`을 `choices` 기반 가격 계산으로 변경했습니다.

## 주요 변경사항

### 1. 데이터베이스 스키마 변경

#### reservation_pricing 테이블에 추가된 컬럼:
- `choices` (JSONB): 선택된 choices와 가격 정보를 저장
- `choices_total` (DECIMAL): choices 기반 총 가격

#### 기존 컬럼 (deprecated):
- `required_options` (JSONB): 기존 방식의 필수 옵션 (보존됨)
- `required_option_total` (DECIMAL): 기존 방식의 총 가격 (보존됨)

### 2. 프론트엔드 변경사항

#### ReservationForm.tsx
- `calculateChoicesTotal()` 함수 추가: choices 기반 가격 계산
- `calculateSubtotal()` 함수 업데이트: choices 우선, 없으면 기존 방식 사용
- `savePricingInfo()` 함수 업데이트: choices 데이터 저장
- formData 타입에 `choices`와 `choicesTotal` 속성 추가

#### PricingSection.tsx
- choices 기반 가격 표시 업데이트
- `choicesTotal` 속성 지원 추가

#### 타입 정의 업데이트
- `PricingInfo` 인터페이스에 `choices`와 `choicesTotal` 추가
- `Reservation` 인터페이스에 `choices`와 `choicesTotal` 추가
- `database.types.ts`에 새로운 컬럼 타입 추가

## 사용법

### 1. 데이터베이스 마이그레이션

```sql
-- 스키마 업데이트
\i update_reservation_pricing_for_choices.sql

-- 기존 데이터 마이그레이션
\i migrate_reservation_pricing_to_choices.sql
```

### 2. 가격 계산 로직

#### 기존 방식 (required_options):
```javascript
const calculateRequiredOptionTotal = () => {
  // 기존 required_options 기반 계산
}
```

#### 새로운 방식 (choices):
```javascript
const calculateChoicesTotal = () => {
  // choices 기반 계산
  Object.entries(formData.choices).forEach(([choiceId, choiceData]) => {
    const adultPrice = (choice.adult_price || 0) * formData.adults
    const childPrice = (choice.child_price || 0) * formData.child
    const infantPrice = (choice.infant_price || 0) * formData.infant
    total += adultPrice + childPrice + infantPrice
  })
}
```

#### 하이브리드 방식 (subtotal 계산):
```javascript
const calculateSubtotal = () => {
  const choicesTotal = calculateChoicesTotal()
  const requiredOptionTotal = calculateRequiredOptionTotal()
  
  // choices가 있으면 choices를 우선 사용, 없으면 기존 requiredOptions 사용
  const optionTotal = choicesTotal > 0 ? choicesTotal : requiredOptionTotal
  
  return calculateProductPriceTotal() + optionTotal
}
```

### 3. 데이터 저장

```javascript
const pricingData = {
  // 기존 필드들...
  required_options: formData.requiredOptions,
  required_option_total: formData.requiredOptionTotal,
  
  // 새로운 필드들
  choices: formData.choices,
  choices_total: calculateChoicesTotal(),
  
  // subtotal은 choices 우선으로 계산됨
  subtotal: calculateSubtotal()
}
```

## 마이그레이션 전략

### 1. 단계적 마이그레이션
1. **스키마 업데이트**: 새로운 컬럼 추가
2. **데이터 마이그레이션**: 기존 데이터를 choices 형식으로 변환
3. **프론트엔드 업데이트**: 새로운 계산 로직 적용
4. **테스트**: 기존 데이터와 새로운 데이터 모두 정상 작동 확인

### 2. 하위 호환성
- 기존 `required_options` 데이터는 보존됨
- choices가 없으면 기존 방식으로 fallback
- 점진적으로 choices 시스템으로 전환 가능

### 3. 데이터 검증
```sql
-- 마이그레이션 결과 확인
SELECT 
    COUNT(*) as total_records,
    COUNT(CASE WHEN choices IS NOT NULL AND choices != '{}'::jsonb THEN 1 END) as records_with_choices,
    COUNT(CASE WHEN choices_total > 0 THEN 1 END) as records_with_choices_total,
    AVG(choices_total) as avg_choices_total
FROM reservation_pricing;
```

## 주의사항

1. **데이터 백업**: 마이그레이션 전에 데이터베이스 백업 필수
2. **테스트 환경**: 프로덕션 적용 전 테스트 환경에서 충분한 테스트
3. **롤백 계획**: 문제 발생 시 롤백할 수 있는 계획 수립
4. **성능 모니터링**: 새로운 인덱스와 쿼리 성능 모니터링

## 파일 구조

```
├── update_reservation_pricing_for_choices.sql    # 스키마 업데이트
├── migrate_reservation_pricing_to_choices.sql    # 데이터 마이그레이션
├── src/
│   ├── lib/database.types.ts                     # 타입 정의 업데이트
│   ├── types/reservation.ts                      # 인터페이스 업데이트
│   ├── components/reservation/
│   │   ├── ReservationForm.tsx                   # 가격 계산 로직 업데이트
│   │   └── PricingSection.tsx                    # UI 업데이트
│   └── app/api/sync/schema/route.ts              # 동기화 스키마 업데이트
```

## 향후 계획

1. **기존 컬럼 제거**: 충분한 테스트 후 `required_options`와 `required_option_total` 컬럼 제거 고려
2. **성능 최적화**: choices 기반 쿼리 성능 최적화
3. **UI 개선**: choices 기반 가격 표시 UI 개선
4. **문서화**: API 문서 및 사용자 가이드 업데이트
