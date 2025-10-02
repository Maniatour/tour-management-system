# Supabase 스토리지 정책 설정 가이드

Supabase 대시보드에서 투어 자료 스토리지 버킷의 정책을 설정하는 방법입니다.

## 1. Supabase 대시보드 접속

1. [Supabase 대시보드](https://supabase.com/dashboard)에 로그인
2. 해당 프로젝트 선택
3. 좌측 메뉴에서 **Storage** 클릭

## 2. 스토리지 버킷 생성 확인

- `tour-materials` 버킷이 생성되어 있는지 확인
- 버킷이 없다면 `create_tour_materials_storage.sql` 스크립트를 먼저 실행

## 3. 스토리지 정책 설정

### 3.1 Policies 탭으로 이동
- Storage 페이지에서 **Policies** 탭 클릭

### 3.2 정책 추가

#### 정책 1: 파일 읽기 권한
- **New Policy** 클릭
- **Policy Name**: `투어 자료 읽기`
- **Target Roles**: `authenticated`
- **Operation**: `SELECT`
- **Policy Definition**:
```sql
bucket_id = 'tour-materials'
```

#### 정책 2: 파일 업로드 권한
- **New Policy** 클릭
- **Policy Name**: `투어 자료 업로드`
- **Target Roles**: `authenticated`
- **Operation**: `INSERT`
- **Policy Definition**:
```sql
bucket_id = 'tour-materials' AND
EXISTS (
  SELECT 1 FROM team 
  WHERE team.email = auth.email() 
  AND team.position IN ('super', 'office manager')
)
```

#### 정책 3: 파일 업데이트 권한
- **New Policy** 클릭
- **Policy Name**: `투어 자료 업데이트`
- **Target Roles**: `authenticated`
- **Operation**: `UPDATE`
- **Policy Definition**:
```sql
bucket_id = 'tour-materials' AND
EXISTS (
  SELECT 1 FROM team 
  WHERE team.email = auth.email() 
  AND team.position IN ('super', 'office manager')
)
```

#### 정책 4: 파일 삭제 권한
- **New Policy** 클릭
- **Policy Name**: `투어 자료 삭제`
- **Target Roles**: `authenticated`
- **Operation**: `DELETE`
- **Policy Definition**:
```sql
bucket_id = 'tour-materials' AND
EXISTS (
  SELECT 1 FROM team 
  WHERE team.email = auth.email() 
  AND team.position IN ('super', 'office manager')
)
```

## 4. 정책 활성화 확인

- 각 정책이 **Enabled** 상태인지 확인
- 필요시 토글 스위치로 활성화/비활성화 가능

## 5. 테스트

### 5.1 관리자 계정으로 테스트
1. 관리자 계정으로 로그인
2. 투어 자료 업로드 시도
3. 파일 업로드가 정상적으로 작동하는지 확인

### 5.2 가이드 계정으로 테스트
1. 가이드 계정으로 로그인
2. 투어 자료 페이지 접근
3. 파일 다운로드가 정상적으로 작동하는지 확인

## 6. 문제 해결

### 파일 업로드 실패
- 관리자 권한 확인
- 정책이 올바르게 설정되었는지 확인
- 브라우저 콘솔에서 오류 메시지 확인

### 파일 다운로드 실패
- 인증 상태 확인
- 정책이 올바르게 설정되었는지 확인
- 파일 경로가 올바른지 확인

### 권한 오류
- 사용자 역할 확인 (`team` 테이블의 `position` 필드)
- 정책 조건 확인
- RLS가 활성화되어 있는지 확인

## 7. 추가 설정

### 파일 크기 제한 조정
- 버킷 설정에서 `file_size_limit` 수정
- 기본값: 100MB (104857600 bytes)

### 허용 파일 형식 추가
- 버킷 설정에서 `allowed_mime_types` 배열에 추가
- 예: `'application/vnd.ms-excel'` (Excel 파일)

### 공개 접근 설정
- 버킷이 `public`으로 설정되어 있으면 인증 없이도 접근 가능
- 보안을 위해 `private`로 설정하고 정책으로 제어하는 것을 권장

## 8. 모니터링

### 스토리지 사용량 확인
- Storage 페이지에서 전체 사용량 모니터링
- 개별 파일 크기 및 개수 확인

### 접근 로그 확인
- Supabase 대시보드의 Logs 섹션에서 접근 로그 확인
- 오류 및 성능 문제 모니터링
