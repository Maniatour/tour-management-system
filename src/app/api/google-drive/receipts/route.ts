import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { JWT } from 'google-auth-library'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

// Next.js API route 타임아웃 설정 (최대 300초 = 5분)
export const maxDuration = 300

// 구글 드라이브 API 스코프
const SCOPES = ['https://www.googleapis.com/auth/drive.readonly']

// 서비스 역할 키를 사용한 Supabase 클라이언트 생성 (RLS 우회)
const createClientSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Supabase service role key is required for API routes')
  }

  return createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

// 구글 드라이브 인증 클라이언트 생성
const getDriveClient = () => {
  const requiredEnvVars = [
    'GOOGLE_PROJECT_ID',
    'GOOGLE_PRIVATE_KEY_ID',
    'GOOGLE_PRIVATE_KEY',
    'GOOGLE_CLIENT_EMAIL',
    'GOOGLE_CLIENT_ID'
  ]

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName])

  if (missingVars.length > 0) {
    throw new Error(
      `Google Drive API 환경 변수가 설정되지 않았습니다: ${missingVars.join(', ')}. ` +
      `.env.local 파일에 다음 변수들을 설정해주세요: GOOGLE_PROJECT_ID, GOOGLE_PRIVATE_KEY_ID, ` +
      `GOOGLE_PRIVATE_KEY, GOOGLE_CLIENT_EMAIL, GOOGLE_CLIENT_ID`
    )
  }

  const auth = new JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL!,
    key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    scopes: SCOPES,
  })

  return google.drive({ version: 'v3', auth })
}

// 파일명에서 tour_expenses ID 추출 (ID.Image.xxxxxx.jpg 형식)
const extractExpenseIdFromFileName = (fileName: string): string | null => {
  // "ID.Image.xxxxxx.jpg" 형식에서 "ID" 부분 추출 (tour_expenses 테이블의 id)
  const match = fileName.match(/^([^\.]+)\.Image\./)
  return match ? match[1] : null
}

// 이미지 파일인지 확인
const isImageFile = (mimeType: string): boolean => {
  return mimeType.startsWith('image/')
}

