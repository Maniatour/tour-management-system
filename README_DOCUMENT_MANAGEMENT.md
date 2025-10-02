# 여행사 전용 회사 문서 관리 시스템

여행사에서 필요한 다양한 문서를 체계적으로 관리하고 만료일을 추적할 수 있는 웹 애플리케이션입니다.

## 주요 기능

### 1. 리뉴얼 리마인더 기능
- **자동 알림**: 문서 만료일 30일 전, 7일 전, 만료 당일에 자동 알림
- **이메일 알림**: 설정된 이메일로 만료 알림 발송
- **대시보드 알림**: 웹 대시보드에서 알림 상태 확인 및 관리
- **알림 관리**: 대기중/발송완료/실패 상태별 필터링 및 관리

### 2. 문서 카테고리 관리
- **기본 카테고리**:
  - 계약/협약 (호텔 계약서, 제휴사 계약, 가이드 계약)
  - 보험/보증 (여행자 보험, 차량 보험, 영업 보증서)
  - 운송 관련 (차량 등록증, 운전면허, 정기 점검 기록)
  - 비자/허가증 (영업허가증, 사업자 등록증, 해외 비자 관련 서류)
  - 회계/세무 (세금 신고서, 납부 영수증, 회계감사 서류)
  - 기타 (내부 규정, 직원 교육 자료, 안전 매뉴얼)
- **동적 카테고리**: 카테고리 추가/수정/삭제 가능
- **커스터마이징**: 색상, 아이콘, 정렬 순서 설정

### 3. 문서 업로드 및 관리
- **파일 업로드**: PDF, Word 문서, 이미지 파일 지원 (최대 100MB)
- **메타데이터 관리**: 제목, 설명, 태그, 버전 정보
- **만료일 관리**: 발급일 기준 자동 만료일 계산 또는 수동 설정
- **검색 및 필터**: 제목, 설명, 태그로 검색, 카테고리별/만료상태별 필터
- **뷰 모드**: 그리드 뷰와 리스트 뷰 지원

### 4. 권한 관리
- **관리자**: 모든 문서 및 카테고리 관리 권한
- **일반 사용자**: 자신이 생성한 문서와 권한이 부여된 문서만 접근
- **문서별 권한**: 문서별로 개별 사용자 권한 설정 가능

### 5. 사용자 인터페이스
- **반응형 디자인**: 모바일, 태블릿, 데스크톱 지원
- **다국어 지원**: 한국어/영어 지원
- **직관적 UI**: 카드 기반 문서 표시, 드래그 앤 드롭 업로드
- **실시간 통계**: 전체/활성/만료예정/만료된 문서 수 표시

## 설치 및 설정

### 1. 데이터베이스 설정

먼저 `create_document_management_schema.sql` 파일을 Supabase에서 실행하세요:

```sql
-- 문서 관리 시스템을 위한 데이터베이스 스키마
-- 여행사 전용 회사 문서 관리 시스템

-- 1. 문서 카테고리 테이블
CREATE TABLE IF NOT EXISTS document_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name_ko VARCHAR(100) NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  description_ko TEXT,
  description_en TEXT,
  color VARCHAR(7) DEFAULT '#3B82F6',
  icon VARCHAR(50) DEFAULT 'file-text',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 문서 테이블
CREATE TABLE IF NOT EXISTS documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  category_id UUID REFERENCES document_categories(id) ON DELETE SET NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  
  -- 만료일 관련 필드
  issue_date DATE,
  expiry_date DATE,
  auto_calculate_expiry BOOLEAN DEFAULT false,
  validity_period_months INTEGER DEFAULT 12,
  
  -- 알림 설정
  reminder_30_days BOOLEAN DEFAULT true,
  reminder_7_days BOOLEAN DEFAULT true,
  reminder_expired BOOLEAN DEFAULT true,
  
  -- 메타데이터
  tags TEXT[],
  version VARCHAR(20) DEFAULT '1.0',
  status VARCHAR(20) DEFAULT 'active',
  
  -- 권한 및 소유자
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- 감사 로그
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 문서 알림 로그 테이블
CREATE TABLE IF NOT EXISTS document_reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  reminder_type VARCHAR(20) NOT NULL,
  reminder_date DATE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  sent_to_email VARCHAR(255),
  sent_to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 문서 접근 권한 테이블
CREATE TABLE IF NOT EXISTS document_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_type VARCHAR(20) NOT NULL,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(document_id, user_id, permission_type)
);

-- 5. 문서 다운로드 로그 테이블
CREATE TABLE IF NOT EXISTS document_download_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

-- 인덱스 및 RLS 정책, 함수들은 SQL 파일 참조
```

