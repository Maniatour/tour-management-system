'use client'

import React from 'react'
import { Calendar, UserMinus, UserPlus, Users } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import Image from 'next/image'
import { getProductName, getChannelName, getStatusLabel, isoToLocalCalendarDateKey } from '@/utils/reservationUtils'
import type { Reservation } from '@/types/reservation'

export type DateGroupCancellationStats =
  | { mode: 'default' }
  | { mode: 'audit-loading' }
  | { mode: 'audit'; reservations: Reservation[] }

interface DateGroupHeaderProps {
  date: string
  reservations: Reservation[]
  isCollapsed: boolean
  onToggleCollapse: () => void
  customers: Array<{ id: string; name?: string }>
  products: Array<{ id: string; name: string }>
  channels: Array<{ id: string; name: string; favicon_url?: string }>
  /**
   * 심플 카드: `audit`이면 `reservations`만 취소 집계에 사용(그날 상태→취소/삭제 감사 전환).
   * `audit-loading`이면 취소 숫자 자리는 로딩 표시. 생략·default면 기존(updated_at 당일+취소상태).
   */
  cancellationStats?: DateGroupCancellationStats
}

function isCancelledLikeStatus(status: string | undefined) {
  const s = (status || '').toLowerCase()
  return s === 'cancelled' || s === 'canceled' || s === 'deleted'
}

function sumPeopleByKey(list: Reservation[], keyFn: (r: Reservation) => string): Record<string, number> {
  const m: Record<string, number> = {}
  for (const r of list) {
    const k = keyFn(r)
    m[k] = (m[k] ?? 0) + r.totalPeople
  }
  return m
}

const badgeBase =
  'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] sm:text-xs font-semibold tabular-nums shrink-0 leading-none'

/** 등록: 양수일 때만 + 접두 */
function formatRegPeople(reg: number, peopleSuffix: string) {
  if (reg <= 0) return `${reg}${peopleSuffix}`
  return `+${reg}${peopleSuffix}`
}

/** 취소: 양수일 때만 −(하이픈) 접두 */
function formatCancelPeople(cancel: number, peopleSuffix: string) {
  if (cancel <= 0) return `${cancel}${peopleSuffix}`
  return `-${cancel}${peopleSuffix}`
}

/** 순(등록−취소): 0은 부호 없음, 양수 +, 음수는 숫자에 - 포함 */
function formatNetPeople(net: number, peopleSuffix: string) {
  if (net > 0) return `+${net}${peopleSuffix}`
  if (net < 0) return `${net}${peopleSuffix}`
  return `0${peopleSuffix}`
}

function RegCancelTotalBadges({
  reg,
  cancel,
  total,
  peopleSuffix,
  regBookingSuffix,
  cancelBookingSuffix,
  cancelPending,
  totalPending,
  groupAriaLabel,
}: {
  reg: number
  cancel: number
  /** 등록 인원 − 취소 인원(순증감) */
  total: number
  peopleSuffix: string
  /** 하루 통계: 예약 건수 문구(번역된 문자열) */
  regBookingSuffix?: string
  cancelBookingSuffix?: string
  /** 취소 집계(감사) 로드 중 — 취소 칸에 … 표시 */
  cancelPending?: boolean
  /** 취소 미확정 시 순증감 칸 … */
  totalPending?: boolean
  groupAriaLabel?: string
}) {
  const netMuted = !totalPending && total === 0
  return (
    <div
      className="flex flex-wrap items-center justify-end gap-1 sm:gap-1.5"
      role="group"
      aria-label={groupAriaLabel}
    >
      <span
        className={`${badgeBase} bg-blue-100 text-blue-900 ring-1 ring-blue-200/60 ${reg === 0 ? 'opacity-55' : ''}`}
      >
        <UserPlus className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
        <span>{formatRegPeople(reg, peopleSuffix)}</span>
        {regBookingSuffix ? (
          <span className="text-[10px] font-medium text-blue-800/85 opacity-90">· {regBookingSuffix}</span>
        ) : null}
      </span>
      <span
        className={`${badgeBase} bg-rose-100 text-rose-900 ring-1 ring-rose-200/60 ${cancelPending ? 'opacity-90' : cancel === 0 ? 'opacity-55' : ''}`}
      >
        <UserMinus className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
        <span>
          {cancelPending ? '…' : formatCancelPeople(cancel, peopleSuffix)}
        </span>
        {cancelPending ? null : cancelBookingSuffix ? (
          <span className="text-[10px] font-medium text-rose-800/85 opacity-90">· {cancelBookingSuffix}</span>
        ) : null}
      </span>
      <span
        className={`${badgeBase} ring-1 ${
          totalPending
            ? 'bg-violet-50 text-violet-900 ring-violet-200/70'
            : total < 0
              ? 'bg-amber-50 text-amber-950 ring-amber-200/80'
              : 'bg-violet-100 text-violet-950 ring-violet-200/70'
        } ${netMuted ? 'opacity-55' : ''}`}
      >
        <Users className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
        <span>{totalPending ? '…' : formatNetPeople(total, peopleSuffix)}</span>
      </span>
    </div>
  )
}

