# 동적 가격 관리 시스템 리팩토링

## 개요
기존의 거대한 `DynamicPricingManager` 컴포넌트를 구조적으로 분리하고 최적화했습니다. 기능과 UI는 그대로 유지하면서 코드의 가독성, 유지보수성, 성능을 크게 개선했습니다.

## 구조 개선

### 1. 커스텀 훅으로 비즈니스 로직 분리

#### `useDynamicPricing`
- 동적 가격 데이터 관리
- 가격 규칙 저장/삭제
- 데이터 로딩 및 상태 관리

#### `useChannelManagement`
- 채널 목록 관리
- 단일/다중 채널 선택 모드
- 채널 선택 상태 관리

#### `useChoiceManagement`
- 초이스 그룹 및 조합 관리
- 초이스 가격 설정
- 조합 생성 및 업데이트

#### `usePricingData`
- 가격 히스토리 관리
- 가격 설정 상태 관리
- 상세 가격 표시 토글

### 2. UI 컴포넌트 분리

#### `ChannelSelector`
- 채널 선택 인터페이스
- 단일/다중 채널 모드 토글
- 채널 목록 표시

#### `PricingCalendar`
- 월별 가격 캘린더
- 날짜 선택 기능
- 가격 규칙 시각화

#### `PricingListView`
- 가격 규칙 목록 표시
- 규칙 편집/삭제 기능
- 가격 정보 상세 표시

#### `ChoicePricingPanel`
- 초이스 조합 가격 설정
- 조합별 개별 가격 관리
- 가격 미리보기

#### `PricingControls`
- 저장/취소 버튼
- 저장 상태 표시
- 메시지 알림

## 성능 최적화

### 1. React.memo 적용
모든 UI 컴포넌트에 `React.memo`를 적용하여 불필요한 리렌더링을 방지했습니다.

### 2. useCallback 최적화
이벤트 핸들러와 비즈니스 로직 함수들을 `useCallback`으로 메모이제이션했습니다.

### 3. useMemo 활용
복잡한 계산이 필요한 값들(현재 월 데이터, 저장 가능 여부 등)을 `useMemo`로 최적화했습니다.

## 타입 안전성

### 새로운 타입 정의
- `SimplePricingRule`: 기존 코드와 호환되는 간단한 가격 규칙 타입
- `SimplePricingRuleDto`: 가격 규칙 생성/수정을 위한 DTO

## 파일 구조

```
src/
├── hooks/
│   ├── useDynamicPricing.ts
│   ├── useChannelManagement.ts
│   ├── useChoiceManagement.ts
│   └── usePricingData.ts
├── components/
│   ├── dynamic-pricing/
│   │   ├── ChannelSelector.tsx
│   │   ├── PricingCalendar.tsx
│   │   ├── PricingListView.tsx
│   │   ├── ChoicePricingPanel.tsx
│   │   └── PricingControls.tsx
│   └── DynamicPricingManager.tsx (리팩토링됨)
└── lib/types/
    └── dynamic-pricing.ts (타입 확장)
```

## 주요 개선사항

### 1. 코드 가독성
- 3,376줄의 거대한 컴포넌트를 여러 개의 작은 컴포넌트로 분리
- 각 컴포넌트가 단일 책임을 가지도록 설계
- 명확한 네이밍과 구조화된 코드

### 2. 유지보수성
- 비즈니스 로직과 UI 로직의 명확한 분리
- 각 기능별로 독립적인 테스트 가능
- 새로운 기능 추가 시 영향 범위 최소화

### 3. 성능
- 불필요한 리렌더링 방지
- 메모이제이션을 통한 계산 최적화
- 컴포넌트별 독립적인 상태 관리

### 4. 타입 안전성
- TypeScript 타입 정의 강화
- 컴파일 타임 에러 방지
- IDE 자동완성 및 리팩토링 지원

## 사용법

기존과 동일한 방식으로 사용할 수 있습니다:

```tsx
<DynamicPricingManager
  productId="product-id"
  onSave={(rule) => console.log('Saved:', rule)}
/>
```

## 백업

기존 파일은 `DynamicPricingManager.backup.tsx`로 백업되어 있습니다. 문제 발생 시 언제든 복원 가능합니다.

## 결론

이번 리팩토링을 통해 동적 가격 관리 시스템의 코드 품질이 크게 향상되었습니다. 기능은 그대로 유지하면서도 개발자 경험과 성능이 개선되어 향후 유지보수와 기능 확장이 훨씬 수월해질 것입니다.
