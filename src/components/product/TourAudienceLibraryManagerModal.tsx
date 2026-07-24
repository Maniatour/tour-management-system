'use client'

import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import TourAudienceLibraryManagerPanel from '@/components/admin/TourAudienceLibraryManagerPanel'

type TourAudienceLibraryManagerModalProps = {
  onClose: () => void
  onMutated?: () => void
}

export default function TourAudienceLibraryManagerModal({
  onClose,
  onMutated,
}: TourAudienceLibraryManagerModalProps) {
  const t = useTranslations('products.customerPageEdit.tourAudienceEmbed')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-card shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">{t('manageLibraryTitle')}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={t('libraryClose')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-4">
          <TourAudienceLibraryManagerPanel {...(onMutated ? { onMutated } : {})} />
        </div>
      </div>
    </div>
  )
}
