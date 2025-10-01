#!/usr/bin/env node

/**
 * 구글 드라이브에서 Supabase Storage로 픽업 호텔 이미지 마이그레이션 스크립트
 * 
 * 사용법:
 * 1. 구글 드라이브 이미지 URL 목록을 준비
 * 2. 스크립트 실행: node scripts/migrate-google-drive-images.js
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

// 구글 드라이브 이미지 URL 목록 (실제 데이터로 교체 필요)
const googleDriveImages = [
  {
    hotelId: 'hotel-id-1', // 실제 픽업 호텔 ID
    hotelName: '호텔명',
    location: '픽업 위치',
    imageUrls: [
      'https://drive.google.com/file/d/GOOGLE_FILE_ID_1/view?usp=sharing',
      'https://drive.google.com/file/d/GOOGLE_FILE_ID_2/view?usp=sharing',
    ]
  },
  // 더 많은 호텔 데이터 추가...
];

/**
 * 구글 드라이브 URL을 직접 다운로드 URL로 변환
 */
function convertGoogleDriveUrl(url) {
  // 구글 드라이브 공유 URL을 직접 다운로드 URL로 변환
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
 * 파일 확장자 추출
 */
function getFileExtension(url, contentType) {
  // Content-Type에서 확장자 추출
  if (contentType) {
    if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
    if (contentType.includes('png')) return 'png';
    if (contentType.includes('gif')) return 'gif';
    if (contentType.includes('webp')) return 'webp';
  }
  
  // URL에서 확장자 추출
  const urlMatch = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  if (urlMatch) {
    return urlMatch[1].toLowerCase();
  }
  
  return 'jpg'; // 기본값
}

/**
 * Supabase Storage에 파일 업로드
 */
async function uploadToSupabase(buffer, fileName, hotelId) {
  const filePath = `hotels/${hotelId}/${fileName}`;
  
  const { data, error } = await supabase.storage
    .from('pickup-hotel-media')
    .upload(filePath, buffer, {
      contentType: 'image/jpeg', // 필요에 따라 조정
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
    .select('media')
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

  return updatedMedia;
}

/**
 * 메인 마이그레이션 함수
 */
async function migrateImages() {
  console.log('🚀 구글 드라이브에서 Supabase로 이미지 마이그레이션 시작...\n');

  for (const hotelData of googleDriveImages) {
    console.log(`📁 호텔 처리 중: ${hotelData.hotelName} - ${hotelData.location}`);
    
    const uploadedUrls = [];
    
    for (let i = 0; i < hotelData.imageUrls.length; i++) {
      const imageUrl = hotelData.imageUrls[i];
      
      try {
        console.log(`  📥 이미지 다운로드 중: ${i + 1}/${hotelData.imageUrls.length}`);
        
        // 구글 드라이브 URL 변환
        const downloadUrl = convertGoogleDriveUrl(imageUrl);
        
        // 이미지 다운로드
        const imageBuffer = await downloadImage(downloadUrl);
        
        // 파일명 생성
        const timestamp = Date.now();
        const extension = getFileExtension(imageUrl);
        const fileName = `${hotelData.hotelId}_${timestamp}_${i + 1}.${extension}`;
        
        // Supabase에 업로드
        console.log(`  ☁️ Supabase에 업로드 중...`);
        const publicUrl = await uploadToSupabase(imageBuffer, fileName, hotelData.hotelId);
        
        uploadedUrls.push(publicUrl);
        console.log(`  ✅ 업로드 완료: ${fileName}`);
        
        // 요청 간격 조절 (API 제한 방지)
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`  ❌ 이미지 처리 실패: ${error.message}`);
        continue;
      }
    }
    
    if (uploadedUrls.length > 0) {
      try {
        // 호텔 데이터 업데이트
        console.log(`  💾 호텔 데이터 업데이트 중...`);
        await updateHotelMedia(hotelData.hotelId, uploadedUrls);
        console.log(`  ✅ 호텔 데이터 업데이트 완료: ${uploadedUrls.length}개 이미지 추가\n`);
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
 * 현재 픽업 호텔 목록 조회 (참고용)
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
    console.log(`  - ${hotel.hotel} (${hotel.pick_up_location}): ${mediaCount}개 미디어`);
  });
  
  console.log('');
}

// 스크립트 실행
async function main() {
  try {
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
} else if (process.argv.includes('--help')) {
  console.log(`
사용법:
  node scripts/migrate-google-drive-images.js [옵션]

옵션:
  --list     현재 픽업 호텔 목록만 표시
  --help     도움말 표시

환경변수:
  NEXT_PUBLIC_SUPABASE_URL        Supabase 프로젝트 URL
  SUPABASE_SERVICE_ROLE_KEY       Supabase 서비스 키

주의사항:
  1. 스크립트 내의 googleDriveImages 배열을 실제 데이터로 수정하세요
  2. 구글 드라이브 이미지는 공개 접근 가능해야 합니다
  3. 대용량 이미지의 경우 시간이 오래 걸릴 수 있습니다
  `);
  process.exit(0);
} else {
  main();
}
