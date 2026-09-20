'use client'

import { Badge } from '@/components/ui/badge'
import { isListingStale } from '@/lib/market-research/prices'
import type { MarketFetchStatus } from '@/lib/market-research/types'

export function MarketResearchStatusBadge({
  status,
  lastSuccessAt,
  isKo,
}: {
  status: MarketFetchStatus
  lastSuccessAt: string | null
  isKo: boolean
}) {
  if (status === 'never') {
    return <Badge variant="outline">{isKo ? '미수집' : 'Never'}</Badge>
  }
  if (status === 'parse_failed' || status === 'http_error') {
    return <Badge variant="destructive">{isKo ? '수집 실패' : 'Fetch failed'}</Badge>
  }
  if (status === 'needs_manual') {
    return <Badge variant="secondary">{isKo ? '수동 확인' : 'Needs review'}</Badge>
  }
  if (lastSuccessAt && isListingStale(lastSuccessAt)) {
    return <Badge variant="destructive">{isKo ? '오래됨' : 'Stale'}</Badge>
  }
  if (status === 'ok') return <Badge>{isKo ? '수집 성공' : 'Fetched'}</Badge>
  return <Badge variant="outline">{isKo ? '미수집' : 'Never'}</Badge>
}
