import type { InstagramPostItem } from '@/lib/instagramPublic'
import { getPublicInstagramProfileUrl } from '@/lib/instagramPublic'

export type InstagramPostsClientResult = {
  posts: InstagramPostItem[]
  profileUrl: string
}

const emptyResult = (): InstagramPostsClientResult => ({
  posts: [],
  profileUrl: getPublicInstagramProfileUrl(),
})

export async function fetchInstagramPosts(options?: {
  limit?: number
}): Promise<InstagramPostsClientResult> {
  const params = new URLSearchParams({
    limit: String(options?.limit ?? 10),
  })

  try {
    const response = await fetch(`/api/public/instagram-posts?${params.toString()}`)
    if (!response.ok) return emptyResult()

    const payload = (await response.json()) as {
      ok?: boolean
      posts?: InstagramPostItem[]
      profileUrl?: string | null
    }

    if (!payload.ok) return emptyResult()

    return {
      posts: payload.posts ?? [],
      profileUrl: payload.profileUrl?.trim() || getPublicInstagramProfileUrl(),
    }
  } catch (error) {
    console.error('[fetchInstagramPosts]', error)
    return emptyResult()
  }
}
