# 밤도깨비 투어 특별 정보 기능 (캐시 시스템)

## 개요
밤도깨비 투어(MDGCSUNRISE) 상품에 대해 다음 정보를 표시합니다:
- 그랜드캐년 사우스림 일출 시간
- 자이온 캐년 일몰 시간  
- 그랜드캐년 사우스림 날씨
- 자이온 캐년 날씨
- 페이지 시티 날씨

## 캐시 시스템
API 호출을 최소화하기 위해 데이터베이스에 캐시 시스템을 구축했습니다:
- **일출/일몰 시간**: 한 번 수집 후 재사용 (변화가 적음)
- **날씨 데이터**: 투어 7일 전부터 하루에 한 번 수집
- **API 호출 최적화**: 캐시된 데이터 우선 사용, API는 fallback으로만 사용

## 설정 방법

### 1. 데이터베이스 마이그레이션
```bash
# Supabase에서 마이그레이션 실행
supabase db push
```

### 2. OpenWeatherMap API 키 발급
1. [OpenWeatherMap](https://openweathermap.org/api)에 가입
2. 무료 API 키 발급 (월 1,000회 호출 제한)
3. 프로젝트 루트에 `.env.local` 파일 생성

### 3. 환경변수 설정
`.env.local` 파일에 다음 내용 추가:
```
NEXT_PUBLIC_OPENWEATHER_API_KEY=your_api_key_here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. 데이터 수집 스케줄러 설정
매일 자동으로 데이터를 수집하려면 cron job을 설정하세요:

```bash
# 매일 오전 6시에 다음 7일간의 데이터 수집
0 6 * * * curl -X GET "https://your-domain.com/api/weather-scheduler"
```

또는 수동으로 데이터 수집:
```bash
# 특정 날짜 데이터 수집
curl -X POST "https://your-domain.com/api/weather-collector" \
  -H "Content-Type: application/json" \
  -d '{"date": "2024-12-15"}'

# 여러 날짜 데이터 수집
curl -X PUT "https://your-domain.com/api/weather-collector" \
  -H "Content-Type: application/json" \
  -d '{"startDate": "2024-12-15", "endDate": "2024-12-21"}'
```

## 컴포넌트 구조

### GoblinTourWeather 컴포넌트
- 위치: `src/components/GoblinTourWeather.tsx`
- 기능: 밤도깨비 투어 전용 날씨 및 일출/일몰 정보 표시
- 조건: `productId === 'MDGCSUNRISE'`일 때만 렌더링

### Weather API 함수들
- 위치: `src/lib/weatherApi.ts`
- `getSunriseSunsetData()`: 캐시된 일출/일몰 데이터 우선 사용
- `getWeatherData()`: 캐시된 날씨 데이터 우선 사용
- `getGoblinTourWeatherData()`: 밤도깨비 투어 전용 데이터 통합

### 데이터 수집 API
- 위치: `src/app/api/weather-collector/route.ts`
- POST: 특정 날짜 데이터 수집
- PUT: 여러 날짜 데이터 수집

### 스케줄러 API
- 위치: `src/app/api/weather-scheduler/route.ts`
- GET: 다음 7일간 데이터 자동 수집

## 데이터베이스 구조

### sunrise_sunset_data 테이블
- 일출/일몰 시간 캐시
- 위치별, 날짜별 고유 데이터

### weather_data 테이블
- 날씨 정보 캐시
- 위치별, 날짜별 고유 데이터

## 좌표 정보
- 그랜드캐년 사우스림: 36.1069, -112.1129
- 자이온 캐년: 37.2982, -113.0263
- 페이지 시티: 36.9147, -111.4558

## API 제한사항 및 최적화
- **OpenWeatherMap 무료 계정**: 월 1,000회 호출 제한
- **Sunrise-Sunset API**: 무제한 (광고 포함)
- **캐시 시스템**: API 호출을 90% 이상 절약
- **자동 수집**: 투어 7일 전부터 하루에 한 번 수집
- **Fallback**: 캐시 미스 시에만 API 호출

## 오류 처리
- API 호출 실패 시 기본값 표시
- 로딩 상태 표시
- 에러 메시지 표시
- 캐시 데이터 우선 사용으로 안정성 향상

## 사용법
1. 투어 관리 시스템에 로그인
2. 밤도깨비 투어(MDGCSUNRISE) 상품의 투어 상세 페이지 접속
3. 투어 정보 섹션 아래에 특별 정보가 표시되는지 확인
4. 캐시된 데이터가 없으면 API에서 실시간 데이터 가져옴
