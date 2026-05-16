'use client'

import { useState } from 'react'
import {
  findChannelRowForBalance,
  type BalanceChannelRowInput,
} from '@/utils/balanceChannelRevenue'

type ReservationChannelFaviconProps = {
  channelId: string
  channels: BalanceChannelRowInput[] | null | undefined
  /** Tailwind size e.g. h-3.5 w-3.5 */
  sizeClass?: string
  className?: string
}

/**
 * 예약 처리 필요 등 — 채널 파비콘(서브채널 id → 마스터 채널 파비콘).
 * next/image 대신 img 사용(외부 favicon URL은 remotePatterns 밖인 경우가 많음).
 */
export function ReservationChannelFavicon({
  channelId,
  channels,
  sizeClass = 'h-3.5 w-3.5',
  className = '',
}: ReservationChannelFaviconProps) {
  const [failed, setFailed] = useState(false)
  const channel = findChannelRowForBalance(channelId, channels ?? [])
  const url = channel?.favicon_url?.trim()

  const boxClass = `${sizeClass} shrink-0 rounded bg-gray-100 ${className}`

  if (!url || failed) {
    return <span className={boxClass} aria-hidden />
  }

  return (
    <img
      src={url}
      alt=""
      className={`${sizeClass} shrink-0 rounded object-cover ${className}`}
      onError={() => setFailed(true)}
    />
  )
}
