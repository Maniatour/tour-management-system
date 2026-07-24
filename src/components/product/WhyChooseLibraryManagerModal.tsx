'use client'

import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import WhyChooseLibraryManagerPanel from '@/components/admin/WhyChooseLibraryManagerPanel'

type WhyChooseLibraryManagerModalProps = {
  onClose: () => void
  onMutated: () => void
}

export default function WhyChooseLibraryManagerModal({
  onClose,
  onMutated,
}: WhyChooseLibraryManagerModalProps) {
  const t = useTranslations('products.customerPageEdit.whyChooseEmbed')

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-3 sm:p-6">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-card shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
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
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <WhyChooseLibraryManagerPanel
            listMaxHeight="max-h-[50vh]"
            onMutated={onMutated}
          />
        </div>
      </div>
    </div>
  )
}
