// 오늘 이후의 투어 포토 버켓 일괄 생성을 위한 간단한 테스트 스크립트
// 브라우저 콘솔에서 실행할 수 있습니다.

// 사용법:
// 1. 브라우저 개발자 도구를 열고 콘솔 탭으로 이동
// 2. 아래 코드를 복사하여 붙여넣기
// 3. bulkCreateFutureTourPhotoBuckets() 함수 실행

async function bulkCreateFutureTourPhotoBuckets() {
  try {
    console.log('🚀 Starting bulk creation of tour-photos buckets for future tours...')
    
    // 오늘 날짜
    const today = new Date().toISOString().split('T')[0]
    console.log(`📅 Processing tours from ${today} onwards`)
    
    // Supabase 클라이언트 가져오기 (페이지에서 이미 로드된 것 사용)
    const { createClient } = await import('@supabase/supabase-js')
    
    // 환경 변수에서 URL과 키 가져오기
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co'
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key'
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // 1. 먼저 메인 tour-photos 버켓이 있는지 확인
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()
    if (listError) {
      console.error('❌ Error listing buckets:', listError)
      return false
    }
    
    const tourPhotosBucket = buckets?.find(bucket => bucket.name === 'tour-photos')
    if (!tourPhotosBucket) {
      console.log('📦 Creating main tour-photos bucket...')
      
      // 버켓 생성
      const { data, error } = await supabase.storage.createBucket('tour-photos', {
        public: true,
        fileSizeLimit: 50 * 1024 * 1024, // 50MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
      })
      
      if (error) {
        console.error('❌ Error creating tour-photos bucket:', error)
        return false
      }
      
      console.log('✅ Main tour-photos bucket created successfully!')
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
        const folderPath = `tours/${tour.id}`
        
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
            console.log(`✅ Created folder structure for tour ${tour.id}`)
            folderSuccessCount++
            
            // .gitkeep 파일 삭제 (폴더만 생성하기 위해)
            await supabase.storage
              .from('tour-photos')
              .remove([`${folderPath}/.gitkeep`])
          }
        } else {
          console.log(`✅ Folder structure already exists for tour ${tour.id}`)
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
    console.log(`   - Main bucket: ${tourPhotosBucket ? 'Already existed' : 'Created'}`)
    console.log(`   - Tours processed: ${tours.length}`)
    console.log(`   - Folders created: ${folderSuccessCount}`)
    console.log(`   - Errors: ${folderErrorCount}`)
    
    return true
    
  } catch (error) {
    console.error('❌ Error in bulk creation:', error)
    return false
  }
}

// 함수를 전역으로 등록하여 콘솔에서 호출할 수 있도록 함
window.bulkCreateFutureTourPhotoBuckets = bulkCreateFutureTourPhotoBuckets

console.log('✅ bulkCreateFutureTourPhotoBuckets function is now available!')
console.log('💡 Run: bulkCreateFutureTourPhotoBuckets() to start the process')
