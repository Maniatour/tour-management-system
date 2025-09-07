# 투어 관리 시스템

가이드를 위한 투어 스케줄 및 고객 관리 시스템입니다. Next.js와 Supabase를 사용하여 구축되었습니다.

## 주요 기능

### 1. 가이드 스케줄 관리
- 날짜별 투어 스케줄 확인
- 투어별 고객 정보 및 연락처 확인
- 투어 완료 처리 및 상태 관리

### 2. 고객 관리
- 고객 정보 등록, 수정, 삭제
- 고객 검색 및 필터링
- 고객별 투어 이력 관리

### 3. 예약 관리
- 투어 예약 생성 및 관리
- 예약 상태 관리 (대기중, 확정, 완료, 취소)
- 참가자 수 및 가격 정보 관리

### 4. 투어 관리
- 투어 상품 등록 및 관리
- 투어 설명, 소요시간, 가격, 최대 참가자 수 설정
- 투어별 상세 정보 관리

### 5. 투어 보고서
- 투어 완료 후 보고서 작성
- 날씨, 하이라이트, 어려웠던 점, 고객 피드백 기록
- 투어 성과 분석을 위한 데이터 수집

### 6. 사용자 인증 및 역할 관리 시스템
- 이메일/비밀번호 회원가입 및 로그인
- 구글 OAuth 소셜 로그인
- 이메일 인증 및 비밀번호 재설정
- 보호된 라우트 및 사용자 세션 관리
- 사용자 프로필 관리
- **역할 기반 접근 제어 (RBAC)**:
  - **고객 (Customer)**: 투어 상품 조회, 스케줄 확인
  - **팀원 (Team Member)**: 고객 관리, 예약 관리, 투어 관리, 스케줄 보기
  - **매니저 (Manager)**: 모든 관리 기능 접근
  - **관리자 (Admin)**: 시스템 전체 관리 권한

## 기술 스택

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS
- **Backend**: Supabase (Database, Authentication)
- **UI Components**: Lucide React Icons
- **Form Management**: React Hook Form
- **Validation**: Zod

## 설치 및 실행

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경 변수 설정
`.env.local` 파일을 생성하고 다음 내용을 추가하세요:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### 3. Supabase 인증 설정
Supabase 대시보드에서 다음 설정을 완료하세요:

1. **Authentication > Settings**에서 이메일 인증 활성화
2. **Authentication > Providers**에서 Google OAuth 설정:
   - Google OAuth 활성화
   - Client ID와 Client Secret 설정
   - **중요**: Redirect URL은 Supabase에서 자동으로 생성됩니다. 
   - Supabase 대시보드의 **Authentication > URL Configuration**에서 **Site URL** 아래에 표시되는 **Redirect URLs**를 확인하세요.
   - 일반적으로 `https:/tyilwbytyuqrhxekjxcd.supabase.co/auth/v1/callback` 형식입니다.
3. **Authentication > URL Configuration**에서:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/auth/callback`

### 4. Google Cloud Console 설정
Google Cloud Console에서 OAuth 2.0 클라이언트 ID를 생성하고 다음 설정을 완료하세요:

1. **Google Cloud Console** > **API 및 서비스** > **인증 정보**로 이동
2. **OAuth 2.0 클라이언트 ID** 생성
3. **승인된 리디렉션 URI**에 다음 URL 추가:
   - Supabase에서 확인한 실제 리다이렉트 URI (예: `https://your-project-ref.supabase.co/auth/v1/callback`)
   - `http://localhost:3000/auth/callback` (개발용)
4. **승인된 JavaScript 원본**에 다음 URL 추가:
   - `http://localhost:3000`
   - `https://your-domain.com` (프로덕션용)

### 🔧 Google OAuth 오류 해결

**Error 400: redirect_uri_mismatch** 오류가 발생하는 경우:

1. **Supabase 리다이렉트 URI 확인**:
   - Supabase 대시보드 > Authentication > URL Configuration
   - "Redirect URLs" 섹션에서 실제 URI를 복사하세요

