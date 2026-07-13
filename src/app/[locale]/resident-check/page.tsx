'use client'

import { Suspense } from 'react'
import { useTranslations } from 'next-intl'
import ResidentCheckFlow from '@/components/resident-check/ResidentCheckFlow'

function ResidentCheckSuspenseFallback() {
  const t = useTranslations('residentCheck')
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 text-muted-foreground">
      {t('suspenseLoading')}
    </div>
  )
}

export default function ResidentCheckPage() {
  return (
    <Suspense fallback={<ResidentCheckSuspenseFallback />}>
      <ResidentCheckFlow />
    </Suspense>
  )
}
