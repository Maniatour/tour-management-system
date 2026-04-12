'use client'

import React from 'react'
import { Calendar } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import Image from 'next/image'
import { getProductName, getChannelName, getStatusLabel, isoToLocalCalendarDateKey } from '@/utils/reservationUtils'
import type { Reservation } from '@/types/reservation'

interface DateGroupHeaderProps {
  date: string
  reservations: Reservation[]
  isCollapsed: boolean
  onToggleCollapse: () => void
  customers: Array<{ id: string; name?: string }>
  products: Array<{ id: string; name: string }>
  channels: Array<{ id: string; name: string; favicon_url?: string }>
}

function isCancelledLikeStatus(status: string | undefined) {
  const s = (status || '').toLowerCase()
  return s === 'cancelled' || s === 'canceled' || s === 'deleted'
}

export function DateGroupHeader({
  date,
  reservations,
  isCollapsed,
  onToggleCollapse,
  customers,
  products,
  channels
}: DateGroupHeaderProps) {
  const t = useTranslations('reservations')
  const locale = useLocale()
  const dateLocaleTag = locale === 'en' ? 'en-US' : 'ko-KR'

  const registeredOnDate = reservations.filter((r) => isoToLocalCalendarDateKey(r.addedTime) === date)

  const regCount = registeredOnDate.length
  let regPending = 0
  let regConfirmed = 0
  let regCompleted = 0
  let regCancelled = 0
  for (const r of registeredOnDate) {
    const p = r.totalPeople
    const st = (r.status || '').toLowerCase()
    if (st === 'pending') regPending += p
    else if (st === 'confirmed') regConfirmed += p
    else if (st === 'completed') regCompleted += p
    else if (st === 'cancelled' || st === 'canceled' || st === 'deleted') regCancelled += p
  }
  const regPeopleTotal = registeredOnDate.reduce((sum, r) => sum + r.totalPeople, 0)
  const regAccounted = regPending + regConfirmed + regCompleted + regCancelled
  const regOther = Math.max(0, regPeopleTotal - regAccounted)

  const cancelledOnDate = reservations.filter(
    (r) => isCancelledLikeStatus(r.status) && isoToLocalCalendarDateKey(r.updated_at ?? null) === date
  )
  const cancelCount = cancelledOnDate.length
  const cancelPeople = cancelledOnDate.reduce((sum, r) => sum + r.totalPeople, 0)

  const detailParts: string[] = []
  if (regPending > 0) detailParts.push(t('groupingLabels.regBreakPending', { n: regPending }))
  if (regConfirmed > 0) detailParts.push(t('groupingLabels.regBreakConfirmed', { n: regConfirmed }))
  if (regCompleted > 0) detailParts.push(t('groupingLabels.regBreakCompleted', { n: regCompleted }))
  if (regCancelled > 0) detailParts.push(t('groupingLabels.regBreakCancelled', { n: regCancelled }))
  if (regOther > 0) detailParts.push(t('groupingLabels.regBreakOther', { n: regOther }))

  const sep = t('groupingLabels.summaryJoin')
  const regInner =
    detailParts.length > 0
      ? t('groupingLabels.registrationInner', {
          people: regPeopleTotal,
          detail: detailParts.join(sep)
        })
      : t('groupingLabels.registrationPeopleOnly', { people: regPeopleTotal })

  const summarySegments: string[] = []
  if (regCount > 0) {
    summarySegments.push(t('groupingLabels.registrationLine', { count: regCount, inner: regInner }))
  }
  if (cancelCount > 0) {
    summarySegments.push(t('groupingLabels.cancellationLine', { count: cancelCount, people: cancelPeople }))
  }
  const activitySummary =
    summarySegments.length > 0
      ? summarySegments.join(sep)
      : t('groupingLabels.fallbackCardStats', {
          count: reservations.length,
          people: reservations.reduce((total, r) => total + r.totalPeople, 0)
        })

  const formattedTitleDate = (() => {
    const [year, month, day] = date.split('-').map(Number)
    const dateObj = new Date(year, month - 1, day)
    return dateObj.toLocaleDateString(dateLocaleTag, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    })
  })()

  const productGroups = reservations.reduce((groups, reservation) => {
    const productName = getProductName(reservation.productId, products || [])
    if (!groups[productName]) {
      groups[productName] = 0
    }
    groups[productName] += reservation.totalPeople
    return groups
  }, {} as Record<string, number>)

  const channelGroups = reservations.reduce((groups, reservation) => {
    const channelName = getChannelName(reservation.channelId, channels || [])
    if (!groups[channelName]) {
      groups[channelName] = 0
    }
    groups[channelName] += reservation.totalPeople
    return groups
  }, {} as Record<string, number>)

  const statusGroups = reservations.reduce((groups, reservation) => {
    const status = reservation.status
    if (!groups[status]) {
      groups[status] = 0
    }
    groups[status] += reservation.totalPeople
    return groups
  }, {} as Record<string, number>)

  return (
    <div className="bg-gray-50 px-2 sm:px-4 py-2 sm:py-3 rounded-lg border border-gray-200">
      <div
        className="flex items-center justify-between cursor-pointer hover:bg-gray-100 rounded-lg p-1 sm:p-2 -m-1 sm:-m-2 transition-colors"
        onClick={onToggleCollapse}
      >
        <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 flex-1 min-w-0">
          <div className="flex items-center space-x-1 sm:space-x-3 min-w-0">
            <Calendar className="h-3 w-3 sm:h-5 sm:w-5 text-blue-600 flex-shrink-0" />
            <h3 className="text-xs sm:text-lg font-semibold text-gray-900">
              {formattedTitleDate} {t('groupingLabels.activityOn')}
            </h3>
          </div>
          <p className="text-[11px] sm:text-sm font-medium text-gray-800 pl-4 sm:pl-0 leading-snug break-words">
            {activitySummary}
          </p>
        </div>
        <div className="flex items-center space-x-2 flex-shrink-0 self-start sm:self-center">
          <svg
            className={`w-3 h-3 sm:h-5 sm:w-5 text-gray-500 transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {!isCollapsed && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center">
              <svg className="w-4 h-4 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              {t('stats.byProduct')} {t('peopleLabel')}
            </h4>
            <div className="space-y-2">
              {Object.entries(productGroups)
                .sort(([, a], [, b]) => b - a)
                .map(([productName, count]) => (
                  <div key={productName} className="flex justify-between items-center py-1 px-2 bg-gray-50 rounded">
                    <span className="text-gray-700 text-sm truncate flex-1 mr-2">{productName}</span>
                    <span className="font-semibold text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full min-w-0">
                      {count}
                      {t('stats.people')}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center">
              <svg className="w-4 h-4 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              {t('stats.byChannel')} {t('peopleLabel')}
            </h4>
            <div className="space-y-2">
              {Object.entries(channelGroups)
                .sort(([, a], [, b]) => b - a)
                .map(([channelName, count]) => {
                  const channel = channels?.find((c) => c.name === channelName)
                  return (
                    <div key={channelName} className="flex justify-between items-center py-1 px-2 bg-gray-50 rounded">
                      <div className="flex items-center space-x-2 flex-1 mr-2 min-w-0">
                        {channel?.favicon_url ? (
                          <Image
                            src={channel.favicon_url}
                            alt={`${channelName} favicon`}
                            width={16}
                            height={16}
                            className="rounded flex-shrink-0"
                            style={{ width: 'auto', height: 'auto' }}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.style.display = 'none'
                              const parent = target.parentElement
                              if (parent) {
                                const fallback = document.createElement('div')
                                fallback.className =
                                  'h-4 w-4 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-xs flex-shrink-0'
                                fallback.innerHTML = '\uD83C\uDF10'
                                parent.appendChild(fallback)
                              }
                            }}
                          />
                        ) : (
                          <div className="h-4 w-4 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-xs flex-shrink-0">
                            🌐
                          </div>
                        )}
                        <span className="text-gray-700 text-sm truncate">{channelName}</span>
                      </div>
                      <span className="font-semibold text-sm bg-green-100 text-green-800 px-2 py-1 rounded-full min-w-0">
                        {count}
                        {t('stats.people')}
                      </span>
                    </div>
                  )
                })}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center">
              <svg className="w-4 h-4 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {t('stats.byStatus')} {t('peopleLabel')}
            </h4>
            <div className="space-y-2">
              {Object.entries(statusGroups)
                .sort(([, a], [, b]) => b - a)
                .map(([status, count]) => (
                  <div key={status} className="flex justify-between items-center py-1 px-2 bg-gray-50 rounded">
                    <span className="text-gray-700 text-sm truncate flex-1 mr-2">{getStatusLabel(status, t)}</span>
                    <span className="font-semibold text-sm bg-purple-100 text-purple-800 px-2 py-1 rounded-full min-w-0">
                      {count}
                      {t('stats.people')}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}