'use client'

import { useTranslations } from 'next-intl'
import { getStatusLabel } from '@/utils/reservationUtils'
import {
  STATUS_TRANSITION_NEW_FROM_MARKER,
  type StatusTransitionTargetBucketAgg,
  type StatusTransitionTargetKey,
} from '@/lib/reservationStatusTargetBuckets'

export function StatusTransitionByTargetBlock({
  buckets,
  loading,
  compact = false,
}: {
  buckets: StatusTransitionTargetBucketAgg[]
  loading?: boolean
  compact?: boolean
}) {
  const t = useTranslations('reservations')
  const people = t('stats.people')

  if (loading) {
    return (
      <p className={compact ? 'text-[11px] text-gray-500' : 'text-xs text-gray-500 py-1 px-2'}>
        {t('stats.statusTransitionAuditLoading')}
      </p>
    )
  }
  if (!buckets.length) {
    return (
      <p className={compact ? 'text-[11px] text-gray-400' : 'text-xs text-gray-400 py-1 px-2'}>
        {t('stats.statusTransitionEmpty')}
      </p>
    )
  }

  const bucketTitle = (target: StatusTransitionTargetKey) => {
    switch (target) {
      case 'confirmed':
        return t('stats.statusBucketConfirmedTitle')
      case 'pending':
        return t('stats.statusBucketPendingTitle')
      case 'cancelled':
        return t('stats.statusBucketCancelledTitle')
      default:
        return target
    }
  }

  const totalLabel = (target: StatusTransitionTargetKey) => {
    switch (target) {
      case 'confirmed':
        return t('stats.statusBucketTotalNetPeople')
      case 'pending':
        return t('stats.statusBucketTotalPeople')
      case 'cancelled':
        return t('stats.statusBucketTotalCancelPeople')
      default:
        return ''
    }
  }

  const gap = compact ? 'space-y-2' : 'space-y-3'
  const bucketBox = compact
    ? 'rounded border border-gray-100 bg-gray-50/80 px-2 py-1.5'
    : 'rounded-lg border border-gray-200 bg-gray-50/90 px-3 py-2.5'
  const titleCls = compact ? 'text-[11px] font-semibold text-gray-900' : 'text-sm font-semibold text-gray-900'
  const lineCls = compact ? 'text-[10px] text-gray-700 leading-snug pl-2' : 'text-xs text-gray-700 leading-snug pl-2'
  const totalCls = compact ? 'text-[11px] font-semibold text-gray-900 mt-1 pl-2' : 'text-xs font-semibold text-gray-900 mt-1.5 pl-2'

  return (
    <div className={gap}>
      {buckets.map((bucket) => (
        <div key={bucket.target} className={bucketBox}>
          <div className={titleCls}>{bucketTitle(bucket.target)}</div>
          <ul className="mt-1 list-none space-y-0.5">
            {bucket.lines.map((line) => {
              const fromLab =
                line.displayFrom === STATUS_TRANSITION_NEW_FROM_MARKER
                  ? t('stats.statusTransitionFromNew')
                  : getStatusLabel(line.displayFrom, (k) => t(k))
              const toLab = getStatusLabel(line.displayTo, (k) => t(k))
              const note = bucket.target === 'confirmed' ? t('stats.statusBucketLineNetPeopleNote') : ''
              return (
                <li key={line.key} className={lineCls}>
                  {fromLab} {'>'} {toLab} : {line.people}
                  {people}
                  {note ? <span className="text-gray-500"> {note}</span> : null}
                </li>
              )
            })}
          </ul>
          <div className={totalCls}>
            {totalLabel(bucket.target)}: {bucket.totalPeople}
            {people}
          </div>
        </div>
      ))}
    </div>
  )
}
