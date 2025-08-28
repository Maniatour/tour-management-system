# 🚀 동적 가격 시스템 (Dynamic Pricing System)

## 📋 개요

이 시스템은 투어 상품의 가격을 채널별, 기간별, 요일별로 세분화하여 관리하고, 예약 시 자동으로 적절한 가격을 계산하는 기능을 제공합니다.

## ✨ 주요 기능

### 1. **채널별 가격 관리**
- 직접 방문, 네이버 여행, 카카오 여행 등 판매 채널별 가격 설정
- 각 채널의 특성에 맞는 가격 정책 적용

### 2. **기간별 가격 설정**
- 성수기/비수기 등 특정 기간에 대한 가격 규칙 생성
- 시작일-종료일로 기간 범위 설정

### 3. **요일별 가격 차등화**
- 일요일, 토요일 등 특정 요일에 대한 가격 조정
- 성인/아동/유아별 차등 가격 적용

### 4. **필수 옵션 가격 관리**
- 호텔 픽업, 점심 도시락 등 필수 옵션별 가격 설정
- 옵션 조합에 따른 가격 계산

### 5. **자동 가격 계산**
- 예약 시 상품, 채널, 날짜, 옵션 선택에 따른 자동 가격 계산
- 실시간 가격 미리보기 및 확인

## 🗄️ 데이터베이스 구조

### 핵심 테이블

#### 1. `dynamic_pricing_rules` - 가격 규칙 마스터
```sql
- id: UUID (PK)
- product_id: UUID (상품 ID)
- channel_id: UUID (채널 ID)
- rule_name: VARCHAR (규칙 이름)
- start_date: DATE (시작일)
- end_date: DATE (종료일)
- is_active: BOOLEAN (활성화 여부)
```

#### 2. `weekday_pricing` - 요일별 가격
```sql
- id: UUID (PK)
- pricing_rule_id: UUID (가격 규칙 ID)
- day_of_week: INTEGER (0=일요일, 1=월요일, ..., 6=토요일)
- adult_price: DECIMAL (성인 가격)
- child_price: DECIMAL (아동 가격)
- infant_price: DECIMAL (유아 가격)
```

#### 3. `required_option_pricing` - 필수 옵션 가격
```sql
- id: UUID (PK)
- pricing_rule_id: UUID (가격 규칙 ID)
- option_id: UUID (옵션 ID)
- adult_price: DECIMAL (성인 옵션 가격)
- child_price: DECIMAL (아동 옵션 가격)
- infant_price: DECIMAL (유아 옵션 가격)
```

#### 4. `reservation_pricing` - 예약별 가격 기록
```sql
- id: UUID (PK)
- reservation_id: UUID (예약 ID)
- pricing_rule_id: UUID (적용된 가격 규칙 ID)
- base_adult_price: DECIMAL (기본 성인 가격)
- total_adult_price: DECIMAL (최종 성인 가격)
- discount_amount: DECIMAL (할인 금액)
```

## 🔧 설치 및 설정

### 1. 마이그레이션 실행
```bash
# Supabase CLI로 마이그레이션 실행
supabase db push

# 또는 SQL 파일 직접 실행
psql -h your-host -U your-user -d your-db -f supabase/migrations/20250101000000_add_dynamic_pricing_system.sql
```

### 2. 환경 변수 설정
```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## 📱 사용법

### 1. **가격 규칙 생성**

#### 1단계: 채널 및 기간 선택
```
채널 선택 → 시작일-종료일 설정 → 규칙 이름 입력
```

#### 2단계: 요일별 가격 설정
```
일요일부터 토요일까지 각 요일별로:
- 성인 가격
- 아동 가격 (성인 가격의 80%)
- 유아 가격 (성인 가격의 50%)
- 활성화 여부
```

#### 3단계: 필수 옵션 가격 설정
```
옵션 추가 → 가격 설정:
- 호텔 픽업: 성인 $30, 아동 $25, 유아 $15
- 점심 도시락: 성인 $20, 아동 $18, 유아 $12
```

### 2. **가격 계산기 사용**

#### 1단계: 예약 정보 입력
```
판매 채널 선택 → 투어 날짜 선택 → 참가자 수 설정
```

#### 2단계: 옵션 선택
```
필수 옵션 체크박스로 선택/해제
```

#### 3단계: 가격 계산
```
"가격 계산하기" 버튼 클릭 → 실시간 결과 확인
```

## 💰 가격 계산 로직

### 기본 가격 계산
```
1. 해당 날짜와 채널에 맞는 가격 규칙 검색
2. 요일별 기본 가격 적용
3. 채널별 가격 조정 적용
4. 옵션 가격 추가
5. 최종 가격 = (기본 가격 + 옵션 가격) × 참가자 수
```

### 예시 계산
```
상품: 그랜드 캐니언 투어
채널: 네이버 여행
날짜: 2024-06-15 (토요일)
참가자: 성인 2명, 아동 1명
옵션: 호텔 픽업

