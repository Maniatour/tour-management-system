'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { otaPlatformLabel } from '@/lib/market-research/compare'
import { listingLanguageLabel, parseListingLanguages } from '@/lib/market-research/listingLanguages'
import { listingRecordedPrices } from '@/lib/market-research/prices'
import type { MarketCompetitor, MarketListing } from '@/lib/market-research/types'
import { MarketResearchStatusBadge } from './MarketResearchStatusBadge'
import { formatUsd, productLabel, type MarketResearchBundle } from './helpers'

export function MarketResearchRegisterSection({
  bundle,
  isKo,
  onAddCompetitor,
  onEditCompetitor,
  onDeleteCompetitor,
  onAddListing,
  onEditListing,
  onDeleteListing,
  onFetchOne,
}: {
  bundle: MarketResearchBundle
  isKo: boolean
  onAddCompetitor: () => void
  onEditCompetitor: (row: MarketCompetitor) => void
  onDeleteCompetitor: (id: string) => void
  onAddListing: (competitorId?: string) => void
  onEditListing: (row: MarketListing) => void
  onDeleteListing: (id: string) => void
  onFetchOne: (id: string) => void
}) {
  const productById = new Map(bundle.products.map((p) => [p.id, p]))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{isKo ? '경쟁사 · 리스팅' : 'Competitors & listings'}</h2>
        <div className="flex gap-2">
          <Button variant="outline" className="h-11 rounded-xl" onClick={onAddCompetitor}>
            {isKo ? '경쟁사 추가' : 'Add competitor'}
          </Button>
          <Button className="h-11 rounded-xl" onClick={() => onAddListing()}>
            {isKo ? '리스팅 추가' : 'Add listing'}
          </Button>
        </div>
      </div>
      {bundle.competitors.map((competitor) => {
        const listings = bundle.listings.filter((row) => row.competitor_id === competitor.id)
        return (
          <Card key={competitor.id} className="rounded-2xl border-border/60 shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg">{competitor.name}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {competitor.website_url || (isKo ? '사이트 없음' : 'No website')}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="rounded-xl" onClick={() => onAddListing(competitor.id)}>
                  URL
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onEditCompetitor(competitor)}>
                  {isKo ? '수정' : 'Edit'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onDeleteCompetitor(competitor.id)}>
                  {isKo ? '삭제' : 'Delete'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {listings.length === 0 ? (
                <p className="text-sm text-muted-foreground">{isKo ? '등록된 리스팅이 없습니다.' : 'No listings yet.'}</p>
              ) : (
                listings.map((listing) => {
                  const languages = parseListingLanguages(listing.language_note)
                  const recorded = listingRecordedPrices(bundle.snapshots, listing.id)
                  return (
                  <div
                    key={listing.id}
                    className="flex flex-col gap-3 rounded-xl border border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{otaPlatformLabel(listing.ota_platform, isKo)}</span>
                        <MarketResearchStatusBadge
                          status={listing.last_fetch_status}
                          lastSuccessAt={listing.last_success_at}
                          isKo={isKo}
                        />
                      </div>
                      <a href={listing.listing_url} target="_blank" rel="noreferrer" className="block truncate text-sm text-primary underline-offset-2 hover:underline">
                        {listing.listing_title || listing.listing_url}
                      </a>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <span className="rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-xs font-medium">
                          From {formatUsd(recorded.from?.adult_total)} / person
                        </span>
                        {listing.has_lower !== false ? (
                          <span className="rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-xs font-medium">
                            Lower {formatUsd(recorded.lower?.adult_sale_price)}
                            {recorded.lower?.adult_not_included
                              ? ` · 불포함 ${formatUsd(recorded.lower.adult_not_included)}`
                              : ''}
                          </span>
                        ) : null}
                        {listing.has_antelope_x !== false ? (
                          <span className="rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-xs font-medium">
                            Antelope X {formatUsd(recorded.antelopeX?.adult_sale_price)}
                            {recorded.antelopeX?.adult_not_included
                              ? ` · 불포함 ${formatUsd(recorded.antelopeX.adult_not_included)}`
                              : ''}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {listing.mapped_product_id
                          ? productLabel(productById.get(listing.mapped_product_id), isKo) || listing.mapped_product_id
                          : isKo
                            ? '자사 상품 미매핑'
                            : 'Unmapped'}
                        {languages.length
                          ? ` · ${languages.map((id) => listingLanguageLabel(id, isKo)).join(', ')}`
                          : ''}
                        {listing.diff_notes ? ` · ${listing.diff_notes}` : ''}
                      </p>
                      {listing.last_fetch_error ? (
                        <p className="text-xs text-destructive">{listing.last_fetch_error}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" className="rounded-xl" onClick={() => onFetchOne(listing.id)}>
                        {isKo ? '지금 수집' : 'Fetch now'}
                      </Button>
                      <Button variant="outline" size="sm" className="rounded-xl" onClick={() => onEditListing(listing)}>
                        {isKo ? '수정' : 'Edit'}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onDeleteListing(listing.id)}>
                        {isKo ? '삭제' : 'Delete'}
                      </Button>
                    </div>
                  </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
