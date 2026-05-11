'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

/** 예전 URL 호환: 투어 추가는 목록 페이지 모달로 이동했습니다. */
export default function AdminNewTourLegacyRedirect() {
  const router = useRouter()
  const params = useParams()
  const locale = typeof params?.locale === 'string' ? params.locale : 'ko'

  useEffect(() => {
    router.replace(`/${locale}/admin/tours`)
  }, [router, locale])

  return (
    <div className="flex min-h-[40vh] items-center justify-center p-6 text-sm text-gray-600">
      {locale === 'ko' ? '투어 목록으로 이동 중…' : 'Redirecting to tour list…'}
    </div>
  )
}
