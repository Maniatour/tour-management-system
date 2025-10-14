# 상담 관리 시스템 (Consultation Management System)

## 개요
투어 관리 시스템의 상담 관리 기능으로, FAQ 템플릿과 상담 안내를 체계적으로 관리할 수 있는 시스템입니다.

## 주요 기능

### 1. FAQ 템플릿 관리
- **다국어 지원**: 한국어/영어 버전 동시 관리
- **카테고리별 분류**: 일반 문의, 예약 관련, 가격 문의, 투어 정보, 정책 및 규정
- **상품별/채널별 맞춤 안내**: 특정 상품이나 채널에만 적용되는 템플릿 설정
- **템플릿 타입**: FAQ, 인사말, 마무리, 정책, 일반
- **우선순위 설정**: 템플릿 표시 순서 조정

### 2. 템플릿 상태 관리
- **활성화/비활성화**: 템플릿 사용 여부 제어
- **즐겨찾기**: 자주 사용하는 템플릿 표시
- **사용 통계**: 템플릿 사용 횟수 및 마지막 사용 시간 추적

### 3. 복사 & 붙여넣기 기능
- **원클릭 복사**: 템플릿 답변을 클립보드에 복사
- **사용 횟수 자동 증가**: 복사 시 사용 통계 업데이트
- **언어별 복사**: 선택한 언어에 맞는 답변 복사

### 4. 필터링 및 검색
- **다중 필터**: 카테고리, 상품, 채널별 필터링
- **실시간 검색**: 질문/답변 내용 및 태그 검색
- **상태별 표시**: 활성화/비활성화, 즐겨찾기만 표시 옵션

### 5. 향후 확장 기능
- **상담 로그**: 고객 상담 기록 관리
- **통계 대시보드**: 상담 통계 및 분석
- **봇 채팅 연동**: AI 챗봇 데이터로 활용

## 데이터베이스 구조

### 테이블 구성
1. **consultation_categories**: 상담 템플릿 카테고리
2. **consultation_templates**: FAQ 및 상담 템플릿
3. **consultation_logs**: 상담 기록 (향후 구현)
4. **consultation_stats**: 상담 통계 (향후 구현)

### 주요 필드
- **다국어 필드**: name_ko, name_en, question_ko, question_en, answer_ko, answer_en
- **관계 필드**: product_id, channel_id, category_id
- **상태 필드**: is_active, is_favorite, template_type
- **통계 필드**: usage_count, last_used_at, priority

## 사용 방법

### 1. 템플릿 추가
1. "새 템플릿 추가" 버튼 클릭
2. 카테고리, 상품, 채널 선택 (선택사항)
3. 한국어/영어 질문과 답변 입력
4. 템플릿 타입, 우선순위, 태그 설정
5. 활성화/즐겨찾기 상태 설정
6. 저장

### 2. 템플릿 사용
1. 원하는 템플릿 찾기 (검색/필터 활용)
2. 복사 버튼 클릭하여 클립보드에 복사
3. 상담 시 붙여넣기로 사용

### 3. 템플릿 관리
- **즐겨찾기**: 별표 버튼으로 즐겨찾기 토글
- **활성화**: 눈 아이콘으로 활성화/비활성화 토글
- **편집**: 편집 버튼으로 내용 수정
- **삭제**: 삭제 버튼으로 템플릿 제거

## 기술 스택
- **Frontend**: Next.js 14, React, TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Icons**: Lucide React
- **State Management**: React Hooks

## 파일 구조
```
src/
├── app/[locale]/admin/consultation/
│   └── page.tsx                    # 상담 관리 메인 페이지
├── types/
│   └── consultation.ts             # 상담 관리 타입 정의
├── lib/
│   └── database.types.ts           # 데이터베이스 타입 (업데이트됨)
└── components/
    └── AdminSidebarAndHeader.tsx   # 사이드바 메뉴 (업데이트됨)

create_consultation_management_schema.sql  # 데이터베이스 스키마
```

## 설치 및 실행

### 1. 데이터베이스 스키마 실행
```sql
-- Supabase SQL Editor에서 실행
-- create_consultation_management_schema.sql 파일 내용 실행
```

### 2. 개발 서버 실행
```bash
npm run dev
```

### 3. 접속
```
http://localhost:3000/ko/admin/consultation
```

## 샘플 데이터
시스템 설치 시 다음 샘플 데이터가 자동으로 생성됩니다:

### 카테고리
- 일반 문의 (General Inquiries)
- 예약 관련 (Booking Related)
- 가격 문의 (Pricing Inquiries)
- 투어 정보 (Tour Information)
- 정책 및 규정 (Policies & Rules)

### 템플릿
- 투어 참여 인원 제한
- 예약 취소 정책
- 어린이 요금 안내
- 투어 포함/불포함 사항

## 향후 개발 계획
1. **상담 로그 관리**: 고객 상담 기록 저장 및 조회
2. **통계 대시보드**: 상담 통계 및 분석 차트
3. **AI 챗봇 연동**: 템플릿을 활용한 자동 응답 시스템
4. **템플릿 버전 관리**: 템플릿 수정 이력 추적
5. **고급 검색**: 자연어 검색 및 AI 기반 추천

## 주의사항
- 템플릿 삭제 시 복구가 불가능하므로 신중하게 삭제하세요
- 다국어 템플릿의 경우 두 언어 모두 입력하는 것을 권장합니다
- 템플릿 사용 통계는 복사 버튼 클릭 시에만 증가합니다
