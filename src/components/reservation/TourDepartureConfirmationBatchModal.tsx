'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, Mail, Plane, Send, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { mapDbReservationRowsToReservations } from '@/lib/mapDbReservationRowsToReservations'
import { ReservationCardItem } from '@/components/reservation/ReservationCardItem'
import EmailPreviewModal from '@/components/reservation/EmailPreviewModal'
import { sendReservationDepartureEmailsBulk } from '@/lib/sendReservationDepartureEmail'
import type { DepartureBatchModalReason } from '@/lib/tourDepartureThreshold'
import type { Customer, Reservation } from '@/types/reservation'
import { getCustomerName, getProductName } from '@/utils/reservationUtils'

export type TourDepartureConfirmationBatchContext = {
  reason: DepartureBatchModalReason
  productId: string
  tourDate: string
  totalPeople: number
  pendingCount: number
  reservationIds: string[]
}

type Props = {
  isOpen: boolean
  onClose: () => void
  context: TourDepartureConfirmationBatchContext
  customers: Customer[]
  products: Array<{ id: string; name: string; sub_category?: string; product_code?: string | null }>
  channels: Array<{ id: string; name: string; favicon_url?: string | null }>
  pickupHotels: Array<{
    id: string
    hotel?: string | null
    name?: string | null
    name_ko?: string | null
    pick_up_location?: string | null
  }>
  productOptions: Array<{ id: string; name: string; is_required?: boolean }>
  optionChoices: Array<{ id: string; name: string }>
  locale: string
  sentBy: string | null
  onDone?: () => void
}

const noop = () => {}
const emptyTourInfoMap = new Map()
const emptyPricingMap = new Map()

