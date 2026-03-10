import { supabase } from './supabase'
import { createTourPhotosBucket, checkTourPhotosBucket } from './tourPhotoBucket'

/**
 * 오늘 이후의 투어 데이터에 대해 tour-photos 버켓을 일괄 생성하는 함수
 */
export async function bulkCreateFutureTourPhotoBuckets() {
  try {
    console.log('🚀 Starting bulk creation of tour-photos buckets for future tours...')
    
    // 오늘 날짜
    const today = new Date().toISOString().split('T')[0]
    console.log(`📅 Processing tours from ${today} onwards`)
    
    // 1. 먼저 메인 tour-photos 버켓이 있는지 확인
    const mainBucketExists = await checkTourPhotosBucket()
    if (!mainBucketExists) {
      console.log('📦 Creating main tour-photos bucket...')
      const created = await createTourPhotosBucket()
      if (created) {
        console.log('✅ Main tour-photos bucket created successfully!')
      } else {
        console.log('❌ Failed to create main tour-photos bucket')
        return false
      }
    } else {
      console.log('✅ Main tour-photos bucket already exists')
    }
    
    // 2. 오늘 이후의 투어 데이터만 조회
    console.log('📋 Fetching future tours...')
    const { data: tours, error: toursError } = await supabase
      .from('tours')
      .select('id, tour_date, product_id')
      .gte('tour_date', today) // 오늘 이후의 투어만
      .order('tour_date', { ascending: true })
    
    if (toursError) {
      console.error('❌ Error fetching tours:', toursError)
      return false
    }
    
    if (!tours || tours.length === 0) {
      console.log('ℹ️ No future tours found')
      return true
    }
    
    console.log(`📊 Found ${tours.length} future tours`)
    
    // 3. 각 투어별로 폴더 구조 생성
    console.log('📁 Creating folder structure in main bucket...')
    let folderSuccessCount = 0
    let folderErrorCount = 0
    
    for (const tour of tours) {
      try {
        // tour-photos 버킷 하위에 투어 ID로 폴더 (예: 19c6a24c, 037a6644)
        const folderPath = tour.id
        
        // 폴더가 존재하는지 확인
        const { data: testFile, error: testError } = await supabase.storage
          .from('tour-photos')
          .list(folderPath, { limit: 1 })
        
        if (testError && testError.message.includes('not found')) {
          // 폴더가 없으면 생성 (빈 파일 업로드로 폴더 생성)
          const { error: createError } = await supabase.storage
            .from('tour-photos')
            .upload(`${folderPath}/.gitkeep`, new Blob([''], { type: 'text/plain' }))
          
          if (createError) {
            console.error(`❌ Error creating folder for tour ${tour.id}:`, createError)
            folderErrorCount++
          } else {
            console.log(`✅ Created folder structure for tour ${tour.id} (${tour.tour_date})`)
            folderSuccessCount++
            
            // .gitkeep 파일 삭제 (폴더만 생성하기 위해)
            await supabase.storage
              .from('tour-photos')
              .remove([`${folderPath}/.gitkeep`])
          }
        } else {
          console.log(`✅ Folder structure already exists for tour ${tour.id} (${tour.tour_date})`)
          folderSuccessCount++
        }
      } catch (error) {
        console.error(`❌ Error processing folder for tour ${tour.id}:`, error)
        folderErrorCount++
      }
    }
    
    console.log(`📈 Folder Summary: ${folderSuccessCount} folders processed, ${folderErrorCount} errors`)
    
    // 4. 최종 결과
    console.log('🎉 Bulk creation completed!')
    console.log('📋 Summary:')
    console.log(`   - Main bucket: ${mainBucketExists ? 'Already existed' : 'Created'}`)
    console.log(`   - Future tours processed: ${tours.length}`)
    console.log(`   - Folders created: ${folderSuccessCount}`)
    console.log(`   - Errors: ${folderErrorCount}`)
    
    return true
    
  } catch (error) {
    console.error('❌ Error in bulk creation:', error)
    return false
  }
}

/**
 * 기존 투어 데이터에 대해 tour-photos 버켓을 일괄 생성하는 함수 (모든 투어)
 */
