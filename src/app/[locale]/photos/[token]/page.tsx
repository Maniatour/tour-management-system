import { redirect } from 'next/navigation'

/**
 * 로케일 접두 사진 URL은 canonical `/photos/[token]`로 통합합니다.
 * (풀 기능 구현은 `src/app/photos/[token]/page.tsx` 단일 유지)
 */
export default async function LocalePhotosRedirect({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  redirect(`/photos/${encodeURIComponent(token)}`)
}
