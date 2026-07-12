import type { InstagramPostItem, InstagramPostsResult } from '@/lib/instagramPublic'
import { getPublicInstagramProfileUrl } from '@/lib/instagramPublic'

export type { InstagramPostItem, InstagramPostsResult } from '@/lib/instagramPublic'
export { getPublicInstagramProfileUrl } from '@/lib/instagramPublic'

type InstagramMediaRow = {
  id?: string
  caption?: string
  media_type?: string
  media_url?: string
  permalink?: string
  thumbnail_url?: string
}

type InstagramMediaResponse = {
  data?: InstagramMediaRow[]
  error?: { message?: string }
}

type InstagramProfileResponse = {
  id?: string
  username?: string
  error?: { message?: string }
}

const GRAPH_API_VERSION = 'v21.0'
const CACHE_TTL_MS = 60 * 60 * 1000
const DEFAULT_LIMIT = 10
const MAX_LIMIT = 10

let cachedPayload: {
  cacheKey: string
  expiresAt: number
  data: InstagramPostsResult
} | null = null

export function getInstagramAccessToken(): string | null {
  return process.env.INSTAGRAM_ACCESS_TOKEN?.trim() || null
}

export function getInstagramUserId(): string | null {
  return process.env.INSTAGRAM_USER_ID?.trim() || null
}

function emptyResult(): InstagramPostsResult {
  return {
    posts: [],
    username: null,
    profileUrl: getPublicInstagramProfileUrl(),
  }
}

function resolveImageUrl(row: InstagramMediaRow): string | null {
  const mediaType = row.media_type?.toUpperCase()
  if (mediaType === 'VIDEO') {
    return row.thumbnail_url?.trim() || row.media_url?.trim() || null
  }
  return row.media_url?.trim() || row.thumbnail_url?.trim() || null
}

function mapMediaRows(rows: InstagramMediaRow[]): InstagramPostItem[] {
  return rows
    .map((row) => {
      const imageUrl = resolveImageUrl(row)
      const permalink = row.permalink?.trim()
      const id = row.id?.trim()
      if (!imageUrl || !permalink || !id) return null

      const mediaType = row.media_type?.toUpperCase()
      const normalizedType: InstagramPostItem['mediaType'] =
        mediaType === 'VIDEO'
          ? 'VIDEO'
          : mediaType === 'CAROUSEL_ALBUM'
            ? 'CAROUSEL_ALBUM'
            : 'IMAGE'

      return {
        id,
        imageUrl,
        permalink,
        ...(row.caption?.trim() ? { caption: row.caption.trim() } : {}),
        mediaType: normalizedType,
      }
    })
    .filter((post): post is InstagramPostItem => post !== null)
}

async function fetchInstagramProfile(
  accessToken: string
): Promise<{ id: string | null; username: string | null }> {
  const url = new URL(`https://graph.instagram.com/${GRAPH_API_VERSION}/me`)
  url.searchParams.set('fields', 'id,username')
  url.searchParams.set('access_token', accessToken)

  try {
    const response = await fetch(url.toString(), { next: { revalidate: 3600 } })
    if (!response.ok) return { id: null, username: null }

    const payload = (await response.json()) as InstagramProfileResponse
    return {
      id: payload.id?.trim() || null,
      username: payload.username?.trim() || null,
    }
  } catch (error) {
    console.error('[instagramPosts] profile fetch failed', error)
    return { id: null, username: null }
  }
}

export async function fetchInstagramPosts(options?: {
  limit?: number
}): Promise<InstagramPostsResult> {
  const accessToken = getInstagramAccessToken()
  const limit = Math.min(Math.max(options?.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT)
  const cacheKey = `instagram:${limit}`

  if (cachedPayload && cachedPayload.cacheKey === cacheKey && cachedPayload.expiresAt > Date.now()) {
    return cachedPayload.data
  }

  if (!accessToken) {
    console.warn('[instagramPosts] Missing INSTAGRAM_ACCESS_TOKEN')
    return emptyResult()
  }

  let userId = getInstagramUserId()
  let username: string | null = null

  if (!userId) {
    const profile = await fetchInstagramProfile(accessToken)
    userId = profile.id
    username = profile.username
  }

  if (!userId) {
    console.warn('[instagramPosts] Missing INSTAGRAM_USER_ID')
    return emptyResult()
  }

  const url = new URL(`https://graph.instagram.com/${GRAPH_API_VERSION}/${userId}/media`)
  url.searchParams.set(
    'fields',
    'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp'
  )
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('access_token', accessToken)

  try {
    const response = await fetch(url.toString(), { next: { revalidate: 3600 } })
    if (!response.ok) {
      console.error('[instagramPosts] HTTP error', response.status)
      return emptyResult()
    }

    const payload = (await response.json()) as InstagramMediaResponse
    if (payload.error) {
      console.error('[instagramPosts] API error', payload.error.message)
      return emptyResult()
    }

    const posts = mapMediaRows(payload.data ?? []).slice(0, limit)
    if (!username) {
      const profile = await fetchInstagramProfile(accessToken)
      username = profile.username
    }

    const profileUrl =
      username != null
        ? `https://www.instagram.com/${username}/`
        : getPublicInstagramProfileUrl()

    const result: InstagramPostsResult = {
      posts,
      username,
      profileUrl,
    }

    cachedPayload = {
      cacheKey,
      expiresAt: Date.now() + CACHE_TTL_MS,
      data: result,
    }

    return result
  } catch (error) {
    console.error('[instagramPosts] fetch failed', error)
    return emptyResult()
  }
}
