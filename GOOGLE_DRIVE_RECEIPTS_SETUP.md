# 구글 드라이브 영수증 가져오기 설정 가이드

구글 드라이브에 저장된 투어 영수증 이미지를 Supabase로 자동으로 가져오는 기능 설정 방법입니다.

## 📋 전제 조건

1. 구글 드라이브에 영수증 이미지가 저장되어 있어야 합니다.
2. 파일명 형식: `ID.Image.xxxxxx.jpg` (ID 부분이 투어 ID입니다)
3. Google Cloud 서비스 계정이 설정되어 있어야 합니다.

## 🔧 1단계: Google Cloud Console 설정

### 1.1 Google Drive API 활성화

1. [Google Cloud Console](https://console.cloud.google.com/)에 접속
2. 프로젝트 선택 또는 새 프로젝트 생성
3. **APIs & Services** > **Library**로 이동
4. "Google Drive API" 검색 후 활성화

### 1.2 서비스 계정 생성

1. **APIs & Services** > **Credentials**로 이동
2. **Create Credentials** > **Service Account** 클릭
3. 서비스 계정 이름 입력 (예: "drive-receipts-reader")
4. **Create and Continue** 클릭
5. 권한은 기본값으로 두고 **Continue**
6. **Done** 클릭

### 1.3 서비스 계정 키 생성

1. 생성된 서비스 계정을 클릭
2. **Keys** 탭으로 이동
3. **Add Key** > **Create new key** 클릭
4. **JSON** 형식 선택 후 다운로드
5. 다운로드한 JSON 파일을 안전한 곳에 보관

### 1.4 구글 드라이브 폴더 공유

1. 영수증 이미지가 있는 구글 드라이브 폴더 열기
2. **공유** 버튼 클릭
3. 서비스 계정 이메일 주소 입력 (JSON 파일의 `client_email` 값)
4. 권한을 **뷰어**로 설정
5. **완료** 클릭

## 🔑 2단계: 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 생성하거나 기존 파일에 다음 내용을 추가하세요:

```env
# Google Drive API 설정 (기존 Google Sheets 설정과 동일한 서비스 계정 사용 가능)
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

## 📁 3단계: 구글 드라이브 폴더 ID 확인

### 방법 1: URL에서 추출

구글 드라이브 폴더를 열고 주소창에서 폴더 ID를 확인하세요:

```
https://drive.google.com/drive/folders/FOLDER_ID_HERE
```

예시:
- URL: `https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j`
- 폴더 ID: `1a2b3c4d5e6f7g8h9i0j`

### 방법 2: 폴더 공유 링크에서 추출

폴더 공유 링크에서도 폴더 ID를 확인할 수 있습니다:

```
https://drive.google.com/drive/folders/FOLDER_ID_HERE?usp=sharing
```

## 📝 4단계: 파일명 형식

영수증 이미지 파일명은 다음 형식을 따라야 합니다:

```
{EXPENSE_ID}.Image.{RANDOM_STRING}.{EXTENSION}
```

예시:
- `expense-001.Image.abc123.jpg` → Expense ID: `expense-001`
- `12345.Image.xyz789.png` → Expense ID: `12345`

**중요**: 파일명의 ID 부분은 `tour_expenses` 테이블의 `id` 컬럼 값이어야 합니다. 시스템은 이 ID를 사용하여 해당 레코드를 찾고 `image_url`과 `file_path`를 업데이트합니다.

## 🚀 5단계: 사용 방법

### 영수증 모달에서 사용

1. 투어 관리 시스템에서 **영수증 첨부** 메뉴 클릭
2. **구글 드라이브에서 가져오기** 버튼 클릭
3. 구글 드라이브 폴더 ID 입력
4. **목록 조회** 버튼 클릭하여 폴더 내 영수증 목록 확인
5. **전체 가져오기** 또는 개별 **가져오기** 버튼으로 영수증 가져오기

### API 엔드포인트 사용

#### 영수증 목록 조회
```bash
GET /api/google-drive/receipts?folderId={FOLDER_ID}
```

#### 단일 영수증 가져오기
```bash
POST /api/google-drive/receipts
Content-Type: application/json

{
  "fileId": "file_id_from_google_drive",
  "expenseId": "optional_expense_id",
  "submittedBy": "user@example.com"
}
```

#### 일괄 가져오기
```bash
PUT /api/google-drive/receipts
Content-Type: application/json

{
  "folderId": "folder_id_from_google_drive",
  "submittedBy": "user@example.com"
}
```

## ⚠️ 주의사항

1. **파일명 형식**: 파일명에서 expense ID를 추출할 수 없으면 가져오지 않습니다.
2. **레코드 존재 여부**: `tour_expenses` 테이블에 해당 expense ID가 존재해야 합니다.
3. **업데이트 방식**: 기존 레코드의 `image_url`과 `file_path`가 업데이트됩니다. 새로운 레코드는 생성하지 않습니다.
4. **API 할당량**: 구글 드라이브 API 할당량을 고려하여 파일 간 약간의 지연이 있습니다.

## 🔍 문제 해결

### 오류: "Google Drive API 환경 변수가 설정되지 않았습니다"

- `.env.local` 파일에 필요한 환경 변수가 모두 설정되어 있는지 확인
- 서버 재시작 필요

### 오류: "파일명에서 expense ID를 추출할 수 없습니다"

- 파일명이 `ID.Image.xxxxxx.jpg` 형식인지 확인
- 파일명의 첫 번째 부분이 `tour_expenses` 테이블의 `id` 값과 일치하는지 확인

### 오류: "Expense ID에 해당하는 레코드를 찾을 수 없습니다"

- `tour_expenses` 테이블에 해당 expense ID가 존재하는지 확인
- 파일명의 ID 형식이 데이터베이스의 expense ID 형식과 일치하는지 확인

### 오류: "Supabase Storage에 파일 업로드 중 오류"

- Supabase Storage 버킷 `tour-expenses`가 생성되어 있는지 확인
- 버킷의 권한 설정 확인

## 📚 추가 정보

- [Google Drive API 문서](https://developers.google.com/drive/api/v3/about-sdk)
- [Supabase Storage 문서](https://supabase.com/docs/guides/storage)

