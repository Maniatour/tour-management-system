/**
 * 구글 드라이브 파일 추출기 v2.0
 * 최신 구글 드라이브 DOM 구조에 최적화
 */

console.log('🚀 구글 드라이브 파일 추출기 v2.0 시작...');

// 방법 1: 최신 구글 드라이브 구조 분석
function analyzeGoogleDriveStructure() {
  console.log('🔍 구글 드라이브 구조 분석 중...');
  
  // 페이지 로딩 상태 확인
  const loadingElements = document.querySelectorAll('[aria-label*="로딩"], [aria-label*="Loading"], .loading, [data-loading="true"]');
  if (loadingElements.length > 0) {
    console.log('⚠️ 페이지가 아직 로딩 중입니다. 잠시 기다려주세요.');
    return false;
  }
  
  // 다양한 가능한 선택자들
  const selectors = {
    // 파일 그리드 아이템
    fileItems: [
      '[data-id]',
      '[role="gridcell"]',
      '[data-tooltip]',
      '.a-s-fa-Ha-pa',
      '[aria-label]',
      'div[data-id]',
      'div[data-tooltip]',
      '[data-entity-id]',
      '.a-s-fa-Ha-pa',
      '.a-s-fa-Ha-pa[data-id]'
    ],
    
    // 파일명 요소
    fileNameElements: [
      '[data-tooltip]',
      '[aria-label]',
      '.a-s-fa-Ha-pa',
      'span',
      'div',
      '[data-name]',
      '.a-s-fa-Ha-pa span',
      '[role="button"] span'
    ],
    
    // 링크 요소
    linkElements: [
      'a[href*="/file/d/"]',
      '[href*="/file/d/"]',
      'a',
      '[data-id] a',
      '.a-s-fa-Ha-pa a'
    ]
  };
  
  console.log('📊 DOM 요소 통계:');
  selectors.fileItems.forEach(selector => {
    const count = document.querySelectorAll(selector).length;
    if (count > 0) {
      console.log(`  ${selector}: ${count}개`);
    }
  });
  
  return true;
}

// 방법 2: 페이지 소스에서 직접 추출
function extractFromPageSource() {
  console.log('📄 페이지 소스에서 파일 추출 중...');
  
  const files = [];
  const pageSource = document.documentElement.innerHTML;
  
  // 파일 ID 패턴 찾기
  const fileIdPattern = /\/file\/d\/([a-zA-Z0-9_-]+)/g;
  const fileIds = [...pageSource.matchAll(fileIdPattern)].map(match => match[1]);
  
  // 파일명 패턴 찾기 (픽업 호텔 이미지)
  const fileNamePattern = /([a-f0-9]{8}\.Photo\s+\d+\.\d+\.png)/gi;
  const fileNames = [...pageSource.matchAll(fileNamePattern)].map(match => match[1]);
  
  console.log(`발견된 파일 ID: ${fileIds.length}개`);
  console.log(`발견된 파일명: ${fileNames.length}개`);
  
  // 파일명과 ID 매칭 시도
  fileNames.forEach(fileName => {
    // 호텔 ID 추출
    const hotelIdMatch = fileName.match(/^([a-f0-9]{8})/);
    if (hotelIdMatch) {
      // 임시로 첫 번째 파일 ID 사용 (실제로는 더 정교한 매칭 필요)
      if (fileIds.length > 0) {
        files.push({
          fileName: fileName,
          fileId: fileIds[0], // 임시
          googleDriveUrl: `https://drive.google.com/file/d/${fileIds[0]}/view?usp=sharing`
        });
      }
    }
  });
  
  return files;
}

