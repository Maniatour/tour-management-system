'use client'

import Link from 'next/link'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { AwayChangeItem } from '@/lib/awayChangeDigest'

export type AwayOtherUserChangesModalProps = {
  open: boolean
  loading: boolean
  items: AwayChangeItem[]
  locale: string
  onClose: (markRead: boolean) => void
}

export default function AwayOtherUserChangesModal({
  open,
  loading,
  items,
  locale,
  onClose,
}: AwayOtherUserChangesModalProps) {
  const t = useTranslations('awayChanges')

  if (!open) return null

  const close = () => onClose(true)

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/50 p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="away-changes-title"
      onClick={close}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3">
          <div>
            <h2 id="away-changes-title" className="text-lg font-semibold text-gray-900">
              {t('title')}
            </h2>
            <p className="mt-1 text-sm text-gray-600">{t('subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
            aria-label={t('close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto px-4 py-3">
          {loading ? (
            <p className="text-sm text-gray-600">{t('loading')}</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-gray-600">{t('empty')}</p>
          ) : (
            <ul className="space-y-2">
              {items.map((it) => (
                <li
                  key={`${it.kind}-${it.id}`}
                  className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm"
                >
                  <div className="font-medium text-gray-900">
                    {t(`labels.${it.labelKey}`)} · {it.action}
                  </div>
                  <div className="mt-0.5 text-xs text-gray-600">
                    {t('by', { email: it.actor || t('unknownActor') })}
                  </div>
                  <div className="mt-0.5 text-xs text-gray-500">
                    {new Date(it.at).toLocaleString(locale === 'en' ? 'en-US' : 'ko-KR')}
                  </div>
                  <div className="mt-2">
                    <ChangeLink item={it} locale={locale} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-gray-100 px-4 py-3">
          <button
            type="button"
            onClick={close}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            {t('confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

function ChangeLink({ item, locale }: { item: AwayChangeItem; locale: string }) {
  const t = useTranslations('awayChanges')
  const prefix = `/${locale}/admin`
  if (item.kind === 'reservation_audit') {
    return (
      <Link
        href={`${prefix}/reservations/${encodeURIComponent(item.recordId)}`}
        className="text-sm font-medium text-blue-600 hover:underline"
      >
        {t('openReservation')}
      </Link>
    )
  }
  if (item.kind === 'tour_audit') {
    return (
      <Link
        href={`${prefix}/tours/${encodeURIComponent(item.recordId)}`}
        className="text-sm font-medium text-blue-600 hover:underline"
      >
        {t('openTour')}
      </Link>
    )
  }
  return (
    <Link href={`${prefix}/booking`} className="text-sm font-medium text-blue-600 hover:underline">
      {t('openBooking')}
    </Link>
  )
}
