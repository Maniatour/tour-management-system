# 구글 시트 데이터 동기화 설정 가이드

## 1. 구글 클라우드 콘솔 설정

### 1.1 프로젝트 생성
1. [Google Cloud Console](https://console.cloud.google.com/)에 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택

### 1.2 Google Sheets API 활성화
1. "API 및 서비스" > "라이브러리" 이동
2. "Google Sheets API" 검색 후 활성화

### 1.3 서비스 계정 생성
1. "API 및 서비스" > "사용자 인증 정보" 이동
2. "사용자 인증 정보 만들기" > "서비스 계정" 선택
3. 서비스 계정 이름 입력 (예: "tour-management-sync")
4. 서비스 계정 ID 자동 생성 확인
5. "만들기 및 계속하기" 클릭

### 1.4 서비스 계정 키 생성
1. 생성된 서비스 계정 클릭
2. "키" 탭 이동
3. "키 추가" > "새 키 만들기" > "JSON" 선택
4. JSON 키 파일 다운로드

## 2. 구글 시트 공유 설정

### 2.1 시트 공유
1. 동기화할 구글 시트 열기
2. "공유" 버튼 클릭
3. 서비스 계정 이메일 추가 (1.3에서 생성한 이메일)
4. 권한을 "편집자"로 설정

### 2.2 시트 구조 확인
시트는 다음과 같은 구조여야 합니다:

**Reservations 시트:**
- 예약번호 (id), 고객명, 이메일, 전화번호, 성인수 (adults), 아동수 (child), 유아수 (infant), 총인원 (total_people)
- 투어날짜 (tour_date), 투어시간 (tour_time), 상품ID (product_id), 투어ID (tour_id)
- 픽업호텔 (pickup_hotel), 픽업시간 (pickup_time), 채널 (channel), 채널RN (channel_rn)
- 추가자 (added_by), 상태 (status), 특이사항 (event_note), 개인투어 (is_private_tour)

**Tours 시트:**
- 투어ID (id), 상품ID (product_id), 투어날짜 (tour_date), 투어상태 (tour_status)
- 가이드이메일 (tour_guide_id), 어시스턴트이메일 (assistant_id), 차량ID (tour_car_id), 개인투어 (is_private_tour)

## 3. 환경 변수 설정

`.env.local` 파일에 다음 변수들을 추가하세요:

```env
# 구글 시트 API 설정
GOOGLE_PROJECT_ID=your_google_project_id
GOOGLE_PRIVATE_KEY_ID=your_private_key_id
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
GOOGLE_CLIENT_EMAIL=your_service_account_email
GOOGLE_CLIENT_ID=your_client_id
```

### 3.1 환경 변수 값 찾기
다운로드한 JSON 키 파일에서 다음 값들을 찾아 복사하세요:

```json
{
  "type": "service_account",
  "project_id": "your-project-id",           // GOOGLE_PROJECT_ID
  "private_key_id": "your-private-key-id",   // GOOGLE_PRIVATE_KEY_ID
  "private_key": "-----BEGIN PRIVATE KEY-----\n...", // GOOGLE_PRIVATE_KEY
  "client_email": "service-account@project.iam.gserviceaccount.com", // GOOGLE_CLIENT_EMAIL
  "client_id": "your-client-id",             // GOOGLE_CLIENT_ID
  ...
}
```

## 4. 사용 방법

### 4.1 관리자 페이지 접속
1. `/admin/data-sync` 페이지로 이동
2. 구글 시트 ID 입력 (URL에서 `/d/` 다음의 긴 문자열)
3. 시트명 설정 (기본값: Reservations, Tours)

### 4.2 동기화 실행
1. **시트 정보 확인**: 시트의 구조와 데이터를 미리 확인
2. **전체 업로드**: 모든 데이터를 새로 업로드
3. **주기적 동기화**: 변경된 데이터만 업데이트

### 4.3 스프레드시트 ID 찾기
구글 시트 URL에서 ID를 추출하세요:
```
https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
                                    ↑ 이 부분이 스프레드시트 ID
```

## 5. 주기적 동기화 설정

### 5.1 Cron Job 설정 (선택사항)
서버에서 주기적으로 동기화를 실행하려면:

```bash
# 매시간 동기화
0 * * * * curl -X POST https://your-domain.com/api/sync/periodic \
  -H "Content-Type: application/json" \
  -d '{"spreadsheetId":"YOUR_SPREADSHEET_ID"}'
```

### 5.2 Vercel Cron (Vercel 배포 시)
`vercel.json` 파일에 cron 설정 추가:

```json
{
  "crons": [
    {
      "path": "/api/sync/periodic",
      "schedule": "0 * * * *"
    }
  ]
}
```

## 6. 문제 해결

### 6.1 인증 오류
- 서비스 계정 이메일이 시트에 공유되었는지 확인
- 환경 변수가 올바르게 설정되었는지 확인
- JSON 키 파일의 형식이 올바른지 확인

### 6.2 데이터 매핑 오류
- 시트의 컬럼명이 정확한지 확인
- `src/lib/syncService.ts`의 `COLUMN_MAPPING` 확인 및 수정

### 6.3 권한 오류
- 서비스 계정에 충분한 권한이 있는지 확인
- Google Sheets API가 활성화되었는지 확인

## 7. 컬럼 매핑 커스터마이징

`src/lib/syncService.ts` 파일의 `COLUMN_MAPPING` 객체를 수정하여 시트의 컬럼명과 데이터베이스 컬럼명을 매핑할 수 있습니다:

```typescript
const COLUMN_MAPPING = {
  '예약번호': 'reservation_id',
  '고객명': 'customer_name',
  '이메일': 'customer_email',
  // ... 추가 매핑
}
```
