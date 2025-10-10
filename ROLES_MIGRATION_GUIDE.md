# 사용자 역할 시스템 마이그레이션 가이드

## 개요
기존의 position 기반 역할 시스템을 새로운 역할-권한 기반 시스템으로 마이그레이션합니다.

## 마이그레이션 단계

### 1단계: 데이터베이스 스키마 생성
```sql
-- Supabase SQL Editor에서 실행
-- 파일: database/migrations/001_create_roles_system.sql
```

### 2단계: 기존 데이터 마이그레이션
```sql
-- Supabase SQL Editor에서 실행
-- 파일: database/migrations/002_migrate_team_to_roles.sql
```

### 3단계: 애플리케이션 코드 업데이트
- ✅ `src/lib/roles.ts` - 새로운 역할 시스템으로 업데이트
- ✅ `src/contexts/AuthContext.tsx` - 새로운 역할 조회 로직 적용
- ✅ `src/components/auth/AdminAuthGuard.tsx` - 새로운 권한 체크 로직 적용

## 새로운 시스템 구조

### 테이블 구조
1. **roles** - 역할 정의 (super_admin, admin, manager, staff, customer)
2. **permissions** - 권한 정의 (can_view_admin, can_manage_users 등)
3. **user_roles** - 사용자-역할 연결
4. **role_permissions** - 역할-권한 연결

### 역할 계층
- **super_admin**: 모든 권한
- **admin**: 대부분 관리 권한 (재무 조회 제외)
- **manager**: 제한된 관리 권한
- **staff**: 기본 업무 권한
- **customer**: 일반 사용자 권한

### 권한 목록
- `can_view_admin`: 관리자 페이지 접근
- `can_manage_users`: 사용자 관리
- `can_manage_products`: 상품 관리
- `can_manage_customers`: 고객 관리
- `can_manage_reservations`: 예약 관리
- `can_manage_tours`: 투어 관리
- `can_manage_team`: 팀 관리
- `can_view_schedule`: 일정 조회
- `can_manage_bookings`: 예약 관리
- `can_view_audit_logs`: 감사 로그 조회
- `can_manage_channels`: 채널 관리
- `can_manage_options`: 옵션 관리
- `can_view_finance`: 재무 조회

## 호환성
- 기존 `team` 테이블의 `position` 기반 시스템과 병행 지원
- 점진적 마이그레이션 가능
- 기존 코드와의 호환성 유지

## 테스트
1. 슈퍼 관리자 이메일로 로그인 테스트
2. 기존 team 멤버들의 역할 확인
3. 권한별 페이지 접근 테스트
4. 새로운 사용자 역할 할당 테스트

## 롤백 계획
문제 발생 시 기존 시스템으로 롤백:
1. 새로운 테이블들 삭제
2. 기존 `roles.ts` 파일 복원
3. `AuthContext.tsx` 및 `AdminAuthGuard.tsx` 복원
