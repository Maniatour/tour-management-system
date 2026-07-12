export type InstagramPostItem = {
  id: string
  imageUrl: string
  permalink: string
  caption?: string
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
}

export type InstagramPostsResult = {
  posts: InstagramPostItem[]
  username: string | null
  profileUrl: string | null
}

export function getPublicInstagramProfileUrl(): string {
  return (
    process.env.NEXT_PUBLIC_INSTAGRAM_URL?.trim() ||
    'https://www.instagram.com/lasvegasmania_us/'
  )
}