2. **Google Cloud Console에서 URI 업데이트**:
   - Google Cloud Console > API 및 서비스 > 인증 정보
   - OAuth 2.0 클라이언트 ID 선택
   - "승인된 리디렉션 URI"에 Supabase URI를 정확히 추가

3. **변경사항 적용 대기**:
   - Google Cloud Console 변경사항은 몇 분 후에 적용됩니다
   - 브라우저 캐시를 지우고 다시 시도하세요

### 5. 개발 서버 실행
```bash
npm run dev
```

### 6. 브라우저에서 확인
http://localhost:3000 으로 접속하여 애플리케이션을 확인하세요.

## 사용자 역할 및 권한

### 🔐 역할별 접근 권한

#### 1. **고객 (Customer)**
- **접근 가능**: 투어 상품 조회, 스케줄 확인
- **접근 불가**: 관리자 기능, 데이터 수정
- **사용 시나리오**: 투어 예약을 원하는 일반 고객

#### 2. **팀원 (Team Member)**
- **접근 가능**: 
  - 고객 관리 (조회, 수정)
  - 예약 관리 (생성, 수정, 조회)
  - 투어 관리 (생성, 수정, 조회)
  - 스케줄 보기
  - 부킹 관리
- **접근 불가**: 팀 관리, 시스템 설정
- **사용 시나리오**: 투어 가이드, 어시스턴트

#### 3. **매니저 (Manager)**
- **접근 가능**: 모든 팀원 권한 + 팀 관리
- **추가 권한**:
  - 팀원 관리 (추가, 수정, 삭제)
  - 감사 로그 조회
  - 채널 관리
  - 옵션 관리
- **사용 시나리오**: 팀 리더, 부서장

#### 4. **관리자 (Admin)**
- **접근 가능**: 모든 시스템 기능
- **특별 권한**: 시스템 전체 관리
- **사용 시나리오**: 시스템 관리자

### 👥 팀원 등록 방법

1. **Supabase 팀 테이블에 사용자 추가**:
   ```sql
   INSERT INTO team (name_ko, name_en, email, phone, position, department, role, is_active)
   VALUES ('홍길동', 'Hong Gil Dong', 'user@example.com', '010-1234-5678', '투어 가이드', '투어 운영팀', 'member', true);
   ```

2. **역할 설정**:
   - `member`: 팀원
   - `manager`: 매니저  
   - `admin`: 관리자

3. **사용자 로그인**: 등록된 이메일로 로그인하면 자동으로 해당 역할이 적용됩니다.

### 🔧 Admin 계정 설정 (중요!)

**Admin 계정으로 로그인했는데 고객용 페이지가 나오는 경우:**

기존 team 테이블의 `position`과 `is_active` 컬럼을 활용하여 역할을 구분합니다.

#### 1단계: 기존 사용자를 Super(Admin)로 설정

**Supabase SQL Editor에서 다음 스크립트를 실행하세요:**

```sql
-- 기존 사용자를 Super(Admin)로 설정 (실제 사용할 이메일로 변경)
UPDATE public.team 
SET 
  position = 'Super',  -- Super는 최고 관리자 역할
  is_active = true     -- 활성 상태로 설정
WHERE email = 'your-admin-email@example.com';
```

#### 2단계: 새로운 Super 사용자 추가 (선택사항)

```sql
-- 새로운 Super 사용자 추가
INSERT INTO public.team (
  email, name_ko, name_en, phone, position, is_active
) VALUES (
  'admin@tour.com',  -- 실제 admin 이메일로 변경
  '관리자', 
  'Administrator', 
  '010-0000-0000', 
  'Super',  -- Super는 최고 관리자 역할
  true      -- is_active = true
) ON CONFLICT (email) DO UPDATE SET
  position = 'Super',
  is_active = true;
```

#### 3단계: 역할별 Position 설정 예시

