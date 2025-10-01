#!/usr/bin/env node

/**
 * 구글 드라이브 픽업 호텔 이미지 마이그레이션 스크립트
 * 파일명 패턴: {hotelId}.Photo {number}.{date}.png
 * 
 * 사용법:
 * node scripts/migrate-pickup-hotel-images.js
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

// 구글 드라이브 폴더의 이미지 파일 목록 (실제 데이터로 교체 필요)
const googleDriveImages = [
  // 파일명 패턴: {hotelId}.Photo {number}.{date}.png
  {
    fileName: '0f7f30a4.Photo 1.041046.png',
    hotelId: '0f7f30a4',
    photoNumber: 1,
    date: '041046',
    googleDriveUrl: 'https://drive.google.com/file/d/GOOGLE_FILE_ID_1/view?usp=sharing'
  },
  {
    fileName: '0f7f30a4.Photo 2.041046.png',
    hotelId: '0f7f30a4',
    photoNumber: 2,
    date: '041046',
    googleDriveUrl: 'https://drive.google.com/file/d/GOOGLE_FILE_ID_2/view?usp=sharing'
  },
  {
    fileName: '1e7a05e9.Photo 1.042915.png',
    hotelId: '1e7a05e9',
    photoNumber: 1,
    date: '042915',
    googleDriveUrl: 'https://drive.google.com/file/d/GOOGLE_FILE_ID_3/view?usp=sharing'
  },
  {
    fileName: '1e7a05e9.Photo 2.042915.png',
    hotelId: '1e7a05e9',
    photoNumber: 2,
    date: '042915',
    googleDriveUrl: 'https://drive.google.com/file/d/GOOGLE_FILE_ID_4/view?usp=sharing'
  },
  // 더 많은 이미지 추가...
  // 실제 구글 드라이브 파일 ID로 교체하세요
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
 * 구글 드라이브 URL을 직접 다운로드 URL로 변환
 */
function convertGoogleDriveUrl(url) {
  const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileIdMatch) {
    const fileId = fileIdMatch[1];
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }
  return url;
}

/**
 * URL에서 파일 다운로드
 */
function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }

      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      });
    });

    request.on('error', reject);
    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

/**
 * Supabase Storage에 파일 업로드
 */
async function uploadToSupabase(buffer, fileName, hotelId) {
  const filePath = `hotels/${hotelId}/${fileName}`;
  
  const { data, error } = await supabase.storage
    .from('pickup-hotel-media')
    .upload(filePath, buffer, {
      contentType: 'image/png',
      upsert: true // 같은 이름의 파일이 있으면 덮어쓰기
    });

  if (error) {
    throw error;
  }

  // 공개 URL 생성
  const { data: { publicUrl } } = supabase.storage
    .from('pickup-hotel-media')
    .getPublicUrl(filePath);

  return publicUrl;
}

/**
 * 픽업 호텔 데이터 업데이트
 */
async function updateHotelMedia(hotelId, newMediaUrls) {
  // 기존 미디어 URL 가져오기
  const { data: hotel, error: fetchError } = await supabase
    .from('pickup_hotels')
    .select('media, hotel, pick_up_location')
    .eq('id', hotelId)
    .single();

  if (fetchError) {
    throw fetchError;
  }

  // 기존 미디어와 새 미디어 합치기
  const existingMedia = hotel.media || [];
  const updatedMedia = [...existingMedia, ...newMediaUrls];

  // 데이터베이스 업데이트
  const { error: updateError } = await supabase
    .from('pickup_hotels')
    .update({ media: updatedMedia })
    .eq('id', hotelId);

  if (updateError) {
    throw updateError;
  }

  return {
    hotelName: hotel.hotel,
    location: hotel.pick_up_location,
    updatedMedia
  };
}

/**
 * 호텔별로 이미지 그룹화
 */
function groupImagesByHotel(images) {
  const grouped = {};
  
  images.forEach(image => {
    if (!grouped[image.hotelId]) {
      grouped[image.hotelId] = [];
    }
    grouped[image.hotelId].push(image);
  });
  
  // 각 호텔별로 사진 번호 순으로 정렬
  Object.keys(grouped).forEach(hotelId => {
    grouped[hotelId].sort((a, b) => a.photoNumber - b.photoNumber);
  });
  
  return grouped;
}

/**
 * 메인 마이그레이션 함수
 */
