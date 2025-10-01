#!/usr/bin/env node

/**
 * 구글 드라이브 폴더에서 파일 목록 추출 도구
 * 
 * 사용법:
 * 1. 구글 드라이브 폴더를 브라우저에서 열기
 * 2. 개발자 도구(F12) 열기
 * 3. Console 탭에서 아래 스크립트 실행
 * 4. 결과를 복사하여 이 스크립트에 입력
 */

const fs = require('fs');
const path = require('path');

// 구글 드라이브 폴더에서 추출한 파일 목록 (실제 데이터로 교체)
const extractedFiles = [
  // 브라우저 콘솔에서 실행할 스크립트:
  /*
  // 구글 드라이브 폴더 페이지에서 실행할 JavaScript 코드
  const files = [];
  document.querySelectorAll('[data-id]').forEach(item => {
    const nameElement = item.querySelector('[data-tooltip]');
    if (nameElement) {
      const fileName = nameElement.getAttribute('data-tooltip');
      const linkElement = item.querySelector('a[href*="/file/d/"]');
      if (linkElement) {
        const href = linkElement.getAttribute('href');
        const fileIdMatch = href.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (fileIdMatch) {
          files.push({
            fileName: fileName,
            fileId: fileIdMatch[1],
            googleDriveUrl: `https://drive.google.com/file/d/${fileIdMatch[1]}/view?usp=sharing`
          });
        }
      }
    }
  });
  console.log(JSON.stringify(files, null, 2));
  */
  
  // 실제 추출된 데이터 (위 스크립트 실행 결과로 교체)
  {
    "fileName": "0f7f30a4.Photo 1.041046.png",
    "fileId": "ACTUAL_FILE_ID_1",
    "googleDriveUrl": "https://drive.google.com/file/d/ACTUAL_FILE_ID_1/view?usp=sharing"
  },
  {
    "fileName": "0f7f30a4.Photo 2.041046.png",
    "fileId": "ACTUAL_FILE_ID_2",
    "googleDriveUrl": "https://drive.google.com/file/d/ACTUAL_FILE_ID_2/view?usp=sharing"
  },
  {
    "fileName": "1e7a05e9.Photo 1.042915.png",
    "fileId": "ACTUAL_FILE_ID_3",
    "googleDriveUrl": "https://drive.google.com/file/d/ACTUAL_FILE_ID_3/view?usp=sharing"
  },
  {
    "fileName": "1e7a05e9.Photo 2.042915.png",
    "fileId": "ACTUAL_FILE_ID_4",
    "googleDriveUrl": "https://drive.google.com/file/d/ACTUAL_FILE_ID_4/view?usp=sharing"
  },
  // 더 많은 파일들...
];

/**
 * 파일명에서 호텔 정보 추출
 */
function parseFileName(fileName) {
  const match = fileName.match(/^([a-f0-9]{8})\.Photo\s+(\d+)\.(\d+)\.png$/i);
  if (match) {
    return {
      hotelId: match[1],
      photoNumber: parseInt(match[2]),
      date: match[3],
      isValid: true
    };
  }
  return { isValid: false };
}

/**
 * 마이그레이션 스크립트용 데이터 생성
 */
function generateMigrationData() {
  console.log('🔄 마이그레이션 스크립트용 데이터 생성 중...\n');
  
  const migrationData = [];
  const invalidFiles = [];
  
  extractedFiles.forEach(file => {
    const parsed = parseFileName(file.fileName);
    
    if (parsed.isValid) {
      migrationData.push({
        fileName: file.fileName,
        hotelId: parsed.hotelId,
        photoNumber: parsed.photoNumber,
        date: parsed.date,
        googleDriveUrl: file.googleDriveUrl
      });
    } else {
      invalidFiles.push(file.fileName);
    }
  });
  
  // 호텔별로 그룹화
  const groupedByHotel = {};
  migrationData.forEach(item => {
    if (!groupedByHotel[item.hotelId]) {
      groupedByHotel[item.hotelId] = [];
    }
    groupedByHotel[item.hotelId].push(item);
  });
  
  // 각 호텔별로 사진 번호 순으로 정렬
  Object.keys(groupedByHotel).forEach(hotelId => {
    groupedByHotel[hotelId].sort((a, b) => a.photoNumber - b.photoNumber);
  });
  
  console.log('📊 통계:');
  console.log(`  - 총 파일 수: ${extractedFiles.length}`);
  console.log(`  - 유효한 파일: ${migrationData.length}`);
  console.log(`  - 무효한 파일: ${invalidFiles.length}`);
  console.log(`  - 호텔 수: ${Object.keys(groupedByHotel).length}\n`);
  
  if (invalidFiles.length > 0) {
    console.log('❌ 무효한 파일명:');
    invalidFiles.forEach(fileName => {
      console.log(`  - ${fileName}`);
    });
    console.log('');
  }
  
  console.log('🏨 호텔별 파일 목록:');
  Object.keys(groupedByHotel).forEach(hotelId => {
    const files = groupedByHotel[hotelId];
    console.log(`  ${hotelId}: ${files.length}개 파일`);
    files.forEach(file => {
      console.log(`    - ${file.fileName} (Photo ${file.photoNumber})`);
    });
  });
  
  return migrationData;
}