export default function TourDepartureConfirmationBatchModal({
  isOpen,
  onClose,
  context,
  customers,
  products,
  channels,
  pickupHotels,
  productOptions,
  optionChoices,
  locale,
  sentBy,
  onDone,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [bulkSending, setBulkSending] = useState(false)
  const [sentIds, setSentIds] = useState<Set<string>>(new Set())
  const [preview, setPreview] = useState<{
    reservationId: string
    customerEmail: string
    tourDate: string
    pickUpTime: string | null
  } | null>(null)
  const choicesCacheRef = useRef(new Map())

  const productName = getProductName(
    context.productId,
    products as Parameters<typeof getProductName>[1]
  )

  const loadReservations = useCallback(async () => {
    if (!context.reservationIds.length) {
      setReservations([])
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .in('id', context.reservationIds)
        .order('created_at', { ascending: true })

      if (error) throw error

      const productMap = new Map(products.map((p) => [p.id, p.sub_category ?? '']))
      const tourMap = new Map<string, boolean>()
      const mapped = mapDbReservationRowsToReservations(
        (data || []) as Record<string, unknown>[],
        productMap,
        tourMap
      )
      const order = new Map(context.reservationIds.map((id, index) => [id, index]))
      mapped.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      setReservations(mapped)
    } catch (error) {
      console.error('[TourDepartureConfirmationBatchModal] load error', error)
      alert('해당일 예약 목록을 불러오지 못했습니다.')
      setReservations([])
    } finally {
      setLoading(false)
    }
  }, [context.reservationIds, products])

  useEffect(() => {
    if (!isOpen) return
    void loadReservations()
    setSentIds(new Set())
    setPreview(null)
  }, [isOpen, loadReservations])

  const handleEmailPreview = useCallback(
    (reservation: Reservation, emailType: 'confirmation' | 'departure' | 'pickup' | 'resident_inquiry') => {
      if (emailType !== 'departure') return
      const customer = customers.find((c) => c.id === reservation.customerId)
      if (!customer?.email) {
        alert('고객 이메일이 없습니다.')
        return
      }
      setPreview({
        reservationId: reservation.id,
        customerEmail: customer.email,
        tourDate: reservation.tourDate,
        pickUpTime: reservation.pickUpTime ?? null,
      })
    },
    [customers]
  )

  const handleBulkSend = useCallback(async () => {
    if (!reservations.length) return
    const targets = reservations.filter((r) => !sentIds.has(r.id))
    if (!targets.length) {
      alert('발송할 예약이 없습니다.')
      return
    }
    const ok = confirm(
      `${targets.length}건에 투어 출발 확정 이메일을 일괄 발송할까요?\n(이미 발송 완료로 표시된 건은 제외됩니다.)`
    )
    if (!ok) return

    setBulkSending(true)
    try {
      const results = await sendReservationDepartureEmailsBulk({
        sentBy,
        items: targets.map((reservation) => {
          const customer = customers.find((c) => c.id === reservation.customerId)
          return {
            reservationId: reservation.id,
            customerEmail: customer?.email,
            ...(customer?.language != null ? { customerLanguage: customer.language } : {}),
          }
        }),
      })
      const succeeded = results.filter((r) => r.ok).map((r) => r.reservationId)
      const failed = results.filter((r) => !r.ok)
      setSentIds((prev) => {
        const next = new Set(prev)
        succeeded.forEach((id) => next.add(id))
        return next
      })
      if (failed.length === 0) {
        alert(`${succeeded.length}건 발송이 완료되었습니다.`)
      } else {
        alert(
          `발송 완료 ${succeeded.length}건, 실패 ${failed.length}건\n` +
            failed.map((f) => `${f.reservationId}: ${f.error ?? '오류'}`).join('\n')
        )
      }
    } finally {
      setBulkSending(false)
    }
  }, [customers, reservations, sentBy, sentIds])

  const title =
    context.reason === 'threshold_crossed'
      ? '출발 확정 — 투어 출발 안내 이메일'
      : '출발 확정 투어 — 대기 예약 출발 안내'

  const description = useMemo(() => {
    if (context.reason === 'threshold_crossed') {
      return `${context.tourDate} · ${productName} — 총 ${context.totalPeople}명으로 출발 확정되었습니다. 해당일 예약 고객에게 출발 확정 이메일을 보내세요.`
    }
    return `${context.tourDate} · ${productName} — 출발 확정(총 ${context.totalPeople}명) 상태이나 대기중 예약 ${context.pendingCount}건이 있습니다. 각 예약 카드에서 개별 또는 일괄로 출발 확정 이메일을 보낼 수 있습니다.`
  }, [context, productName])

  if (!isOpen || typeof document === 'undefined') return null

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-departure-batch-title"
      >
        <div className="flex h-[min(92vh,900px)] w-full max-w-7xl flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border border-border/60 bg-background shadow-xl">
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border/60 px-4 py-4 sm:px-6">
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 text-primary">
                <Plane className="h-5 w-5 shrink-0" aria-hidden />
                <h2 id="tour-departure-batch-title" className="text-lg font-semibold text-foreground">
                  {title}
                </h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="닫기"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border/40 bg-muted/30 px-4 py-3 sm:px-6">
            <p className="text-sm text-muted-foreground">
              예약 {reservations.length}건
              {sentIds.size > 0 ? ` · 발송 완료 ${sentIds.size}건` : ''}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleBulkSend()}
                disabled={bulkSending || loading || reservations.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {bulkSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Send className="h-4 w-4" aria-hidden />
                )}
                일괄 출발 확정 이메일 발송
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onDone?.()
                }}
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted"
              >
                닫기
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : reservations.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                표시할 예약이 없습니다.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {reservations.map((reservation) => {
                  const customer = customers.find((c) => c.id === reservation.customerId)
                  const customerLabel = getCustomerName(reservation.customerId, customers)
                  const isSent = sentIds.has(reservation.id)
                  return (
                    <div key={reservation.id} className="relative">
                      {isSent ? (
                        <div className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                          <Mail className="h-3 w-3" aria-hidden />
                          발송됨
                        </div>
                      ) : null}
                      <ReservationCardItem
                        reservation={reservation}
                        customers={customers}
                        products={products}
                        channels={channels.map((c) => ({
                          id: c.id,
                          name: c.name,
                          ...(c.favicon_url ? { favicon_url: c.favicon_url } : {}),
                        }))}
                        pickupHotels={pickupHotels}
                        productOptions={productOptions}
                        optionChoices={optionChoices}
                        tourInfoMap={emptyTourInfoMap}
                        reservationPricingMap={emptyPricingMap}
                        locale={locale}
                        onPricingInfoClick={noop}
                        onCreateTour={noop}
                        onPickupTimeClick={noop}
                        onPickupHotelClick={noop}
                        onPaymentClick={noop}
                        onDetailClick={noop}
                        onReviewClick={noop}
                        onEmailPreview={handleEmailPreview}
                        onEmailLogsClick={noop}
                        onEditClick={noop}
                        onCustomerClick={noop}
                        onRefreshReservations={() => void loadReservations()}
                        generatePriceCalculation={() => ''}
                        getGroupColorClasses={() => ''}
                        getSelectedChoicesFromNewSystem={async () => []}
                        choicesCacheRef={choicesCacheRef}
                      />
                      {!customer?.email ? (
                        <p className="mt-1 px-1 text-xs text-amber-700">
                          {customerLabel || '고객'} — 이메일 없음 (발송 불가)
                        </p>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {preview ? (
        <EmailPreviewModal
          isOpen
          onClose={() => setPreview(null)}
          reservationId={preview.reservationId}
          emailType="departure"
          customerEmail={preview.customerEmail}
          pickupTime={preview.pickUpTime}
          tourDate={preview.tourDate}
          onSend={async () => {
            try {
              const { sendReservationDepartureEmail } = await import(
                '@/lib/sendReservationDepartureEmail'
              )
              const customer = customers.find((c) =>
                reservations.some((r) => r.id === preview.reservationId && r.customerId === c.id)
              )
              await sendReservationDepartureEmail({
                reservationId: preview.reservationId,
                customerEmail: preview.customerEmail,
                ...(customer?.language != null ? { customerLanguage: customer.language } : {}),
                sentBy,
              })
              setSentIds((prev) => new Set(prev).add(preview.reservationId))
              alert('이메일이 발송되었습니다.')
              setPreview(null)
            } catch (error) {
              alert(error instanceof Error ? error.message : '이메일 발송에 실패했습니다.')
            }
          }}
        />
      ) : null}
    </>,
    document.body
  )
}
