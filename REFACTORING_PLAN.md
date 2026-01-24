# 예약 페이지 리팩토링 계획

## 현재 상태
- 파일 크기: ~4,700줄
- 위치: `src/app/[locale]/admin/reservations/page.tsx`

## 리팩토링 목표
1. UI, 레이아웃, 스타일, 동작은 정확히 동일하게 유지
2. 논리적인 컴포넌트로 분리
3. 모든 props, 동작, side effects 동일하게 유지
4. 디자인 변경 없음
5. 외부 API, 라우트, 데이터 계약 이름 변경 없음

## 추출된 컴포넌트

### 1. ReservationsHeader ✅
- 위치: `src/components/reservation/ReservationsHeader.tsx`
- 기능: 타이틀, 검색창, 뷰 전환 버튼, 새 예약 추가 버튼

### 2. ReservationsFilters ✅
- 위치: `src/components/reservation/ReservationsFilters.tsx`
- 기능: 필터 접기/펼치기, 상태/채널/날짜 필터, 정렬, 그룹화 옵션

### 3. WeeklyStatsPanel ✅
- 위치: `src/components/reservation/WeeklyStatsPanel.tsx`
- 기능: 주간 네비게이션, 주간 통계 (상품별/채널별/상태별)

## 추가로 추출해야 할 컴포넌트

### 4. ReservationCardItem (예정)
- 기능: 개별 예약 카드 표시
- 복잡도: 매우 높음 (투어 정보, 가격 계산, 버튼 등 포함)
- 사용 위치: 날짜별 그룹화 뷰, 일반 카드뷰

### 5. DateGroupHeader (예정)
- 기능: 날짜별 그룹 헤더 (접기/펼치기, 통계 정보)
- 사용 위치: 날짜별 그룹화 뷰

### 6. EmptyState (예정)
- 기능: 검색 결과 없음, 예약 없음 안내 메시지
- 사용 위치: 여러 곳

### 7. PaginationControls (예정)
- 기능: 페이지네이션 컨트롤
- 사용 위치: 일반 카드뷰

## 다음 단계
1. 메인 페이지에 새 컴포넌트 통합
2. ReservationCardItem 추출 (가장 복잡한 부분)
3. 나머지 컴포넌트 추출
4. 테스트 및 검증
