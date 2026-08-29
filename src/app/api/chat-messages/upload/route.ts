import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

export const runtime = 'nodejs'
export const maxDuration = 30

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
const RATE_WINDOW_MS = 15 * 60 * 1000
const RATE_MAX = 30

const uploadHits = new Map<string, number[]>()

function getSupabaseAdmin() {
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

function clientKey(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}

function allowUpload(key: string): boolean {
  const now = Date.now()
  const recent = (uploadHits.get(key) || []).filter((t) => now - t < RATE_WINDOW_MS)
  if (recent.length >= RATE_MAX) {
    uploadHits.set(key, recent)
    return false
  }
  recent.push(now)
  uploadHits.set(key, recent)
  return true
}

function sniffImageExt(bytes: Uint8Array): 'jpg' | 'png' | 'gif' | 'webp' | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpg'
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'png'
  }
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return 'gif'
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'webp'
  }
  return null
}

function contentTypeForExt(ext: 'jpg' | 'png' | 'gif' | 'webp'): string {
  if (ext === 'png') return 'image/png'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'webp') return 'image/webp'
  return 'image/jpeg'
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: '서버 설정 오류: 이미지 업로드를 사용할 수 없습니다.' },
        { status: 500 }
      )
    }

    if (!allowUpload(clientKey(request))) {
      return NextResponse.json(
        { error: '업로드가 너무 잦습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 429 }
      )
    }

    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json({ error: '이미지 파일이 필요합니다.' }, { status: 400 })
    }
    const fileValue = formData.get('file')
    const roomId = String(formData.get('room_id') || '').trim()
    const roomCode = String(formData.get('room_code') || '').trim()

    if (!fileValue || typeof fileValue === 'string') {
      return NextResponse.json({ error: '이미지 파일이 필요합니다.' }, { status: 400 })
    }
    const file = fileValue as File
    if (file.size <= 0) {
      return NextResponse.json({ error: '이미지 파일이 필요합니다.' }, { status: 400 })
    }
    if (!roomId || !roomCode) {
      return NextResponse.json({ error: '채팅방 정보가 필요합니다.' }, { status: 400 })
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: '파일이 너무 큽니다. 최대 8MB까지 업로드할 수 있습니다.' },
        { status: 400 }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { data: room, error: roomError } = await supabaseAdmin
      .from('chat_rooms')
      .select('id, is_active, room_code')
      .eq('id', roomId)
      .eq('room_code', roomCode)
      .single()

    if (roomError || !room) {
      return NextResponse.json({ error: '채팅방을 찾을 수 없습니다.' }, { status: 404 })
    }
    if (!room.is_active) {
      return NextResponse.json({ error: '비활성화된 채팅방입니다.' }, { status: 403 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = sniffImageExt(new Uint8Array(buffer.subarray(0, 16)))
    if (!ext) {
      return NextResponse.json(
        { error: '지원하지 않는 이미지 형식입니다. JPEG, PNG, GIF, WebP만 가능합니다.' },
        { status: 400 }
      )
    }

    const timestamp = Date.now()
    const randomString = Math.random().toString(36).slice(2, 10)
    const storagePath = `chat-messages/${room.id}/${timestamp}_${randomString}.${ext}`

    const { data, error } = await supabaseAdmin.storage.from('images').upload(storagePath, buffer, {
      cacheControl: '3600',
      upsert: false,
      contentType: contentTypeForExt(ext),
    })

    if (error) {
      console.error('Tour chat image upload error:', error)
      return NextResponse.json(
        { error: '이미지 업로드에 실패했습니다.', detail: error.message },
        { status: 500 }
      )
    }

    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from('images').getPublicUrl(data.path)

    return NextResponse.json({
      success: true,
      imageUrl: publicUrl,
      fileName: file.name || `screenshot.${ext}`,
      path: data.path,
    })
  } catch (error) {
    console.error('Tour chat image upload error:', error)
    return NextResponse.json(
      {
        error: '서버 오류가 발생했습니다',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
