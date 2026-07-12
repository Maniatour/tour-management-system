'use client'

import { Suspense } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import TravelGuideEditorView from '@/components/travel-guide/TravelGuideEditorView'
import { Loader2 } from 'lucide-react'
import CustomerPageShell from '@/components/customer/CustomerPageShell'

function TravelGuideWritePageInner() {
  const locale = useLocale()
  const t = useTranslations('common')
  return <TravelGuideEditorView locale={locale} t={t} />
}

export default function TravelGuideWritePage() {
  const locale = useLocale()

  return (
    <Suspense
      fallback={
        <CustomerPageShell locale={locale} className="travel-guide-page">
          <div className="kv-container py-16 text-center text-muted-foreground">
            <Loader2 className="mx-auto h-6 w-6 animate-spin" />
          </div>
        </CustomerPageShell>
      }
    >
      <TravelGuideWritePageInner />
    </Suspense>
  )
}
