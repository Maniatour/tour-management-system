'use client'

const MATCH_EPS = 0.02

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`
}

export function PricingEngineValueBadge({
  engineValue,
  matchDb,
  title,
}: {
  engineValue: number
  matchDb: boolean
  title?: string
}) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-mono tabular-nums font-semibold shrink-0 ${
        matchDb ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
      }`}
      title={title}
    >
      {fmtUsd(engineValue)}
    </span>
  )
}

export function PricingEngineCompareValue({
  dbValue,
  engineValue,
  className = '',
  valueClassName = '',
  engineTitle = '엔진',
}: {
  dbValue: number | null | undefined
  engineValue: number | null | undefined
  className?: string
  valueClassName?: string
  engineTitle?: string
}) {
  const db =
    dbValue != null && Number.isFinite(Number(dbValue)) ? Number(dbValue) : null
  const eng =
    engineValue != null && Number.isFinite(Number(engineValue)) ? Number(engineValue) : null
  const shown = db ?? eng ?? 0
  const match = db != null && eng != null && Math.abs(db - eng) <= MATCH_EPS

  return (
    <span className={`inline-flex items-center gap-1.5 justify-end ${className}`}>
      {eng != null ? (
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-mono tabular-nums font-semibold shrink-0 ${
            match ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
          }`}
          title={`${engineTitle} ${fmtUsd(eng)}`}
        >
          {fmtUsd(eng)}
        </span>
      ) : null}
      <span className={valueClassName || 'font-medium tabular-nums'}>{fmtUsd(shown)}</span>
    </span>
  )
}
