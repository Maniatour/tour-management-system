'use client'

import React from 'react'
import { useParams } from 'next/navigation'
import TagTranslationManager from '@/components/admin/TagTranslationManager'

export default function TagTranslationsPage() {
  const params = useParams()
  const locale = params.locale as string

  return (
    <div className="p-6">
      <TagTranslationManager locale={locale} />
    </div>
  )
}