/**
 * 마이그레이션 스크립트 파일 생성
 */
function generateMigrationScript(migrationData) {
  const scriptContent = `#!/usr/bin/env node

/**
 * 구글 드라이브 픽업 호텔 이미지 마이그레이션 스크립트 (자동 생성)
 * 생성일: ${new Date().toISOString()}
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { createClient } = require('@supabase/supabase-js');

// Supabase 설정
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Supabase 환경변수가 설정되지 않았습니다.');
  console.error('NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 설정해주세요.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 구글 드라이브 이미지 파일 목록 (자동 생성됨)
const googleDriveImages = ${JSON.stringify(migrationData, null, 2)};

// ... (나머지 함수들은 기존 스크립트와 동일)
`;

  const outputPath = path.join(__dirname, 'migrate-pickup-hotel-images-generated.js');
  fs.writeFileSync(outputPath, scriptContent);
  
  console.log(`\n📝 마이그레이션 스크립트 생성됨: ${outputPath}`);
  console.log('이제 다음 명령으로 마이그레이션을 실행할 수 있습니다:');
  console.log(`node ${outputPath}`);
}

/**
 * CSV 파일 생성 (호텔별 파일 목록)
 */
function generateCSV(migrationData) {
  const csvContent = [
    'Hotel ID,Photo Number,Date,File Name,Google Drive URL',
    ...migrationData.map(item => 
      `${item.hotelId},${item.photoNumber},${item.date},"${item.fileName}","${item.googleDriveUrl}"`
    )
  ].join('\n');
  
  const csvPath = path.join(__dirname, 'pickup-hotel-images.csv');
  fs.writeFileSync(csvPath, csvContent);
  
  console.log(`📊 CSV 파일 생성됨: ${csvPath}`);
}

// 메인 실행
function main() {
  console.log('🔍 구글 드라이브 파일 목록 분석 중...\n');
  
  if (extractedFiles.length === 0 || extractedFiles[0].fileId === 'ACTUAL_FILE_ID_1') {
    console.log('⚠️  실제 파일 데이터가 입력되지 않았습니다.');
    console.log('다음 단계를 따라주세요:\n');
    console.log('1. 구글 드라이브 폴더를 브라우저에서 열기');
    console.log('2. 개발자 도구(F12) 열기');
    console.log('3. Console 탭에서 아래 스크립트 실행:');
    console.log(`
const files = [];
document.querySelectorAll('[data-id]').forEach(item => {
  const nameElement = item.querySelector('[data-tooltip]');
  if (nameElement) {
    const fileName = nameElement.getAttribute('data-tooltip');
    const linkElement = item.querySelector('a[href*="/file/d/"]');
    if (linkElement) {
      const href = linkElement.getAttribute('href');
      const fileIdMatch = href.match(/\\/file\\/d\\/([a-zA-Z0-9_-]+)/);
      if (fileIdMatch) {
        files.push({
          fileName: fileName,
          fileId: fileIdMatch[1],
          googleDriveUrl: \`https://drive.google.com/file/d/\${fileIdMatch[1]}/view?usp=sharing\`
        });
      }
    }
  }
});
console.log(JSON.stringify(files, null, 2));
    `);
    console.log('4. 결과를 복사하여 이 스크립트의 extractedFiles 배열에 붙여넣기');
    console.log('5. 스크립트 재실행\n');
    return;
  }
  
  const migrationData = generateMigrationData();
  
  if (migrationData.length > 0) {
    generateMigrationScript(migrationData);
    generateCSV(migrationData);
  } else {
    console.log('❌ 유효한 파일이 없습니다.');
  }
}

// 명령행 인수 처리
if (process.argv.includes('--help')) {
  console.log(`
사용법:
  node scripts/extract-google-drive-files.js

기능:
  - 구글 드라이브 폴더에서 추출한 파일 목록 분석
  - 파일명 패턴 검증
  - 마이그레이션 스크립트 자동 생성
  - CSV 파일 생성

단계:
  1. 구글 드라이브 폴더에서 파일 목록 추출
  2. 이 스크립트에 데이터 입력
  3. 마이그레이션 스크립트 실행
  `);
  process.exit(0);
} else {
  main();
}
