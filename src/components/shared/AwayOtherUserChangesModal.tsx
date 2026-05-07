'use client'

import Link from 'next/link'
import { Bus, User, UserCircle, Users, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { AwayChangeBadge, AwayChangeItem } from '@/lib/awayChangeDigest'

export type AwayOtherUserChangesModalProps = {
  open: boolean
  loading: boolean
  items: AwayChangeItem[]
  locale: string
  onClose: (markRead: boolean) => void
}

function badgeIcon(kind: AwayChangeBadge['kind']) {
  switch (kind) {
    case 'capacity':
      return <Users className="h-3 w-3 shrink-0" aria-hidden />
    case 'guide':
      return <UserCircle className="h-3 w-3 shrink-0" aria-hidden />
    case 'assistant':
      return <User className="h-3 w-3 shrink-0" aria-hidden />
    case 'vehicle':
      return <Bus className="h-3 w-3 shrink-0" aria-hidden />
    default:
      return null
  }
}

function actionBadgeClass(action: string): string {
  const a = (action || '').toUpperCase()
  if (a === 'INSERT') return 'bg-emerald-100 text-emerald-800'
  if (a === 'DELETE') return 'bg-red-100 text-red-800'
  return 'bg-blue-100 text-blue-800'
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
            <ul className="space-y-3">
              {items.map((it) => (
                <li
                  key={`${it.kind}-${it.id}`}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm shadow-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-gray-900">{t(`labels.${it.labelKey}`)}</span>
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${actionBadgeClass(it.action)}`}>
                      {(() => {
                        const a = (it.action || 'UPDATE').toLowerCase()
                        if (a === 'insert') return t('actions.insert')
                        if (a === 'delete') return t('actions.delete')
                        return t('actions.update')
                      })()}
                    </span>
                  </div>

                  <p className="mt-2 text-sm font-semibold leading-snug text-gray-900">{it.headerTitle}</p>
                  {it.headerSubtitle ? (
                    <p className="mt-1 text-xs text-gray-700">{it.headerSubtitle}</p>
                  ) : null}

                  {it.headerBadges.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {it.headerBadges.map((b, idx) => (
                        <BadgePill key={`${it.id}-b-${idx}`} badge={b} />
                      ))}
                    </div>
                  ) : null}

                  {it.diffLines.length > 0 ? (
                    <ul className="mt-3 space-y-2 border-t border-gray-100 pt-2 text-xs text-gray-800">
                      {it.diffLines.map((line, idx) => (
                        <li key={`${it.id}-d-${idx}`}>
                          <span className="font-medium text-gray-700">{line.label}</span>
                          <span className="text-gray-500">{t('colon')}</span>{' '}
                          <span className="text-gray-600">{line.beforeText}</span>
                          <span className="mx-0.5 text-gray-400">&gt;</span>
                          <span className="text-gray-900">{line.afterText}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="mt-3">
                    <ChangeLink item={it} locale={locale} />
                  </div>

                  <p className="mt-3 border-t border-gray-100 pt-2 text-[11px] text-gray-500">
                    {new Date(it.at).toLocaleString(locale === 'en' ? 'en-US' : 'ko-KR')}
                    <span className="mx-1.5 text-gray-300">·</span>
                    <span className="font-medium text-gray-600">
                      {it.actorNickName?.trim() || it.actor || t('unknownActor')}
                    </span>
                  </p>
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

function BadgePill({ badge }: { badge: AwayChangeBadge }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-800">
      {badgeIcon(badge.kind)}
      {badge.text}
    </span>
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
