/**
 * 구글 드라이브 폴더에서 파일 목록 추출하는 다양한 방법들
 * 
 * 사용법:
 * 1. 구글 드라이브 폴더 페이지에서 개발자 도구(F12) 열기
 * 2. Console 탭에서 아래 코드들을 하나씩 시도해보세요
 */

console.log('🔍 구글 드라이브 파일 추출기 시작...');

// 방법 1: 기본 선택자 (최신 구글 드라이브)
function extractFilesMethod1() {
  console.log('📁 방법 1: 기본 선택자 시도 중...');
  
  const files = [];
  
  // 다양한 가능한 선택자들 시도
  const selectors = [
    '[data-id]',
    '[data-tooltip]',
    '[role="gridcell"]',
    '.a-s-fa-Ha-pa',
    '[aria-label]',
    'div[data-id]',
    'div[data-tooltip]'
  ];
  
  selectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    console.log(`선택자 "${selector}": ${elements.length}개 요소 발견`);
    
    elements.forEach((item, index) => {
      try {
        // 파일명 추출 시도
        let fileName = null;
        const nameSelectors = [
          '[data-tooltip]',
          '[aria-label]',
          '.a-s-fa-Ha-pa',
          'span',
          'div'
        ];
        
        for (const nameSelector of nameSelectors) {
          const nameElement = item.querySelector(nameSelector);
          if (nameElement) {
            fileName = nameElement.getAttribute('data-tooltip') || 
                      nameElement.getAttribute('aria-label') || 
                      nameElement.textContent?.trim();
            if (fileName && fileName.includes('.png')) {
              break;
            }
          }
        }
        
        // 링크 추출 시도
        let fileId = null;
        const linkSelectors = [
          'a[href*="/file/d/"]',
          '[href*="/file/d/"]',
          'a'
        ];
        
        for (const linkSelector of linkSelectors) {
          const linkElement = item.querySelector(linkSelector);
          if (linkElement) {
            const href = linkElement.getAttribute('href');
            if (href) {
              const fileIdMatch = href.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
              if (fileIdMatch) {
                fileId = fileIdMatch[1];
                break;
              }
            }
          }
        }
        
        if (fileName && fileId) {
          files.push({
            fileName: fileName,
            fileId: fileId,
            googleDriveUrl: `https://drive.google.com/file/d/${fileId}/view?usp=sharing`
          });
        }
      } catch (error) {
        console.log(`요소 ${index} 처리 중 오류:`, error);
      }
    });
  });
  
  console.log(`방법 1 결과: ${files.length}개 파일 발견`);
  return files;
}