계산 과정:
1. 기본 가격: 성인 $200, 아동 $160, 유아 $100
2. 토요일 가격: 20% 증가 → 성인 $240, 아동 $192, 유아 $120
3. 네이버 여행: 15% 증가 → 성인 $276, 아동 $221, 유아 $138
4. 호텔 픽업: 성인 $30, 아동 $25, 유아 $15
5. 최종 가격: 성인 $306, 아동 $246, 유아 $153
6. 총 합계: ($306 × 2) + ($246 × 1) = $858
```

## 🔍 API 엔드포인트

### 가격 규칙 관리
```typescript
// 가격 규칙 생성
POST /api/pricing-rules
{
  product_id: string,
  channel_id: string,
  rule_name: string,
  start_date: string,
  end_date: string,
  weekday_pricing: WeekdayPricingDto[],
  required_option_pricing: RequiredOptionPricingDto[]
}

// 가격 규칙 조회
GET /api/pricing-rules?product_id=${productId}

// 가격 규칙 수정
PUT /api/pricing-rules/${ruleId}

// 가격 규칙 삭제
DELETE /api/pricing-rules/${ruleId}
```

### 가격 계산
```typescript
// 예약 가격 계산
POST /api/calculate-price
{
  product_id: string,
  channel_id: string,
  tour_date: string,
  adults: number,
  children: number,
  infants: number,
  option_ids: string[]
}
```

## 🎯 컴포넌트 구조

### 1. `DynamicPricingManager`
- 가격 규칙 생성/편집/삭제
- 요일별 가격 설정 UI
- 필수 옵션 가격 관리

### 2. `PriceCalculator`
- 예약 시 가격 계산
- 실시간 가격 미리보기
- 옵션 선택 및 가격 조합

### 3. 타입 정의
- `src/lib/types/dynamic-pricing.ts`
- 모든 인터페이스 및 타입 정의

## 🚀 향후 확장 계획

### 1. **고급 가격 정책**
- 수량 할인 (그룹 예약 할인)
- 조기 예약 할인
- 마지막 분 할인

### 2. **AI 가격 최적화**
- 수요 예측 기반 동적 가격 조정
- 경쟁사 가격 분석
- 수익 최적화 알고리즘

### 3. **멀티 통화 지원**
- USD, KRW, EUR 등 다국가 통화
- 실시간 환율 적용
- 지역별 가격 정책

### 4. **고객 등급별 가격**
- VIP 고객 할인
- 회원 등급별 차등 가격
- 충성도 프로그램 연동

## 🐛 문제 해결

### 일반적인 문제들

#### 1. 가격이 계산되지 않는 경우
```
- 채널과 날짜가 올바르게 선택되었는지 확인
- 해당 기간에 활성화된 가격 규칙이 있는지 확인
- 데이터베이스 연결 상태 확인
```

#### 2. 옵션 가격이 반영되지 않는 경우
```
- 옵션이 올바르게 선택되었는지 확인
- 옵션별 가격이 설정되어 있는지 확인
- 가격 규칙의 활성화 상태 확인
```

#### 3. 성능 이슈
```
- 데이터베이스 인덱스 확인
- 가격 계산 함수 최적화
- 캐싱 전략 적용
```

## 📞 지원 및 문의

### 개발팀 연락처
- **기술 문의**: dev@company.com
- **버그 리포트**: bugs@company.com
- **기능 요청**: features@company.com

### 문서 및 리소스
- [API 문서](https://docs.company.com/api)
- [개발자 가이드](https://docs.company.com/dev)
- [사용자 매뉴얼](https://docs.company.com/user)

---

**© 2024 Tour Management System. All rights reserved.**
