'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import TourReportForm from '@/components/TourReportForm'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { TOUR_DETAIL_NESTED_PICKER_Z_INDEX } from '@/lib/dialogZIndex'

type TourReportWriteModalProps = {
  open: boolean
  onClose: () => void
  tourId: string
  productId?: string | null
  locale: string
  reportId?: string | null
  initialData?: Record<string, unknown> | null
  onSuccess: () => void
}

export default function TourReportWriteModal({
  open,
  onClose,
  tourId,
  productId,
  locale,
  reportId,
  initialData,
  onSuccess,
}: TourReportWriteModalProps) {
  const t = useTranslations('tours.tourReport')

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [open, onClose])

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent
        forceZIndex={TOUR_DETAIL_NESTED_PICKER_Z_INDEX}
        hideCloseButton
        overlayClassName="bg-black/50"
        className="flex h-[min(90vh,calc(100dvh-1.5rem))] w-[calc(100vw-1.5rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl"
        onOpenAutoFocus={(event) => event.preventDefault()}
        aria-describedby={undefined}
      >
        <DialogHeader className="flex shrink-0 flex-row items-center justify-between space-y-0 border-b border-gray-200 px-4 py-3 sm:px-6">
          <DialogTitle className="text-base sm:text-lg">{t('writeReport')}</DialogTitle>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            aria-label={t('close')}
          >
            <X className="h-5 w-5" />
          </button>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col">
          <TourReportForm
            key={reportId ?? 'create'}
            tourId={tourId}
            productId={productId ?? null}
            variant="modal"
            {...(reportId ? { reportId } : {})}
            {...(initialData ? { initialData } : {})}
            onSuccess={onSuccess}
            onCancel={onClose}
            locale={locale}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