/**
 * 구글 드라이브에서 영수증 이미지 목록 가져오기
 * GET /api/google-drive/receipts?folderId=<folder_id>
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const folderId = searchParams.get('folderId')

    if (!folderId) {
      return NextResponse.json(
        { error: '폴더 ID가 필요합니다. folderId 파라미터를 제공해주세요.' },
        { status: 400 }
      )
    }

    const drive = getDriveClient()

    // 폴더 내의 모든 파일 조회 (페이지네이션 처리)
    const allFiles = []
    let nextPageToken: string | undefined = undefined
    
    do {
      const response = await drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, webContentLink, thumbnailLink)',
        orderBy: 'modifiedTime desc',
        pageSize: 1000, // 최대값
        pageToken: nextPageToken,
      })
      
      if (response.data.files) {
        allFiles.push(...response.data.files)
      }
      
      nextPageToken = response.data.nextPageToken || undefined
    } while (nextPageToken)

    // 이미지 파일만 필터링하고 파일명에서 expense ID 추출
    const receipts = allFiles
      .filter(file => isImageFile(file.mimeType || ''))
      .map(file => {
        const expenseId = extractExpenseIdFromFileName(file.name || '')
        return {
          fileId: file.id,
          fileName: file.name,
          mimeType: file.mimeType,
          size: file.size,
          modifiedTime: file.modifiedTime,
          webContentLink: file.webContentLink,
          thumbnailLink: file.thumbnailLink,
          expenseId: expenseId,
        }
      })

    return NextResponse.json({
      success: true,
      receipts,
      count: receipts.length,
    })
  } catch (error: any) {
    console.error('구글 드라이브 영수증 목록 조회 오류:', error)
    return NextResponse.json(
      {
        error: '구글 드라이브에서 영수증 목록을 가져오는데 실패했습니다.',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

/**
 * 구글 드라이브에서 영수증 이미지를 다운로드하여 Supabase에 업로드
 * POST /api/google-drive/receipts
 * Body: { fileId: string, expenseId?: string, submittedBy?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fileId, expenseId, submittedBy } = body

    if (!fileId) {
      return NextResponse.json(
        { error: '파일 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    const drive = getDriveClient()
    const supabase = createClientSupabase()

    // 1. 파일 정보 가져오기
    const fileInfo = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType, size',
    })

    const fileName = fileInfo.data.name || 'receipt.jpg'
    const mimeType = fileInfo.data.mimeType || 'image/jpeg'
    const fileSize = parseInt(fileInfo.data.size || '0')

    // 파일명에서 expense ID 추출 (제공되지 않은 경우)
    let finalExpenseId = expenseId || extractExpenseIdFromFileName(fileName)

    if (!finalExpenseId) {
      return NextResponse.json(
        {
          error: '파일명에서 expense ID를 추출할 수 없습니다. 파일명 형식은 "ID.Image.xxxxxx.jpg"여야 합니다.',
          fileName,
        },
        { status: 400 }
      )
    }

    // 2. tour_expenses 레코드 존재 확인 및 이미 image_url이 있는지 확인
    const { data: expenseData, error: expenseError } = await supabase
      .from('tour_expenses')
      .select('id, tour_id, tour_date, product_id, image_url, file_path')
      .eq('id', finalExpenseId)
      .single()

    if (expenseError || !expenseData) {
      return NextResponse.json(
        {
          error: `Expense ID "${finalExpenseId}"에 해당하는 레코드를 찾을 수 없습니다.`,
          expenseId: finalExpenseId,
        },
        { status: 404 }
      )
    }

    // 이미 image_url이 있는 경우 건너뛰기
    if (expenseData.image_url && expenseData.image_url.trim() !== '') {
      return NextResponse.json({
        success: true,
        message: '이미 영수증이 등록되어 있어 건너뛰었습니다.',
        skipped: true,
        data: {
          expenseId: finalExpenseId,
          tourId: expenseData.tour_id,
          fileName,
          existingImageUrl: expenseData.image_url,
        },
      })
    }

    // 3. 구글 드라이브에서 파일 다운로드
    const fileResponse = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    )

    const fileBuffer = Buffer.from(fileResponse.data as ArrayBuffer)
    const file = new File([fileBuffer], fileName, { type: mimeType })

    // 4. Supabase Storage에 업로드
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 15)
    const fileExtension = fileName.split('.').pop() || 'jpg'
    const uploadFileName = `${timestamp}_${randomString}.${fileExtension}`
    const filePath = `receipts/${expenseData.tour_id}/${uploadFileName}`

    const { error: uploadError } = await supabase.storage
      .from('tour-expenses')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      console.error('Supabase 업로드 오류:', uploadError)
      return NextResponse.json(
        {
          error: 'Supabase Storage에 파일 업로드 중 오류가 발생했습니다.',
          details: uploadError.message,
        },
        { status: 500 }
      )
    }

    // 5. 공개 URL 생성
    const { data: { publicUrl } } = supabase.storage
      .from('tour-expenses')
      .getPublicUrl(filePath)

    // 6. tour_expenses 테이블의 image_url과 file_path 업데이트
    const { error: updateError } = await supabase
      .from('tour_expenses')
      .update({
        image_url: publicUrl,
        file_path: filePath,
        updated_at: new Date().toISOString(),
      })
      .eq('id', finalExpenseId)

    if (updateError) {
      console.error('데이터베이스 업데이트 오류:', updateError)
      return NextResponse.json(
        {
          error: '데이터베이스 레코드를 업데이트하는 중 오류가 발생했습니다.',
          details: updateError.message,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '영수증이 성공적으로 가져와졌습니다.',
      data: {
        expenseId: finalExpenseId,
        tourId: expenseData.tour_id,
        fileName,
        filePath,
        imageUrl: publicUrl,
        tourDate: expenseData.tour_date,
      },
    })
  } catch (error: any) {
    console.error('구글 드라이브 영수증 가져오기 오류:', error)
    return NextResponse.json(
      {
        error: '구글 드라이브에서 영수증을 가져오는데 실패했습니다.',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

/**
 * 여러 영수증을 한 번에 가져오기
 * PUT /api/google-drive/receipts
 * Body: { folderId: string, submittedBy?: string, batchSize?: number, skip?: number }
 * 
 * 배치 처리 지원:
 * - batchSize: 한 번에 처리할 파일 수 (기본값: 50)
 * - skip: 건너뛸 파일 수 (페이지네이션용)
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { folderId, submittedBy, batchSize = 50, skip = 0 } = body

    if (!folderId) {
      return NextResponse.json(
        { error: '폴더 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    const drive = getDriveClient()
    const supabase = createClientSupabase()

    // 폴더 내의 모든 이미지 파일 조회 (페이지네이션 처리)
    const allFiles = []
    let nextPageToken: string | undefined = undefined
    
    do {
      const response = await drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'nextPageToken, files(id, name, mimeType, size)',
        pageSize: 1000, // 최대값
        pageToken: nextPageToken,
      })
      
      if (response.data.files) {
        allFiles.push(...response.data.files)
      }
      
      nextPageToken = response.data.nextPageToken || undefined
    } while (nextPageToken)

    const imageFiles = allFiles.filter(file =>
      isImageFile(file.mimeType || '')
    )

    // 배치 처리: skip부터 batchSize만큼만 처리
    const totalFiles = imageFiles.length
    const startIndex = skip
    const endIndex = Math.min(skip + batchSize, totalFiles)
    const filesToProcess = imageFiles.slice(startIndex, endIndex)
    const hasMore = endIndex < totalFiles

    const results = []
    const errors = []
    const skipped = []

    // 각 파일을 순차적으로 처리
    for (const file of filesToProcess) {
      try {
        const expenseId = extractExpenseIdFromFileName(file.name || '')

        if (!expenseId) {
          errors.push({
            fileName: file.name,
            error: '파일명에서 expense ID를 추출할 수 없습니다.',
          })
          continue
        }

        // tour_expenses 레코드 존재 확인 및 이미 image_url이 있는지 확인
        const { data: expenseData, error: expenseError } = await supabase
          .from('tour_expenses')
          .select('id, tour_id, tour_date, product_id, image_url, file_path')
          .eq('id', expenseId)
          .single()

        if (expenseError || !expenseData) {
          errors.push({
            fileName: file.name,
            expenseId,
            error: `Expense ID "${expenseId}"에 해당하는 레코드를 찾을 수 없습니다.`,
          })
          continue
        }

        // 이미 image_url이 있는 경우 건너뛰기
        if (expenseData.image_url && expenseData.image_url.trim() !== '') {
          skipped.push({
            fileName: file.name,
            expenseId,
            reason: '이미 영수증이 등록되어 있음',
          })
          continue
        }

        // 파일 다운로드
        const fileResponse = await drive.files.get(
          { fileId: file.id!, alt: 'media' },
          { responseType: 'arraybuffer' }
        )

        const fileBuffer = Buffer.from(fileResponse.data as ArrayBuffer)
        const fileObj = new File([fileBuffer], file.name || 'receipt.jpg', {
          type: file.mimeType || 'image/jpeg',
        })

        // Supabase Storage에 업로드
        const timestamp = Date.now()
        const randomString = Math.random().toString(36).substring(2, 15)
        const fileExtension = (file.name || 'jpg').split('.').pop() || 'jpg'
        const uploadFileName = `${timestamp}_${randomString}.${fileExtension}`
        const filePath = `receipts/${expenseData.tour_id}/${uploadFileName}`

        const { error: uploadError } = await supabase.storage
          .from('tour-expenses')
          .upload(filePath, fileObj, {
            cacheControl: '3600',
            upsert: false,
          })

        if (uploadError) {
          errors.push({
            fileName: file.name,
            expenseId,
            error: `Supabase 업로드 실패: ${uploadError.message}`,
          })
          continue
        }

        // 공개 URL 생성
        const { data: { publicUrl } } = supabase.storage
          .from('tour-expenses')
          .getPublicUrl(filePath)

        // tour_expenses 테이블의 image_url과 file_path 업데이트
        const { error: updateError } = await supabase
          .from('tour_expenses')
          .update({
            image_url: publicUrl,
            file_path: filePath,
            updated_at: new Date().toISOString(),
          })
          .eq('id', expenseId)

        if (updateError) {
          errors.push({
            fileName: file.name,
            expenseId,
            error: `데이터베이스 업데이트 실패: ${updateError.message}`,
          })
          continue
        }

        results.push({
          fileName: file.name,
          expenseId,
          tourId: expenseData.tour_id,
          success: true,
        })

        // API 할당량 고려하여 약간의 지연
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error: any) {
        errors.push({
          fileName: file.name,
          error: error.message || '처리 중 오류 발생',
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `${results.length}개의 영수증이 성공적으로 가져와졌습니다.${skipped.length > 0 ? ` (${skipped.length}개 건너뜀)` : ''}`,
      results,
      errors,
      skipped,
      pagination: {
        total: totalFiles,
        processed: endIndex,
        hasMore,
        nextSkip: hasMore ? endIndex : undefined,
      },
      summary: {
        total: totalFiles,
        processed: filesToProcess.length,
        success: results.length,
        failed: errors.length,
        skipped: skipped.length,
      },
    })
  } catch (error: any) {
    console.error('구글 드라이브 영수증 일괄 가져오기 오류:', error)
    return NextResponse.json(
      {
        error: '구글 드라이브에서 영수증을 일괄 가져오는데 실패했습니다.',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

