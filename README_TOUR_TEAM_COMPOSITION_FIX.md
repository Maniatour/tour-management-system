# 투어 상세 페이지 팀 구성 문제 해결 가이드

## 문제 상황
투어 상세 페이지에서 팀 구성 섹션의 가이드와 드라이버 이름이 표시되지 않고, 선택지 드롭다운에 아무것도 나오지 않는 문제가 발생했습니다.

## 원인 분석
1. **팀 멤버 필터링 문제**: 기존 코드에서 `position = 'Tour Guide'`인 멤버만 가져오고 있어서 드라이버나 다른 포지션의 멤버들이 제외됨
2. **404 오류 연쇄**: team 테이블 접근 시 발생하는 404 오류로 인해 팀 멤버 데이터가 로드되지 않음
3. **오류 처리 부족**: 팀 멤버 로딩 실패 시 적절한 fallback 메커니즘이 없음

## 해결 방법

### 1. 데이터베이스 함수 생성 (우선 실행)

```sql
\i fix_team_functions_final.sql
```

이 스크립트는 다음을 수행합니다:
- 안전한 RPC 함수 생성
- team 테이블 접근 권한 설정
- 누락된 사용자 추가
- RLS 정책 수정

### 2. 프론트엔드 코드 수정 완료

#### A. 팀 멤버 로딩 로직 개선
- **기존**: `position = 'Tour Guide'`인 멤버만 로드
- **수정**: 모든 활성 팀 멤버 로드 (`is_active = true`)
- **추가**: RPC 함수 fallback 메커니즘

#### B. 드롭다운 필터링 개선
- **가이드 선택**: 가이드 포지션 필터링
- **드라이버 선택**: 드라이버 포지션 필터링
- **2차 가이드**: 가이드 포지션 필터링

#### C. 디버깅 기능 추가
- 팀 멤버 로딩 상태 표시
- 강제 로딩 버튼 추가
- 콘솔 로그로 디버깅 정보 제공

### 3. 수정된 파일

**src/app/[locale]/admin/tours/[id]/page.tsx**

#### 주요 변경사항:

1. **팀 멤버 로딩 개선**:
```javascript
// 기존
.select('email, name_ko, name_en')
.eq('position', 'Tour Guide')
.eq('is_active', true)

// 수정
.select('email, name_ko, name_en, position')
.eq('is_active', true)
// 모든 활성 멤버 로드
```

2. **드롭다운 필터링 개선**:
```javascript
// 가이드 선택
.filter((member: any) => 
  !member.position || 
  member.position.toLowerCase().includes('guide') || 
  member.position.toLowerCase().includes('가이드')
)

// 드라이버 선택
.filter((member: any) => {
  if (member.email === selectedGuide) return false
  
  if (teamType === 'guide+driver') {
    return !member.position || 
           member.position.toLowerCase().includes('driver') || 
           member.position.toLowerCase().includes('드라이버') ||
           member.position.toLowerCase().includes('운전')
  }
  return true
})
```

3. **Fallback 메커니즘 추가**:
```javascript
const loadTeamMembersFallback = useCallback(async () => {
  // 직접 조회 시도
  const { data: directData, error: directError } = await supabase
    .from('team')
    .select('email, name_ko, name_en, position')
    .eq('is_active', true)
  
  if (!directError && directData) {
    setTeamMembers(directData as TeamMember[])
    return directData
  }
  
  // RPC 함수로 fallback
  const { data: rpcData, error: rpcError } = await supabase
    .rpc('get_team_members_info', { p_emails: [] })
  
  if (!rpcError && rpcData) {
    setTeamMembers(rpcData as TeamMember[])
    return rpcData
  }
  
  return []
}, [])
```

4. **디버깅 UI 추가**:
```javascript
<h2 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
  팀 구성
  <ConnectionStatusLabel status={connectionStatus.team} section="팀" />
  <span className="ml-2 text-xs text-gray-500">
    ({teamMembers.length}명 로드됨)
  </span>
  {teamMembers.length === 0 && (
    <button
      onClick={loadTeamMembersFallback}
      className="ml-2 px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200"
    >
      팀 멤버 다시 로드
    </button>
  )}
</h2>
```

### 4. 테스트 방법

1. **투어 상세 페이지 접속**: `/admin/tours/[tour-id]` 페이지로 이동
2. **팀 구성 섹션 확인**: 
   - 팀 멤버 수가 표시되는지 확인
   - 가이드 드롭다운에 선택지가 나오는지 확인
   - 드라이버 드롭다운에 선택지가 나오는지 확인
3. **브라우저 콘솔 확인**: 
   - "Team members loaded: X members" 메시지 확인
   - 오류 메시지가 없는지 확인
4. **강제 로딩 테스트**: 
   - 팀 멤버가 0명일 때 "팀 멤버 다시 로드" 버튼 클릭
   - 버튼 클릭 후 팀 멤버가 로드되는지 확인

### 5. 예상 결과

수정 후 다음과 같이 작동해야 합니다:

1. **팀 멤버 로딩**: 모든 활성 팀 멤버가 로드됨
2. **가이드 선택**: 가이드 포지션의 멤버들이 드롭다운에 표시됨
3. **드라이버 선택**: 드라이버 포지션의 멤버들이 드롭다운에 표시됨
4. **이름 표시**: 배정된 가이드/드라이버의 이름이 정상적으로 표시됨
5. **오류 처리**: 로딩 실패 시 적절한 fallback 동작

### 6. 추가 확인사항

#### team 테이블 데이터 확인:
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

#### 포지션별 멤버 수 확인:
```sql
SELECT 
  position,
  COUNT(*) as member_count
FROM team 
WHERE is_active = true
GROUP BY position
ORDER BY position;
```

### 7. 문제 지속 시 대안

만약 문제가 지속된다면:

1. **RLS 정책 확인**: team 테이블의 RLS 정책이 너무 제한적인지 확인
2. **사용자 권한 확인**: 현재 사용자가 team 테이블에 접근할 수 있는지 확인
3. **데이터 확인**: team 테이블에 실제로 데이터가 있는지 확인
4. **네트워크 확인**: Supabase 연결 상태 확인

## 요약

투어 상세 페이지의 팀 구성 문제는 주로 팀 멤버 필터링과 데이터 로딩 문제로 발생했습니다. 위의 해결 방법을 적용하면 가이드와 드라이버 이름이 정상적으로 표시되고 드롭다운에 적절한 선택지가 나타날 것입니다.