// 방법 3: 이벤트 리스너를 통한 동적 추출
function extractWithEventListeners() {
  console.log('🎯 이벤트 리스너를 통한 동적 추출 중...');
  
  const files = [];
  
  // 모든 클릭 가능한 요소에 이벤트 리스너 추가
  const clickableElements = document.querySelectorAll('[role="button"], a, [data-id], [data-tooltip]');
  
  clickableElements.forEach((element, index) => {
    try {
      // 파일명 추출
      let fileName = null;
      const nameSelectors = [
        '[data-tooltip]',
        '[aria-label]',
        '.a-s-fa-Ha-pa',
        'span',
        'div'
      ];
      
      for (const selector of nameSelectors) {
        const nameElement = element.querySelector(selector);
        if (nameElement) {
          fileName = nameElement.getAttribute('data-tooltip') || 
                    nameElement.getAttribute('aria-label') || 
                    nameElement.textContent?.trim();
          if (fileName && fileName.includes('.png')) {
            break;
          }
        }
      }
      
      // 링크 추출
      let fileId = null;
      const linkElement = element.querySelector('a[href*="/file/d/"]') || element;
      if (linkElement.href) {
        const fileIdMatch = linkElement.href.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (fileIdMatch) {
          fileId = fileIdMatch[1];
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
      // 무시
    }
  });
  
  return files;
}

// 방법 4: 스크롤을 통한 동적 로딩
function extractWithScroll() {
  console.log('📜 스크롤을 통한 동적 로딩 중...');
  
  return new Promise((resolve) => {
    const files = [];
    let scrollCount = 0;
    const maxScrolls = 5;
    
    function scrollAndExtract() {
      // 현재 페이지의 파일 추출
      const currentFiles = extractFromPageSource();
      files.push(...currentFiles);
      
      // 페이지 하단으로 스크롤
      window.scrollTo(0, document.body.scrollHeight);
      
      scrollCount++;
      
      if (scrollCount < maxScrolls) {
        setTimeout(scrollAndExtract, 2000); // 2초 대기
      } else {
        // 중복 제거
        const uniqueFiles = files.filter((file, index, self) => 
          index === self.findIndex(f => f.fileName === file.fileName)
        );
        resolve(uniqueFiles);
      }
    }
    
    scrollAndExtract();
  });
}

// 방법 5: 수동 입력 도우미 (강화된 버전)
function createAdvancedManualHelper() {
  console.log('🛠️ 고급 수동 입력 도우미 생성 중...');
  
  const helperHTML = `
    <div id="advanced-file-extractor" style="
      position: fixed;
      top: 20px;
      right: 20px;
      width: 450px;
      max-height: 80vh;
      background: white;
      border: 2px solid #4285f4;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      z-index: 10000;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      overflow-y: auto;
    ">
      <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 20px;">
        <h3 style="margin: 0; color: #4285f4; font-size: 18px;">🚀 고급 파일 추출기</h3>
        <button onclick="closeAdvancedHelper()" style="
          background: #ea4335;
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
        ">✕</button>
      </div>
      
      <div style="margin-bottom: 15px;">
        <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #333;">파일명:</label>
        <input type="text" id="advancedFileName" placeholder="예: 0f7f30a4.Photo 1.041046.png" 
               style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 6px; font-size: 14px;">
      </div>
      
      <div style="margin-bottom: 15px;">
        <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #333;">구글 드라이브 URL:</label>
        <input type="text" id="advancedFileUrl" placeholder="https://drive.google.com/file/d/FILE_ID/view?usp=sharing" 
               style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 6px; font-size: 14px;">
      </div>
      
      <div style="display: flex; gap: 10px; margin-bottom: 20px;">
        <button onclick="addFileToAdvancedHelper()" style="
          background: #4285f4;
          color: white;
          border: none;
          padding: 12px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: bold;
          flex: 1;
        ">➕ 파일 추가</button>
        
        <button onclick="copyAdvancedHelperResult()" style="
          background: #34a853;
          color: white;
          border: none;
          padding: 12px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: bold;
          flex: 1;
        ">📋 복사</button>
      </div>
      
      <div style="margin-bottom: 15px;">
        <button onclick="autoDetectFiles()" style="
          background: #ff9800;
          color: white;
          border: none;
          padding: 10px 15px;
          border-radius: 6px;
          cursor: pointer;
          width: 100%;
          font-weight: bold;
        ">🔍 자동 감지 시도</button>
      </div>
      
      <div id="advancedFileList" style="
        margin-top: 15px;
        max-height: 300px;
        overflow-y: auto;
        border: 1px solid #eee;
        border-radius: 6px;
        padding: 15px;
        background: #f8f9fa;
      ">
        <p style="margin: 0; color: #666; text-align: center;">추가된 파일이 여기에 표시됩니다...</p>
      </div>
      
      <div style="margin-top: 15px; padding: 10px; background: #e3f2fd; border-radius: 6px;">
        <p style="margin: 0; font-size: 12px; color: #1976d2;">
          💡 <strong>팁:</strong> 파일을 우클릭 → "링크 복사" 또는 "공유"를 사용하세요.
        </p>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', helperHTML);
  
  // 전역 함수들 정의
  window.advancedHelperFiles = [];
  
  window.addFileToAdvancedHelper = function() {
    const fileName = document.getElementById('advancedFileName').value.trim();
    const fileUrl = document.getElementById('advancedFileUrl').value.trim();
    
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
    
    // 중복 확인
    const exists = window.advancedHelperFiles.some(f => f.fileName === fileName);
    if (exists) {
      alert('이미 추가된 파일입니다.');
      return;
    }
    
    window.advancedHelperFiles.push(fileData);
    updateAdvancedHelperFileList();
    
    // 입력 필드 초기화
    document.getElementById('advancedFileName').value = '';
    document.getElementById('advancedFileUrl').value = '';
    
    console.log(`파일 추가됨: ${fileName}`);
  };
  
  window.copyAdvancedHelperResult = function() {
    if (!window.advancedHelperFiles || window.advancedHelperFiles.length === 0) {
      alert('추가된 파일이 없습니다.');
      return;
    }
    
    const result = JSON.stringify(window.advancedHelperFiles, null, 2);
    navigator.clipboard.writeText(result).then(() => {
      alert(`✅ ${window.advancedHelperFiles.length}개 파일의 JSON 데이터가 클립보드에 복사되었습니다!`);
      console.log('복사된 데이터:', result);
    }).catch(err => {
      console.error('클립보드 복사 실패:', err);
      // 대안: 텍스트 영역에 표시
      const textarea = document.createElement('textarea');
      textarea.value = result;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      alert('JSON 데이터가 복사되었습니다!');
    });
  };
  
  window.closeAdvancedHelper = function() {
    const helper = document.getElementById('advanced-file-extractor');
    if (helper) {
      helper.remove();
    }
  };
  
  window.autoDetectFiles = function() {
    console.log('🔍 자동 감지 시도 중...');
    
    // 페이지에서 파일명 패턴 찾기
    const allText = document.body.textContent;
    const pngFiles = allText.match(/[a-f0-9]{8}\.Photo\s+\d+\.\d+\.png/gi);
    
    if (pngFiles && pngFiles.length > 0) {
      console.log(`발견된 파일명: ${pngFiles.length}개`);
      pngFiles.forEach(fileName => {
        console.log(`- ${fileName}`);
      });
      
      alert(`자동으로 ${pngFiles.length}개의 파일명을 발견했습니다! 콘솔을 확인하세요.`);
    } else {
      alert('자동 감지된 파일이 없습니다. 수동으로 입력해주세요.');
    }
  };
  
  window.updateAdvancedHelperFileList = function() {
    const fileListDiv = document.getElementById('advancedFileList');
    if (window.advancedHelperFiles && window.advancedHelperFiles.length > 0) {
      fileListDiv.innerHTML = window.advancedHelperFiles.map((file, index) => `
        <div style="margin-bottom: 10px; padding: 12px; background: white; border-radius: 6px; border-left: 4px solid #4285f4;">
          <div style="display: flex; justify-content: between; align-items: start;">
            <div style="flex: 1;">
              <strong style="color: #333; font-size: 14px;">${file.fileName}</strong><br>
              <small style="color: #666;">ID: ${file.fileId}</small>
            </div>
            <button onclick="removeFileFromAdvancedHelper(${index})" style="
              background: #ea4335;
              color: white;
              border: none;
              padding: 4px 8px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 12px;
            ">삭제</button>
          </div>
        </div>
      `).join('');
    } else {
      fileListDiv.innerHTML = '<p style="margin: 0; color: #666; text-align: center;">추가된 파일이 여기에 표시됩니다...</p>';
    }
  };
  
  window.removeFileFromAdvancedHelper = function(index) {
    window.advancedHelperFiles.splice(index, 1);
    updateAdvancedHelperFileList();
  };
  
  console.log('✅ 고급 수동 입력 도우미가 생성되었습니다!');
}

// 모든 방법 실행
async function runAllExtractionMethods() {
  console.log('🚀 모든 추출 방법 실행 중...\n');
  
  // 구조 분석
  if (!analyzeGoogleDriveStructure()) {
    console.log('❌ 페이지 로딩이 완료되지 않았습니다. 잠시 후 다시 시도해주세요.');
    return;
  }
  
  // 방법들 실행
  const results = {
    pageSource: extractFromPageSource(),
    eventListeners: extractWithEventListeners()
  };
  
  // 스크롤 방법은 비동기이므로 별도 실행
  try {
    results.scroll = await extractWithScroll();
  } catch (error) {
    console.log('스크롤 추출 실패:', error);
    results.scroll = [];
  }
  
  console.log('\n📊 결과 요약:');
  console.log(`페이지 소스: ${results.pageSource.length}개 파일`);
  console.log(`이벤트 리스너: ${results.eventListeners.length}개 파일`);
  console.log(`스크롤 추출: ${results.scroll.length}개 파일`);
  
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
    createAdvancedManualHelper();
  }
  
  return results[bestMethod];
}

// 실행
console.log('🎯 구글 드라이브 파일 추출기 v2.0 로드 완료!');
console.log('사용 가능한 명령어:');
console.log('- runAllExtractionMethods(): 모든 방법으로 파일 추출 시도');
console.log('- createAdvancedManualHelper(): 고급 수동 입력 도우미 생성');
console.log('- extractFromPageSource(): 페이지 소스에서 추출');
console.log('- extractWithEventListeners(): 이벤트 리스너로 추출');

// 자동 실행
runAllExtractionMethods();
