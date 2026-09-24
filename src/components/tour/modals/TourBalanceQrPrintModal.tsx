'use client'

import { useEffect, useMemo, useState } from 'react'
import QRCode from 'react-qr-code'
import { Loader2, Printer, QrCode, X } from 'lucide-react'
import { fetchApiWithAuthWhenReady } from '@/lib/api-client-bearer'
import { cardFeeChargeTotals } from '@/components/payment/CardFeeChargePreview'
import { printDomClone } from '@/lib/printHtmlDocument'
import {
  loadReservationBalanceRows,
  type ReservationBalancePrintRow,
} from '@/lib/loadReservationBalanceRows'

export type TourBalanceQrPrintModalProps = {
  isOpen: boolean
  onClose: () => void
  locale?: string
  reservationIds: string[]
  tourDate: string
  productName: string
}

type QrLink = {
  reservationId: string
  sitePayUrl: string
  chargeUsd: number
  reused: boolean
  error?: string
}

const PRINT_CSS = `
  @page { size: letter; margin: 0.35in; }
  html, body { margin: 0; padding: 0; background: #fff; color: #111; }
  * { box-sizing: border-box; }
  .bqr-sheet { font-family: Arial, Helvetica, sans-serif; color: #111; }
  .bqr-head { margin: 0 0 10px; }
  .bqr-title { margin: 0; font-size: 18px; font-weight: 800; }
  .bqr-sub { margin: 2px 0 0; font-size: 12px; color: #374151; }
  .bqr-note { margin: 6px 0 0; font-size: 11px; color: #4b5563; }
  .bqr-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .bqr-card {
    border: 1.5px solid #111;
    border-radius: 10px;
    padding: 8px 8px 6px;
    text-align: center;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .bqr-card:nth-child(8n):not(:last-child) { break-after: page; page-break-after: always; }
  .bqr-name { margin: 0; font-size: 15px; font-weight: 800; line-height: 1.2; }
  .bqr-hotel { margin: 2px 0 0; font-size: 11px; color: #374151; }
  .bqr-cash { margin: 8px 0 0; font-size: 16px; font-weight: 600; color: #4b5563; line-height: 1.2; }
  .bqr-cardpay {
    display: inline-block;
    margin: 4px auto 8px;
    padding: 3px 10px;
    font-size: 16px;
    font-weight: 800;
    color: #111;
    background: #e8f0ff;
    border-radius: 8px;
    line-height: 1.2;
  }
  .bqr-qr { width: 1.45in; height: 1.45in; margin: 0 auto; }
  .bqr-qr svg { width: 100%; height: 100%; }
  .bqr-scan { margin: 4px 0 0; font-size: 10px; letter-spacing: 0.01em; }
`

function money(amount: number): string {
  return `$${amount.toFixed(2)}`
}

