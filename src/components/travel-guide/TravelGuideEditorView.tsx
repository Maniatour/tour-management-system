'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import CustomerPageShell from '@/components/customer/CustomerPageShell'
import TravelGuideEditorForm from '@/components/travel-guide/TravelGuideEditorForm'

type Props = {
  locale: string
  t: (key: string) => string
}

export default function TravelGuideEditorView({ locale, t }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('id')?.trim() ?? ''

  return (
    <CustomerPageShell locale={locale} className="travel-guide-page">
      <section className="kv-section">
        <div className="kv-container kv-travel-guide-editor">
          <Link href={`/${locale}/travel-guide`} className="kv-travel-guide-back">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {t('travelGuideBackToArticles')}
          </Link>

          <div className="kv-travel-guide-editor-header">
            <div>
              <h1 className="kv-section-title">
                {editId ? t('travelGuideEditArticle') : t('travelGuideWriteArticle')}
              </h1>
              <p className="kv-section-subtitle">{t('travelGuideEditorSubtitle')}</p>
            </div>
          </div>

          <TravelGuideEditorForm
            t={t}
            editId={editId}
            variant="page"
            onSaved={({ slug, isPublished }) => {
              if (isPublished) {
                router.push(`/${locale}/travel-guide/${slug}`)
              } else {
                router.push(`/${locale}/travel-guide`)
              }
            }}
            onDeleted={() => router.push(`/${locale}/travel-guide`)}
          />
        </div>
      </section>
    </CustomerPageShell>
  )
}
