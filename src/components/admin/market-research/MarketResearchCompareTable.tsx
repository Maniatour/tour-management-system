'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { compareRowLabel, type CompareRow } from '@/lib/market-research/compare'
import { excludedItemLabel } from '@/lib/market-research/excludedItems'
import { formatUsd } from './helpers'

export function MarketResearchCompareTable({
  rows,
  columns,
  isKo,
}: {
  rows: CompareRow[]
  columns: Array<{ id: string; label: string }>
  isKo: boolean
}) {
  if (columns.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {isKo ? '비교할 항목을 선택하세요.' : 'Select items to compare.'}
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border/60">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[160px]">{isKo ? '가격 축' : 'Axis'}</TableHead>
            {columns.map((col) => (
              <TableHead key={col.id} className="min-w-[140px]">
                {col.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.axisKey}>
              <TableCell className="font-medium">{compareRowLabel(row, isKo)}</TableCell>
              {columns.map((col) => {
                const cell = row.cells[col.id]
                const delta = cell?.deltaAmount
                const deltaText =
                  delta == null ? '' : `${delta > 0 ? '+' : ''}${formatUsd(delta)}`
                const isExcludedRow = Boolean(row.excludedItemId)
                return (
                  <TableCell key={col.id}>
                    <div className="text-base font-semibold">
                      {row.offer === 'listing_from' && cell?.total != null
                        ? `From ${formatUsd(cell.total)}`
                        : formatUsd(cell?.total)}
                    </div>
                    {row.offer === 'listing_from' ? (
                      <div className="text-xs text-muted-foreground">{isKo ? '1인 기준가' : 'Per person'}</div>
                    ) : isExcludedRow ? (
                      <div className="text-xs text-muted-foreground">{isKo ? '1인 불포함' : 'Per person excluded'}</div>
                    ) : (
                      <>
                        <div className="text-xs text-muted-foreground">
                          {isKo ? '판매' : 'Sale'} {formatUsd(cell?.sale)}
                          {cell?.notIncluded ? ` · ${isKo ? '불포함' : 'excl.'} ${formatUsd(cell.notIncluded)}` : ''}
                        </div>
                        {cell?.excludedItems?.length ? (
                          <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                            {cell.excludedItems.map((item) => (
                              <div key={item.id}>
                                {excludedItemLabel(item, isKo)} {formatUsd(item.amount)}
                              </div>
                            ))}
                          </div>
                        ) : null}
                        <div className="text-xs text-muted-foreground">
                          {isKo ? '자사' : 'Ours'} {formatUsd(cell?.ourTotal)}
                          {deltaText ? ` · ${deltaText}` : ''}
                        </div>
                      </>
                    )}
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
