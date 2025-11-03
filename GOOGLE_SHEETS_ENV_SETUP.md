# Google Sheets API 환경 변수 설정 가이드

## 1. Google Cloud Console에서 서비스 계정 생성

1. [Google Cloud Console](https://console.cloud.google.com/)에 접속
2. 프로젝트 생성 또는 기존 프로젝트 선택
3. **중요**: "API 및 서비스" > "라이브러리"에서 다음 API들을 활성화:
   - ✅ **Google Sheets API** (필수)
   - ✅ **Google Drive API** (투어 영수증 기능 사용 시 필수)
4. "API 및 서비스" > "사용자 인증 정보"에서 서비스 계정 생성
5. 서비스 계정 키를 JSON 형식으로 다운로드

## 2. 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 생성하고 다음 내용을 추가하세요:

```env
# Google Sheets API 설정
GOOGLE_PROJECT_ID=your_project_id_here
GOOGLE_PRIVATE_KEY_ID=your_private_key_id_here
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_CONTENT_HERE\n-----END PRIVATE KEY-----\n"
GOOGLE_CLIENT_EMAIL=your_service_account_email@your_project_id.iam.gserviceaccount.com
GOOGLE_CLIENT_ID=your_client_id_here
```

## 3. JSON 키 파일에서 값 추출

다운로드한 JSON 파일에서 다음 값들을 찾아 복사하세요:

```json
{
  "type": "service_account",
  "project_id": "your-project-id",           // → GOOGLE_PROJECT_ID
  "private_key_id": "your-private-key-id",   // → GOOGLE_PRIVATE_KEY_ID
  "private_key": "-----BEGIN PRIVATE KEY-----\n...", // → GOOGLE_PRIVATE_KEY
  "client_email": "service-account@project.iam.gserviceaccount.com", // → GOOGLE_CLIENT_EMAIL
  "client_id": "your-client-id",             // → GOOGLE_CLIENT_ID
  ...
}
```

## 4. Google Sheet 공유 설정

1. 동기화할 Google Sheet 열기
2. "공유" 버튼 클릭
3. 서비스 계정 이메일 추가 (GOOGLE_CLIENT_EMAIL 값, 예: `xxxxx@xxxxx.iam.gserviceaccount.com`)
4. 권한을 **"편집자"** 또는 **"뷰어"**로 설정 (읽기 전용이면 "뷰어"도 가능)
5. **중요**: "알림 전송" 체크박스를 해제해도 됩니다 (선택사항)

### 권한 오류 발생 시 확인사항

**"The caller does not have permission" 오류가 발생하는 경우:**

1. ✅ Google Cloud Console에서 "Google Sheets API"가 활성화되어 있는지 확인
   - "API 및 서비스" > "라이브러리" > "Google Sheets API" 검색 > 활성화
2. ✅ 구글 시트에 서비스 계정 이메일이 공유되어 있는지 확인
   - 시트에서 "공유" 버튼 클릭 > 서비스 계정 이메일이 목록에 있는지 확인
3. ✅ 서비스 계정 권한이 올바르게 설정되어 있는지 확인
   - "편집자" 또는 "뷰어" 권한이 있어야 합니다

## 5. 개발 서버 재시작

환경 변수 설정 후 개발 서버를 재시작하세요:

```bash
npm run dev
```

## 6. 테스트

1. `/admin/data-sync` 페이지로 이동
2. Google Sheet ID 입력
3. "시트 정보 확인" 버튼 클릭하여 연결 테스트

## 주의사항

- `.env.local` 파일은 절대 Git에 커밋하지 마세요
- 프라이빗 키는 전체를 복사하되, `\n`을 실제 줄바꿈으로 변경하세요 (환경 변수에서는 `\n` 그대로 사용해도 됩니다)
- 서비스 계정 이메일이 Google Sheet에 공유되어야 합니다
- Google Drive API와 Google Sheets API를 모두 사용하는 경우, 두 API 모두 활성화되어 있어야 합니다

## 관련 문서

- 투어 영수증 기능 사용 시: `GOOGLE_DRIVE_RECEIPTS_SETUP.md` 참조
