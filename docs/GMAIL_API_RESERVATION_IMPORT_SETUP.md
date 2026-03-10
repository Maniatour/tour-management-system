# Gmail API로 예약 이메일 자동 수신 설정 가이드

Gmail 받은편지함에 **예약 알림 메일**이 오면, 우리 서버가 **Gmail API**로 그 메일을 읽어와서 **예약 가져오기** 목록에 자동으로 넣는 방식입니다.  
Resend·도메인·유료 없이, **Google 계정 하나**로 설정할 수 있어요.

---

## 1. 전체 흐름 한 줄 요약

1. **Google Cloud**에서 프로젝트 만들고 **Gmail API** 켜기  
2. **OAuth 동의 화면** 설정 후 **클라이언트 ID/비밀** 발급  
3. 우리 앱에 **Gmail 연결** 버튼 추가 → 사용자가 한 번만 **Google 로그인·권한 허용**  
4. 서버가 **주기적으로**(또는 트리거로) Gmail에서 새 메일 조회 → 파싱 후 **예약 가져오기** API로 저장  

이 문서는 **1~2번(Google Cloud 설정)** 까지 하고, 3~4번은 앱 구현 시 참고용으로 적어 둡니다.

---

## 2. 미리 준비할 것

- **Google 계정** (예약 메일이 도착하는 Gmail 주소)
- **Google Cloud Console** 접속 가능한 환경
- 우리 서비스 **실제 URL** (OAuth 리디렉션용)  
  예: `https://tour.maniatour.com`

---

## 3. Google Cloud 프로젝트 만들기

1. **[Google Cloud Console](https://console.cloud.google.com/)** 접속 후 로그인
2. 상단 **프로젝트 선택** 드롭다운 클릭 → **새 프로젝트**
3. **프로젝트 이름** 입력 (예: `tour-reservation-import`) → **만들기**
4. 만들어진 프로젝트를 **선택**한 상태로 다음 단계로

---

## 4. Gmail API 사용 설정

1. 왼쪽 메뉴(☰) → **API 및 서비스** → **라이브러리**
2. 검색창에 **Gmail API** 입력
3. **Gmail API** 카드 클릭 → **사용** 버튼 클릭  
   → “API 사용 설정됨” 메시지가 나오면 완료

---

## 5. OAuth 동의 화면 설정

Gmail을 “우리 앱이 대신 읽는다”고 하려면, **OAuth 동의 화면**에서 “어떤 앱이, 어떤 권한을 쓰는지”를 Google에 알려줘야 합니다.

1. 왼쪽 메뉴 → **API 및 서비스** → **OAuth 동의 화면**
2. **User Type** 선택  
   - **내부**: 같은 Google 워크스페이스 사람만 사용 (회사 Gmail만 쓸 때)  
   - **외부**: 일반 Gmail 등 누구나 사용 가능 → **만들기** 클릭
3. **앱 정보** 입력  
   - **앱 이름**: 예) `예약 가져오기`  
   - **사용자 지원 이메일**: 본인 이메일 선택  
   - **개발자 연락처 정보**: 이메일 입력  
   - **저장 후 계속**
4. **범위(Scopes)**  
   - **범위 추가 또는 삭제** 클릭  
   - 범위 검색에 `gmail.readonly` 또는 `gmail.modify` 입력  
   - **Gmail API** 아래에서 아래 중 선택 후 **업데이트**  
     - `https://www.googleapis.com/auth/gmail.readonly` — 메일 읽기만  
     - `https://www.googleapis.com/auth/gmail.modify` — 읽기 + 레이블 등 수정 (읽음 처리 등에 유리)  
   - **저장 후 계속**
5. **테스트 사용자** (외부로 만들었을 때)  
   - “앱이 테스트 중”이면 **테스트 사용자 추가**에서 예약 메일 받는 Gmail 주소 추가  
   - **저장 후 계속** → **대시보드로 돌아가기**

---

## 6. OAuth 2.0 클라이언트 ID 만들기

우리 앱이 Google 로그인 창을 띄우고, 사용자 동의 후 **토큰**을 받으려면 **클라이언트 ID**가 필요합니다.

