'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  computeNeedsResidentFlow,
  emailLogStatusSuccess,
  type ReservationFollowUpPipelineSnapshot,
} from '@/lib/reservationFollowUpPipeline'

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

const CHUNK = 100

/** effect 정리·의존성 변경으로 요청이 끊긴 경우 — 실패로 로그하지 않음 */
function isLikelyAbortError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const o = e as { name?: string; message?: string; details?: string }
  if (o.name === 'AbortError') return true
  const blob = `${o.message ?? ''}\n${o.details ?? ''}`
  return blob.includes('AbortError') || blob.includes('signal is aborted')
}

/** productFingerprint 문자열 → 예약별 product_code (안정 키용, effect 의존성에서 배열 참조 제거) */
function productCodeMapFromFingerprint(fp: string): Map<string, string | null> {
  const m = new Map<string, string | null>()
  if (!fp) return m
  for (const segment of fp.split('|')) {
    if (!segment) continue
    const colon = segment.indexOf(':')
    if (colon < 0) continue
    const id = segment.slice(0, colon)
    const raw = segment.slice(colon + 1)
    m.set(id, raw === '' ? null : raw)
  }
  return m
}

type ReservationLite = { id: string; productId: string }

/**
 * 예약 카드 Follow-up 파이프라인 표시용: email_logs + (해당 시) 거주 확인 토큰/제출 + 수동 완료(다른 채널).
 */