export default function TourBalanceQrPrintModal({
  isOpen,
  onClose,
  locale = 'ko',
  reservationIds,
  tourDate,
  productName,
}: TourBalanceQrPrintModalProps) {
  const isKo = locale.startsWith('ko')
  const idsKey = reservationIds.filter(Boolean).join(',')
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<ReservationBalancePrintRow[]>([])
  const [links, setLinks] = useState<QrLink[]>([])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) {
      setRows([])
      setLinks([])
      setError(null)
      return
    }
    const ids = idsKey ? idsKey.split(',').filter(Boolean) : []
    if (ids.length === 0) {
      setRows([])
      return
    }
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      setLinks([])
      try {
        const loaded = await loadReservationBalanceRows(ids)
        if (!cancelled) setRows(loaded)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : isKo ? '잔금을 불러오지 못했습니다.' : 'Failed to load balances.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [isOpen, idsKey, isKo])

  const dueRows = useMemo(
    () =>
      rows
        .filter((row) => row.balanceAmount > 0.005 && (row.currency || 'USD').toUpperCase() === 'USD')
        .sort((a, b) => a.customerName.localeCompare(b.customerName)),
    [rows]
  )

  const linkById = useMemo(() => {
    const map = new Map<string, QrLink>()
    for (const link of links) map.set(link.reservationId, link)
    return map
  }, [links])

  const readyCards = dueRows.filter((row) => Boolean(linkById.get(row.reservationId)?.sitePayUrl))

  const createLinks = async () => {
    if (dueRows.length === 0 || creating) return
    setCreating(true)
    setError(null)
    try {
      const res = await fetchApiWithAuthWhenReady('/api/invoices/tour-balance-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale: isKo ? 'ko' : 'en',
          tourDate,
          items: dueRows.map((row) => ({
            reservationId: row.reservationId,
            recipientName: row.customerName,
            balanceUsd: Math.round(row.balanceAmount * 100) / 100,
          })),
        }),
      })
      if (!res) {
        setError(isKo ? '로그인 세션을 확인한 뒤 다시 시도해 주세요.' : 'Check your session and try again.')
        return
      }
      const data = (await res.json().catch(() => null)) as
        | { error?: string; links?: QrLink[] }
        | null
      if (!res.ok || !data?.links) {
        setError(data?.error || (isKo ? '잔금 링크를 만들지 못했습니다.' : 'Failed to create balance links.'))
        return
      }
      setLinks(data.links)
      const failed = data.links.filter((link) => !link.sitePayUrl)
      if (failed.length > 0) {
        setError(
          isKo
            ? `${failed.length}명의 링크를 만들지 못했습니다. 나머지는 인쇄할 수 있습니다.`
            : `${failed.length} link${failed.length === 1 ? '' : 's'} could not be created. The rest can still be printed.`
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : isKo ? '잔금 링크를 만들지 못했습니다.' : 'Failed to create balance links.')
    } finally {
      setCreating(false)
    }
  }

  const printSheet = () => {
    const root = document.getElementById('tour-balance-qr-sheet')
    if (!root || readyCards.length === 0) return
    const title = `${tourDate || 'Tour'} balance QR`
    printDomClone(root, { title, extraCss: PRINT_CSS })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900">
              {isKo ? '잔금 QR 인쇄' : 'Balance QR print'}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {[tourDate, productName].filter(Boolean).join(' · ')}
            </p>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              {isKo
                ? '잔금이 남은 고객의 카드 결제 QR을 이 투어 한 장으로 모읍니다. 현금이 없을 때 가이드가 해당 칸을 보여 주면 됩니다. 이메일이나 문자는 보내지 않습니다.'
                : 'Collect card-payment QR codes for guests who still owe a balance, on one sheet for this tour. The guide shows the matching square when cash is not ready. No email or text is sent.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100"
            aria-label={isKo ? '닫기' : 'Close'}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center gap-2 py-10 text-sm text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              {isKo ? '잔금을 확인하는 중…' : 'Checking balances…'}
            </div>
          ) : dueRows.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">
              {isKo ? '잔금이 남은 고객이 없습니다.' : 'No guests have a remaining balance.'}
            </p>
          ) : readyCards.length === 0 ? (
            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
              {dueRows.map((row) => {
                const charge = cardFeeChargeTotals(row.balanceAmount)
                return (
                  <li key={row.reservationId} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">{row.customerName}</p>
                      {row.pickupLabel ? (
                        <p className="truncate text-xs text-gray-500">{row.pickupLabel}</p>
                      ) : null}
                      {linkById.get(row.reservationId)?.error ? (
                        <p className="text-xs text-red-600">{linkById.get(row.reservationId)?.error}</p>
                      ) : null}
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-semibold tabular-nums text-gray-900">{money(row.balanceAmount)}</p>
                      <p className="text-xs text-gray-500">
                        {isKo ? '카드' : 'Card'} {money(charge.total)}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div id="tour-balance-qr-sheet" className="bqr-sheet rounded-xl bg-white">
              <div className="bqr-head mb-3">
                <h3 className="bqr-title text-base font-extrabold text-gray-900">Remaining balance</h3>
                <p className="bqr-sub text-sm text-gray-700">
                  {[tourDate, productName].filter(Boolean).join(' · ')}
                </p>
                <p className="bqr-note text-xs leading-5 text-gray-500">
                  If the guest has no cash, show the QR under their name. The card amount includes the card fee.
                </p>
              </div>
              <div className="bqr-grid grid grid-cols-1 gap-3 sm:grid-cols-2">
                {dueRows.map((row) => {
                  const link = linkById.get(row.reservationId)
                  const charge = link?.chargeUsd || cardFeeChargeTotals(row.balanceAmount).total
                  return (
                    <article key={row.reservationId} className="bqr-card rounded-xl border border-gray-900 px-3 py-3 text-center">
                      <p className="bqr-name text-base font-extrabold text-gray-900">{row.customerName}</p>
                      {row.pickupLabel ? <p className="bqr-hotel text-xs text-gray-600">{row.pickupLabel}</p> : null}
                      <p className="bqr-cash mt-2 text-base font-semibold leading-tight text-gray-600">
                        Cash {money(row.balanceAmount)}
                      </p>
                      <p className="bqr-cardpay mx-auto mt-1 inline-block rounded-lg bg-blue-50 px-2.5 py-0.5 text-base font-extrabold leading-tight text-gray-900">
                        Card {money(charge)}
                      </p>
                      {link?.sitePayUrl ? (
                        <div className="bqr-qr mx-auto mt-1 h-36 w-36 bg-white p-1">
                          <QRCode
                            value={link.sitePayUrl}
                            size={144}
                            bgColor="#FFFFFF"
                            fgColor="#111111"
                            level="M"
                            title={row.customerName}
                            style={{ height: '100%', width: '100%' }}
                          />
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-red-600">
                          {link?.error || 'No link'}
                        </p>
                      )}
                      {link?.sitePayUrl ? (
                        <p className="bqr-scan mt-1 text-[11px] text-gray-700">Scan to pay by card</p>
                      ) : null}
                    </article>
                  )
                })}
              </div>
            </div>
          )}

          {error ? (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            {isKo ? '닫기' : 'Close'}
          </button>
          <button
            type="button"
            onClick={() => void createLinks()}
            disabled={loading || creating || dueRows.length === 0}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-50"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
            {creating
              ? isKo
                ? '링크 만드는 중…'
                : 'Creating links…'
              : readyCards.length > 0
                ? isKo
                  ? '링크 다시 준비'
                  : 'Refresh links'
                : isKo
                  ? '잔금 링크 만들기'
                  : 'Create balance links'}
          </button>
          <button
            type="button"
            onClick={printSheet}
            disabled={readyCards.length === 0}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            {isKo ? '인쇄' : 'Print'}
          </button>
        </div>
      </div>
    </div>
  )
}
