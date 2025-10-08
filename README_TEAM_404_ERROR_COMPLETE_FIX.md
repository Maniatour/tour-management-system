# Team 테이블 404 오류 완전 해결 가이드

## 문제 상황
```
POST https://tyilwbytyuqrhxekjxcd.supabase.co/rest/v1/rpc/get_team_member_info 404 (Not Found)
Error fetching guide info via RPC: 
{code: 'PGRST202', details: 'Searched for the function public.get_team_member_i…r, but no matches were found in the schema cache.', hint: 'Perhaps you meant to call the function public.is_team_member', message: 'Could not find the function public.get_team_member_info(p_email) in the schema cache'}
```

## 원인 분석
1. **RPC 함수 미생성**: `get_team_member_info` 함수가 데이터베이스에 생성되지 않음
2. **함수 권한 문제**: 함수가 생성되었지만 적절한 권한이 설정되지 않음
3. **스키마 캐시 문제**: Supabase 스키마 캐시에 함수가 반영되지 않음

## 해결 방법

### 1. 즉시 해결 (데이터베이스 스크립트 실행)

```sql
-- fix_team_functions_404_error.sql 실행
\i fix_team_functions_404_error.sql
```

이 스크립트는 다음을 수행합니다:
- 기존 함수 삭제 후 재생성
- 안전한 RPC 함수 생성 (`get_team_member_info`, `get_team_members_info`)
- 적절한 권한 설정
- 누락된 사용자를 team 테이블에 추가
- RLS 정책 수정
- 함수 테스트 및 확인

### 2. 프론트엔드 코드 개선

모든 team 조회 코드를 더 안전한 방식으로 수정했습니다:

#### 기존 방식 (문제 발생):
```javascript
// RPC 함수만 사용
const { data, error } = await supabase
  .rpc('get_team_member_info', { p_email: guideEmail })
```

#### 새로운 방식 (안전함):
```javascript
// 먼저 직접 조회 시도 (더 안전한 방식)
const { data: directData, error: directError } = await supabase
  .from('team')
  .select('name_ko, name_en')
  .eq('email', guideEmail)
  .single()

if (!directError && directData) {
  return directData
}

// 직접 조회 실패 시 RPC 함수 시도 (fallback)
const { data: rpcData, error: rpcError } = await supabase
  .rpc('get_team_member_info', { p_email: guideEmail })

if (!rpcError && rpcData && rpcData.length > 0) {
  return rpcData[0]
}
```

### 3. 수정된 파일들

1. **src/components/reservation/TourConnectionSection.tsx**
   - `fetchGuideInfo` 함수를 직접 조회 우선 방식으로 수정

2. **src/app/[locale]/guide/page.tsx**
   - team 멤버 조회를 직접 조회 우선 방식으로 수정

3. **src/app/[locale]/admin/chat-management/page.tsx**
   - 가이드와 어시스턴트 정보 조회를 직접 조회 우선 방식으로 수정

### 4. 데이터베이스 함수 확인

#### 함수 생성 확인:
```sql
-- 함수 존재 확인
SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('get_team_member_info', 'get_team_members_info', 'is_current_user_team_member')
ORDER BY routine_name;
```

#### 함수 테스트:
```sql
-- 개별 사용자 조회 테스트
SELECT * FROM public.get_team_member_info('kevinjung68@gmail.com');

-- 여러 사용자 조회 테스트
SELECT * FROM public.get_team_members_info(ARRAY['kevinjung68@gmail.com', 'admin@tour.com']);

-- 현재 사용자 확인 테스트
SELECT public.is_current_user_team_member() as is_team_member;
```

### 5. 사용자 등록 확인

```sql
-- 현재 사용자가 team 테이블에 등록되어 있는지 확인
SELECT 
  email,
  name_ko,
  name_en,
  position,
  is_active,
  status
FROM team 
WHERE email = 'kevinjung68@gmail.com';
```

### 6. RLS 정책 확인

```sql
-- team 테이블의 RLS 정책 확인
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'team'
ORDER BY policyname;
```

### 7. 대안 해결책

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

### 8. 스키마 캐시 새로고침

Supabase 스키마 캐시를 새로고침하려면:

1. **Supabase 대시보드**에서 프로젝트 선택
2. **Database** → **Functions** 메뉴로 이동
3. 함수가 올바르게 생성되었는지 확인
4. 필요시 **Refresh** 버튼 클릭

### 9. 테스트 방법

수정 후 다음을 테스트하세요:

1. **예약관리 페이지**: 예약에서 투어 연결 기능이 정상 작동하는지 확인
2. **가이드 페이지**: 가이드 정보가 정상적으로 표시되는지 확인
3. **채팅 관리**: 채팅 관리 페이지에서 가이드 정보가 표시되는지 확인
4. **브라우저 콘솔**: 404 오류가 더 이상 발생하지 않는지 확인

### 10. 모니터링

다음 명령어로 지속적으로 모니터링하세요:

```sql
-- team 테이블 접근 오류 모니터링
SELECT * FROM team WHERE email = 'kevinjung68@gmail.com';

-- RPC 함수 테스트
SELECT * FROM get_team_member_info('kevinjung68@gmail.com');

-- 함수 권한 확인
SELECT 
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name = 'get_team_member_info';
```

## 요약

404 오류는 주로 RPC 함수가 생성되지 않았거나 권한 문제로 발생합니다. 위의 해결 방법을 순서대로 적용하면 문제가 해결될 것입니다. 가장 안전한 방법은 직접 조회를 우선으로 하고 RPC 함수를 fallback으로 사용하는 것이며, 이는 보안을 유지하면서도 필요한 데이터에 접근할 수 있게 해줍니다.
