# Google API 통합 설정 가이드

Google Sheets API와 Google Drive API를 함께 사용하기 위한 통합 설정 가이드입니다.

## 📋 개요

이 시스템은 **Google Sheets API**와 **Google Drive API**를 모두 사용하며, 두 API는 **동일한 서비스 계정**을 공유합니다.

- **Google Sheets API**: 데이터 동기화 기능 (`/admin/data-sync`)
- **Google Drive API**: 투어 영수증 가져오기 기능

## 🔧 1단계: Google Cloud Console 설정

### 1.1 API 활성화

1. [Google Cloud Console](https://console.cloud.google.com/)에 접속
2. 프로젝트 선택 또는 새 프로젝트 생성
3. **APIs & Services** > **Library**로 이동
4. 다음 API들을 모두 활성화:
   - ✅ **Google Sheets API** (필수)
   - ✅ **Google Drive API** (필수)

### 1.2 서비스 계정 생성

1. **APIs & Services** > **Credentials**로 이동
2. **Create Credentials** > **Service Account** 클릭
3. 서비스 계정 이름 입력 (예: "tour-management-api")
4. **Create and Continue** 클릭
5. 권한은 기본값으로 두고 **Continue**
6. **Done** 클릭

### 1.3 서비스 계정 키 생성

1. 생성된 서비스 계정을 클릭
2. **Keys** 탭으로 이동
3. **Add Key** > **Create new key** 클릭
4. **JSON** 형식 선택 후 다운로드
5. 다운로드한 JSON 파일(`service-account-key.json`)을 안전한 곳에 보관

## 🔑 2단계: 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 생성하고 다음 내용을 추가하세요:

```env
# Google API 설정 (Google Sheets API & Google Drive API 공통)
GOOGLE_PROJECT_ID=your_project_id_here
GOOGLE_PRIVATE_KEY_ID=your_private_key_id_here
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_CONTENT_HERE\n-----END PRIVATE KEY-----\n"
GOOGLE_CLIENT_EMAIL=your_service_account_email@your_project_id.iam.gserviceaccount.com
GOOGLE_CLIENT_ID=your_client_id_here
```

### JSON 파일에서 값 추출

다운로드한 JSON 파일(`service-account-key.json`)에서 다음 값들을 찾아 복사하세요:

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

**중요**: `private_key` 값을 복사할 때 전체 키를 복사해야 하며, 줄바꿈 문자(`\n`)가 포함되어 있어야 합니다.

## 📁 3단계: Google 리소스 공유 설정

### 3.1 Google Sheet 공유

1. 동기화할 Google Sheet 열기
2. **공유** 버튼 클릭
3. 서비스 계정 이메일 추가 (`GOOGLE_CLIENT_EMAIL` 값)
4. 권한을 **"편집자"** 또는 **"뷰어"**로 설정
5. **완료** 클릭

### 3.2 Google Drive 폴더 공유 (영수증 기능 사용 시)

1. 영수증 이미지가 있는 구글 드라이브 폴더 열기
2. **공유** 버튼 클릭
3. 서비스 계정 이메일 추가 (`GOOGLE_CLIENT_EMAIL` 값)
4. 권한을 **"뷰어"**로 설정
5. **완료** 클릭

## 🚀 4단계: 개발 서버 재시작

환경 변수 설정 후 개발 서버를 재시작하세요:

```bash
npm run dev
```

## ✅ 5단계: 설정 확인

### Google Sheets API 테스트

1. `/admin/data-sync` 페이지로 이동
2. Google Sheet ID 입력
3. **시트 정보 확인** 버튼 클릭하여 연결 테스트

### Google Drive API 테스트

1. 투어 관리 페이지에서 **영수증 첨부** 메뉴 클릭
2. **구글 드라이브에서 가져오기** 버튼 클릭
3. 구글 드라이브 폴더 ID 입력
4. **목록 조회** 버튼 클릭하여 연결 테스트

## ⚠️ 문제 해결

### 오류: "The caller does not have permission"

**Google Sheets API 권한 오류:**
1. ✅ Google Cloud Console에서 "Google Sheets API"가 활성화되어 있는지 확인
2. ✅ 구글 시트에 서비스 계정 이메일이 공유되어 있는지 확인
3. ✅ 서비스 계정 권한이 "편집자" 또는 "뷰어"로 설정되어 있는지 확인

**Google Drive API 권한 오류:**
1. ✅ Google Cloud Console에서 "Google Drive API"가 활성화되어 있는지 확인
2. ✅ 구글 드라이브 폴더에 서비스 계정 이메일이 공유되어 있는지 확인
3. ✅ 서비스 계정 권한이 "뷰어" 이상으로 설정되어 있는지 확인

### 오류: "Google API 환경 변수가 설정되지 않았습니다"

- `.env.local` 파일에 모든 필수 환경 변수가 설정되어 있는지 확인
- 서버 재시작 필요

### 오류: "API not enabled"

- Google Cloud Console에서 해당 API가 활성화되어 있는지 확인
- API 활성화 후 몇 분 기다려야 할 수 있습니다

## 📚 추가 문서

- Google Sheets API 상세 설정: `GOOGLE_SHEETS_ENV_SETUP.md`
- Google Drive API 상세 설정: `GOOGLE_DRIVE_RECEIPTS_SETUP.md`

## 💡 참고사항

- `.env.local` 파일은 절대 Git에 커밋하지 마세요 (`.gitignore`에 포함되어 있어야 합니다)
- 서비스 계정 키는 안전하게 보관하세요
- 두 API는 같은 서비스 계정을 사용하므로, 환경 변수를 한 번만 설정하면 됩니다

