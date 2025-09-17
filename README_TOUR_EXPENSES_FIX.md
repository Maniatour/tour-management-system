# Tour Expenses 외래 키 제약 조건 문제 해결

## 문제 상황
데이터 동기화 과정에서 `tour_expenses` 테이블의 외래 키 제약 조건 위반이 발생하고 있습니다:

- `tour_expenses_product_id_fkey`: `product_id`가 `products` 테이블에 존재하지 않음
- `tour_expenses_tour_id_fkey`: `tour_id`가 `tours` 테이블에 존재하지 않음

## 해결 방법

### 1. 즉시 해결 (기존 데이터 수정)

다음 SQL 스크립트를 Supabase SQL Editor에서 실행하여 기존 데이터의 외래 키 문제를 해결하세요:

```sql
-- fix_tour_expenses_safe.sql 실행
-- 이 스크립트는 안전하게 유효하지 않은 외래 키 참조를 NULL로 설정합니다.
```

### 2. 향후 동기화 개선

`src/lib/flexibleSyncService.ts`에 `tour_expenses` 테이블에 대한 특별한 처리를 추가했습니다:

- 동기화 전에 외래 키 검증 수행
- 유효하지 않은 외래 키를 가진 레코드 자동 필터링
- 경고 메시지로 제외된 레코드 수 표시

### 3. 사용 방법

1. **기존 데이터 수정**:
   - Supabase 대시보드 → SQL Editor
   - `fix_tour_expenses_safe.sql` 내용 복사하여 실행

2. **데이터 동기화**:
   - 기존과 동일하게 데이터 동기화 페이지에서 `tour_expenses` 테이블 선택
   - 이제 외래 키 검증이 자동으로 수행됩니다

### 4. 주의사항

- `fix_tour_expenses_safe.sql`은 기존 데이터를 백업한 후 안전하게 수정합니다
- 유효하지 않은 외래 키 참조는 NULL로 설정되어 데이터 손실을 방지합니다
- 동기화 과정에서 제외된 레코드는 콘솔 로그에서 확인할 수 있습니다

### 5. 검증

수정 후 다음 쿼리로 문제가 해결되었는지 확인할 수 있습니다:

```sql
-- 유효하지 않은 tour_id 참조 확인
SELECT COUNT(*) FROM tour_expenses te
LEFT JOIN tours t ON te.tour_id = t.id
WHERE te.tour_id IS NOT NULL AND t.id IS NULL;

-- 유효하지 않은 product_id 참조 확인  
SELECT COUNT(*) FROM tour_expenses te
LEFT JOIN products p ON te.product_id = p.id
WHERE te.product_id IS NOT NULL AND p.id IS NULL;
```

두 쿼리 모두 0을 반환해야 합니다.
