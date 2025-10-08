# Team 테이블 406 오류 해결 가이드

## 문제 상황
```
Failed to load resource: the server responded with a status of 406 ()
Error fetching guide info: Object
tyilwbytyuqrhxekjxcd.supabase.co/rest/v1/team?select=name_ko%2Cname_en&email=eq.Kevinjung68%40gmail.com:1
```

## 원인 분석
1. **RLS (Row Level Security) 정책 문제**: `team` 테이블에 RLS가 활성화되어 있음
2. **사용자 권한 부족**: `kevinjung68@gmail.com` 사용자가 `team` 테이블에 등록되지 않았거나 권한이 없음
3. **인증 문제**: Supabase 인증 토큰이 올바르지 않거나 만료됨

## 해결 방법

### 1. 즉시 해결 (데이터베이스 스크립트 실행)

```sql
-- fix_team_access_safely.sql 실행
\i fix_team_access_safely.sql
```

이 스크립트는 다음을 수행합니다:
- 안전한 RPC 함수 생성 (`get_team_member_info`, `get_team_members_info`)
- RLS 정책을 더 유연하게 수정
- 누락된 사용자를 team 테이블에 추가
- 함수 권한 설정

### 2. 프론트엔드 코드 수정

기존의 직접적인 team 테이블 조회를 안전한 RPC 함수 호출로 변경했습니다:

#### 기존 방식 (문제 발생):
```javascript
const { data, error } = await supabase
  .from('team')
  .select('name_ko, name_en')
  .eq('email', guideEmail)
  .single()
```

#### 새로운 방식 (안전함):
```javascript
const { data, error } = await supabase
  .rpc('get_team_member_info', { p_email: guideEmail })

if (error) {
  // RPC 실패 시 직접 조회 (fallback)
  const { data: fallbackData, error: fallbackError } = await supabase
    .from('team')
    .select('name_ko, name_en')
    .eq('email', guideEmail)
    .single()
}
```

### 3. 수정된 파일들

1. **src/components/reservation/TourConnectionSection.tsx**
   - `fetchGuideInfo` 함수를 안전한 RPC 방식으로 수정

2. **src/app/[locale]/guide/page.tsx**
   - team 멤버 조회를 `get_team_members_info` RPC 함수로 수정

3. **src/app/[locale]/admin/chat-management/page.tsx**
   - 가이드와 어시스턴트 정보 조회를 안전한 방식으로 수정

### 4. 추가 확인사항

#### 사용자 등록 확인:
```sql
-- 현재 사용자가 team 테이블에 등록되어 있는지 확인
SELECT * FROM team WHERE email = 'kevinjung68@gmail.com';
```

#### RLS 정책 확인:
```sql
-- team 테이블의 RLS 정책 확인
SELECT policyname, cmd, qual FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'team';
```

#### 인증 상태 확인:
```sql
-- 현재 인증된 사용자 정보 확인
SELECT 
  auth.uid() as user_id,
  auth.jwt() ->> 'email' as jwt_email,
  now() as current_time;
```

### 5. 대안 해결책 (임시)

만약 위 방법들이 작동하지 않는다면:

#### A. RLS 완전 비활성화 (개발 환경에서만):
```sql
ALTER TABLE public.team DISABLE ROW LEVEL SECURITY;
```

#### B. 사용자 직접 추가:
```sql
INSERT INTO team (name_ko, name_en, email, phone, position, department, role, is_active, status)
VALUES (
  'Kevin Jung',
  'Kevin Jung', 
  'kevinjung68@gmail.com',
  '010-0000-0000',
  'Developer',
  'IT',
  'member',
  true,
  'active'
)
ON CONFLICT (email) DO UPDATE SET
  is_active = true,
  status = 'active';
```

### 6. 예방 조치

1. **새 사용자 등록**: 새로운 개발자나 사용자가 추가될 때 team 테이블에 등록
2. **권한 관리**: 적절한 RLS 정책으로 보안 유지
3. **오류 처리**: 프론트엔드에서 team 조회 실패 시 적절한 fallback 처리

### 7. 테스트

수정 후 다음을 테스트하세요:

1. **가이드 페이지 로드**: `/guide` 페이지가 정상적으로 로드되는지 확인
2. **투어 연결**: 예약에서 투어 연결 기능이 정상 작동하는지 확인
3. **채팅 관리**: 채팅 관리 페이지에서 가이드 정보가 표시되는지 확인

### 8. 모니터링

다음 명령어로 지속적으로 모니터링하세요:

```sql
-- team 테이블 접근 오류 모니터링
SELECT * FROM team WHERE email = 'kevinjung68@gmail.com';

-- RPC 함수 테스트
SELECT * FROM get_team_member_info('kevinjung68@gmail.com');
```

## 요약

406 오류는 주로 RLS 정책과 사용자 권한 문제로 발생합니다. 위의 해결 방법을 순서대로 적용하면 문제가 해결될 것입니다. 가장 안전한 방법은 안전한 RPC 함수를 사용하는 것이며, 이는 보안을 유지하면서도 필요한 데이터에 접근할 수 있게 해줍니다.

