'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { OurChannelDiscountMode, OurChannelSettings } from '@/lib/market-research/types'
import { formatUsd } from './helpers'
import { MarketResearchToggleChips } from './MarketResearchToggleChips'

function moneyText(value: number | null): string {
  return value == null ? '' : String(value)
}

function optionalMoney(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed || trimmed === '.') return null
  const amount = Number(trimmed)
  return Number.isFinite(amount) ? amount : null
}

function MoneyField({
  id,
  label,
  value,
  placeholder,
  onChange,
}: {
  id: string
  label: string
  value: string
  placeholder: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          $
        </span>
        <Input
          id={id}
          type="number"
          min="0"
          step="0.01"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="h-12 rounded-xl pl-7"
        />
      </div>
    </div>
  )
}

export function MarketResearchOurChannelSettingsFields({
  settings,
  onChange,
  dynamicLower,
  dynamicAntelopeX,
  dynamicPercent,
  isKo,
}: {
  settings: OurChannelSettings
  onChange: (next: OurChannelSettings) => void
  dynamicLower: number | null
  dynamicAntelopeX: number | null
  dynamicPercent: number | null
  isKo: boolean
}) {
  const [lowerText, setLowerText] = useState(() => moneyText(settings.lowerSale))
  const [antelopeText, setAntelopeText] = useState(() => moneyText(settings.antelopeXSale))
  const [percentText, setPercentText] = useState(() =>
    settings.discountPercent == null ? '' : String(settings.discountPercent)
  )
  const mode = settings.discountMode
  const dynamicBits = [
    dynamicLower != null ? `Lower ${formatUsd(dynamicLower)}` : null,
    dynamicAntelopeX != null ? `Antelope X ${formatUsd(dynamicAntelopeX)}` : null,
    dynamicPercent != null && dynamicPercent > 0
      ? isKo
        ? `쿠폰 ${dynamicPercent}%`
        : `coupon ${dynamicPercent}%`
      : isKo
        ? '쿠폰 없음'
        : 'no coupon',
  ].filter((item): item is string => Boolean(item))

  return (
    <div className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm">
      <div>
        <p className="text-sm font-semibold text-slate-900">
          {isKo ? '이 채널 비교 설정' : 'Channel comparison settings'}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {isKo
            ? '예약과 동적가격은 그대로 둡니다. 여기서 고친 값은 시장조사 비교에만 쓰입니다.'
            : 'Booking and dynamic pricing stay as they are. These values are only for market research.'}
        </p>
      </div>
      <p className="text-sm text-slate-600">
        {isKo ? '동적가격' : 'Dynamic pricing'}: {dynamicBits.join(' · ')}
      </p>
      <div className="space-y-2">
        <Label>{isKo ? '할인' : 'Discount'}</Label>
        <MarketResearchToggleChips
          options={[
            { id: 'inherit', label: isKo ? '동적가격 쿠폰' : 'Dynamic coupon' },
            { id: 'none', label: isKo ? '할인 없음' : 'No discount' },
            { id: 'custom', label: isKo ? '직접 입력' : 'Custom' },
          ]}
          selected={[mode]}
          onChange={(next) => {
            const picked = (next[0] || 'inherit') as OurChannelDiscountMode
            onChange({ ...settings, discountMode: picked })
          }}
        />
        {mode === 'none' ? (
          <p className="text-xs text-muted-foreground">
            {isKo
              ? 'Viator처럼 쿠폰 없이 판매하는 채널은 정가로 비교합니다.'
              : 'Channels sold without a coupon are compared at list price.'}
          </p>
        ) : null}
        {mode === 'custom' ? (
          <div className="relative w-32">
            <Label htmlFor="our-channel-discount" className="sr-only">
              {isKo ? '할인 %' : 'Discount %'}
            </Label>
            <Input
              id="our-channel-discount"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={percentText}
              onChange={(event) => {
                const next = event.target.value
                setPercentText(next)
                onChange({ ...settings, discountPercent: optionalMoney(next) })
              }}
              className="h-12 rounded-xl pr-8"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              %
            </span>
          </div>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <MoneyField
          id="our-channel-lower"
          label="Lower Antelope Canyon"
          value={lowerText}
          placeholder={dynamicLower != null ? String(dynamicLower) : isKo ? '동적가격' : 'Dynamic'}
          onChange={(value) => {
            setLowerText(value)
            onChange({ ...settings, lowerSale: optionalMoney(value) })
          }}
        />
        <MoneyField
          id="our-channel-x"
          label="Antelope Canyon X"
          value={antelopeText}
          placeholder={dynamicAntelopeX != null ? String(dynamicAntelopeX) : isKo ? '동적가격' : 'Dynamic'}
          onChange={(value) => {
            setAntelopeText(value)
            onChange({ ...settings, antelopeXSale: optionalMoney(value) })
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {isKo ? '판매가를 비우면 이 채널의 동적가격을 사용합니다.' : 'Leave a sale blank to use this channel’s dynamic price.'}
      </p>
    </div>
  )
}
