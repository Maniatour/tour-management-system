'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRightLeft } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useOperatorOptional } from '@/contexts/OperatorContext'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  isMovableExpenseTable,
  MOVABLE_EXPENSE_TABLE_LABEL,
  MOVABLE_EXPENSE_TABLES,
  moveExpensesToTable,
  type MovableExpenseTable,
  type MoveExpenseItem,
} from '@/lib/moveExpenseTable'

type TourPickRow = {
  id: string
  tour_date: string
  product_id: string | null
  productName: string
}

type ReservationPreview = {
  id: string
  tour_date: string | null
  status: string | null
  product_id: string | null
  tour_id: string | null
}

function todayYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function MoveExpenseTableDialog({
  open,
  onOpenChange,
  items,
  onMoved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: MoveExpenseItem[]
  onMoved?: () => void
}) {
  const { user } = useAuth()
  const operator = useOperatorOptional()
  const activeOperatorId = resolveOperatorId(operator?.operatorId)
  const uniqueSources = useMemo(() => new Set(items.map((i) => i.table)), [items])
  const destOptions = useMemo(
    () =>
      MOVABLE_EXPENSE_TABLES.filter((table) => uniqueSources.size !== 1 || !uniqueSources.has(table)),
    [uniqueSources]
  )
  const [destTable, setDestTable] = useState<MovableExpenseTable | ''>('')
  const [tourDate, setTourDate] = useState(todayYmd())
  const [tourId, setTourId] = useState('')
  const [tours, setTours] = useState<TourPickRow[]>([])
  const [toursLoading, setToursLoading] = useState(false)
  const [reservationId, setReservationId] = useState('')
  const [reservationPreview, setReservationPreview] = useState<ReservationPreview | null>(null)
  const [reservationLookupError, setReservationLookupError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setDestTable(destOptions[0] ?? '')
    setTourId('')
    setTours([])
    setReservationId('')
    setReservationPreview(null)
    setReservationLookupError('')
    setTourDate(todayYmd())
  }, [open, destOptions])

  useEffect(() => {
    if (!open || destTable !== 'tour_expenses' || !/^\d{4}-\d{2}-\d{2}$/.test(tourDate)) {
      setTours([])
      return
    }
    let cancelled = false
    setToursLoading(true)
    void (async () => {
      const { data, error } = await supabase
        .from('tours')
        .select('id, tour_date, product_id')
        .eq('operator_id', activeOperatorId)
        .eq('tour_date', tourDate)
        .order('id', { ascending: true })
        .limit(80)
      if (cancelled) return
      if (error) {
        console.error(error)
        setTours([])
        setToursLoading(false)
        return
      }
      const rows = (data ?? []) as Array<{ id: string; tour_date: string; product_id: string | null }>
      const productIds = [...new Set(rows.map((r) => r.product_id).filter((id): id is string => Boolean(id)))]
      const nameById = new Map<string, string>()
      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from('products')
          .select('id, name, name_ko')
          .in('id', productIds)
        for (const p of (products ?? []) as Array<{ id: string; name?: string | null; name_ko?: string | null }>) {
          nameById.set(p.id, (p.name_ko || p.name || p.id).trim())
        }
      }
      if (cancelled) return
      setTours(
        rows.map((r) => ({
          id: r.id,
          tour_date: String(r.tour_date).slice(0, 10),
          product_id: r.product_id,
          productName: (r.product_id && nameById.get(r.product_id)) || r.product_id || '상품 없음',
        }))
      )
      setToursLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [open, destTable, tourDate, activeOperatorId])

  const lookupReservation = useCallback(async (id: string) => {
    const rid = id.trim()
    if (!rid) {
      setReservationPreview(null)
      setReservationLookupError('')
      return
    }
    const { data, error } = await supabase
      .from('reservations')
      .select('id, tour_date, status, product_id, tour_id')
      .eq('id', rid)
      .maybeSingle()
    if (error) {
      setReservationPreview(null)
      setReservationLookupError('예약을 조회하지 못했습니다.')
      return
    }
    if (!data?.id) {
      setReservationPreview(null)
      setReservationLookupError('해당 예약을 찾을 수 없습니다.')
      return
    }
    setReservationLookupError('')
    setReservationPreview({
      id: String(data.id),
      tour_date: data.tour_date ? String(data.tour_date).slice(0, 10) : null,
      status: data.status ? String(data.status) : null,
      product_id: data.product_id ? String(data.product_id) : null,
      tour_id: data.tour_id ? String(data.tour_id) : null,
    })
  }, [])

  const canSubmit =
    items.length > 0 &&
    Boolean(destTable) &&
    !saving &&
    (destTable !== 'tour_expenses' || Boolean(tourId)) &&
    (destTable !== 'reservation_expenses' || Boolean(reservationId.trim()))

  const submit = async () => {
    if (!destTable || items.length === 0) return
    setSaving(true)
    try {
      const result = await moveExpensesToTable(supabase, items, {
        destTable,
        tourId: destTable === 'tour_expenses' ? tourId : null,
        reservationId: destTable === 'reservation_expenses' ? reservationId.trim() : null,
        actorEmail: user?.email || '',
      })
      if (result.moved === 0) {
        toast.error(result.skipped[0]?.reason || '옮기지 못했습니다.')
        return
      }
      if (result.skipped.length > 0) {
        toast.message(
          `${result.moved}건 이동 · ${result.skipped.length}건 실패: ${result.skipped[0]?.reason ?? ''}`
        )
      } else {
        toast.success(
          `${result.moved}건을 ${MOVABLE_EXPENSE_TABLE_LABEL[destTable]}(으)로 옮겼습니다.`
        )
      }
      onOpenChange(false)
      onMoved?.()
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : '이동 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" stackLevel="nested">
        <DialogHeader>
          <DialogTitle>지출 테이블 이동</DialogTitle>
          <DialogDescription>
            선택한 {items.length}건을 다른 원장으로 옮깁니다. 회사·투어·예약 지출은 삭제 보관함으로 보내지고,
            현금 출금은 삭제됩니다. 명세 대조는 새 건으로 이어집니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {uniqueSources.size > 1 ? (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              출처가 다른 건이 섞여 있습니다. 목적지는 같고, 이미 같은 테이블인 건은 건너뜁니다.
            </p>
          ) : null}

          <div className="space-y-1.5">
            <Label>목적지</Label>
            <Select
              value={destTable}
              onValueChange={(v) => {
                if (isMovableExpenseTable(v)) setDestTable(v)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="옮길 테이블 선택" />
              </SelectTrigger>
              <SelectContent>
                {destOptions.map((table) => (
                  <SelectItem key={table} value={table}>
                    {MOVABLE_EXPENSE_TABLE_LABEL[table]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {destTable === 'tour_expenses' ? (
            <div className="space-y-3 rounded-xl border border-border/60 p-3 bg-muted/30">
              <div className="space-y-1.5">
                <Label htmlFor="move-expense-tour-date">투어 날짜</Label>
                <Input
                  id="move-expense-tour-date"
                  type="date"
                  value={tourDate}
                  onChange={(e) => {
                    setTourDate(e.target.value)
                    setTourId('')
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>투어</Label>
                <Select value={tourId} onValueChange={setTourId} disabled={toursLoading || tours.length === 0}>
                  <SelectTrigger>
                    <SelectValue placeholder={toursLoading ? '불러오는 중…' : '투어 선택'} />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {tours.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.productName} · {t.id.slice(0, 8)}…
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!toursLoading && tours.length === 0 ? (
                  <p className="text-xs text-amber-800">해당 날짜의 투어가 없습니다.</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {destTable === 'reservation_expenses' ? (
            <div className="space-y-3 rounded-xl border border-border/60 p-3 bg-muted/30">
              <div className="space-y-1.5">
                <Label htmlFor="move-expense-reservation-id">예약 ID</Label>
                <div className="flex gap-2">
                  <Input
                    id="move-expense-reservation-id"
                    value={reservationId}
                    onChange={(e) => {
                      setReservationId(e.target.value)
                      setReservationPreview(null)
                      setReservationLookupError('')
                    }}
                    placeholder="예약 번호"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void lookupReservation(reservationId)}
                    disabled={!reservationId.trim()}
                  >
                    확인
                  </Button>
                </div>
                {reservationLookupError ? (
                  <p className="text-xs text-destructive">{reservationLookupError}</p>
                ) : null}
                {reservationPreview ? (
                  <p className="text-xs text-muted-foreground">
                    {reservationPreview.tour_date || '날짜 없음'} · {reservationPreview.status || '상태 없음'}
                    {reservationPreview.tour_id ? ` · 투어 ${reservationPreview.tour_id.slice(0, 8)}…` : ''}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {destTable === 'cash_transactions' ? (
            <p className="text-xs text-muted-foreground leading-relaxed">
              현금 관리의 출금 거래로 기록됩니다. 기존 현금 대조 연결은 해제됩니다.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            취소
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={!canSubmit}>
            {saving ? '이동 중…' : `${items.length}건 이동`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function MoveExpenseTableButton({
  items,
  disabled,
  onMoved,
  onOpenChange,
  iconOnly,
  title = '다른 테이블로 이동',
  size = 'sm',
  variant = 'outline',
}: {
  items: MoveExpenseItem[]
  disabled?: boolean
  onMoved?: () => void
  onOpenChange?: (open: boolean) => void
  iconOnly?: boolean
  title?: string
  size?: 'sm' | 'default'
  variant?: 'outline' | 'ghost'
}) {
  const [open, setOpen] = useState(false)
  const setBoth = (next: boolean) => {
    setOpen(next)
    onOpenChange?.(next)
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={iconOnly ? 'h-10 w-10 p-0 min-h-[44px]' : undefined}
        disabled={disabled || items.length === 0}
        title={title}
        onClick={() => setBoth(true)}
      >
        <ArrowRightLeft className={iconOnly ? 'h-4 w-4' : 'h-4 w-4 mr-1.5 shrink-0'} aria-hidden />
        {iconOnly ? <span className="sr-only">{title}</span> : '테이블 이동'}
      </Button>
      <MoveExpenseTableDialog
        open={open}
        onOpenChange={setBoth}
        items={items}
        {...(onMoved ? { onMoved } : {})}
      />
    </>
  )
}
