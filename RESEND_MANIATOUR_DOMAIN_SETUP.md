# Resend maniatour.com 도메인 설정 가이드

## 개요
인터널 사이트(kovegas.com)에서 이메일을 발송하되, 발신자를 `info@maniatour.com`으로 설정하기 위해 `maniatour.com` 도메인을 Resend에 인증해야 합니다.

## 현재 상황
- ✅ 인터널 사이트: `kovegas.com` (이미 Resend에 연결됨)
- ✅ 발신자 이메일: `info@maniatour.com` (Google Workspace에 등록됨)
- ⚠️ Resend에 `maniatour.com` 도메인 인증 필요
- ❌ **문제**: `maniatour.com`의 DNS가 Wix에서 관리되고 있어서, Wix는 서브도메인 MX 레코드를 지원하지 않아 Resend 도메인 인증이 불가능합니다.

## 해결 방법

### ⚠️ Wix DNS 제한사항
Wix는 DNS 레코드 추가에 제한이 있어서 Resend 도메인 인증을 위한 DNS 레코드(TXT, MX)를 추가할 수 없습니다.

### 방법 1: 서브도메인을 별도 DNS 제공업체에서 관리 (권장)

`maniatour.com`의 루트 도메인은 Wix에서 관리하되, 서브도메인(예: `mail.maniatour.com`)만 별도의 DNS 제공업체에서 관리하는 방법입니다.

#### 장점
- Wix 웹사이트에 영향 없음
- 서브도메인만 별도 관리
- Resend 도메인 인증 가능

#### Step 1: DNS 제공업체 선택
- **Cloudflare** (무료, 추천)
- **AWS Route 53**
- **Namecheap**
- **GoDaddy**

#### Step 2: 서브도메인 DNS 위임 설정
1. Wix DNS 관리 페이지 접속
2. 서브도메인 `mail.maniatour.com`을 위한 NS 레코드 추가:
   - Type: `NS`
   - Name: `mail`
   - Value: DNS 제공업체의 네임서버 주소 (예: Cloudflare의 경우 `ns1.cloudflare.com`, `ns2.cloudflare.com`)

#### Step 3: DNS 제공업체에서 서브도메인 설정
1. DNS 제공업체에 `mail.maniatour.com` 도메인 추가
2. Resend 대시보드에서 `mail.maniatour.com` 도메인 추가
3. Resend가 제공하는 DNS 레코드를 DNS 제공업체에 추가

#### Step 4: 코드 수정
서브도메인을 사용하도록 발신자 이메일 변경:
```bash
RESEND_FROM_EMAIL=info@mail.maniatour.com
```

### 방법 2: Reply-To 헤더 사용 (간단한 해결책)

`kovegas.com` 도메인을 사용하여 발신하되, Reply-To 헤더를 `info@maniatour.com`으로 설정하면 회신은 `info@maniatour.com`으로 갑니다.

#### 장점
- DNS 설정 불필요
- 즉시 사용 가능
- 회신은 `info@maniatour.com`으로 수신

#### 단점
- 발신자 주소가 `info@kovegas.com`으로 표시됨 (하지만 Reply-To가 있으면 회신은 정상 작동)

#### 구현 방법
코드에서 Reply-To 헤더 추가 필요 (아래 "코드 수정" 섹션 참고)

### 방법 3: Resend에 maniatour.com 도메인 추가 (Wix DNS 변경 시)

Resend는 여러 도메인을 인증할 수 있습니다. `kovegas.com`과 별도로 `maniatour.com`을 추가로 인증하면 됩니다.

#### Step 1: Resend 대시보드에서 도메인 추가
1. Resend 대시보드 접속: https://resend.com/domains
2. "Add Domain" 또는 "도메인 추가" 클릭
3. `maniatour.com` 입력 (서브도메인 없이 루트 도메인)
4. "Add" 클릭

#### Step 2: DNS 레코드 확인
Resend 대시보드에서 다음 DNS 레코드들을 확인하세요:

1. **Domain Verification (DKIM)** - TXT 레코드
   - Name: `resend._domainkey` (또는 `resend._domainkey.maniatour.com`)
   - Value: Resend에서 제공하는 긴 문자열

2. **Enable Sending (SPF)** - TXT 레코드
   - Name: `@` 또는 `maniatour.com` (루트 도메인)
   - Value: `v=spf1 include:amazonses.com ~all` (또는 Resend에서 제공하는 전체 값)

3. **Enable Sending (MX)** - MX 레코드 (선택사항, 수신용)
   - Name: `@` 또는 `maniatour.com`
   - Value: `feedback-smtp.us-east-1.amazonses.com`
   - Priority: `10`

#### Step 3: maniatour.com DNS에 레코드 추가

**⚠️ 중요**: `maniatour.com`은 Google Workspace를 사용 중이므로, 기존 MX 레코드와 충돌하지 않도록 주의하세요.

##### Google Workspace와 함께 사용하는 경우

1. **DKIM 레코드 추가** (필수)
   - Type: `TXT`
   - Name: `resend._domainkey`
   - Value: Resend에서 제공하는 값
   - TTL: `3600`

2. **SPF 레코드 확인/수정** (필수)
   - Google Workspace가 이미 SPF 레코드를 사용 중일 수 있습니다
   - 기존 SPF 레코드에 Resend를 추가해야 합니다
   - 예: 기존이 `v=spf1 include:_spf.google.com ~all`이면
   - 변경: `v=spf1 include:_spf.google.com include:amazonses.com ~all`
   - 또는 Resend에서 제공하는 전체 SPF 값 사용

