# 예약관리 투어 연결 페이지 이동 수정

## 수정 내용

예약관리에서 연결된 투어를 선택할 때 새로운 창이 열리는 대신 같은 페이지 내에서 이동하도록 수정했습니다.

## 변경된 파일들

### 1. `src/components/reservation/TourConnectionSection.tsx`

**기존 코드:**
```javascript
onClick={() => window.open(`/${window.location.pathname.split('/')[1]}/admin/tours/${tour.id}`, '_blank')}
```

**수정된 코드:**
```javascript
onClick={() => {
  const locale = window.location.pathname.split('/')[1]
  window.location.href = `/${locale}/admin/tours/${tour.id}`
}}
```

### 2. `src/components/ScheduleView.tsx`

**기존 코드:**
```javascript
// 투어 상세 페이지로 이동
const handleTourDoubleClick = (tourId: string) => {
  const pathLocale = locale || (typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : '')
  const href = `/${pathLocale}/admin/tours/${tourId}`
  window.open(href, '_blank')
}
```

**수정된 코드:**
```javascript
// 투어 상세 페이지로 이동
const handleTourDoubleClick = (tourId: string) => {
  const pathLocale = locale || (typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : '')
  const href = `/${pathLocale}/admin/tours/${tourId}`
  window.location.href = href
}
```

**기존 코드 (모달 내 버튼):**
```javascript
onClick={() => {
  if (guideModalContent.tourId) {
    const pathLocale = locale || (typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : '')
    const href = `/${pathLocale}/admin/tours/${guideModalContent.tourId}`
    window.open(href, '_blank')
  }
}}
```

**수정된 코드:**
```javascript
onClick={() => {
  if (guideModalContent.tourId) {
    const pathLocale = locale || (typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : '')
    const href = `/${pathLocale}/admin/tours/${guideModalContent.tourId}`
    window.location.href = href
  }
}}
```

## 변경 효과

1. **예약관리 페이지**: 연결된 투어를 클릭하면 새로운 창이 열리지 않고 같은 페이지에서 투어 상세 페이지로 이동합니다.

2. **스케줄 뷰**: 투어를 더블클릭하거나 모달에서 "투어 상세 수정" 버튼을 클릭하면 같은 페이지에서 이동합니다.

3. **사용자 경험 개선**: 여러 창이 열리지 않아 브라우저가 깔끔하게 유지되고, 뒤로 가기 버튼으로 쉽게 돌아갈 수 있습니다.

## 유지된 기능

다음과 같은 경우는 의도적으로 새 창에서 열리도록 유지했습니다:

1. **Google Maps 링크**: 외부 링크이므로 새 창에서 열림
2. **문서 미리보기**: "새 창" 버튼으로 명시적으로 새 창에서 열기 옵션 제공
3. **외부 링크들**: Google Sheets, 이미지 URL 등 외부 리소스

## 테스트 방법

1. 예약관리 페이지에서 예약을 선택
2. "연결된 투어" 섹션에서 투어를 클릭
3. 새로운 창이 열리지 않고 같은 페이지에서 투어 상세 페이지로 이동하는지 확인
4. 브라우저의 뒤로 가기 버튼으로 예약관리 페이지로 돌아갈 수 있는지 확인