export async function bulkCreateTourPhotoBuckets() {
  try {
    console.log('🚀 Starting bulk creation of tour-photos buckets...')
    
    // 1. 먼저 메인 tour-photos 버켓이 있는지 확인
    const mainBucketExists = await checkTourPhotosBucket()
    if (!mainBucketExists) {
      console.log('📦 Creating main tour-photos bucket...')
      const created = await createTourPhotosBucket()
      if (created) {
        console.log('✅ Main tour-photos bucket created successfully!')
      } else {
        console.log('❌ Failed to create main tour-photos bucket')
        return false
      }
    } else {
      console.log('✅ Main tour-photos bucket already exists')
    }
    
    // 2. 모든 투어 데이터 조회
    console.log('📋 Fetching all tours...')
    const { data: tours, error: toursError } = await supabase
      .from('tours')
      .select('id, tour_date, product_id')
      .order('tour_date', { ascending: false })
    
    if (toursError) {
      console.error('❌ Error fetching tours:', toursError)
      return false
    }
    
    if (!tours || tours.length === 0) {
      console.log('ℹ️ No tours found')
      return true
    }
    
    console.log(`📊 Found ${tours.length} tours`)
    
    // 3. 각 투어별로 폴더 구조 생성
    console.log('📁 Creating folder structure in main bucket...')
    let folderSuccessCount = 0
    let folderErrorCount = 0
    
    for (const tour of tours) {
      try {
        // tour-photos 버킷 하위에 투어 ID로 폴더 (예: 19c6a24c, 037a6644)
        const folderPath = tour.id
        
        // 폴더가 존재하는지 확인
        const { data: testFile, error: testError } = await supabase.storage
          .from('tour-photos')
          .list(folderPath, { limit: 1 })
        
        if (testError && testError.message.includes('not found')) {
          // 폴더가 없으면 생성 (빈 파일 업로드로 폴더 생성)
          const { error: createError } = await supabase.storage
            .from('tour-photos')
            .upload(`${folderPath}/.gitkeep`, new Blob([''], { type: 'text/plain' }))
          
          if (createError) {
            console.error(`❌ Error creating folder for tour ${tour.id}:`, createError)
            folderErrorCount++
          } else {
            console.log(`✅ Created folder structure for tour ${tour.id} (${tour.tour_date})`)
            folderSuccessCount++
            
            // .gitkeep 파일 삭제 (폴더만 생성하기 위해)
            await supabase.storage
              .from('tour-photos')
              .remove([`${folderPath}/.gitkeep`])
          }
        } else {
          console.log(`✅ Folder structure already exists for tour ${tour.id} (${tour.tour_date})`)
          folderSuccessCount++
        }
      } catch (error) {
        console.error(`❌ Error processing folder for tour ${tour.id}:`, error)
        folderErrorCount++
      }
    }
    
    console.log(`📈 Folder Summary: ${folderSuccessCount} folders processed, ${folderErrorCount} errors`)
    
    // 4. 최종 결과
    console.log('🎉 Bulk creation completed!')
    console.log('📋 Summary:')
    console.log(`   - Main bucket: ${mainBucketExists ? 'Already existed' : 'Created'}`)
    console.log(`   - Tours processed: ${tours.length}`)
    console.log(`   - Folders created: ${folderSuccessCount}`)
    console.log(`   - Errors: ${folderErrorCount}`)
    
    return true
    
  } catch (error) {
    console.error('❌ Error in bulk creation:', error)
    return false
  }
}

/**
 * 투어별 폴더를 tour-photos 메인 버킷 안에 생성하는 함수.
 * (과거에는 tour-photos-{tourId} 개별 버킷을 만들었으나, 이제는 tour-photos/{tourId} 폴더 구조만 사용)
 */
export async function createIndividualTourBuckets() {
  try {
    console.log('🚀 Creating tour folders in tour-photos bucket...')
    
    const mainBucketExists = await checkTourPhotosBucket()
    if (!mainBucketExists) {
      console.log('📦 Main tour-photos bucket not found. Creating...')
      const created = await createTourPhotosBucket()
      if (!created) {
        console.error('❌ Failed to create main tour-photos bucket')
        return false
      }
    }
    
    const { data: tours, error: toursError } = await supabase
      .from('tours')
      .select('id, tour_date, product_id')
      .order('tour_date', { ascending: false })
    
    if (toursError) {
      console.error('❌ Error fetching tours:', toursError)
      return false
    }
    
    if (!tours || tours.length === 0) {
      console.log('ℹ️ No tours found')
      return true
    }
    
    console.log(`📊 Found ${tours.length} tours`)
    
    let successCount = 0
    let errorCount = 0
    
    for (const tour of tours) {
      try {
        const folderPath = tour.id
        
        const { data: listData, error: listError } = await supabase.storage
          .from('tour-photos')
          .list(folderPath, { limit: 1 })
        
        if (listError && listError.message.includes('not found')) {
          const { error: createError } = await supabase.storage
            .from('tour-photos')
            .upload(`${folderPath}/.gitkeep`, new Blob([''], { type: 'text/plain' }))
          
          if (createError) {
            console.error(`❌ Error creating folder for tour ${tour.id}:`, createError)
            errorCount++
          } else {
            await supabase.storage.from('tour-photos').remove([`${folderPath}/.gitkeep`])
            console.log(`✅ Created folder tour-photos/${tour.id}`)
            successCount++
          }
        } else {
          console.log(`✅ Folder tour-photos/${tour.id} already exists`)
          successCount++
        }
      } catch (error) {
        console.error(`❌ Error processing tour ${tour.id}:`, error)
        errorCount++
      }
    }
    
    console.log(`📈 Summary: ${successCount} folders ensured, ${errorCount} errors`)
    return true
  } catch (error) {
    console.error('❌ Error in folder creation:', error)
    return false
  }
}
