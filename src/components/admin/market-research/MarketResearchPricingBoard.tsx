'use client'

import { ExternalLink, Pencil, RefreshCw, Settings2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { MarketListing, MarketOtaPlatform } from '@/lib/market-research/types'
import {
  OUR_COLUMN_TONE,
  COLUMN_TONES,
  cellValue,
  type PricingBoardColumn,
  type PricingBoardRow,
} from '@/lib/market-research/pricingBoard'
import { formatUsd } from './helpers'
import { MarketResearchPriceStack } from './MarketResearchPriceStack'

function FinalCell({
  primary,
  secondary,
  isKo,
}: {
  primary: number | null
  secondary: number | null
  isKo: boolean
}) {
  return (
    <div>
      <div className="text-lg font-semibold">{formatUsd(primary)}</div>
      <div className="text-xs text-muted-foreground">{isKo ? 'Lower 기준' : 'Lower'}</div>
      {secondary != null ? (
        <div className="mt-1 text-sm font-medium">
          {formatUsd(secondary)}
          <span className="ml-1 text-xs font-normal text-muted-foreground">X</span>
        </div>
      ) : null}
    </div>
  )
}

export function MarketResearchPricingBoard({
  columns,
  rows,
  isKo,
  onEditListing,
  onDeleteListing,
  onEnterPrice,
  onFetchOne,
  onManageCompareItems,
  onEditOurs,
}: {
  columns: PricingBoardColumn[]
  rows: PricingBoardRow[]
  isKo: boolean
  onEditListing: (listing: MarketListing) => void
  onDeleteListing: (id: string) => void
  onEnterPrice: (listingId: string) => void
  onFetchOne: (listingId: string) => void
  onManageCompareItems?: () => void
  onEditOurs?: (platform: MarketOtaPlatform) => void
}) {
  const grid = `minmax(220px, 1.15fr) repeat(${Math.max(columns.length, 1)}, minmax(170px, 1fr))`

  if (columns.length === 0) {
    return (
      <div className="space-y-4 px-2 py-16 text-center">
        <p className="text-muted-foreground">
          {isKo
            ? '선택한 플랫폼 · 경쟁사에 해당하는 리스팅이 없습니다.'
            : 'No competitor listings for this product and OTA yet.'}
        </p>
        {onManageCompareItems ? (
          <Button variant="outline" className="h-10 rounded-xl" onClick={onManageCompareItems}>
            <Settings2 className="mr-1 h-4 w-4" />
            {isKo ? '불포함 항목' : 'Not-included items'}
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="grid items-stretch gap-3" style={{ gridTemplateColumns: grid }}>
          <div className="flex items-end px-2 pb-10 text-2xl font-semibold text-slate-500">
            {isKo ? '가격 비교' : 'Pricing'}
          </div>
          {columns.map((col) => {
            const tone = col.kind === 'ours' ? OUR_COLUMN_TONE : COLUMN_TONES[col.toneIndex]
            return (
              <div key={col.columnId} className="relative flex h-full flex-col pt-1">
                <div
                  className={`${tone.bar} relative z-10 mx-4 rounded-2xl px-3 py-2 text-center text-sm font-semibold leading-tight text-white shadow-sm`}
                >
                  <div>{col.competitorName}</div>
                  {col.showOtaLabel ? (
                    <div className="mt-0.5 text-[11px] font-medium text-white/90">{col.otaLabel}</div>
                  ) : null}
                </div>
                <div className="-mt-3 flex min-h-44 flex-1 flex-col rounded-2xl bg-white px-4 pb-5 pt-8 text-center shadow-sm">
                  <MarketResearchPriceStack
                    list={col.fromPrice}
                    discounted={col.fromDiscounted}
                    percent={col.discountPercent}
                    isKo={isKo}
                    size="lg"
                  />
                  <div className="mt-auto flex min-h-8 flex-wrap justify-center gap-1 pt-3">
                    {col.kind === 'ours' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-lg px-2"
                        onClick={() => onEditOurs?.(col.otaPlatform)}
                      >
                        <Settings2 className="mr-1 h-3.5 w-3.5" />
                        {isKo ? '설정' : 'Settings'}
                      </Button>
                    ) : col.listing ? (
                      <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-lg px-2"
                      onClick={() => onEnterPrice(col.listing!.id)}
                    >
                      {isKo ? '가격' : 'Price'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-lg px-2"
                      onClick={() => onFetchOne(col.listing!.id)}
                      aria-label={isKo ? '지금 수집' : 'Fetch now'}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-lg px-2"
                      onClick={() => onEditListing(col.listing!)}
                      aria-label={isKo ? '리스팅 수정' : 'Edit listing'}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-lg px-2"
                      onClick={() => onDeleteListing(col.listing!.id)}
                      aria-label={isKo ? '리스팅 삭제' : 'Delete listing'}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 rounded-lg px-2" asChild>
                      <a
                        href={col.listing.listing_url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={isKo ? '리스팅 열기' : 'Open listing'}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-4 space-y-3">
          {rows.map((row) => {
            if (row.kind === 'section') {
              return (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-white/80 px-5 py-3 text-sm font-semibold tracking-wide text-slate-500"
                >
                  <span>{row.label}</span>
                  {row.id === 'excluded' && onManageCompareItems ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-lg"
                      onClick={onManageCompareItems}
                    >
                      <Settings2 className="mr-1 h-3.5 w-3.5" />
                      {isKo ? '항목' : 'Items'}
                    </Button>
                  ) : null}
                </div>
              )
            }
            return (
              <div
                key={`${row.kind}:${row.id}`}
                className={`grid items-center gap-3 rounded-2xl px-4 py-4 shadow-sm ${
                  row.kind === 'final' ? 'bg-white ring-1 ring-slate-200' : 'bg-white'
                }`}
                style={{ gridTemplateColumns: grid }}
              >
                <div
                  className={`text-sm ${
                    row.kind === 'final'
                      ? 'font-semibold text-slate-900'
                      : row.kind === 'excluded'
                        ? 'pl-2 text-slate-500'
                        : 'font-medium text-slate-600'
                  }`}
                >
                  {row.label}
                </div>
                {columns.map((col) => {
                  const value = cellValue(col, row)
                  const included = row.kind === 'excluded' && col.inclusionItems[row.id] === 'included'
                  return (
                    <div key={col.columnId} className="text-center">
                      {row.kind === 'final' ? (
                        <FinalCell primary={value.primary} secondary={value.secondary} isKo={isKo} />
                      ) : included ? (
                        <div className="text-sm font-medium text-emerald-700">
                          {isKo ? '포함' : 'Included'}
                        </div>
                      ) : row.kind === 'sale' ? (
                        <MarketResearchPriceStack
                          list={value.primary}
                          discounted={value.secondary}
                          percent={col.discountPercent}
                          isKo={isKo}
                        />
                      ) : (
                        <div
                          className={
                            row.kind === 'excluded' ? 'text-sm font-medium' : 'text-base font-semibold'
                          }
                        >
                          {formatUsd(value.primary)}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