### 2. Storage 버킷 설정

Supabase Storage에서 `document-files` 버킷을 생성하고 다음 설정을 적용하세요:

- **Public**: false (비공개)
- **File size limit**: 100MB
- **Allowed MIME types**: 
  - application/pdf
  - application/msword
  - application/vnd.openxmlformats-officedocument.wordprocessingml.document
  - image/jpeg
  - image/png
  - image/gif

### 3. 환경 변수 설정

`.env.local` 파일에 Supabase 설정이 올바르게 되어 있는지 확인하세요:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 사용법

### 1. 문서 업로드
1. 관리자 페이지에서 "문서 업로드" 버튼 클릭
2. 파일 선택 (PDF, Word, 이미지)
3. 문서 정보 입력 (제목, 설명, 카테고리, 만료일 등)
4. 알림 설정 선택 (30일/7일/당일 알림)
5. 업로드 완료

### 2. 카테고리 관리
1. "카테고리 관리" 버튼 클릭
2. 새 카테고리 생성 또는 기존 카테고리 수정
3. 색상, 아이콘, 정렬 순서 설정
4. 저장

### 3. 알림 관리
1. "알림 관리" 버튼 클릭
2. 대기중/발송완료/실패 상태별 필터링
3. 대기중인 알림 수동 발송 가능
4. 발송 실패한 알림 재발송

### 4. 문서 검색 및 필터
- **검색**: 제목, 설명, 태그로 검색
- **카테고리 필터**: 특정 카테고리만 표시
- **만료 상태 필터**: 활성/만료예정/만료된 문서 필터
- **정렬**: 만료일/제목/생성일 기준 정렬
- **뷰 모드**: 그리드/리스트 뷰 전환

## 기술 스택

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **Authentication**: Supabase Auth
- **Internationalization**: next-intl
- **Icons**: Lucide React
- **Notifications**: Sonner

## 파일 구조

```
src/
├── app/[locale]/admin/documents/
│   └── page.tsx                    # 메인 문서 관리 페이지
├── components/documents/
│   ├── DocumentCard.tsx           # 문서 카드 컴포넌트
│   ├── DocumentFilters.tsx        # 검색 및 필터 컴포넌트
│   ├── DocumentUploadModal.tsx    # 문서 업로드 모달
│   ├── DocumentCategoryModal.tsx  # 카테고리 관리 모달
│   └── DocumentReminderDashboard.tsx # 알림 관리 대시보드
└── i18n/locales/
    ├── ko.json                    # 한국어 번역
    └── en.json                    # 영어 번역
```

## 주요 특징

### 1. 자동 만료일 계산
- 발급일 + 유효기간(개월) = 만료일 자동 계산
- 수동 만료일 설정도 가능

### 2. 스마트 알림 시스템
- 문서 생성 시 자동으로 알림 스케줄 생성
- 만료일 기준으로 30일/7일/당일 알림 설정
- 알림 발송 상태 추적 및 재발송 기능

### 3. 보안 및 권한
- Row Level Security (RLS) 적용
- 사용자별 문서 접근 권한 관리
- 다운로드 로그 기록

### 4. 확장성
- 카테고리 동적 추가/수정
- 태그 시스템으로 유연한 분류
- 버전 관리 지원

## 문제 해결

### 1. 파일 업로드 실패
- 파일 크기가 100MB를 초과하지 않는지 확인
- 지원되는 파일 형식인지 확인 (PDF, Word, 이미지)
- Supabase Storage 권한 설정 확인

### 2. 알림이 발송되지 않음
- 이메일 설정이 올바른지 확인
- 알림 상태를 "알림 관리"에서 확인
- 실패한 알림은 수동으로 재발송 가능

### 3. 권한 오류
- 사용자 역할이 올바르게 설정되었는지 확인
- 문서별 권한 설정 확인
- RLS 정책이 올바르게 적용되었는지 확인

## 향후 개선 사항

1. **이메일 서비스 연동**: 실제 이메일 발송 기능 구현
2. **문서 미리보기**: PDF 뷰어 기능 추가
3. **문서 버전 관리**: 동일 문서의 여러 버전 관리
4. **자동 갱신 알림**: 갱신 완료 시 알림 해제
5. **문서 템플릿**: 자주 사용하는 문서 템플릿 기능
6. **API 연동**: 외부 시스템과의 문서 동기화

## 라이선스

이 프로젝트는 여행사 전용으로 개발되었습니다.
