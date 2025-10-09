# 초이스 그룹별 색상 뱃지 기능

## 개요

상품 카드뷰와 예약 관리 페이지에서 초이스를 그룹별로 다른 색깔 뱃지로 표시하는 기능을 구현했습니다.

## 주요 변경사항

### 1. 상품 카드뷰 (ProductCard.tsx)
- 기존: 모든 초이스가 보라색 뱃지로 표시
- 변경: 그룹별로 다른 색상의 뱃지로 표시
- 그룹 정보를 포함하여 초이스 옵션 추출
- 그룹별 색상 매핑 적용

### 2. 예약 관리 페이지 (admin/reservations/page.tsx)
- 그룹별 색상 매핑 함수 추가
- 선택된 옵션의 그룹 정보를 찾아서 색상 결정
- 기존 하드코딩된 색상 로직을 그룹 기반으로 변경

### 3. 투어 상세 페이지 (admin/tours/[id]/page.tsx)
- 그룹별 색상 매핑 함수 추가
- 선택된 옵션의 그룹 정보를 찾아서 색상 결정

### 4. 공통 유틸리티 함수 (utils/groupColors.ts)
- 그룹별 색상 매핑을 위한 공통 함수 생성
- 여러 컴포넌트에서 재사용 가능한 유틸리티

## 색상 매핑 규칙

### 특정 그룹 색상
- **캐년 그룹** (canyon, 캐년): 파란색 (`bg-blue-100`, `text-blue-800`)
- **호텔 그룹** (hotel, 호텔, room, 룸): 초록색 (`bg-green-100`, `text-green-800`)
- **식사 그룹** (meal, 식사, food): 주황색 (`bg-orange-100`, `text-orange-800`)
- **교통 그룹** (transport, 교통, vehicle): 보라색 (`bg-purple-100`, `text-purple-800`)
- **활동 그룹** (activity, 활동, experience): 분홍색 (`bg-pink-100`, `text-pink-800`)

### 기본 색상 팔레트
그룹 이름에 특정 키워드가 없는 경우, 그룹 ID의 해시값을 기반으로 다음 색상 중 하나를 선택:
- 인디고 (`bg-indigo-100`)
- 틸 (`bg-teal-100`)
- 시안 (`bg-cyan-100`)
- 에메랄드 (`bg-emerald-100`)
- 바이올렛 (`bg-violet-100`)
- 로즈 (`bg-rose-100`)
- 스카이 (`bg-sky-100`)
- 라임 (`bg-lime-100`)

## 사용 예시

### 1박2일 투어 예시
- **앤텔롭캐년 그룹**: 파란색 뱃지
  - Lower Antelope Canyon (파란색)
  - Antelope X Canyon (파란색)
- **호텔 그룹**: 초록색 뱃지
  - 1인 1실 (초록색)
  - 2인 1실 (초록색)

## 기술적 구현

### 그룹 정보 추출
```typescript
const getChoicesOptions = (product: Product) => {
  // choices.required에서 그룹 정보와 옵션 정보를 함께 추출
  // 각 옵션에 groupId, groupName, groupNameKo 정보 포함
}
```

### 색상 결정 로직
```typescript
const getGroupColorClasses = (groupId: string, groupName?: string) => {
  // 1. 그룹 이름에 특정 키워드가 있는지 확인
  // 2. 키워드가 있으면 해당 색상 반환
  // 3. 없으면 그룹 ID 해시값으로 색상 팔레트에서 선택
}
```

### 뱃지 렌더링
```typescript
const renderChoicesBadges = (product: Product) => {
  // 각 옵션의 그룹 정보를 기반으로 색상 결정
  // 그룹별로 다른 색상의 뱃지 렌더링
}
```

## 파일 변경사항

### 수정된 파일
1. `src/components/ProductCard.tsx` - 상품 카드뷰 뱃지 색상
2. `src/app/[locale]/admin/reservations/page.tsx` - 예약 관리 페이지 뱃지 색상
3. `src/app/[locale]/admin/tours/[id]/page.tsx` - 투어 상세 페이지 뱃지 색상

### 새로 생성된 파일
1. `src/utils/groupColors.ts` - 공통 색상 매핑 유틸리티

## 향후 개선사항

1. **색상 커스터마이징**: 관리자가 그룹별 색상을 직접 설정할 수 있는 기능
2. **색상 접근성**: 색맹 사용자를 위한 패턴이나 아이콘 추가
3. **성능 최적화**: 색상 계산 결과 캐싱
4. **일관성**: 모든 페이지에서 동일한 색상 매핑 적용

## 사용법

기존 코드는 수정 없이 자동으로 그룹별 색상이 적용됩니다. 새로운 그룹을 추가할 때는 `groupColors.ts`의 색상 매핑 규칙을 참고하여 적절한 색상이 자동으로 할당됩니다.