// 방법 2: 모든 링크 검색
function extractFilesMethod2() {
  console.log('📁 방법 2: 모든 링크 검색 중...');
  
  const files = [];
  const allLinks = document.querySelectorAll('a[href*="/file/d/"]');
  
  console.log(`총 ${allLinks.length}개의 파일 링크 발견`);
  
  allLinks.forEach((link, index) => {
    try {
      const href = link.getAttribute('href');
      const fileIdMatch = href.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      
      if (fileIdMatch) {
        const fileId = fileIdMatch[1];
        
        // 파일명 찾기 시도
        let fileName = null;
        
        // 링크의 부모 요소들에서 파일명 찾기
        let currentElement = link;
        for (let i = 0; i < 5; i++) {
          if (currentElement) {
            const nameElement = currentElement.querySelector('[data-tooltip], [aria-label]');
            if (nameElement) {
              fileName = nameElement.getAttribute('data-tooltip') || 
                        nameElement.getAttribute('aria-label') || 
                        nameElement.textContent?.trim();
              if (fileName && fileName.includes('.png')) {
                break;
              }
            }
            currentElement = currentElement.parentElement;
          }
        }
        
        // 텍스트 내용에서 파일명 찾기
        if (!fileName) {
          const textContent = link.textContent?.trim();
          if (textContent && textContent.includes('.png')) {
            fileName = textContent;
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
    } catch (error) {
      console.log(`링크 ${index} 처리 중 오류:`, error);
    }
  });
  
  console.log(`방법 2 결과: ${files.length}개 파일 발견`);
  return files;
}

// 방법 3: 페이지 소스 분석
function extractFilesMethod3() {
  console.log('📁 방법 3: 페이지 소스 분석 중...');
  
  const files = [];
  const pageSource = document.documentElement.innerHTML;
  
  // 정규식으로 파일 ID와 이름 찾기
  const fileIdPattern = /\/file\/d\/([a-zA-Z0-9_-]+)/g;
  const fileNamePattern = /([a-f0-9]{8}\.Photo\s+\d+\.\d+\.png)/gi;
  
  const fileIds = [...pageSource.matchAll(fileIdPattern)].map(match => match[1]);
  const fileNames = [...pageSource.matchAll(fileNamePattern)].map(match => match[1]);
  
  console.log(`페이지에서 ${fileIds.length}개 파일 ID 발견`);
  console.log(`페이지에서 ${fileNames.length}개 파일명 발견`);
  
  // 파일명과 ID 매칭 시도
  fileNames.forEach(fileName => {
    // 파일명에서 호텔 ID 추출
    const hotelIdMatch = fileName.match(/^([a-f0-9]{8})/);
    if (hotelIdMatch) {
      const hotelId = hotelIdMatch[1];
      
      // 같은 호텔 ID를 가진 파일 ID 찾기
      const matchingFileId = fileIds.find(id => {
        // 간단한 휴리스틱: 파일 ID가 호텔 ID와 비슷한 패턴인지 확인
        return true; // 일단 모든 파일 ID를 시도
      });
      
      if (matchingFileId) {
        files.push({
          fileName: fileName,
          fileId: matchingFileId,
          googleDriveUrl: `https://drive.google.com/file/d/${matchingFileId}/view?usp=sharing`
        });
      }
    }
  });
  
  console.log(`방법 3 결과: ${files.length}개 파일 발견`);
  return files;
}

// 방법 4: 수동 입력 도우미
function createManualInputHelper() {
  console.log('📁 방법 4: 수동 입력 도우미 생성 중...');
  
  const helperHTML = `
    <div id="file-extractor-helper" style="
      position: fixed;
      top: 20px;
      right: 20px;
      width: 400px;
      background: white;
      border: 2px solid #4285f4;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      font-family: Arial, sans-serif;
    ">
      <h3 style="margin: 0 0 15px 0; color: #4285f4;">파일 추출 도우미</h3>
      
      <div style="margin-bottom: 15px;">
        <label style="display: block; margin-bottom: 5px; font-weight: bold;">파일명:</label>
        <input type="text" id="fileName" placeholder="예: 0f7f30a4.Photo 1.041046.png" 
               style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
      </div>
      
      <div style="margin-bottom: 15px;">
        <label style="display: block; margin-bottom: 5px; font-weight: bold;">구글 드라이브 URL:</label>
        <input type="text" id="fileUrl" placeholder="https://drive.google.com/file/d/FILE_ID/view?usp=sharing" 
               style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
      </div>
      
      <button onclick="addFileToHelper()" style="
        background: #4285f4;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 4px;
        cursor: pointer;
        margin-right: 10px;
      ">파일 추가</button>
      
      <button onclick="copyHelperResult()" style="
        background: #34a853;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 4px;
        cursor: pointer;
      ">결과 복사</button>
      
      <button onclick="closeHelper()" style="
        background: #ea4335;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 4px;
        cursor: pointer;
        margin-left: 10px;
      ">닫기</button>
      
      <div id="fileList" style="margin-top: 15px; max-height: 200px; overflow-y: auto; border: 1px solid #eee; padding: 10px;">
        <p style="margin: 0; color: #666;">추가된 파일이 여기에 표시됩니다...</p>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', helperHTML);
  
  // 전역 함수들 정의
  window.addFileToHelper = function() {
    const fileName = document.getElementById('fileName').value.trim();
    const fileUrl = document.getElementById('fileUrl').value.trim();
    
    if (!fileName || !fileUrl) {
      alert('파일명과 URL을 모두 입력해주세요.');
      return;
    }
    
    const fileIdMatch = fileUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (!fileIdMatch) {
      alert('올바른 구글 드라이브 URL을 입력해주세요.');
      return;
    }
    
    const fileId = fileIdMatch[1];
    const fileData = {
      fileName: fileName,
      fileId: fileId,
      googleDriveUrl: fileUrl
    };
    
    // 파일 목록에 추가
    window.helperFiles = window.helperFiles || [];
    window.helperFiles.push(fileData);
    
    // UI 업데이트
    updateHelperFileList();
    
    // 입력 필드 초기화
    document.getElementById('fileName').value = '';
    document.getElementById('fileUrl').value = '';
  };
  
  window.copyHelperResult = function() {
    if (!window.helperFiles || window.helperFiles.length === 0) {
      alert('추가된 파일이 없습니다.');
      return;
    }
    
    const result = JSON.stringify(window.helperFiles, null, 2);
    navigator.clipboard.writeText(result).then(() => {
      alert(`${window.helperFiles.length}개 파일의 JSON 데이터가 클립보드에 복사되었습니다!`);
    });
  };
  
  window.closeHelper = function() {
    document.getElementById('file-extractor-helper').remove();
  };
  
  window.updateHelperFileList = function() {
    const fileListDiv = document.getElementById('fileList');
    if (window.helperFiles && window.helperFiles.length > 0) {
      fileListDiv.innerHTML = window.helperFiles.map((file, index) => `
        <div style="margin-bottom: 8px; padding: 8px; background: #f8f9fa; border-radius: 4px;">
          <strong>${file.fileName}</strong><br>
          <small style="color: #666;">ID: ${file.fileId}</small>
        </div>
      `).join('');
    } else {
      fileListDiv.innerHTML = '<p style="margin: 0; color: #666;">추가된 파일이 여기에 표시됩니다...</p>';
    }
  };
  
  console.log('✅ 수동 입력 도우미가 화면 우측 상단에 생성되었습니다.');
}

// 모든 방법 실행
function runAllMethods() {
  console.log('🚀 모든 추출 방법 실행 중...\n');
  
  const results = {
    method1: extractFilesMethod1(),
    method2: extractFilesMethod2(),
    method3: extractFilesMethod3()
  };
  
  console.log('\n📊 결과 요약:');
  console.log(`방법 1: ${results.method1.length}개 파일`);
  console.log(`방법 2: ${results.method2.length}개 파일`);
  console.log(`방법 3: ${results.method3.length}개 파일`);
  
  // 가장 많은 파일을 찾은 방법 선택
  const bestMethod = Object.keys(results).reduce((a, b) => 
    results[a].length > results[b].length ? a : b
  );
  
  console.log(`\n🏆 가장 좋은 결과: ${bestMethod} (${results[bestMethod].length}개 파일)`);
  
  if (results[bestMethod].length > 0) {
    console.log('\n📋 추출된 파일 목록:');
    results[bestMethod].forEach((file, index) => {
      console.log(`${index + 1}. ${file.fileName}`);
    });
    
    console.log('\n📄 JSON 결과:');
    console.log(JSON.stringify(results[bestMethod], null, 2));
  } else {
    console.log('\n❌ 자동 추출이 실패했습니다. 수동 입력 도우미를 사용하세요.');
    createManualInputHelper();
  }
  
  return results[bestMethod];
}

// 디버깅 정보 출력
function debugPageStructure() {
  console.log('🔍 페이지 구조 분석 중...');
  
  console.log('\n📊 DOM 요소 통계:');
  console.log(`총 요소 수: ${document.querySelectorAll('*').length}`);
  console.log(`data-id 속성을 가진 요소: ${document.querySelectorAll('[data-id]').length}`);
  console.log(`data-tooltip 속성을 가진 요소: ${document.querySelectorAll('[data-tooltip]').length}`);
  console.log(`구글 드라이브 링크: ${document.querySelectorAll('a[href*="/file/d/"]').length}`);
  
  console.log('\n🔗 발견된 링크들:');
  document.querySelectorAll('a[href*="/file/d/"]').forEach((link, index) => {
    if (index < 10) { // 처음 10개만 표시
      console.log(`${index + 1}. ${link.href}`);
    }
  });
  
  console.log('\n📝 발견된 텍스트들 (png 포함):');
  const allText = document.body.textContent;
  const pngFiles = allText.match(/[a-f0-9]{8}\.Photo\s+\d+\.\d+\.png/gi);
  if (pngFiles) {
    pngFiles.slice(0, 10).forEach((file, index) => {
      console.log(`${index + 1}. ${file}`);
    });
  }
}

// 실행
console.log('🎯 구글 드라이브 파일 추출기 로드 완료!');
console.log('사용 가능한 명령어:');
console.log('- runAllMethods(): 모든 방법으로 파일 추출 시도');
console.log('- extractFilesMethod1(): 방법 1 실행');
console.log('- extractFilesMethod2(): 방법 2 실행');
console.log('- extractFilesMethod3(): 방법 3 실행');
console.log('- createManualInputHelper(): 수동 입력 도우미 생성');
console.log('- debugPageStructure(): 페이지 구조 분석');

// 자동 실행
runAllMethods();
