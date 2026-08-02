'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Car, ExternalLink, FileText, X } from 'lucide-react'
import { useTranslations } from 'next-intl'

function isImageUrl(url: string): boolean {
  return /\.(jpe?g|png|gif|webp)($|\?)/i.test(url)
}

function isPdfUrl(url: string): boolean {
  return /\.pdf($|\?)/i.test(url)
}

interface GuideVehicleBadgeProps {
  vehicleNumber?: string | null
  rentalAgreementFileUrl?: string | null
  unassignedLabel: string
}

export default function GuideVehicleBadge({
  vehicleNumber,
  rentalAgreementFileUrl,
  unassignedLabel,
}: GuideVehicleBadgeProps) {
  const t = useTranslations('guide.tourCard')
  const [open, setOpen] = useState(false)

  const agreementUrl = rentalAgreementFileUrl?.trim() || ''
  const hasAgreement = agreementUrl.length > 0
  const label = vehicleNumber || unassignedLabel

  const handleClick = (e: React.MouseEvent) => {
    if (!hasAgreement) return
    e.stopPropagation()
    setOpen(true)
  }

  const badgeClass = hasAgreement
    ? 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 cursor-pointer transition-colors hover:bg-red-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60'
    : 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800'

  return (
    <>
      {hasAgreement ? (
        <button
          type="button"
          onClick={handleClick}
          className={badgeClass}
          title={t('viewRentalAgreement')}
          aria-label={`${label} — ${t('viewRentalAgreement')}`}
        >
          <Car className="w-3 h-3 mr-1 shrink-0" />
          {label}
        </button>
      ) : (
        <span className={badgeClass}>
          <Car className="w-3 h-3 mr-1 shrink-0" />
          {label}
        </span>
      )}

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[1300] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guide-rental-agreement-title"
            onClick={(e) => {
              e.stopPropagation()
              setOpen(false)
            }}
          >
            <div
              className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-2xl sm:rounded-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 sm:px-5">
                <h3
                  id="guide-rental-agreement-title"
                  className="flex min-w-0 items-center gap-2 text-sm font-semibold text-gray-900 sm:text-base"
                >
                  <FileText className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate">{t('rentalAgreementTitle')}</span>
                  {vehicleNumber ? (
                    <span className="truncate text-gray-500">· {vehicleNumber}</span>
                  ) : null}
                </h3>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="shrink-0 rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
                  aria-label={t('close')}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
                {isImageUrl(agreementUrl) ? (
                  <img
                    src={agreementUrl}
                    alt={t('rentalAgreementTitle')}
                    className="mx-auto max-h-[min(70vh,720px)] w-full rounded-lg border border-gray-200 object-contain shadow-sm"
                  />
                ) : isPdfUrl(agreementUrl) ? (
                  <iframe
                    src={agreementUrl}
                    title={t('rentalAgreementTitle')}
                    className="h-[min(70vh,720px)] w-full rounded-lg border border-gray-200 bg-white"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-200 bg-slate-50 px-6 py-10 text-center">
                    <FileText className="h-10 w-10 text-gray-400" />
                    <p className="text-sm text-gray-600">{t('rentalAgreementPreviewUnavailable')}</p>
                  </div>
                )}
              </div>

              <div className="flex shrink-0 justify-end border-t border-gray-200 bg-slate-50/80 px-4 py-3 sm:px-5">
                <a
                  href={agreementUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <ExternalLink className="h-4 w-4" />
                  {t('openInNewWindow')}
                </a>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
