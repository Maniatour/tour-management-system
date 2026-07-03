'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

/** 레거시 URL → 허브로 통합 (쿼리 유지) */
export default function AdminOperationsHubManageRedirect() {
  const params = useParams()
  const router = useRouter()
  const locale = (params?.locale as string) || 'ko'

  useEffect(() => {
    router.replace(`/${locale}/admin/operations-hub`)
  }, [locale, router])

  return null
}
