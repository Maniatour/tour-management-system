'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getAccessTokenForApi } from '@/lib/supabase'
import {
  buildAntelopeOnSiteTicketBookingInsert,
  suggestAntelopeOnSiteEa,
  type AntelopeOnSiteCanyon,
} from '@/lib/antelopeOnSiteReceipt'
import { resolveAntelopeCheckInDate } from '@/lib/scheduleVehicleOilMaintenance'
import { formatTicketPayableUsd } from '@/lib/ticket-booking-change-display'

export type AntelopeOnSiteTransferExpense = {
  id: string
  amount: number
  paid_for: string | null
  paid_to: string | null
  image_url: string | null
  payment_method: string | null
  tour_date?: string | null
}

function todayYmdLA(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
}

export default function AntelopeOnSiteToTicketBookingModal({
  open,
  onClose,
  expense,
  tourId,
  tourDate,
  productId,
  locale,
  onTransferred,
}: {
  open: boolean
  onClose: () => void
  expense: AntelopeOnSiteTransferExpense | null
  tourId: string
  tourDate: string
  productId?: string | null
  locale: string
  onTransferred: () => void
}) {
  const isEn = locale.startsWith('en')
  const [ea, setEa] = useState('1')
  const [canyon, setCanyon] = useState<AntelopeOnSiteCanyon>('L')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkInDate = useMemo(
    () =>
      resolveAntelopeCheckInDate({
        tour_date: tourDate,
        ...(productId != null ? { product_id: productId } : {}),
      }) || String(expense?.tour_date || tourDate || '').slice(0, 10),
    [tourDate, productId, expense?.tour_date]
  )

  useEffect(() => {
    if (!open || !expense) return
    setEa(String(suggestAntelopeOnSiteEa(expense.amount)))
    setCanyon('L')
    setError(null)
    setSubmitting(false)
  }, [open, expense])

  const handleSubmit = async () => {
    if (!expense) return
    const qty = Math.floor(Number(ea))
    if (!Number.isFinite(qty) || qty < 1) {
      setError(isEn ? 'Enter ticket quantity (EA).' : '티켓 수량(EA)을 입력하세요.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const accessToken = await getAccessTokenForApi(30)
      if (!accessToken) {
        setError(
          isEn
            ? 'Your session is not ready. Refresh and try again.'
            : '로그인 세션이 없습니다. 새로고침 후 다시 시도해 주세요.'
        )
        return
      }
      const payload = buildAntelopeOnSiteTicketBookingInsert({
        expenseId: expense.id,
        tourId,
        checkInDate,
        ea: qty,
        canyon,
        amount: expense.amount,
        paymentMethod: expense.payment_method,
        imageUrl: expense.image_url,
        submitOn: todayYmdLA(),
      })
      const res = await fetch('/api/ticket-bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      })
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        setError(
          body?.error ||
            (isEn ? 'Could not create the ticket booking.' : '입장권 부킹을 만들지 못했습니다.')
        )
        return
      }
      onTransferred()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : isEn ? 'Transfer failed.' : '넘기기에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!expense) return null

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !submitting) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEn ? 'Send Antelope on-site receipt to ticket bookings' : '앤텔롭 현장 결제 → 입장권 부킹'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            {isEn
              ? 'Receipts do not include ticket quantity. Enter EA, then send as an on-site paid booking so the calendar L/X compare matches.'
              : '영수증에 티켓 수량이 없습니다. EA를 입력해 현장 결제 부킹으로 넘기면 달력 L/X 비교에 반영됩니다.'}
          </p>
          <div className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2">
            <div className="font-medium text-foreground">
              {expense.paid_for || expense.paid_to || (isEn ? 'Antelope Canyon' : '앤텔롭 캐년')}
            </div>
            <div className="mt-0.5 text-muted-foreground">
              {isEn ? 'On-site amount' : '현장 결제 금액'} {formatTicketPayableUsd(expense.amount)}
              <span className="mx-1.5 text-border">·</span>
              {isEn ? 'Check-in' : '체크인'} {checkInDate}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="antelope-onsite-ea">{isEn ? 'Ticket quantity (EA)' : '티켓 수량 (EA)'}</Label>
            <Input
              id="antelope-onsite-ea"
              type="number"
              min={1}
              step={1}
              value={ea}
              onChange={(e) => setEa(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{isEn ? 'Canyon' : '캐년'}</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={canyon === 'L' ? 'default' : 'outline'}
                className="h-11"
                onClick={() => setCanyon('L')}
              >
                L · Lower
              </Button>
              <Button
                type="button"
                variant={canyon === 'X' ? 'default' : 'outline'}
                className="h-11"
                onClick={() => setCanyon('X')}
              >
                X · Antelope X
              </Button>
            </div>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            {isEn ? 'Cancel' : '취소'}
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEn ? 'Send to bookings' : '부킹 관리로 넘기기'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