export function DateGroupHeader({
  date,
  reservations,
  isCollapsed,
  onToggleCollapse,
  customers,
  products,
  channels,
  cancellationStats = { mode: 'default' },
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

  const cancelStatsPending = cancellationStats.mode === 'audit-loading'

  /** default: 당일 updated_at+취소상태(과집계 가능). audit: 부모가 넘긴 목록만(그날 상태→취소/삭제 감사 전환). */
  const cancelledOnDate =
    cancellationStats.mode === 'audit'
      ? cancellationStats.reservations
      : cancellationStats.mode === 'audit-loading'
        ? []
        : reservations.filter(
            (r) => isCancelledLikeStatus(r.status) && isoToLocalCalendarDateKey(r.updated_at ?? null) === date
          )
  const cancelCount = cancelledOnDate.length
  const cancelPeople = cancelledOnDate.reduce((sum, r) => sum + r.totalPeople, 0)

  /** 요약과 동일: 당일 신규 등록 + 당일 취소 처리된 건만 상세 통계에 포함 (그날 다른 상태만 바뀐 카드 제외) */
  const statsRelevantReservations = (() => {
    const seen = new Set<string>()
    const out: Reservation[] = []
    for (const r of registeredOnDate) {
      const id = String(r.id ?? '').trim()
      if (!id || seen.has(id)) continue
      seen.add(id)
      out.push(r)
    }
    for (const r of cancelledOnDate) {
      const id = String(r.id ?? '').trim()
      if (!id || seen.has(id)) continue
      seen.add(id)
      out.push(r)
    }
    return out
  })()

  /** 등록·취소 요약이 있을 때만 위 집합 사용; 요약이 fallback이면 당일 그룹 전체와 맞춤 */
  const reservationsForActivityBreakdown =
    regCount > 0 || cancelCount > 0 ? statsRelevantReservations : reservations

  const hasActivityBreakdown = regCount > 0 || cancelCount > 0 || cancelStatsPending
  const dayRegCancelNetPeople = regPeopleTotal - (cancelStatsPending ? 0 : cancelPeople)

  const productRegByName = sumPeopleByKey(registeredOnDate, (r) =>
    getProductName(r.productId, products || [])
  )
  const productCancelByName = sumPeopleByKey(cancelledOnDate, (r) =>
    getProductName(r.productId, products || [])
  )
  const productRowKeys = [...new Set([...Object.keys(productRegByName), ...Object.keys(productCancelByName)])].sort(
    (a, b) =>
      (productRegByName[b] ?? 0) +
      (productCancelByName[b] ?? 0) -
      ((productRegByName[a] ?? 0) + (productCancelByName[a] ?? 0))
  )

  const channelRegByName = sumPeopleByKey(registeredOnDate, (r) =>
    getChannelName(r.channelId, channels || [])
  )
  const channelCancelByName = sumPeopleByKey(cancelledOnDate, (r) =>
    getChannelName(r.channelId, channels || [])
  )
  const channelRowKeys = [...new Set([...Object.keys(channelRegByName), ...Object.keys(channelCancelByName)])].sort(
    (a, b) =>
      (channelRegByName[b] ?? 0) +
      (channelCancelByName[b] ?? 0) -
      ((channelRegByName[a] ?? 0) + (channelCancelByName[a] ?? 0))
  )

  const productGroupsFallback = reservationsForActivityBreakdown.reduce((groups, reservation) => {
    const productName = getProductName(reservation.productId, products || [])
    groups[productName] = (groups[productName] ?? 0) + reservation.totalPeople
    return groups
  }, {} as Record<string, number>)

  const channelGroupsFallback = reservationsForActivityBreakdown.reduce((groups, reservation) => {
    const channelName = getChannelName(reservation.channelId, channels || [])
    groups[channelName] = (groups[channelName] ?? 0) + reservation.totalPeople
    return groups
  }, {} as Record<string, number>)

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
  if (cancelStatsPending) {
    summarySegments.push(t('groupingLabels.cancellationLinePending'))
  } else if (cancelCount > 0) {
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
      weekday: 'long',
    })
  })()

  const statusGroups = reservationsForActivityBreakdown.reduce((groups, reservation) => {
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
        <div className="mt-4 space-y-4">
          {hasActivityBreakdown && (
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">{t('stats.dayActivitySummaryTitle')}</h4>
              <div className="space-y-3">
                <div className="flex justify-start">
                  <RegCancelTotalBadges
                    reg={regPeopleTotal}
                    cancel={cancelPeople}
                    total={dayRegCancelNetPeople}
                    peopleSuffix={t('stats.people')}
                    regBookingSuffix={
                      regCount > 0 ? t('stats.bookingCountInline', { count: regCount }) : undefined
                    }
                    cancelBookingSuffix={
                      cancelStatsPending
                        ? undefined
                        : cancelCount > 0
                          ? t('stats.bookingCountInline', { count: cancelCount })
                          : undefined
                    }
                    cancelPending={cancelStatsPending}
                    totalPending={cancelStatsPending}
                    groupAriaLabel={t('stats.activityBadgesGroupLabel')}
                  />
                </div>
                <p className="text-xs text-gray-500 leading-snug">
                  {t('stats.dayActivitySummaryOverlapNote')}
                  {cancelStatsPending ? <> {t('stats.dayActivityCancelAuditLoading')}</> : null}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center">
              <svg className="w-4 h-4 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              {t('stats.byProduct')} {t('peopleLabel')}
            </h4>
            <div className="space-y-2">
              {hasActivityBreakdown
                ? productRowKeys.map((productName) => {
                    const reg = productRegByName[productName] ?? 0
                    const cancel = productCancelByName[productName] ?? 0
                    const net = reg - cancel
                    return (
                      <div
                        key={productName}
                        className="flex flex-col gap-2 py-2 px-2 bg-gray-50 rounded sm:flex-row sm:items-center sm:justify-between"
                      >
                        <span className="text-gray-800 text-sm font-medium truncate sm:max-w-[45%]">{productName}</span>
                        <div className="self-end sm:self-auto">
                          <RegCancelTotalBadges
                            reg={reg}
                            cancel={cancel}
                            total={net}
                            peopleSuffix={t('stats.people')}
                            groupAriaLabel={t('stats.activityBadgesGroupLabel')}
                          />
                        </div>
                      </div>
                    )
                  })
                : Object.entries(productGroupsFallback)
                    .sort(([, a], [, b]) => b - a)
                    .map(([productName, total]) => (
                      <div
                        key={productName}
                        className="flex flex-col gap-1 py-2 px-2 bg-gray-50 rounded sm:flex-row sm:items-center sm:justify-between"
                      >
                        <span className="text-gray-700 text-sm truncate sm:max-w-[55%]">{productName}</span>
                        <span
                          className={`${badgeBase} bg-slate-100 text-slate-900 ring-1 ring-slate-200/80 shrink-0`}
                        >
                          <Users className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
                          {t('stats.activityRowGroupTotalOnly', { total })}
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
              {hasActivityBreakdown
                ? channelRowKeys.map((channelName) => {
                    const reg = channelRegByName[channelName] ?? 0
                    const cancel = channelCancelByName[channelName] ?? 0
                    const net = reg - cancel
                    const channel = channels?.find((c) => c.name === channelName)
                    return (
                      <div
                        key={channelName}
                        className="flex flex-col gap-2 py-2 px-2 bg-gray-50 rounded sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-center space-x-2 min-w-0 sm:max-w-[48%]">
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
                          <span className="text-gray-800 text-sm font-medium truncate">{channelName}</span>
                        </div>
                        <div className="self-end pl-6 sm:max-w-[52%] sm:self-auto sm:pl-0">
                          <RegCancelTotalBadges
                            reg={reg}
                            cancel={cancel}
                            total={net}
                            peopleSuffix={t('stats.people')}
                            groupAriaLabel={t('stats.activityBadgesGroupLabel')}
                          />
                        </div>
                      </div>
                    )
                  })
                : Object.entries(channelGroupsFallback)
                    .sort(([, a], [, b]) => b - a)
                    .map(([channelName, total]) => {
                      const channel = channels?.find((c) => c.name === channelName)
                      return (
                        <div
                          key={channelName}
                          className="flex flex-col gap-1.5 py-2 px-2 bg-gray-50 rounded sm:flex-row sm:items-center sm:justify-between"
                        >
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
                          <span
                            className={`${badgeBase} bg-slate-100 text-slate-900 ring-1 ring-slate-200/80 shrink-0`}
                          >
                            <Users className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
                            {t('stats.activityRowGroupTotalOnly', { total })}
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
        </div>
      )}
    </div>
  )
}