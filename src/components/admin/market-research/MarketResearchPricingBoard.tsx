'use client'

import { Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { MarketListing, MarketOtaPlatform } from '@/lib/market-research/types'
import {
  OUR_COLUMN_TONE,
  COLUMN_TONES,
  cellValue,
  competitorPriceTone,
  shownSalePrice,
  type CompetitorPriceTone,
  type PricingBoardColumn,
  type PricingBoardRow,
} from '@/lib/market-research/pricingBoard'
import { formatUsd } from './helpers'
import { MarketResearchColumnMenu } from './MarketResearchColumnMenu'
import { MarketResearchPriceStack } from './MarketResearchPriceStack'

function toneClass(tone: CompetitorPriceTone | null): string {
  if (tone === 'higher') return 'text-emerald-600'
  if (tone === 'lower') return 'text-red-600'
  return ''
}

function FinalCell({
  primary,
  secondary,
  primaryTone,
  secondaryTone,
  isKo,
}: {
  primary: number | null
  secondary: number | null
  primaryTone: CompetitorPriceTone | null
  secondaryTone: CompetitorPriceTone | null
  isKo: boolean
}) {
  return (
    <div>
      <div className={`text-lg font-semibold ${toneClass(primaryTone)}`}>{formatUsd(primary)}</div>
      <div className="text-xs text-muted-foreground">{isKo ? 'Lower 기준' : 'Lower'}</div>
      {secondary != null ? (
        <div className={`mt-1 text-sm font-medium ${toneClass(secondaryTone)}`}>
          {formatUsd(secondary)}
          <span className="ml-1 text-xs font-normal text-muted-foreground">X</span>
        </div>
      ) : null}
    </div>
  )
}

function oursColumnFor(columns: PricingBoardColumn[], column: PricingBoardColumn): PricingBoardColumn | null {
  if (column.kind !== 'competitor') return null
  return columns.find((row) => row.kind === 'ours' && row.otaPlatform === column.otaPlatform) ?? null
}

const LABEL_WIDTH = 220
const COLUMN_WIDTH = 196

export function MarketResearchPricingBoard({
  columns,
  rows,
  isKo,
  favoriteIds,
  onToggleFavorite,
  onMoveListing,
  onHideListing,
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
  favoriteIds?: string[]
  onToggleFavorite?: (listingId: string) => void
  onMoveListing?: (listingId: string, direction: -1 | 1) => void
  onHideListing?: (listingId: string) => void
  onEditListing: (listing: MarketListing) => void
  onDeleteListing: (id: string) => void
  onEnterPrice: (listingId: string) => void
  onFetchOne: (listingId: string) => void
  onManageCompareItems?: () => void
  onEditOurs?: (platform: MarketOtaPlatform) => void
}) {
  const grid = `${LABEL_WIDTH}px repeat(${Math.max(columns.length, 1)}, ${COLUMN_WIDTH}px)`
  const boardWidth = LABEL_WIDTH + Math.max(columns.length, 1) * COLUMN_WIDTH + Math.max(columns.length, 1) * 12
  const competitorIds = columns.filter((column) => column.kind === 'competitor').map((column) => column.columnId)
  const favorites = new Set(favoriteIds || [])

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
    <div className="market-research-x-scroll market-research-x-scroll--board">
      <div style={{ width: boardWidth }}>
        <div className="grid items-stretch gap-3" style={{ gridTemplateColumns: grid }}>
          <div className="sticky left-0 z-20 flex items-end bg-slate-50 px-2 pb-10 text-2xl font-semibold text-slate-500">
            {isKo ? '가격 비교' : 'Pricing'}
          </div>
          {columns.map((col) => {
            const tone = col.kind === 'ours' ? OUR_COLUMN_TONE : COLUMN_TONES[col.toneIndex]
            const ours = oursColumnFor(columns, col)
            const headerPriceTone = competitorPriceTone(
              shownSalePrice(col.fromPrice, col.fromDiscounted),
              ours ? shownSalePrice(ours.fromPrice, ours.fromDiscounted) : null
            )
            const competitorIndex = competitorIds.indexOf(col.columnId)
            const favorite = favorites.has(col.columnId)
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
                <div className="-mt-3 flex min-h-44 flex-1 flex-col rounded-2xl bg-white px-3 pb-4 pt-8 text-center shadow-sm">
                  <MarketResearchPriceStack
                    list={col.fromPrice}
                    discounted={col.fromDiscounted}
                    percent={col.discountPercent}
                    isKo={isKo}
                    size="lg"
                    tone={headerPriceTone}
                  />
                  <div className="mt-auto pt-3">
                    {col.kind === 'ours' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 rounded-xl px-3 text-slate-600"
                        onClick={() => onEditOurs?.(col.otaPlatform)}
                      >
                        <Settings2 className="mr-1 h-3.5 w-3.5" />
                        {isKo ? '설정' : 'Settings'}
                      </Button>
                    ) : col.listing ? (
                      <MarketResearchColumnMenu
                        isKo={isKo}
                        listing={col.listing}
                        favorite={favorite}
                        canMoveLeft={competitorIndex > 0}
                        canMoveRight={competitorIndex >= 0 && competitorIndex < competitorIds.length - 1}
                        onToggleFavorite={onToggleFavorite}
                        onMove={onMoveListing}
                        onHide={onHideListing}
                        onEnterPrice={onEnterPrice}
                        onFetch={onFetchOne}
                        onEdit={onEditListing}
                        onDelete={onDeleteListing}
                      />
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
                  className={`sticky left-0 z-10 -ml-4 bg-white py-1 pr-2 text-sm ${
                    row.kind === 'final'
                      ? 'pl-4 font-semibold text-slate-900'
                      : row.kind === 'excluded'
                        ? 'pl-6 text-slate-500'
                        : 'pl-4 font-medium text-slate-600'
                  }`}
                >
                  {row.label}
                </div>
                {columns.map((col) => {
                  const value = cellValue(col, row)
                  const ours = oursColumnFor(columns, col)
                  const oursValue = ours ? cellValue(ours, row) : null
                  const included = row.kind === 'excluded' && col.inclusionItems[row.id] === 'included'
                  const saleTone =
                    row.kind === 'sale'
                      ? competitorPriceTone(
                          shownSalePrice(value.primary, value.secondary),
                          oursValue ? shownSalePrice(oursValue.primary, oursValue.secondary) : null
                        )
                      : null
                  return (
                    <div key={col.columnId} className="text-center">
                      {row.kind === 'final' ? (
                        <FinalCell
                          primary={value.primary}
                          secondary={value.secondary}
                          primaryTone={competitorPriceTone(value.primary, oursValue?.primary)}
                          secondaryTone={competitorPriceTone(value.secondary, oursValue?.secondary)}
                          isKo={isKo}
                        />
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
                          tone={saleTone}
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
