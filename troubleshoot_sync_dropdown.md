# Supabase 동기화 드롭다운에서 payment_records 테이블이 보이지 않는 문제 해결

## 문제 상황
- `payment_records` 테이블이 Supabase에 정상적으로 생성됨
- 데이터 동기화 → 유연한 데이터 동기화 → 동기화 설정 → 대상 테이블 드롭다운에 나타나지 않음

## 해결 방법

### 1. SQL 스크립트 실행
`fix_payment_records_sync_visibility.sql` 파일을 Supabase SQL Editor에서 실행하세요.

### 2. 수동 해결 단계

#### A. Real-time Publication 확인 및 수정
```sql
-- 1. 현재 publication 상태 확인
SELECT * FROM pg_publication WHERE pubname = 'supabase_realtime';

-- 2. publication에 포함된 테이블 확인
SELECT 
  p.pubname,
  c.relname as table_name
FROM pg_publication p
JOIN pg_publication_rel pr ON p.oid = pr.prpubid
JOIN pg_class c ON pr.prrelid = c.oid
WHERE p.pubname = 'supabase_realtime'
ORDER BY c.relname;

-- 3. payment_records를 publication에 추가
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_records;
```

#### B. 권한 재설정
```sql
-- 모든 필요한 권한 부여
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_records TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_records TO service_role;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO service_role;
```

#### C. 테이블 소유자 확인
```sql
-- 테이블 소유자 확인
SELECT 
  schemaname,
  tablename,
  tableowner
FROM pg_tables 
WHERE tablename = 'payment_records';

-- 필요시 소유자 변경
ALTER TABLE public.payment_records OWNER TO postgres;
```

### 3. Supabase Dashboard에서 확인

#### A. Database → Replication
1. Supabase Dashboard → Database → Replication
2. `payment_records` 테이블이 Real-time으로 설정되어 있는지 확인
3. 없다면 수동으로 추가

#### B. Table Editor에서 확인
1. Supabase Dashboard → Table Editor
2. `payment_records` 테이블이 정상적으로 표시되는지 확인
3. 테이블 구조가 올바른지 확인

### 4. 브라우저 및 캐시 문제 해결

#### A. 브라우저 새로고침
- Supabase Dashboard를 완전히 새로고침 (Ctrl+F5)
- 브라우저 캐시 삭제
- 시크릿 모드에서 테스트

#### B. 다른 브라우저에서 테스트
- Chrome, Firefox, Edge 등 다른 브라우저에서 확인

### 5. Supabase 프로젝트 재시작

#### A. 프로젝트 일시 중지
1. Supabase Dashboard → Settings → General
2. 프로젝트 일시 중지 (Pause Project)

#### B. 프로젝트 재시작
1. 몇 분 후 프로젝트 재시작 (Resume Project)
2. 동기화 설정 다시 확인

### 6. 대안 방법

#### A. 수동으로 동기화 설정
1. Supabase Dashboard → Database → Replication
2. "Add table to replication" 클릭
3. `payment_records` 테이블 선택
4. Real-time 활성화

#### B. Supabase CLI 사용
```bash
# Supabase CLI로 설정
supabase db reset
supabase db push
```

### 7. 최후의 수단

#### A. 테이블 재생성
```sql
-- 테이블 삭제
DROP TABLE IF EXISTS public.payment_records CASCADE;

-- 다시 생성 (complete_payment_records_setup.sql 실행)
```

#### B. Supabase 지원팀 문의
- 문제가 지속되면 Supabase 지원팀에 문의
- 테이블이 동기화 드롭다운에 나타나지 않는 문제 보고

## 확인 방법

### 1. SQL로 확인
```sql
-- 테이블이 publication에 있는지 확인
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_publication p
      JOIN pg_publication_rel pr ON p.oid = pr.prpubid
      JOIN pg_class c ON pr.prrelid = c.oid
      WHERE p.pubname = 'supabase_realtime'
      AND c.relname = 'payment_records'
    ) THEN 'READY FOR SYNC'
    ELSE 'NOT READY'
  END as sync_status;
```

### 2. Dashboard에서 확인
- 데이터 동기화 → 유연한 데이터 동기화 → 동기화 설정
- 대상 테이블 드롭다운에 `payment_records` 표시 확인

## 예상 원인
1. **Real-time publication 누락**: 테이블이 `supabase_realtime` publication에 추가되지 않음
2. **권한 문제**: 테이블에 대한 적절한 권한이 부여되지 않음
3. **캐시 문제**: Supabase Dashboard의 캐시 문제
4. **테이블 소유자 문제**: 테이블 소유자가 올바르지 않음
5. **RLS 정책 문제**: RLS 정책이 동기화를 방해함