```sql
-- Office Manager 설정 (Manager 역할)
UPDATE public.team 
SET position = 'Office Manager', is_active = true
WHERE email = 'manager@example.com';

-- Tour Guide 설정 (Team Member 역할)
UPDATE public.team 
SET position = 'Tour Guide', is_active = true
WHERE email = 'guide@example.com';

-- OP 설정 (Team Member 역할)
UPDATE public.team 
SET position = 'OP', is_active = true
WHERE email = 'op@example.com';

-- Driver 설정 (Team Member 역할)
UPDATE public.team 
SET position = 'Driver', is_active = true
WHERE email = 'driver@example.com';
```

#### 4단계: 역할 인식 규칙

시스템은 `position` 컬럼의 값을 기반으로 역할을 자동 인식합니다:

- **Admin**: `position = 'Super'` (최고 관리자)
- **Manager**: `position = 'Office Manager'` (사무 관리자)  
- **Team Member**: `position IN ('Tour Guide', 'OP', 'Driver')` (투어 가이드, 운영, 운전사)
- **Customer**: `team` 테이블에 없거나 `is_active = false`

#### 5단계: 브라우저에서 확인

1. 개발자 도구 콘솔을 열어주세요
2. 페이지를 새로고침하세요
3. Admin 계정으로 로그인하면 관리자 페이지가 표시됩니다

### 🚀 대시보드 접근

- **고객**: `http://localhost:3000/dashboard` - 고객용 대시보드
- **팀원/관리자**: `http://localhost:3000/admin` - 관리자 대시보드
- **역할별 메뉴**: 로그인 후 사용자 역할에 따라 다른 메뉴가 표시됩니다.

## 프로젝트 구조

```
src/
├── app/                    # Next.js App Router
│   ├── customers/         # 고객 관리 페이지
│   ├── reservations/      # 예약 관리 페이지
│   ├── tours/            # 투어 관리 페이지
│   ├── schedule/         # 가이드 스케줄 페이지
│   ├── layout.tsx        # 메인 레이아웃
│   └── page.tsx          # 홈 페이지
├── components/            # 재사용 가능한 컴포넌트
│   └── Navigation.tsx    # 메인 네비게이션
└── lib/                  # 유틸리티 및 설정
    └── supabase.ts       # Supabase 클라이언트 설정
```

## 주요 페이지

### 홈 페이지 (`/`)
- 시스템 개요 및 통계
- 빠른 액션 버튼
- 최근 활동 내역

### 가이드 스케줄 (`/schedule`)
- 날짜별 투어 스케줄 확인
- 고객 연락처 정보 확인
- 투어 보고서 작성
- 투어 완료 처리

### 고객 관리 (`/customers`)
- 고객 목록 조회 및 검색
- 고객 정보 추가/수정/삭제
- 고객별 상세 정보 관리

### 예약 관리 (`/reservations`)
- 투어 예약 생성 및 관리
- 예약 상태 변경
- 참가자 수 및 가격 관리

### 투어 관리 (`/tours`)
- 투어 상품 등록 및 관리
- 투어 정보 수정
- 투어별 상세 설정

## 데이터베이스 스키마

### 주요 테이블
- `customers`: 고객 정보
- `tours`: 투어 상품 정보
- `reservations`: 예약 정보
- `tour_reports`: 투어 보고서
- `guides`: 가이드 정보
- `tour_options`: 투어 옵션
- `tour_courses`: 투어 코스

## 향후 개발 계획

- [ ] Supabase 연동 및 실제 데이터베이스 연결
- [ ] 사용자 인증 및 권한 관리
- [ ] 투어 옵션 및 코스 관리 페이지
- [ ] 상품 관리 페이지
- [ ] 투어 정산 및 수익 분석
- [ ] 모바일 반응형 UI 개선
- [ ] 실시간 알림 시스템
- [ ] 파일 업로드 (사진, 문서)

## 기여 방법

1. 이 저장소를 포크합니다
2. 새로운 기능 브랜치를 생성합니다 (`git checkout -b feature/amazing-feature`)
3. 변경사항을 커밋합니다 (`git commit -m 'Add some amazing feature'`)
4. 브랜치에 푸시합니다 (`git push origin feature/amazing-feature`)
5. Pull Request를 생성합니다

## 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 문의

프로젝트에 대한 문의사항이 있으시면 이슈를 생성해 주세요.
