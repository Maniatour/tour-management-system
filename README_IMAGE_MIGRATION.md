# 구글 드라이브에서 Supabase로 이미지 마이그레이션 가이드

## 개요
구글 드라이브에 저장된 픽업 호텔 이미지를 Supabase Storage로 마이그레이션하는 방법을 설명합니다.

## 준비사항

### 1. 구글 드라이브 설정
- 이미지를 "링크가 있는 모든 사용자"로 공개 설정
- 공유 링크 형식: `https://drive.google.com/file/d/FILE_ID/view?usp=sharing`
- **픽업 호텔 이미지 폴더**: [구글 드라이브 폴더 링크](https://drive.google.com/drive/u/0/folders/1-1isDupdB8umUlcyUGP2IoX9x8CGZrCv)

### 2. 파일명 패턴
픽업 호텔 이미지는 다음 패턴을 따릅니다:
```
{hotelId}.Photo {number}.{date}.png
```
예시: `0f7f30a4.Photo 1.041046.png`
- `hotelId`: 8자리 16진수 (픽업 호텔 ID)
- `Photo {number}`: 사진 번호 (1, 2, 3...)
- `{date}`: 업로드 날짜 (6자리 숫자)
- `.png`: 파일 확장자

### 3. 환경변수 설정
```bash
# .env.local 파일에 추가
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## 마이그레이션 방법

### 방법 1: 웹 인터페이스 (권장)

1. **관리자 페이지 접속**
   - 관리자 로그인 후 사이드바에서 "이미지 마이그레이션" 클릭

2. **호텔 선택**
   - 마이그레이션할 픽업 호텔을 드롭다운에서 선택

3. **구글 드라이브 URL 입력**
   - 텍스트 영역에 구글 드라이브 공유 링크를 한 줄에 하나씩 입력
   ```
   https://drive.google.com/file/d/1ABC123DEF456GHI789JKL/view?usp=sharing
   https://drive.google.com/file/d/2XYZ789UVW456RST123OPQ/view?usp=sharing
   ```

4. **마이그레이션 실행**
   - "마이그레이션 시작" 버튼 클릭
   - 진행 상황을 실시간으로 확인

### 방법 2: Node.js 스크립트 (대량 처리용)

#### 2-1. 파일 목록 추출 (문제 해결 포함)

**문제**: 구글 드라이브 콘솔에서 아무것도 나오지 않는 경우

**해결 방법들**:

1. **강력한 추출기 (권장)**
   ```javascript
   // 구글 드라이브 폴더에서 실행
   const files = [];
   
   // 모든 링크 검색
   document.querySelectorAll('a[href*="/file/d/"]').forEach(link => {
     const href = link.getAttribute('href');
     const fileIdMatch = href.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
     
     if (fileIdMatch) {
       const fileId = fileIdMatch[1];
       let fileName = null;
       
       // 파일명 찾기
       let currentElement = link;
       for (let i = 0; i < 5; i++) {
         if (currentElement) {
           const nameElement = currentElement.querySelector('[data-tooltip], [aria-label]');
           if (nameElement) {
             fileName = nameElement.getAttribute('data-tooltip') || 
                       nameElement.getAttribute('aria-label') || 
                       nameElement.textContent?.trim();
             if (fileName && fileName.includes('.png')) break;
           }
           currentElement = currentElement.parentElement;
         }
       }
       
       if (fileName) {
         files.push({
           fileName: fileName,
           fileId: fileId,
           googleDriveUrl: `https://drive.google.com/file/d/${fileId}/view?usp=sharing`
         });
       }
     }
   });
   
   console.log('추출된 파일:', files.length + '개');
   console.log(JSON.stringify(files, null, 2));
   ```

2. **수동 입력 도우미**
   ```javascript
   // 수동 입력 도우미 생성
   const helperHTML = `
   <div id="file-extractor-helper" style="position: fixed; top: 20px; right: 20px; width: 400px; background: white; border: 2px solid #4285f4; border-radius: 8px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 10000;">
     <h3 style="margin: 0 0 15px 0; color: #4285f4;">파일 추출 도우미</h3>
     <div style="margin-bottom: 15px;">
       <label style="display: block; margin-bottom: 5px; font-weight: bold;">파일명:</label>
       <input type="text" id="fileName" placeholder="예: 0f7f30a4.Photo 1.041046.png" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
     </div>
     <div style="margin-bottom: 15px;">
       <label style="display: block; margin-bottom: 5px; font-weight: bold;">구글 드라이브 URL:</label>
       <input type="text" id="fileUrl" placeholder="https://drive.google.com/file/d/FILE_ID/view?usp=sharing" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
     </div>
     <button onclick="addFileToHelper()" style="background: #4285f4; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin-right: 10px;">파일 추가</button>
     <button onclick="copyHelperResult()" style="background: #34a853; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">결과 복사</button>
     <button onclick="closeHelper()" style="background: #ea4335; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin-left: 10px;">닫기</button>
     <div id="fileList" style="margin-top: 15px; max-height: 200px; overflow-y: auto; border: 1px solid #eee; padding: 10px;"></div>
   </div>`;
   
   document.body.insertAdjacentHTML('beforeend', helperHTML);
   
   window.helperFiles = [];
   window.addFileToHelper = function() {
     const fileName = document.getElementById('fileName').value.trim();
     const fileUrl = document.getElementById('fileUrl').value.trim();
     const fileIdMatch = fileUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
     
     if (fileName && fileIdMatch) {
       window.helperFiles.push({
         fileName: fileName,
         fileId: fileIdMatch[1],
         googleDriveUrl: fileUrl
       });
       document.getElementById('fileName').value = '';
       document.getElementById('fileUrl').value = '';
       updateHelperFileList();
     }
   };
   
   window.copyHelperResult = function() {
     navigator.clipboard.writeText(JSON.stringify(window.helperFiles, null, 2));
     alert(window.helperFiles.length + '개 파일의 JSON 데이터가 복사되었습니다!');
   };
   
   window.closeHelper = function() {
     document.getElementById('file-extractor-helper').remove();
   };
   
   window.updateHelperFileList = function() {
     const fileListDiv = document.getElementById('fileList');
     fileListDiv.innerHTML = window.helperFiles.map(file => `
       <div style="margin-bottom: 8px; padding: 8px; background: #f8f9fa; border-radius: 4px;">
         <strong>${file.fileName}</strong><br>
         <small style="color: #666;">ID: ${file.fileId}</small>
       </div>
     `).join('');
   };
   
   console.log('수동 입력 도우미가 생성되었습니다!');
   ```

3. **디버깅 정보**
   ```javascript
   // 문제 진단을 위한 디버깅 코드
   console.log('페이지 구조 분석:');
   console.log('총 요소 수:', document.querySelectorAll('*').length);
   console.log('data-id 속성을 가진 요소:', document.querySelectorAll('[data-id]').length);
   console.log('data-tooltip 속성을 가진 요소:', document.querySelectorAll('[data-tooltip]').length);
   console.log('구글 드라이브 링크:', document.querySelectorAll('a[href*="/file/d/"]').length);
   
   console.log('발견된 링크들:');
   document.querySelectorAll('a[href*="/file/d/"]').forEach((link, index) => {
     if (index < 10) console.log(index + 1 + '.', link.href);
   });
   
   console.log('발견된 파일명들:');
   const allText = document.body.textContent;
   const pngFiles = allText.match(/[a-f0-9]{8}\.Photo\s+\d+\.\d+\.png/gi);
   if (pngFiles) {
     pngFiles.slice(0, 10).forEach((file, index) => {
       console.log(index + 1 + '.', file);
     });
   }
   ```

#### 2-2. 마이그레이션 실행
```bash
# 생성된 마이그레이션 스크립트 실행
node scripts/migrate-pickup-hotel-images-generated.js

# 또는 직접 실행
node scripts/migrate-pickup-hotel-images.js
```

### 방법 3: 수동 SQL 업데이트

1. **이미지 수동 업로드**
   - Supabase 대시보드에서 Storage > pickup-hotel-media 버킷으로 이동
   - 이미지 파일을 직접 업로드

2. **SQL로 데이터 업데이트**
   ```sql
   -- scripts/update-hotel-images.sql 파일 참조
   UPDATE pickup_hotels 
   SET media = ARRAY[
     'https://your-project.supabase.co/storage/v1/object/public/pickup-hotel-media/hotels/hotel-id/image1.jpg',
     'https://your-project.supabase.co/storage/v1/object/public/pickup-hotel-media/hotels/hotel-id/image2.jpg'
   ]
   WHERE id = 'hotel-id';
   ```

## 파일 구조

마이그레이션 후 Supabase Storage 구조:
```
pickup-hotel-media/
├── hotels/
│   ├── hotel-id-1/
│   │   ├── hotel-id-1_1640995200000_1.jpg
│   │   ├── hotel-id-1_1640995200000_2.jpg
│   │   └── hotel-id-1_1640995200000_3.jpg
│   ├── hotel-id-2/
│   │   ├── hotel-id-2_1640995300000_1.jpg
│   │   └── hotel-id-2_1640995300000_2.jpg
│   └── ...
```

## 주의사항

### 1. 구글 드라이브 설정
- **공개 설정 필수**: "링크가 있는 모든 사용자"로 설정
- **파일 크기 제한**: Supabase Storage는 파일당 10MB 제한
- **지원 형식**: JPG, PNG, GIF, WebP

### 2. 네트워크 및 성능
- **대용량 이미지**: 처리 시간이 오래 걸릴 수 있음
- **API 제한**: 요청 간격을 두어 API 제한 방지
- **에러 처리**: 일부 이미지 실패 시에도 계속 진행

### 3. 데이터 백업
- **마이그레이션 전**: 기존 미디어 URL 백업 권장
- **테스트**: 소량의 이미지로 먼저 테스트

## 문제 해결

### 1. 구글 드라이브 접근 오류
```
HTTP 403: Forbidden
```
**해결방법**: 구글 드라이브 공유 설정을 "링크가 있는 모든 사용자"로 변경

### 2. Supabase 업로드 오류
```
Storage quota exceeded
```
**해결방법**: Supabase 프로젝트의 Storage 용량 확인 및 확장

### 3. 이미지 표시 안됨
**해결방법**: 
- Supabase Storage 버킷의 공개 정책 확인
- 이미지 URL 형식 확인
- 브라우저 캐시 클리어

## 검증 방법

### 1. 마이그레이션 결과 확인
```sql
-- 호텔별 미디어 개수 확인
SELECT 
  hotel,
  pick_up_location,
  array_length(media, 1) as media_count
FROM pickup_hotels 
ORDER BY hotel;
```

### 2. 이미지 접근 테스트
- 마이그레이션된 URL을 브라우저에서 직접 접근
- 픽업 호텔 관리 페이지에서 이미지 표시 확인

### 3. 예약 시스템 연동 확인
- 예약 폼에서 픽업 호텔 선택 시 이미지 표시 확인

## 추가 기능

### 1. 이미지 최적화
- 업로드 시 자동 리사이징
- WebP 형식으로 변환
- 썸네일 생성

### 2. 배치 처리
- 대량 이미지 일괄 처리
- 진행률 표시
- 실패한 이미지 재시도

### 3. 모니터링
- 업로드 통계
- 용량 사용량 추적
- 에러 로그 수집

## 지원

문제가 발생하면 다음을 확인하세요:
1. 구글 드라이브 공유 설정
2. Supabase 환경변수 설정
3. 네트워크 연결 상태
4. 파일 크기 및 형식

추가 도움이 필요하면 개발팀에 문의하세요.