1. 왼쪽 메뉴 → **API 및 서비스** → **사용자 인증 정보**
2. **+ 사용자 인증 정보 만들기** → **OAuth 클라이언트 ID**
3. **애플리케이션 유형**: **웹 애플리케이션**
4. **이름**: 예) `예약 가져오기 웹`
5. **승인된 리디렉션 URI**  
   - **URI 추가** 클릭 후 아래 **정확한 URL**을 하나씩 추가 (경로·슬래시·http/https 모두 일치해야 함)  
   - **로컬 개발**: `http://localhost:3000/api/email/gmail/auth`  
   - **운영(실서비스)**: `https://실제도메인/api/email/gmail/auth`  
     예: `https://tour.maniatour.com/api/email/gmail/auth` 또는 `https://kovegas.com/api/email/gmail/auth`  
   - 사용하는 환경(로컬/운영)마다 **각각 한 줄씩** 추가하고 **저장**해야 400 redirect_uri_mismatch 가 나지 않습니다.
6. **만들기** 클릭
7. **클라이언트 ID**와 **클라이언트 보안 비밀**이 뜸  
   - **클라이언트 ID**: `xxxxx.apps.googleusercontent.com`  
   - **클라이언트 보안 비밀**: 비밀값  
   → 이 두 개를 **복사해서 안전한 곳에 메모** (환경 변수에 넣을 예정)

---

## 7. 환경 변수에 넣기

우리 서버(또는 Next.js 앱)에서 Gmail OAuth를 쓰려면 아래 값을 설정합니다.

| 변수 이름 | 설명 | 예시 |
|-----------|------|------|
| `GOOGLE_GMAIL_CLIENT_ID` | 6번에서 복사한 클라이언트 ID | `123456789-xxx.apps.googleusercontent.com` |
| `GOOGLE_GMAIL_CLIENT_SECRET` | 6번에서 복사한 클라이언트 보안 비밀 | `GOCSPX-xxxxx` |

- **로컬**: 프로젝트 루트 `.env.local` 에 추가  
- **Vercel 등**: 프로젝트 **Settings** → **Environment Variables** 에 추가  

주의: **클라이언트 보안 비밀**은 외부에 노출되지 않도록 서버/환경 변수에서만 사용하세요.

---

## 8. 우리 앱에서 쓸 때 흐름 (구현 참고)

Gmail API 연동을 **코드로** 넣을 때 참고할 대략적인 흐름입니다.

1. **Gmail 연결 페이지**  
   - “Gmail 연결” 버튼 → Google OAuth URL로 이동  
   - `scope` 에 `gmail.readonly` 또는 `gmail.modify` 포함  
   - `redirect_uri` = 6번에서 등록한 콜백 URL
2. **콜백 API** (`/api/auth/gmail/callback` 등)  
   - 쿼리로 받은 `code` 로 **액세스 토큰 + 리프레시 토큰** 교환  
   - **리프레시 토큰**을 DB나 암호화된 저장소에 **해당 사용자(또는 팀)와 연결**해 저장
3. **주기적 조회 (Cron / 스케줄러)**  
   - 저장된 리프레시 토큰으로 **액세스 토큰** 재발급  
   - Gmail API `users.messages.list` (예: `labelIds: ['INBOX']`, `q: 'is:unread'` 등) 로 **새 메일 ID 목록** 조회  
   - 각 ID로 `users.messages.get` 해서 **제목·본문** 가져오기  
   - 우리 파서로 예약 정보 추출 후 **POST /api/reservation-imports** 로 전달  
     body: `{ subject, text, from, message_id }`  
   - 처리한 메일은 **읽음 처리** 또는 **레이블**로 “처리됨” 표시 (중복 방지)
4. **에러 처리**  
   - 리프레시 토큰 만료/취소 시 → “Gmail 다시 연결” 안내

실제 엔드포인트 경로·DB 스키마·스케줄 간격은 프로젝트에 맞게 정하면 됩니다.

---

## 9. 한 페이지 체크리스트

- [ ] Google Cloud Console에서 **프로젝트** 생성
- [ ] **Gmail API** 사용 설정 (라이브러리에서 사용)
- [ ] **OAuth 동의 화면** 설정 (앱 이름, 범위: `gmail.readonly` 또는 `gmail.modify`, 테스트 사용자)
- [ ] **OAuth 2.0 클라이언트 ID** 생성 (웹 앱, 리디렉션 URI 등록)
- [ ] **클라이언트 ID** / **클라이언트 보안 비밀** 복사
- [ ] 환경 변수 `GOOGLE_GMAIL_CLIENT_ID`, `GOOGLE_GMAIL_CLIENT_SECRET` 설정
- [ ] 앱에 **Gmail 연결·콜백·주기 조회** 로직 구현 (8번 흐름 참고)

이 순서까지 하면 **Gmail API로 예약 이메일 자동 수신**을 셋업할 수 있습니다.  
구체적인 코드 예시가 필요하면 “Gmail 연결 API 라우트 예시”, “messages.list 호출 예시” 등으로 따로 문서를 이어서 적을 수 있어요.