3. **MX 레코드** (선택사항)
   - Google Workspace MX 레코드는 그대로 유지
   - Resend MX 레코드는 이메일 수신용이므로, Google Workspace만 사용한다면 추가하지 않아도 됩니다

#### Step 4: DNS 전파 대기
- 일반적으로 5분 ~ 24시간 (평균 1-2시간)

#### Step 5: Resend에서 확인
1. Resend 대시보드에서 `maniatour.com` 도메인 상태 확인
2. 모든 레코드가 "Verified" 상태가 되면 완료

## 코드 수정

### ✅ 방법 2 구현 완료 (Reply-To 헤더)

코드에 Reply-To 헤더가 이미 추가되었습니다. 이제 다음과 같이 작동합니다:

- **발신자**: `kovegas.com` 도메인 사용 (또는 환경 변수로 설정)
- **회신 주소**: `info@maniatour.com` (Reply-To 헤더)
- **회신 수신**: Google Workspace의 `info@maniatour.com`으로 정상 수신

#### 환경 변수 설정 (선택사항)
```bash
# 발신자 주소 (kovegas.com 도메인 사용)
RESEND_FROM_EMAIL=info@kovegas.com  # 또는 updates@kovegas.com 등

# 회신 주소 (Google Workspace)
RESEND_REPLY_TO=info@maniatour.com
```

환경 변수를 설정하지 않으면 기본값으로 `info@maniatour.com`이 사용됩니다.

### 방법 1 사용 시 (서브도메인)
서브도메인을 설정한 경우, 환경 변수만 변경하면 됩니다:
```bash
RESEND_FROM_EMAIL=info@mail.maniatour.com
RESEND_REPLY_TO=info@maniatour.com  # 회신은 여전히 info@maniatour.com으로
```

## 환경 변수 설정

도메인 인증이 완료되면, 환경 변수를 설정하세요:

```bash
# .env.local 또는 운영 환경 변수
RESEND_FROM_EMAIL=info@maniatour.com
```

현재 코드는 이미 `info@maniatour.com`을 기본값으로 사용하므로, 환경 변수를 설정하지 않아도 작동합니다. 하지만 명시적으로 설정하는 것을 권장합니다.

## 확인 방법

### 1. DNS 레코드 확인 (터미널)
```bash
# DKIM 레코드 확인
nslookup -type=TXT resend._domainkey.maniatour.com

# SPF 레코드 확인
nslookup -type=TXT maniatour.com
```

### 2. 온라인 도구로 확인
- **MXToolbox**: https://mxtoolbox.com/
- **DNS Checker**: https://dnschecker.org/

### 3. 이메일 발송 테스트
도메인 인증 완료 후, 실제 이메일을 발송하여 테스트하세요.

## Google Workspace와의 호환성

✅ **호환 가능**: Resend와 Google Workspace를 동시에 사용할 수 있습니다.

- **발신**: Resend를 통해 `info@maniatour.com`으로 이메일 발송
- **수신**: Google Workspace를 통해 `info@maniatour.com`으로 이메일 수신
- **SPF 레코드**: 두 서비스를 모두 포함하도록 설정

## 문제 해결

### "Domain not verified" 오류
- DNS 레코드가 제대로 추가되었는지 확인
- DNS 전파 시간 대기 (최대 24시간)
- 레코드 값이 정확한지 확인 (공백, 따옴표 없음)

### "SPF record conflict" 오류
- 기존 Google Workspace SPF 레코드에 Resend를 추가해야 함
- 여러 SPF 레코드가 있으면 하나로 통합

### 이메일이 스팸으로 분류되는 경우
- SPF, DKIM 레코드가 모두 인증되었는지 확인
- DMARC 레코드 추가 고려

## 빠른 시작 (권장)

**Wix DNS 제한으로 인해 가장 간단한 해결책은 Reply-To 헤더 사용입니다.**

### ✅ 이미 구현 완료
코드에 Reply-To 헤더가 추가되어 있습니다. 추가 설정 없이 바로 사용 가능합니다.

### 환경 변수 설정 (선택사항)
```bash
# .env.local 또는 운영 환경 변수
# 발신자: kovegas.com 도메인 사용 (Resend에 이미 인증됨)
RESEND_FROM_EMAIL=info@kovegas.com  # 또는 updates@kovegas.com

# 회신 주소: Google Workspace의 info@maniatour.com
RESEND_REPLY_TO=info@maniatour.com
```

### 작동 방식
1. **발신**: `info@kovegas.com` (또는 설정한 주소)로 이메일 발송
2. **회신**: 고객이 "회신" 버튼을 클릭하면 `info@maniatour.com`으로 회신
3. **수신**: Google Workspace의 `info@maniatour.com`으로 정상 수신

### 장점
- ✅ DNS 설정 불필요
- ✅ 즉시 사용 가능
- ✅ Wix 웹사이트에 영향 없음
- ✅ 회신은 정상적으로 `info@maniatour.com`으로 수신

### 단점
- ⚠️ 발신자 주소가 `info@kovegas.com`으로 표시됨 (하지만 회신은 정상 작동)

## 참고 자료

- [Resend 도메인 설정 문서](https://resend.com/docs/dashboard/domains/introduction)
- [Google Workspace SPF 레코드](https://support.google.com/a/answer/10684623)
- [Resend DNS 레코드 가이드](https://resend.com/docs/dashboard/domains/dns-records)
- [Resend Reply-To 헤더 문서](https://resend.com/docs/api-reference/emails/send-email)
