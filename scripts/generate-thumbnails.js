/**
 * 기존 투어 사진들에 대한 썸네일 생성 스크립트
 * 
 * 사용법:
 *   node scripts/generate-thumbnails.js [tourId]
 * 
 * tourId를 지정하지 않으면 모든 투어의 사진에 대해 썸네일을 생성합니다.
 */

const { createClient } = require('@supabase/supabase-js')
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

// 환경 변수 로드
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ 환경 변수가 설정되지 않았습니다.')
  console.error('NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 확인해주세요.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

/**
 * 썸네일 파일명 생성
 */
function getThumbnailFileName(originalFileName) {
  const lastDotIndex = originalFileName.lastIndexOf('.')
  if (lastDotIndex === -1) {
    return `${originalFileName}_thumb`
  }
  const nameWithoutExt = originalFileName.substring(0, lastDotIndex)
  const ext = originalFileName.substring(lastDotIndex)
  return `${nameWithoutExt}_thumb${ext}`
}

/**
 * 단일 사진에 대한 썸네일 생성
 */
async function generateThumbnailForPhoto(tourId, fileName, filePath) {
  try {
    console.log(`  📸 처리 중: ${fileName}`)

    // 원본 이미지 다운로드
    const { data: imageData, error: downloadError } = await supabase.storage
      .from('tour-photos')
      .download(filePath)

    if (downloadError) {
      throw new Error(`다운로드 실패: ${downloadError.message}`)
    }

    // Buffer로 변환
    const imageBuffer = Buffer.from(await imageData.arrayBuffer())

    // 썸네일 생성 (최대 400x400px, 품질 80%)
    const thumbnailBuffer = await sharp(imageBuffer)
      .resize(400, 400, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 80 })
      .toBuffer()

    // 썸네일 파일명 및 경로
    const thumbnailFileName = getThumbnailFileName(fileName)
    const thumbnailPath = `${tourId}/${thumbnailFileName}`

    // 썸네일이 이미 존재하는지 확인
    const { data: existingThumbnail } = await supabase.storage
      .from('tour-photos')
      .list(tourId, {
        search: thumbnailFileName
      })

    if (existingThumbnail && existingThumbnail.length > 0) {
      console.log(`  ⏭️  썸네일이 이미 존재합니다: ${thumbnailFileName}`)
      return { success: true, skipped: true }
    }

    // 썸네일 업로드
    const { error: uploadError } = await supabase.storage
      .from('tour-photos')
      .upload(thumbnailPath, thumbnailBuffer, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      throw new Error(`업로드 실패: ${uploadError.message}`)
    }

    // 데이터베이스 업데이트
    const { data: photoRecords, error: queryError } = await supabase
      .from('tour_photos')
      .select('id')
      .eq('file_path', filePath)

    if (!queryError && photoRecords && photoRecords.length > 0) {
      for (const record of photoRecords) {
        await supabase
          .from('tour_photos')
          .update({ thumbnail_path: thumbnailPath })
          .eq('id', record.id)
      }
    }

    console.log(`  ✅ 완료: ${thumbnailFileName}`)
    return { success: true, skipped: false }
  } catch (error) {
    console.error(`  ❌ 실패: ${fileName} - ${error.message}`)
    return { success: false, error: error.message }
  }
}

/**
 * 특정 투어의 모든 사진에 대해 썸네일 생성
 */
