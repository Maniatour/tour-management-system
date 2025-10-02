# 투어 코스 관리 - 구글 맵 연동 기능

## 🗺️ 구글 맵 연동 기능

투어 코스 관리 시스템에 구글 맵 API를 연동하여 위치 검색 및 선택 기능을 추가했습니다.

### ✨ 주요 기능

1. **위치 검색 및 선택**
   - 구글 플레이스 API를 사용한 실시간 위치 검색
   - 검색 결과에서 위치 선택 시 자동으로 좌표 및 주소 입력
   - 구글 맵 링크 자동 생성 및 저장

2. **다중 위치 관리**
   - 메인 위치 (투어 코스 전체 위치)
   - 시작점 위치 (투어 시작 지점)
   - 종료점 위치 (투어 종료 지점)

3. **구글 맵 링크 저장**
   - 각 위치별 구글 맵 링크 자동 저장
   - 투어 코스 카드에서 구글 맵 링크 클릭으로 바로 이동 가능

### 🔧 설정 방법

#### 1. Google Cloud Console 설정

1. [Google Cloud Console](https://console.cloud.google.com/)에 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. **APIs & Services** > **Library**로 이동
4. 다음 API들을 활성화:
   - **Maps JavaScript API**
   - **Geocoding API**
   - **Places API**

#### 2. API 키 생성

1. **APIs & Services** > **Credentials**로 이동
2. **Create Credentials** > **API Key** 클릭
3. 생성된 API 키를 복사

#### 3. 환경변수 설정

프로젝트 루트에 `.env.local` 파일 생성:

```bash
# Google Maps API Key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_actual_api_key_here

# 기존 Supabase 설정
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

#### 4. API 키 제한 설정 (보안)

**HTTP referrers 제한 (권장)**:
- **Application restrictions** > **HTTP referrers (web sites)** 선택
- 다음 패턴 추가:
  ```
  localhost:3000/*
  yourdomain.com/*
  *.yourdomain.com/*
  ```

**API 제한**:
- **API restrictions** > **Restrict key** 선택
- 다음 API만 선택:
  - Maps JavaScript API
  - Geocoding API
  - Places API

### 📊 데이터베이스 스키마

#### 추가된 필드들

**tour_courses 테이블**:
- `google_maps_url` - 메인 위치 구글 맵 링크
- `place_id` - 메인 위치 구글 플레이스 ID
- `start_google_maps_url` - 시작점 구글 맵 링크
- `start_place_id` - 시작점 구글 플레이스 ID
- `end_google_maps_url` - 종료점 구글 맵 링크
- `end_place_id` - 종료점 구글 플레이스 ID

**tour_course_points 테이블**:
- `google_maps_url` - 포인트 구글 맵 링크
- `place_id` - 포인트 구글 플레이스 ID

### 🚀 사용 방법

#### 1. 데이터베이스 스키마 적용

Supabase 대시보드에서 `update_tour_courses_schema_with_maps.sql` 파일을 실행하세요.

#### 2. 투어 코스 생성/수정

1. 투어 코스 관리 페이지에서 "새 투어 코스" 또는 "수정" 클릭
2. 위치 정보 섹션에서:
   - **메인 위치 검색**: 전체 투어 코스의 메인 위치 검색
   - **시작점 위치 검색**: 투어 시작 지점 검색
   - **종료점 위치 검색**: 투어 종료 지점 검색
3. 검색 결과에서 원하는 위치 선택
4. 자동으로 좌표, 주소, 구글 맵 링크가 입력됨

#### 3. 구글 맵 링크 확인

- 투어 코스 카드에서 위치 정보 옆의 링크 아이콘 클릭
- 새 탭에서 구글 맵이 열림

### 🔍 위치 검색 기능

- **실시간 검색**: 타이핑하는 동안 실시간으로 검색 결과 표시
- **다양한 결과**: 장소명, 주소, 좌표 정보를 포함한 검색 결과
- **자동 완성**: 구글 플레이스 API의 자동 완성 기능 활용
- **정확한 좌표**: 선택한 위치의 정확한 위도/경도 자동 입력

### 💡 사용 팁

1. **정확한 위치 검색**: 구체적인 주소나 장소명으로 검색하면 더 정확한 결과를 얻을 수 있습니다.
2. **좌표 확인**: 검색 결과에서 좌표 정보를 확인하여 올바른 위치인지 검증하세요.
3. **구글 맵 링크**: 저장된 구글 맵 링크를 통해 고객이나 가이드가 쉽게 위치를 찾을 수 있습니다.

### ⚠️ 주의사항

- Google Maps API는 사용량에 따라 과금됩니다
- 무료 할당량이 있지만 초과 시 비용이 발생할 수 있습니다
- API 키를 절대 공개 저장소에 커밋하지 마세요
- 프로덕션에서는 적절한 도메인 제한을 설정하세요

### 🛠️ 문제 해결

#### InvalidKeyMapError
- API 키가 올바른지 확인
- Maps JavaScript API가 활성화되었는지 확인
- 도메인 제한이 올바르게 설정되었는지 확인

#### API 로드 실패
- 네트워크 연결 확인
- 브라우저 개발자 도구에서 오류 메시지 확인
- API 키 권한 확인

#### 위치 검색이 작동하지 않음
- 환경변수 `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`가 올바르게 설정되었는지 확인
- Places API가 활성화되었는지 확인
- 브라우저 콘솔에서 오류 메시지 확인