export function useReservationFollowUpSnapshots(
  reservations: ReservationLite[],
  products: Array<{ id: string; product_code?: string | null }>,
  /** 수동 완료 저장 후 스냅샷 재조회 */
  refreshToken = 0
): {
  snapshotsByReservationId: Map<string, ReservationFollowUpPipelineSnapshot>
  loading: boolean
  /** 취소 Follow-up 수동 저장 직후 UI 반영(재조회 전·레이스 완화) */
  patchCancelManualFlags: (
    reservationId: string,
    cancelFollowUpManual: boolean,
    cancelRebookingOutreachManual: boolean
  ) => void
} {
  const idsKey = useMemo(() => {
    const ids = [...new Set(reservations.map((r) => String(r.id ?? '').trim()).filter(Boolean))]
    ids.sort()
    return ids.join('\u001f')
  }, [reservations])

  const productFingerprint = useMemo(() => {
    return reservations
      .map((r) => {
        const pid = String(r.productId ?? '').trim()
        const p = products.find((x) => x.id === pid)
        return `${r.id}:${p?.product_code ?? ''}`
      })
      .sort()
      .join('|')
  }, [reservations, products])

  const [snapshotsByReservationId, setSnapshotsByReservationId] = useState<
    Map<string, ReservationFollowUpPipelineSnapshot>
  >(new Map())
  const [loading, setLoading] = useState(false)

  const patchCancelManualFlags = useCallback(
    (reservationId: string, cancelFollowUpManual: boolean, cancelRebookingOutreachManual: boolean) => {
      const rid = String(reservationId ?? '').trim()
      if (!rid) return
      setSnapshotsByReservationId((prev) => {
        const cur = prev.get(rid)
        if (!cur) return prev
        if (
          cur.cancelFollowUpManual === cancelFollowUpManual &&
          cur.cancelRebookingOutreachManual === cancelRebookingOutreachManual
        ) {
          return prev
        }
        const next = new Map(prev)
        next.set(rid, { ...cur, cancelFollowUpManual, cancelRebookingOutreachManual })
        return next
      })
    },
    []
  )

  useEffect(() => {
    const ids = idsKey.split('\u001f').filter(Boolean)
    if (ids.length === 0) {
      setSnapshotsByReservationId((prev) => (prev.size === 0 ? prev : new Map()))
      return
    }

    const productCodeByReservationId = productCodeMapFromFingerprint(productFingerprint)

    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const confirmationSent = new Set<string>()
        const residentInquirySent = new Set<string>()
        const departureSent = new Set<string>()
        const pickupSent = new Set<string>()

        for (const part of chunk(ids, CHUNK)) {
          const { data: logs, error } = await supabase
            .from('email_logs')
            .select('reservation_id,email_type,status')
            .in('reservation_id', part)

          if (error) throw error
          for (const row of logs || []) {
            const rid = String((row as { reservation_id?: string }).reservation_id ?? '')
            if (!rid || !emailLogStatusSuccess((row as { status?: string }).status)) continue
            const t = String((row as { email_type?: string }).email_type ?? '')
            if (t === 'confirmation') confirmationSent.add(rid)
            if (t === 'resident_inquiry') residentInquirySent.add(rid)
            if (t === 'departure') departureSent.add(rid)
            if (t === 'pickup') pickupSent.add(rid)
          }
        }

        const guestDone = new Set<string>()
        const manualByReservationId = new Map<
          string,
          {
            confirmation_manual: boolean
            resident_manual: boolean
            departure_manual: boolean
            pickup_manual: boolean
            cancel_follow_up_manual: boolean
            cancel_rebooking_outreach_manual: boolean
          }
        >()
        for (const part of chunk(ids, CHUNK)) {
          const { data: manualRows, error: manErr } = await supabase
            .from('reservation_follow_up_pipeline_manual')
            .select(
              'reservation_id, confirmation_manual, resident_manual, departure_manual, pickup_manual, cancel_follow_up_manual, cancel_rebooking_outreach_manual'
            )
            .in('reservation_id', part)
          if (manErr) throw manErr
          for (const row of manualRows || []) {
            const rid = String((row as { reservation_id?: string }).reservation_id ?? '')
            if (!rid) continue
            manualByReservationId.set(rid, {
              confirmation_manual: !!(row as { confirmation_manual?: boolean }).confirmation_manual,
              resident_manual: !!(row as { resident_manual?: boolean }).resident_manual,
              departure_manual: !!(row as { departure_manual?: boolean }).departure_manual,
              pickup_manual: !!(row as { pickup_manual?: boolean }).pickup_manual,
              cancel_follow_up_manual: !!(row as { cancel_follow_up_manual?: boolean }).cancel_follow_up_manual,
              cancel_rebooking_outreach_manual: !!(row as { cancel_rebooking_outreach_manual?: boolean })
                .cancel_rebooking_outreach_manual,
            })
          }
        }

        for (const part of chunk(ids, CHUNK)) {
          const { data: tokens, error: tokErr } = await supabase
            .from('resident_check_tokens')
            .select('id,reservation_id,completed_at')
            .in('reservation_id', part)

          if (tokErr) throw tokErr
          const tokenRows = (tokens || []) as Array<{
            id: string
            reservation_id: string
            completed_at: string | null
          }>
          const tokenIds = tokenRows.map((t) => t.id).filter(Boolean)
          const agreedTokenIds = new Set<string>()
          if (tokenIds.length > 0) {
            for (const tp of chunk(tokenIds, CHUNK)) {
              const { data: subs, error: subErr } = await supabase
                .from('resident_check_submissions')
                .select('token_id, agreed')
                .in('token_id', tp)
              if (subErr) throw subErr
              for (const s of subs || []) {
                const row = s as { token_id?: string; agreed?: boolean }
                if (row.agreed && row.token_id) agreedTokenIds.add(row.token_id)
              }
            }
          }
          for (const t of tokenRows) {
            const rid = t.reservation_id
            if (t.completed_at) guestDone.add(rid)
            else if (agreedTokenIds.has(t.id)) guestDone.add(rid)
          }
        }

        const next = new Map<string, ReservationFollowUpPipelineSnapshot>()
        for (const rid of ids) {
          const code = productCodeByReservationId.get(rid) ?? null
          const needs = computeNeedsResidentFlow(code)
          const m = manualByReservationId.get(rid)
          const mc = m?.confirmation_manual ?? false
          const mr = m?.resident_manual ?? false
          const md = m?.departure_manual ?? false
          const mp = m?.pickup_manual ?? false
          const cFu = m?.cancel_follow_up_manual ?? false
          const cRe = m?.cancel_rebooking_outreach_manual ?? false
          /** 출발 확정(이메일·수동)만 있어도 예약 확인 단계는 완료로 표시. 거주 단계는 별도. */
          const departureEffective = departureSent.has(rid) || md
          next.set(rid, {
            confirmationSent: confirmationSent.has(rid) || mc || departureEffective,
            residentInquirySent: residentInquirySent.has(rid) || (needs && mr),
            guestResidentFlowCompleted: guestDone.has(rid) || (needs && mr),
            departureSent: departureEffective,
            pickupSent: pickupSent.has(rid) || mp,
            needsResidentFlow: needs,
            manualConfirmation: mc,
            manualResident: mr,
            manualDeparture: md,
            manualPickup: mp,
            cancelFollowUpManual: cFu,
            cancelRebookingOutreachManual: cRe,
          })
        }
        if (!cancelled) setSnapshotsByReservationId(next)
      } catch (e) {
        if (cancelled || isLikelyAbortError(e)) return
        console.error('useReservationFollowUpSnapshots:', e)
        if (!cancelled) setSnapshotsByReservationId(new Map())
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [idsKey, productFingerprint, refreshToken])

  return { snapshotsByReservationId, loading, patchCancelManualFlags }
}
