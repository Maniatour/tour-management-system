'use client'

import React from 'react'
import {
  buildChannelSettlementPricingCalcDisplay,
  formatPercentStatsCell,
  formatUsdStatsCell,
  type ChannelSettlementStatsItemLike,
} from '@/lib/channelSettlementStatsPricingDisplay'

export function ChannelSettlementPricingCalcHeaderCells() {
  return (
    <>
      <th
        className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24"
        title="가격 계산 ① 고객 총 결제 금액 (total_price)"
      >
        고객 총 결제
      </th>
      <th
        className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24"
        title="가격 계산 ③ 채널 결제 금액"
      >
        채널 결제
      </th>
      <th
        className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-16"
        title="가격 계산 채널 수수료 %"
      >
        수수료 %
      </th>
      <th
        className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24"
        title="가격 계산 ③ 채널 정산 금액"
      >
        채널 정산
      </th>
      <th
        className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24"
        title="가격 계산 ④ 총 매출 (company_total_revenue)"
      >
        총매출
      </th>
      <th
        className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24"
        title="가격 계산 ④ 운영 이익 (operating_profit)"
      >
        운영이익
      </th>
    </>
  )
}

type RowCellsProps = {
  item: ChannelSettlementStatsItemLike
  ctx: Parameters<typeof buildChannelSettlementPricingCalcDisplay>[1]
  settlementCellClassName?: string
  settlementTitle?: string | undefined
}

export function ChannelSettlementPricingCalcRowCells({
  item,
  ctx,
  settlementCellClassName = 'text-amber-600',
  settlementTitle,
}: RowCellsProps) {
  const calc = buildChannelSettlementPricingCalcDisplay(item, ctx)
  return (
    <>
      <td className="px-2 py-2 whitespace-nowrap text-xs text-indigo-700 font-semibold text-right w-24">
        {formatUsdStatsCell(calc.customerTotalPayment)}
      </td>
      <td className="px-2 py-2 whitespace-nowrap text-xs text-sky-700 text-right w-24">
        {formatUsdStatsCell(calc.channelPaymentAmount)}
      </td>
      <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-700 text-right w-16">
        {formatPercentStatsCell(calc.channelCommissionPercent)}
      </td>
      <td
        className={`px-2 py-2 whitespace-nowrap text-xs text-right w-24 ${settlementCellClassName}`}
        title={settlementTitle}
      >
        {formatUsdStatsCell(calc.channelSettlementAmount)}
      </td>
      <td className="px-2 py-2 whitespace-nowrap text-xs text-purple-600 font-semibold text-right w-24">
        {formatUsdStatsCell(calc.companyTotalRevenue)}
      </td>
      <td className="px-2 py-2 whitespace-nowrap text-xs text-emerald-700 font-semibold text-right w-24">
        {formatUsdStatsCell(calc.operatingProfit)}
      </td>
    </>
  )
}

export function ChannelSettlementPricingCalcFooterCells({
  totals,
}: {
  totals: {
    customerTotalPayment: number
    channelPaymentAmount: number
    channelSettlementAmount: number
    companyTotalRevenue: number
    operatingProfit: number
  }
}) {
  return (
    <>
      <td className="px-2 py-2 text-xs font-semibold text-indigo-700 text-right">
        {formatUsdStatsCell(totals.customerTotalPayment)}
      </td>
      <td className="px-2 py-2 text-xs font-semibold text-sky-700 text-right">
        {formatUsdStatsCell(totals.channelPaymentAmount)}
      </td>
      <td className="px-2 py-2 text-xs text-gray-500 text-right">—</td>
      <td className="px-2 py-2 text-xs font-semibold text-amber-600 text-right">
        {formatUsdStatsCell(totals.channelSettlementAmount)}
      </td>
      <td className="px-2 py-2 text-xs font-semibold text-purple-600 text-right">
        {formatUsdStatsCell(totals.companyTotalRevenue)}
      </td>
      <td className="px-2 py-2 text-xs font-semibold text-emerald-700 text-right">
        {formatUsdStatsCell(totals.operatingProfit)}
      </td>
    </>
  )
}
