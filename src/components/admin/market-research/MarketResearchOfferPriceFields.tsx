'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { discountedPrice } from '@/lib/market-research/prices'
import { formatUsd } from './helpers'
import { MarketResearchToggleChips } from './MarketResearchToggleChips'

function MoneyInput({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
        $
      </span>
      <Input
        id={id}
        type="number"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-xl pl-7"
      />
    </div>
  )
}

function DiscountPreview({
  list,
  percent,
  isKo,
}: {
  list: string
  percent: string
  isKo: boolean
}) {
  const n = list.trim() === '' ? null : Number(list)
  const sale = discountedPrice(Number.isFinite(n) ? n : null, Number(percent) || 0)
  if (sale == null) return null
  return (
    <p className="text-xs text-[#0B5FFF]">
      {isKo ? `할인가 ${formatUsd(sale)}` : `Sale ${formatUsd(sale)}`}
    </p>
  )
}

export function MarketResearchOfferPriceFields({
  isKo,
  allInclusive,
  hasLower,
  hasAntelopeX,
  fromPrice,
  lowerSale,
  antelopeXSale,
  discountEnabled,
  discountPercent,
  onFromPrice,
  onLowerSale,
  onAntelopeXSale,
  onDiscountEnabled,
  onDiscountPercent,
}: {
  isKo: boolean
  allInclusive: boolean
  hasLower: boolean
  hasAntelopeX: boolean
  fromPrice: string
  lowerSale: string
  antelopeXSale: string
  discountEnabled: boolean
  discountPercent: string
  onFromPrice: (value: string) => void
  onLowerSale: (value: string) => void
  onAntelopeXSale: (value: string) => void
  onDiscountEnabled: (value: boolean) => void
  onDiscountPercent: (value: string) => void
}) {
  const suffix = allInclusive
    ? isKo
      ? '전체 포함가'
      : 'all-inclusive'
    : isKo
      ? '정가'
      : 'list price'
  const percent = discountEnabled ? discountPercent : ''
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <div className="space-y-2">
          <Label>{isKo ? '할인' : 'Discount'}</Label>
          <MarketResearchToggleChips
            options={[
              { id: 'no', label: isKo ? '할인 없음' : 'No discount' },
              { id: 'yes', label: isKo ? '할인' : 'Discounted' },
            ]}
            selected={[discountEnabled ? 'yes' : 'no']}
            onChange={(next) => onDiscountEnabled(next[0] === 'yes')}
          />
        </div>
        {discountEnabled ? (
          <div className="space-y-2">
            <Label htmlFor="offer-discount">{isKo ? '할인 %' : 'Discount %'}</Label>
            <div className="relative w-32">
              <Input
                id="offer-discount"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={discountPercent}
                onChange={(e) => onDiscountPercent(e.target.value)}
                className="h-11 rounded-xl pr-8"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                %
              </span>
            </div>
          </div>
        ) : null}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="offer-from">{isKo ? `표시가 · ${suffix}` : `Listed price · ${suffix}`}</Label>
          <MoneyInput id="offer-from" value={fromPrice} onChange={onFromPrice} />
          <DiscountPreview list={fromPrice} percent={percent} isKo={isKo} />
        </div>
        {hasAntelopeX ? (
          <div className="space-y-2">
            <Label htmlFor="offer-x">Antelope Canyon X</Label>
            <MoneyInput id="offer-x" value={antelopeXSale} onChange={onAntelopeXSale} />
            <DiscountPreview list={antelopeXSale} percent={percent} isKo={isKo} />
          </div>
        ) : null}
        {hasLower ? (
          <div className="space-y-2">
            <Label htmlFor="offer-lower">Lower Antelope Canyon</Label>
            <MoneyInput id="offer-lower" value={lowerSale} onChange={onLowerSale} />
            <DiscountPreview list={lowerSale} percent={percent} isKo={isKo} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
