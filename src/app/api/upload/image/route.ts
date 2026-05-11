import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { createSupabaseClientWithToken, supabaseAdmin } from '@/lib/supabase'

/** 로그인 확인 후 스토리지용 클라이언트: 서비스 롤이 있으면 RLS 이슈 없이 업로드(인증된 요청에 한함) */
async function getAuthedStorageContext(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''

  const supabaseCookie = await createServerSupabase()
  let {
    data: { user },
    error: authError,
  } = await supabaseCookie.auth.getUser()

  let supabaseUser = supabaseCookie

  if (!user && bearer) {
    const jwtResult = await supabaseCookie.auth.getUser(bearer)
    user = jwtResult.data.user
    authError = jwtResult.error
    if (user) {
      supabaseUser = createSupabaseClientWithToken(bearer)
    }
  }

  if (authError || !user) {
    return {
      error: NextResponse.json(
        { error: '로그인이 필요합니다. 이미지 업로드는 로그인된 상태에서만 가능합니다.' },
        { status: 401 }
      ),
    }
  }

  const storageClient = supabaseAdmin ?? supabaseUser
  return { user, storageClient }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthedStorageContext(request)
    if ('error' in ctx) return ctx.error

    const { storageClient } = ctx

    const formData = await request.formData()
    const file = formData.get('file') as File
    const folder = (formData.get('folder') as string) || 'options'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // 파일 타입 검증
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({
        error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.',
      }, { status: 400 })
    }

    // 파일 크기 검증 (5MB 제한)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return NextResponse.json({
        error: 'File too large. Maximum size is 5MB.',
      }, { status: 400 })
    }

    // 고유한 파일명 생성
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 15)
    const fileExtension = file.name.split('.').pop() || 'jpg'
    const fileName = `${timestamp}_${randomString}.${fileExtension}`

    // Supabase Storage에 파일 업로드 (세션·JWT 또는 서비스 롤 클라이언트)
    const { data, error } = await storageClient.storage
      .from('images')
      .upload(`${folder}/${fileName}`, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (error) {
      console.error('Upload error:', error)
      return NextResponse.json(
        { error: 'Upload failed', detail: error.message },
        { status: 500 }
      )
    }

    // 공개 URL 생성
    const {
      data: { publicUrl },
    } = storageClient.storage.from('images').getPublicUrl(data.path)

    // 썸네일 URL 생성 (같은 이미지 사용, 나중에 이미지 리사이징 서비스 추가 가능)
    const thumbnailUrl = publicUrl

    return NextResponse.json({
      success: true,
      imageUrl: publicUrl,
      thumbnailUrl: thumbnailUrl,
      fileName: fileName,
      path: data.path,
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const ctx = await getAuthedStorageContext(request)
    if ('error' in ctx) return ctx.error

    const { storageClient } = ctx

    const { searchParams } = new URL(request.url)
    const filePath = searchParams.get('path')

    if (!filePath) {
      return NextResponse.json({ error: 'No file path provided' }, { status: 400 })
    }

    const { error } = await storageClient.storage.from('images').remove([filePath])

    if (error) {
      console.error('Delete error:', error)
      return NextResponse.json({ error: 'Delete failed', detail: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
