import { createTourPhotosBucket, checkTourPhotosBucket } from '@/lib/tourPhotoBucket'

/**
 * 투어 생성 시 tour-photos 버켓을 생성하는 테스트 함수
 */
export async function testTourPhotoBucketCreation() {
  try {
    console.log('Testing tour-photos bucket creation...')
    
    // 1. 기존 버켓 확인
    const bucketExists = await checkTourPhotosBucket()
    console.log('Bucket exists:', bucketExists)
    
    if (!bucketExists) {
      // 2. 버켓 생성
      const created = await createTourPhotosBucket()
      console.log('Bucket created:', created)
      
      if (created) {
        console.log('✅ tour-photos bucket created successfully!')
        return true
      } else {
        console.log('❌ Failed to create tour-photos bucket')
        return false
      }
    } else {
      console.log('✅ tour-photos bucket already exists')
      return true
    }
  } catch (error) {
    console.error('❌ Error testing bucket creation:', error)
    return false
  }
}
