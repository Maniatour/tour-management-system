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

### 3. 개발 서버 실행
```bash
npm run dev
```

### 4. 브라우저에서 확인
http://localhost:3000 으로 접속하여 애플리케이션을 확인하세요.

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
