'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { listingAxes } from '@/lib/market-research/prices'
import { axisLabel, otaPlatformLabel } from '@/lib/market-research/compare'
import type { MarketCanyonVariant, MarketOfferType } from '@/lib/market-research/types'
import type { MarketResearchBundle } from './helpers'

export function MarketResearchPriceEntryForm({
  bundle,
  isKo,
  onSave,
}: {
  bundle: MarketResearchBundle
  isKo: boolean
  onSave: (input: {
    listingId: string
    canyon: MarketCanyonVariant
    offer: MarketOfferType
    sale: number
    notIncluded: number
    rating?: number | null
    reviewCount?: number | null
  }) => Promise<void>
}) {
  const [listingId, setListingId] = useState(bundle.listings[0]?.id || '')
  const listing = bundle.listings.find((row) => row.id === listingId)
  const axes = useMemo(() => (listing ? listingAxes(listing) : []), [listing])
  const [canyon, setCanyon] = useState<MarketCanyonVariant>(axes[0]?.canyon || 'lower')
  const [offer, setOffer] = useState<MarketOfferType>(axes[0]?.offer || 'all_inclusive')
  const [sale, setSale] = useState('')
  const [notIncluded, setNotIncluded] = useState('')
  const [rating, setRating] = useState('')
  const [reviewCount, setReviewCount] = useState('')
  const [saving, setSaving] = useState(false)
  const nameByCompetitor = new Map(bundle.competitors.map((row) => [row.id, row.name]))

  return (
    <Card className="rounded-2xl border-border/60 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">{isKo ? '오늘 가격 입력' : 'Enter today’s price'}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label>{isKo ? '리스팅' : 'Listing'}</Label>
          <Select
            value={listingId}
            onValueChange={(value) => {
              setListingId(value)
              const next = bundle.listings.find((row) => row.id === value)
              const first = next ? listingAxes(next)[0] : null
              if (first) {
                setCanyon(first.canyon)
                setOffer(first.offer)
              }
            }}
          >
            <SelectTrigger className="h-11 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {bundle.listings.map((row) => (
                <SelectItem key={row.id} value={row.id}>
                  {nameByCompetitor.get(row.competitor_id)} · {otaPlatformLabel(row.ota_platform, isKo)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>{isKo ? '가격 축' : 'Price axis'}</Label>
          <Select
            value={`${canyon}:${offer}`}
            onValueChange={(value) => {
              const [nextCanyon, nextOffer] = value.split(':') as [MarketCanyonVariant, MarketOfferType]
              setCanyon(nextCanyon)
              setOffer(nextOffer)
            }}
          >
            <SelectTrigger className="h-11 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {axes.map((axis) => (
                <SelectItem key={`${axis.canyon}:${axis.offer}`} value={`${axis.canyon}:${axis.offer}`}>
                  {axisLabel(axis.canyon, axis.offer, isKo)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{offer === 'all_inclusive' ? (isKo ? '전체포함가' : 'All-inclusive') : isKo ? '판매가' : 'Sale price'}</Label>
          <Input type="number" min="0" value={sale} onChange={(e) => setSale(e.target.value)} className="h-11 rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label>{isKo ? '불포함 금액' : 'Not included'}</Label>
          <Input
            type="number"
            min="0"
            value={notIncluded}
            disabled={offer === 'all_inclusive'}
            onChange={(e) => setNotIncluded(e.target.value)}
            className="h-11 rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label>{isKo ? '평점' : 'Rating'}</Label>
          <Input type="number" min="0" max="5" step="0.1" value={rating} onChange={(e) => setRating(e.target.value)} className="h-11 rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label>{isKo ? '리뷰 수' : 'Reviews'}</Label>
          <Input type="number" min="0" value={reviewCount} onChange={(e) => setReviewCount(e.target.value)} className="h-11 rounded-xl" />
        </div>
        <div className="md:col-span-2">
          <Button
            className="h-11 rounded-xl"
            disabled={saving || !listingId || !sale}
            onClick={async () => {
              setSaving(true)
              try {
                await onSave({
                  listingId,
                  canyon,
                  offer,
                  sale: Number(sale),
                  notIncluded: offer === 'all_inclusive' ? 0 : Number(notIncluded) || 0,
                  rating: rating ? Number(rating) : null,
                  reviewCount: reviewCount ? Number(reviewCount) : null,
                })
                setSale('')
                setNotIncluded('')
              } finally {
                setSaving(false)
              }
            }}
          >
            {isKo ? '가격 저장' : 'Save price'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
