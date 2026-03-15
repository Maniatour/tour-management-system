import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_PUBLIC = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

/**
 * GET /api/proxy-image?url=...
 * 이메일 미리보기 등에서 외부 이미지(Supabase Storage 등)를 같은 오리진으로 불러와 표시하기 위한 프록시.
 * url 쿼리는 encodeURIComponent된 이미지 URL.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const encoded = searchParams.get('url')
    if (!encoded) {
      return NextResponse.json({ error: 'url required' }, { status: 400 })
    }
    const imageUrl = decodeURIComponent(encoded)
    if (!imageUrl.startsWith('http')) {
      return NextResponse.json({ error: 'Invalid url' }, { status: 400 })
    }
    const allowed = SUPABASE_PUBLIC
      ? imageUrl.startsWith(SUPABASE_PUBLIC)
      : imageUrl.includes('supabase.co')
    if (!allowed) {
      return NextResponse.json({ error: 'Only Supabase storage URLs allowed' }, { status: 403 })
    }

    const res = await fetch(imageUrl, {
      headers: {
        Accept: 'image/*',
        'User-Agent': 'Mozilla/5.0 (compatible; ProxyImage/1.0)'
      },
      next: { revalidate: 3600 }
    })
    if (!res.ok) {
      return new NextResponse(null, { status: res.status })
    }
    const contentType = res.headers.get('content-type') || 'image/jpeg'
    const blob = await res.blob()
    return new NextResponse(blob, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600'
      }
    })
  } catch (error) {
    console.error('[proxy-image]', error)
    return new NextResponse(null, { status: 500 })
  }
}