async function migrateImages() {
  console.log('🚀 구글 드라이브 픽업 호텔 이미지 마이그레이션 시작...\n');

  // 호텔별로 이미지 그룹화
  const groupedImages = groupImagesByHotel(googleDriveImages);
  const hotelIds = Object.keys(groupedImages);
  
  console.log(`📊 총 ${hotelIds.length}개 호텔, ${googleDriveImages.length}개 이미지 처리 예정\n`);

  for (const hotelId of hotelIds) {
    const images = groupedImages[hotelId];
    console.log(`🏨 호텔 처리 중: ${hotelId} (${images.length}개 이미지)`);
    
    const uploadedUrls = [];
    
    for (let i = 0; i < images.length; i++) {
      const imageData = images[i];
      
      try {
        console.log(`  📥 이미지 다운로드 중: ${imageData.fileName} (${i + 1}/${images.length})`);
        
        // 구글 드라이브 URL 변환
        const downloadUrl = convertGoogleDriveUrl(imageData.googleDriveUrl);
        
        // 이미지 다운로드
        const imageBuffer = await downloadImage(downloadUrl);
        
        // Supabase에 업로드
        console.log(`  ☁️ Supabase에 업로드 중...`);
        const publicUrl = await uploadToSupabase(imageBuffer, imageData.fileName, hotelId);
        
        uploadedUrls.push(publicUrl);
        console.log(`  ✅ 업로드 완료: ${imageData.fileName}`);
        
        // 요청 간격 조절 (API 제한 방지)
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`  ❌ 이미지 처리 실패 (${imageData.fileName}): ${error.message}`);
        continue;
      }
    }
    
    if (uploadedUrls.length > 0) {
      try {
        // 호텔 데이터 업데이트
        console.log(`  💾 호텔 데이터 업데이트 중...`);
        const result = await updateHotelMedia(hotelId, uploadedUrls);
        console.log(`  ✅ 호텔 데이터 업데이트 완료: ${result.hotelName} - ${result.location}`);
        console.log(`     총 ${result.updatedMedia.length}개 미디어 파일\n`);
      } catch (error) {
        console.error(`  ❌ 호텔 데이터 업데이트 실패: ${error.message}\n`);
      }
    } else {
      console.log(`  ⚠️ 업로드된 이미지가 없습니다.\n`);
    }
  }
  
  console.log('🎉 마이그레이션 완료!');
}

/**
 * 현재 픽업 호텔 목록 조회
 */
async function listCurrentHotels() {
  console.log('📋 현재 픽업 호텔 목록:');
  
  const { data: hotels, error } = await supabase
    .from('pickup_hotels')
    .select('id, hotel, pick_up_location, media')
    .order('hotel');
  
  if (error) {
    console.error('❌ 호텔 목록 조회 실패:', error.message);
    return;
  }
  
  hotels.forEach(hotel => {
    const mediaCount = hotel.media ? hotel.media.length : 0;
    console.log(`  - ${hotel.hotel} (${hotel.pick_up_location}): ID=${hotel.id}, ${mediaCount}개 미디어`);
  });
  
  console.log('');
}

/**
 * 파일명 패턴 검증
 */
function validateFileNames() {
  console.log('🔍 파일명 패턴 검증:');
  
  googleDriveImages.forEach(image => {
    const parsed = parseFileName(image.fileName);
    if (parsed.isValid) {
      console.log(`  ✅ ${image.fileName} -> 호텔ID: ${parsed.hotelId}, 사진번호: ${parsed.photoNumber}`);
    } else {
      console.log(`  ❌ ${image.fileName} -> 패턴 불일치`);
    }
  });
  
  console.log('');
}

// 스크립트 실행
async function main() {
  try {
    // 파일명 패턴 검증
    validateFileNames();
    
    // 현재 호텔 목록 표시
    await listCurrentHotels();
    
    // 마이그레이션 실행
    await migrateImages();
    
  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error.message);
    process.exit(1);
  }
}

// 명령행 인수 처리
if (process.argv.includes('--list')) {
  listCurrentHotels().then(() => process.exit(0));
} else if (process.argv.includes('--validate')) {
  validateFileNames();
  process.exit(0);
} else if (process.argv.includes('--help')) {
  console.log(`
사용법:
  node scripts/migrate-pickup-hotel-images.js [옵션]

옵션:
  --list       현재 픽업 호텔 목록만 표시
  --validate   파일명 패턴 검증만 실행
  --help       도움말 표시

환경변수:
  NEXT_PUBLIC_SUPABASE_URL        Supabase 프로젝트 URL
  SUPABASE_SERVICE_ROLE_KEY       Supabase 서비스 키

파일명 패턴:
  {hotelId}.Photo {number}.{date}.png
  예: 0f7f30a4.Photo 1.041046.png

주의사항:
  1. 스크립트 내의 googleDriveImages 배열을 실제 구글 드라이브 파일 ID로 수정하세요
  2. 구글 드라이브 이미지는 공개 접근 가능해야 합니다
  3. 호텔 ID는 8자리 16진수여야 합니다
  `);
  process.exit(0);
} else {
  main();
}
