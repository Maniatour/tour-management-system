# 계층적 관광지 관리 시스템

## 개요

투어 코스 관리 시스템을 개선하여 관광지의 계층적 구조를 효율적으로 관리할 수 있는 시스템입니다. 기존의 단순한 투어 코스 관리를 넘어서 복잡한 관광지 구조를 체계적으로 정리하고 관리할 수 있습니다.

## 주요 기능

### 1. 계층적 관광지 구조
- **3단계 계층 구조**: 투어 → 관광지 → 세부 포인트
- **예시 구조**:
  ```
  밤도깨비 투어
  ├── 그랜드캐년 (1단계)
  │   ├── 사우스림 (2단계)
  │   │   ├── 마더 포인트 (3단계)
  │   │   ├── 야바파이 포인트 (3단계)
  │   │   └── 림트레일 (마더 포인트 → 야바파이 포인트)
  │   ├── 이스트림 (2단계)
  │   └── 웨스트림 (2단계)
  ├── 앤텔로프 캐년 (1단계)
  └── 홀스슈 밴드 (1단계)
  ```

### 2. 상세한 관광지 정보 관리
- **기본 정보**: 한국어/영어 이름, 설명
- **위치 정보**: 주소, 좌표, Google Maps 연동
- **투어 정보**: 체류 시간, 입장료 (성인/어린이/유아)
- **내부 노트**: 관리자만 볼 수 있는 가이드 노트
- **카테고리**: 자연 관광지, 문화재, 체험 시설 등

### 3. 관광지 간 연결 관리
- **트레일/경로**: 관광지 간 이동 경로
- **거리 및 소요시간**: 정확한 이동 정보
- **난이도**: 쉬움/보통/어려움
- **연결 타입**: 트레일, 도로, 교통수단 등

### 4. 사진 관리
- **다중 사진**: 각 관광지별 여러 사진 업로드
- **대표 사진**: 메인 이미지 설정
- **정렬**: 사진 순서 관리

## 데이터베이스 구조

### 주요 테이블

#### 1. `tours` - 투어 테이블
```sql
- id: UUID (Primary Key)
- name_ko: 한국어 이름
- name_en: 영어 이름
- description_ko: 한국어 설명
- description_en: 영어 설명
- internal_note: 내부 노트
- is_active: 활성 상태
```

#### 2. `attractions` - 관광지 테이블 (계층적)
```sql
- id: UUID (Primary Key)
- tour_id: 투어 참조
- parent_id: 상위 관광지 참조 (자기 참조)
- name_ko: 한국어 이름
- name_en: 영어 이름
- description_ko: 고객용 설명
- description_en: 영어 설명
- internal_note: 가이드용 내부 노트
- location: 위치 정보
- latitude/longitude: 좌표
- google_maps_url: Google Maps 링크
- place_id: Google Place ID
- visit_duration: 체류 시간 (분)
- admission_fee_*: 입장료 (성인/어린이/유아)
- level: 계층 레벨 (1, 2, 3)
- sort_order: 정렬 순서
- path: 계층 경로 (예: "1/2/3")
```

#### 3. `attraction_connections` - 관광지 연결 테이블
```sql
- id: UUID (Primary Key)
- from_attraction_id: 시작 관광지
- to_attraction_id: 도착 관광지
- connection_type: 연결 타입 (trail, path, road, transport)
- name_ko/name_en: 연결 경로 이름
- description_ko/description_en: 설명
- internal_note: 내부 노트
- distance_km: 거리 (킬로미터)
- duration_minutes: 소요 시간 (분)
- difficulty_level: 난이도 (easy, medium, hard)
```

#### 4. `attraction_photos` - 관광지 사진 테이블
```sql
- id: UUID (Primary Key)
- attraction_id: 관광지 참조
- file_name: 파일명
- file_path: 파일 경로
- file_size: 파일 크기
- file_type: 파일 타입
- mime_type: MIME 타입
- thumbnail_url: 썸네일 URL
- is_primary: 대표 사진 여부
- sort_order: 정렬 순서
```

#### 5. `attraction_categories` - 관광지 카테고리 테이블
```sql
- id: UUID (Primary Key)
- name_ko/name_en: 카테고리 이름
- description_ko/description_en: 설명
- icon: 아이콘 이름
- color: 카테고리 색상
- sort_order: 정렬 순서
```

