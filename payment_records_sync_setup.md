# Payment Records 동기화 설정 가이드

## 문제 해결 단계

### 1. RLS 정책 설정
먼저 `setup_payment_records_rls.sql` 파일을 Supabase SQL Editor에서 실행하세요.

### 2. Supabase Dashboard에서 확인

#### A. 테이블 확인
1. Supabase Dashboard → Table Editor
2. `payment_records` 테이블이 있는지 확인
3. 테이블이 없다면 제공된 스키마로 생성

#### B. RLS 정책 확인
1. Supabase Dashboard → Authentication → Policies
2. `payment_records` 테이블에 대한 정책이 있는지 확인
3. 없다면 `setup_payment_records_rls.sql` 실행

### 3. 데이터 동기화 설정

#### A. Real-time 설정
1. Supabase Dashboard → Database → Replication
2. `payment_records` 테이블을 Real-time으로 설정
3. 또는 SQL로 설정:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_records;
```

#### B. 동기화 설정에서 테이블이 보이지 않는 경우
1. **브라우저 새로고침**: Supabase Dashboard를 완전히 새로고침
2. **권한 확인**: 관리자 권한으로 로그인했는지 확인
3. **테이블 재생성**: 테이블을 삭제하고 다시 생성
4. **RLS 비활성화 후 재활성화**:
```sql
ALTER TABLE public.payment_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;
```

### 4. 테이블이 여전히 보이지 않는 경우

#### A. 수동으로 동기화 설정 추가
```sql
-- Real-time 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_records;

-- 동기화를 위한 추가 설정
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_records TO anon;
```

#### B. Supabase CLI 사용 (선택사항)
```bash
# Supabase CLI로 동기화 설정
supabase db reset
supabase db push
```

### 5. 확인 방법

#### A. 테이블 접근 테스트
```sql
-- 테이블이 정상적으로 접근되는지 확인
SELECT COUNT(*) FROM public.payment_records;
```

#### B. Real-time 구독 테스트
```javascript
// JavaScript에서 Real-time 구독 테스트
const channel = supabase
  .channel('payment_records')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'payment_records' },
    (payload) => console.log('Payment record change:', payload)
  )
  .subscribe();
```

## 문제가 지속되는 경우

1. **Supabase 지원팀 문의**: 테이블이 동기화 설정에 나타나지 않는 경우
2. **프로젝트 재시작**: Supabase 프로젝트를 일시적으로 중지 후 재시작
3. **새 프로젝트 생성**: 최후의 수단으로 새 프로젝트에 마이그레이션

## 추가 참고사항

- `payment_records` 테이블은 `reservations` 테이블과 외래키 관계가 있습니다
- RLS 정책은 `team` 테이블의 활성 사용자만 접근을 허용합니다
- Real-time 구독을 위해서는 테이블이 `supabase_realtime` publication에 추가되어야 합니다
