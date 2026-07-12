import { NextRequest, NextResponse } from 'next/server'
import { fetchInstagramPosts } from '@/lib/instagramPosts'

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 10

export async function GET(request: NextRequest) {
  const limitParam = Number.parseInt(
    request.nextUrl.searchParams.get('limit') ?? String(DEFAULT_LIMIT),
    10
  )
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(limitParam, 1), MAX_LIMIT)
    : DEFAULT_LIMIT

  const result = await fetchInstagramPosts({ limit })

  return NextResponse.json(
    {
      ok: true,
      posts: result.posts,
      username: result.username,
      profileUrl: result.profileUrl,
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    }
  )
}
