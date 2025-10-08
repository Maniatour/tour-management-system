# 투어 상세 페이지 팀 구성 문제 완전 해결 가이드

## 문제 상황
- 팀 구성에서 "0명 로드됨" 표시
- 가이드, 드라이버 선택지가 나오지 않음
- tour guide와 driver 포지션의 멤버를 모두 선택할 수 있어야 함
- 페이지 locale에 따라 name_ko, name_en 표시 필요

## 해결 방법

### 1. 데이터베이스 확인 (우선 실행)

```sql
\i debug_team_data.sql
```

이 스크립트로 다음을 확인합니다:
- team 테이블 구조
- 활성 팀 멤버 데이터
- position별 멤버 분포
- RPC 함수 작동 상태

### 2. 프론트엔드 코드 수정 완료

#### A. 팀 멤버 로딩 로직 개선

**기존 문제점:**
- RPC 함수가 빈 배열을 받을 때 모든 멤버를 반환하지 않음
- `is_active` 조건으로 인한 필터링 문제

**수정된 로직:**
```javascript
// 1차: 활성 멤버만 조회
const { data: directData, error: directError } = await supabase
  .from('team')
  .select('email, name_ko, name_en, position, is_active')
  .eq('is_active', true)

// 2차: 모든 멤버 조회 후 클라이언트에서 필터링
if (error) {
  const { data: allData } = await supabase
    .from('team')
    .select('email, name_ko, name_en, position, is_active')
  
  const activeMembers = allData.filter(member => member.is_active !== false)
  setTeamMembers(activeMembers)
}
```

#### B. 필터링 로직 수정

**가이드 선택 드롭다운:**
```javascript
.filter((member: any) => {
  if (!member.position) return true // position이 없으면 포함
  const position = member.position.toLowerCase()
  return position.includes('tour') && position.includes('guide') ||
         position.includes('guide') ||
         position.includes('가이드') ||
         position.includes('driver') ||
         position.includes('드라이버') ||
         position.includes('운전')
})
```

**드라이버/어시스턴트 선택 드롭다운:**
```javascript
.filter((member: any) => {
  // 이미 선택된 가이드는 제외
  if (member.email === selectedGuide) return false
  
  // tour guide와 driver 모두 선택 가능
  if (!member.position) return true
  const position = member.position.toLowerCase()
  return position.includes('tour') && position.includes('guide') ||
         position.includes('guide') ||
         position.includes('가이드') ||
         position.includes('driver') ||
         position.includes('드라이버') ||
         position.includes('운전')
})
```

#### C. Locale 기반 이름 표시

```javascript
const getTeamMemberName = (email: string) => {
  if (!email) return '직원 미선택'
  
  const member = teamMembers.find(member => member.email === email)
  if (!member) return email
  
  // locale에 따라 적절한 이름 반환
  const locale = window.location.pathname.split('/')[1] || 'ko'
  if (locale === 'ko') {
    return member.name_ko || member.name_en || email
  } else {
    return member.name_en || member.name_ko || email
  }
}
```

#### D. 드롭다운 표시 개선

```javascript
.map((member: any) => {
  const locale = window.location.pathname.split('/')[1] || 'ko'
  const displayName = locale === 'ko' 
    ? (member.name_ko || member.name_en || member.email)
    : (member.name_en || member.name_ko || member.email)
  
  return (
    <option key={member.email} value={member.email}>
      {displayName} ({member.position || 'No position'})
    </option>
  )
})
```

### 3. 디버깅 기능 추가

#### A. 로딩 상태 표시
```javascript
<span className="ml-2 text-xs text-gray-500">
  ({teamMembers.length}명 로드됨, 가이드/드라이버 {filteredCount}명)
</span>
```

#### B. 강제 로딩 버튼
```javascript
{teamMembers.length === 0 && (
  <button
    onClick={loadTeamMembersFallback}
    className="ml-2 px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200"
  >
    팀 멤버 다시 로드
  </button>
)}
```

#### C. 콘솔 로그
```javascript
console.log('Team members loaded:', team.length, 'members')
console.log('Team members data:', team)
```

### 4. 테스트 방법

1. **투어 상세 페이지 접속**: `/admin/tours/[tour-id]` 페이지로 이동
2. **팀 구성 섹션 확인**:
   - "X명 로드됨, 가이드/드라이버 Y명" 표시 확인
   - 가이드 드롭다운에 선택지가 나오는지 확인
   - 드라이버 드롭다운에 선택지가 나오는지 확인
3. **브라우저 콘솔 확인**:
   - "Team members loaded: X members" 메시지 확인
   - 오류 메시지가 없는지 확인
4. **선택 테스트**:
   - 가이드로 tour guide 선택 가능한지 확인
   - 가이드로 driver 선택 가능한지 확인
   - 드라이버로 tour guide 선택 가능한지 확인
   - 드라이버로 driver 선택 가능한지 확인

### 5. 예상 결과

수정 후 다음과 같이 작동해야 합니다:

1. **팀 멤버 로딩**: 활성 팀 멤버가 정상적으로 로드됨
2. **필터링**: tour guide와 driver 포지션의 멤버들이 모두 표시됨
3. **선택 가능성**: 가이드와 드라이버 모두 tour guide와 driver 선택 가능
4. **이름 표시**: 페이지 locale에 따라 name_ko 또는 name_en 표시
5. **포지션 표시**: 드롭다운에서 각 멤버의 포지션도 함께 표시

### 6. 문제 지속 시 확인사항

#### A. team 테이블 데이터 확인
```sql
SELECT 
  email,
  name_ko,
  name_en,
  position,
  is_active
FROM team 
WHERE is_active = true
ORDER BY position, name_ko;
```

#### B. 포지션별 멤버 확인
```sql
SELECT 
  position,
  COUNT(*) as member_count
FROM team 
WHERE is_active = true
  AND (
    LOWER(position) LIKE '%tour%guide%' OR
    LOWER(position) LIKE '%guide%' OR
    LOWER(position) LIKE '%가이드%' OR
    LOWER(position) LIKE '%driver%' OR
    LOWER(position) LIKE '%드라이버%' OR
    LOWER(position) LIKE '%운전%'
  )
GROUP BY position
ORDER BY position;
```

#### C. RLS 정책 확인
```sql
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'team';
```

### 7. 추가 개선사항

1. **캐싱 개선**: 팀 멤버 데이터 캐싱 시간 조정
2. **오류 처리**: 더 구체적인 오류 메시지 제공
3. **로딩 상태**: 스켈레톤 UI로 로딩 상태 표시
4. **실시간 업데이트**: 팀 멤버 변경 시 자동 새로고침

## 요약

투어 상세 페이지의 팀 구성 문제는 주로 팀 멤버 로딩과 필터링 로직의 문제였습니다. 위의 해결 방법을 적용하면:

1. **0명 로드 문제 해결**: 다중 fallback 메커니즘으로 팀 멤버 로딩 보장
2. **선택지 표시**: tour guide와 driver 포지션의 멤버들이 모두 드롭다운에 표시
3. **유연한 선택**: 가이드와 드라이버 모두 tour guide와 driver 선택 가능
4. **다국어 지원**: 페이지 locale에 따라 적절한 이름 표시

이제 투어 상세 페이지에서 팀 구성이 정상적으로 작동할 것입니다!