async function generateThumbnailsForTour(tourId) {
  console.log(`\n📁 투어 ID: ${tourId}`)
  console.log('=' .repeat(50))

  try {
    // Storage에서 파일 목록 가져오기
    const { data: files, error } = await supabase.storage
      .from('tour-photos')
      .list(tourId, {
        sort: { column: 'created_at', order: 'desc' }
      })

    if (error) {
      console.error(`❌ 파일 목록 조회 실패: ${error.message}`)
      return { success: 0, failed: 0, skipped: 0 }
    }

    if (!files || files.length === 0) {
      console.log('  ℹ️  사진이 없습니다.')
      return { success: 0, failed: 0, skipped: 0 }
    }

    // 원본 사진 파일만 필터링 (썸네일 제외)
    const originalPhotos = files.filter(file => 
      !file.name.includes('.folder_info.json') && 
      !file.name.includes('folder.info') &&
      !file.name.includes('.info') &&
      !file.name.includes('.README') &&
      !file.name.startsWith('.') &&
      !file.name.includes('_thumb') && // 썸네일 제외
      file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)
    )

    if (originalPhotos.length === 0) {
      console.log('  ℹ️  처리할 사진이 없습니다.')
      return { success: 0, failed: 0, skipped: 0 }
    }

    // 썸네일 파일 목록 확인
    const thumbnailFiles = files.filter(file => file.name.includes('_thumb'))
    const thumbnailMap = new Set(thumbnailFiles.map(f => f.name.replace('_thumb', '')))

    // 썸네일이 없는 사진만 필터링
    const photosWithoutThumbnails = originalPhotos.filter(file => 
      !thumbnailMap.has(file.name)
    )

    if (photosWithoutThumbnails.length === 0) {
      console.log('  ✅ 모든 사진에 썸네일이 이미 생성되어 있습니다.')
      return { success: 0, failed: 0, skipped: originalPhotos.length }
    }

    console.log(`  📊 총 ${originalPhotos.length}개 사진 중 ${photosWithoutThumbnails.length}개에 썸네일 생성 필요`)

    let successCount = 0
    let failCount = 0
    let skippedCount = 0

    // 각 사진에 대해 썸네일 생성
    for (let i = 0; i < photosWithoutThumbnails.length; i++) {
      const file = photosWithoutThumbnails[i]
      const filePath = `${tourId}/${file.name}`
      
      console.log(`\n[${i + 1}/${photosWithoutThumbnails.length}]`)
      const result = await generateThumbnailForPhoto(tourId, file.name, filePath)
      
      if (result.success) {
        if (result.skipped) {
          skippedCount++
        } else {
          successCount++
        }
      } else {
        failCount++
      }

      // 서버 부하 방지를 위한 짧은 대기
      if (i < photosWithoutThumbnails.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    console.log(`\n📊 결과:`)
    console.log(`  ✅ 성공: ${successCount}개`)
    console.log(`  ⏭️  건너뜀: ${skippedCount}개`)
    console.log(`  ❌ 실패: ${failCount}개`)

    return { success: successCount, failed: failCount, skipped: skippedCount }
  } catch (error) {
    console.error(`❌ 오류 발생: ${error.message}`)
    return { success: 0, failed: 0, skipped: 0 }
  }
}

/**
 * 모든 투어에 대해 썸네일 생성
 */
async function generateThumbnailsForAllTours() {
  console.log('\n🔍 모든 투어의 사진 검색 중...\n')

  try {
    // Storage에서 모든 폴더 목록 가져오기
    const { data: folders, error } = await supabase.storage
      .from('tour-photos')
      .list('', {
        limit: 1000
      })

    if (error) {
      console.error(`❌ 폴더 목록 조회 실패: ${error.message}`)
      return
    }

    // 폴더만 필터링 (파일 제외)
    const tourFolders = folders?.filter(item => !item.name.includes('.')) || []

    if (tourFolders.length === 0) {
      console.log('  ℹ️  투어 폴더가 없습니다.')
      return
    }

    console.log(`📁 총 ${tourFolders.length}개 투어 발견\n`)

    let totalSuccess = 0
    let totalFailed = 0
    let totalSkipped = 0

    for (let i = 0; i < tourFolders.length; i++) {
      const folder = tourFolders[i]
      const result = await generateThumbnailsForTour(folder.name)
      
      totalSuccess += result.success
      totalFailed += result.failed
      totalSkipped += result.skipped

      if (i < tourFolders.length - 1) {
        console.log('\n' + '-'.repeat(50) + '\n')
      }
    }

    console.log('\n' + '='.repeat(50))
    console.log('📊 전체 결과:')
    console.log(`  ✅ 성공: ${totalSuccess}개`)
    console.log(`  ⏭️  건너뜀: ${totalSkipped}개`)
    console.log(`  ❌ 실패: ${totalFailed}개`)
    console.log('='.repeat(50) + '\n')
  } catch (error) {
    console.error(`❌ 오류 발생: ${error.message}`)
  }
}

// 메인 실행
async function main() {
  const tourId = process.argv[2]

  console.log('\n' + '='.repeat(50))
  console.log('🖼️  투어 사진 썸네일 생성 스크립트')
  console.log('='.repeat(50))

  if (tourId) {
    // 특정 투어만 처리
    await generateThumbnailsForTour(tourId)
  } else {
    // 모든 투어 처리
    await generateThumbnailsForAllTours()
  }

  console.log('✅ 스크립트 실행 완료\n')
}

main().catch(error => {
  console.error('❌ 치명적 오류:', error)
  process.exit(1)
})

