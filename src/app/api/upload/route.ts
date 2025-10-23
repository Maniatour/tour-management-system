import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 용도별 버킷 매핑
const BUCKET_MAPPING = {
  maintenance: 'maintenance-files',
  company_expenses: 'company-expense-files',
  reservation_expenses: 'reservation-expense-files',
  ticket_bookings: 'ticket-booking-files',
  tour_hotel_bookings: 'hotel-booking-files'
} as const

type BucketType = keyof typeof BUCKET_MAPPING

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const bucketType = formData.get('bucketType') as BucketType || 'maintenance'
    
    if (!files || files.length === 0) {
      return NextResponse.json({ error: '파일이 선택되지 않았습니다.' }, { status: 400 })
    }

    // 버킷 타입 검증
    if (!BUCKET_MAPPING[bucketType]) {
      return NextResponse.json({ error: '유효하지 않은 버킷 타입입니다.' }, { status: 400 })
    }

    const bucketName = BUCKET_MAPPING[bucketType]
    const uploadedUrls: string[] = []
    
    for (const file of files) {
      // 파일 크기 제한 (10MB)
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json({ error: `파일 크기가 너무 큽니다: ${file.name}` }, { status: 400 })
      }
      
      // 파일 타입 검증
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json({ error: `지원하지 않는 파일 형식입니다: ${file.name}` }, { status: 400 })
      }

      // 파일명 생성 (용도별 접두사 + 타임스탬프 + 랜덤 문자열)
      const timestamp = Date.now()
      const randomString = Math.random().toString(36).slice(2)
      const fileExtension = file.name.split('.').pop()
      const fileName = `${bucketType}_${timestamp}_${randomString}.${fileExtension}`
      
      // Supabase Storage에 업로드
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) {
        console.error('파일 업로드 오류:', error)
        return NextResponse.json({ error: `파일 업로드 실패: ${file.name}` }, { status: 500 })
      }

      // 공개 URL 생성
      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(fileName)

      uploadedUrls.push(publicUrl)
    }

    return NextResponse.json({ 
      success: true, 
      urls: uploadedUrls,
      bucketType,
      bucketName,
      message: `${uploadedUrls.length}개 파일이 ${bucketName} 버킷에 업로드되었습니다.`
    })
  } catch (error) {
    console.error('파일 업로드 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}