## 사용자 인터페이스

### 관리자 인터페이스 (`/admin/hierarchical-attractions`)
- **계층적 트리 뷰**: 관광지 구조를 시각적으로 표시
- **드래그 앤 드롭**: 계층 구조 변경
- **실시간 편집**: 인라인 편집 기능
- **대량 관리**: 여러 관광지 동시 처리
- **검색 및 필터링**: 투어별, 카테고리별 필터
- **사진 관리**: 드래그 앤 드롭 사진 업로드

### 가이드 인터페이스 (`/guide/hierarchical-attractions`)
- **읽기 전용 뷰**: 관광지 정보 조회
- **내부 노트 표시**: 가이드용 노트 확인
- **모바일 최적화**: 현장에서 쉽게 사용
- **오프라인 지원**: 네트워크 없이도 기본 정보 확인
- **검색 기능**: 빠른 관광지 찾기

## 주요 특징

### 1. 자동 계층 경로 관리
- 관광지 추가/이동 시 자동으로 `path` 필드 업데이트
- 트리거를 통한 실시간 계층 구조 유지

### 2. 다국어 지원
- 한국어/영어 완전 지원
- 고객용 설명과 가이드용 내부 노트 분리

### 3. Google Maps 연동
- 자동 좌표 검색
- Google Maps 링크 생성
- Place ID 저장

### 4. 권한 관리
- RLS (Row Level Security) 적용
- 관리자/가이드 권한 분리
- 내부 노트는 관리자만 수정 가능

### 5. 성능 최적화
- 계층 구조 인덱싱
- 캐싱을 통한 빠른 로딩
- 최적화된 쿼리

## 설치 및 설정

### 1. 데이터베이스 스키마 적용
```bash
# Supabase에서 SQL 스크립트 실행
psql -h your-db-host -U your-username -d your-database -f hierarchical_attractions_schema.sql
```

### 2. 환경 변수 설정
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 3. 권한 설정
- 관리자: 모든 기능 사용 가능
- 가이드: 읽기 전용 + 내부 노트 확인
- 고객: 접근 불가

## 사용 예시

### 1. 새 투어 생성
1. 관리자 페이지에서 "새 투어" 클릭
2. 투어 기본 정보 입력
3. 관광지 추가 (1단계)
4. 하위 관광지 추가 (2단계, 3단계)
5. 관광지 간 연결 설정

### 2. 관광지 정보 관리
1. 관광지 선택
2. 기본 정보, 위치, 가격 정보 입력
3. Google Maps에서 위치 확인
4. 사진 업로드
5. 내부 노트 작성

### 3. 가이드 사용
1. 가이드 페이지에서 관광지 정보 확인
2. 내부 노트 토글로 가이드 정보 확인
3. 모바일에서 현장 정보 확인
4. 연결 경로로 이동 계획 수립

## 확장 가능성

### 1. 추가 기능
- **실시간 위치 추적**: 가이드의 현재 위치 표시
- **AR 지원**: 증강현실로 관광지 정보 표시
- **음성 안내**: TTS를 통한 자동 안내
- **다국어 확장**: 일본어, 중국어 등 추가

### 2. 통합 기능
- **예약 시스템 연동**: 관광지별 예약 관리
- **가격 관리**: 동적 가격 설정
- **리뷰 시스템**: 고객 리뷰 통합
- **분석 대시보드**: 방문 통계 및 분석

## 문제 해결

### 1. 일반적인 문제
- **계층 구조 오류**: `path` 필드 수동 업데이트
- **권한 오류**: RLS 정책 확인
- **사진 업로드 실패**: 스토리지 권한 확인

### 2. 성능 최적화
- **느린 로딩**: 인덱스 추가 확인
- **메모리 사용량**: 페이지네이션 적용
- **캐시 문제**: 브라우저 캐시 클리어

## 지원 및 문의

시스템 사용 중 문제가 발생하거나 개선 사항이 있으시면 개발팀에 문의해주세요.

---

**버전**: 1.0.0  
**최종 업데이트**: 2024년 12월  
**개발팀**: 투어 관리 시스템 개발팀
