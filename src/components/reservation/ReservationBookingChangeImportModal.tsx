'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { X, MapPin, Loader2, ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import { ImportedEmailBodyPanel } from '@/components/reservation/ImportedEmailBodyPanel'
import type { ExtractedReservationData } from '@/types/reservationImport'
import { expandChannelRnMatchVariants } from '@/utils/channelRnMatch'
import { getPickupHotelDisplay, matchPickupHotelId } from '@/utils/reservationUtils'
import { isReservationImportBookingChange } from '@/lib/emailReservationParser'

type ImportRow = {
  id: string
  subject: string | null
  source_email: string | null
  status: string
  reservation_id: string | null
  raw_body_text: string | null
  raw_body_html?: string | null
  extracted_data: ExtractedReservationData
}

type MatchRow = {
  id: string
  status: string
  tour_date: string | null
  pickup_hotel: string | null
  channel_rn: string | null
}

type PickupHotelRow = {
  id: string
  hotel?: string | null
  pick_up_location?: string | null
  internal_name?: string | null
  address?: string | null
}

export function ReservationBookingChangeImportModal({
  importId,
  locale,
  onClose,
  onResolved,
}: {
  importId: string | null
  locale: string
  onClose: () => void
  onResolved?: () => void
}) {
  const open = Boolean(importId)
  const [row, setRow] = useState<ImportRow | null>(null)
  const [match, setMatch] = useState<MatchRow | null>(null)
  const [hotels, setHotels] = useState<PickupHotelRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hotelId, setHotelId] = useState('')

  const load = useCallback(async () => {
    if (!importId) return
    setLoading(true)
    setError(null)
    setMatch(null)
    try {
      const [importRes, hotelsRes] = await Promise.all([
        fetchApiWithAuth(`/api/reservation-imports/${importId}`),
        supabase.from('pickup_hotels').select('id, hotel, pick_up_location, internal_name, address').order('hotel'),
      ])
      let data = (await importRes.json()) as ImportRow & { error?: string }
      if (!importRes.ok) throw new Error(data.error || '불러오기 실패')
      const hasBody = Boolean((data.raw_body_text || '').trim() || (data.raw_body_html || '').trim())
      const extracted = data.extracted_data
      const amendmentSubject = /\bamendment\s+request\b/i.test(data.subject || '')
      const bodyHasDateChange = /travel\s+date\s+changed/i.test(data.raw_body_text || '')
      const needsReparse =
        hasBody &&
        (extracted?.is_booking_change !== true ||
          !String(extracted?.pickup_hotel || '').trim() ||
          (amendmentSubject &&
            bodyHasDateChange &&
            !String(extracted?.requested_tour_date || '').trim()))
      if (needsReparse) {
        const reparseRes = await fetchApiWithAuth(`/api/reservation-imports/${importId}/reparse`, {
          method: 'POST',
        })
        if (reparseRes.ok) {
          data = (await reparseRes.json()) as ImportRow
        }
      }
      if (!isReservationImportBookingChange({ subject: data.subject, extracted: data.extracted_data })) {
        setError('예약 변경 이메일이 아닙니다. 목록에서 다시 열어 주세요.')
        setRow(null)
        return
      }
      setRow(data)
      const hotelRows = (hotelsRes.data || []) as PickupHotelRow[]
      setHotels(hotelRows)

      const extractedHotel = String(data.extracted_data?.pickup_hotel || '').trim()
      const appliedId = String(data.extracted_data?.pickup_change_applied_hotel_id || '').trim()
      const matchedFromEmail = matchPickupHotelId(extractedHotel, hotelRows)
      setHotelId(appliedId || matchedFromEmail || '')

      const channelRn = String(data.extracted_data?.channel_rn || '').trim()
      const variants = expandChannelRnMatchVariants(channelRn)
      if (data.reservation_id || variants.length > 0) {
        let query = supabase
          .from('reservations')
          .select('id, status, tour_date, pickup_hotel, channel_rn')
          .limit(5)
        if (data.reservation_id) {
          query = query.eq('id', data.reservation_id)
        } else {
          query = query.in('channel_rn', variants)
        }
        const { data: resRows } = await query
        const found = (resRows || [])[0] as MatchRow | undefined
        if (found) {
          setMatch(found)
          if (!appliedId && !matchedFromEmail && found.pickup_hotel) setHotelId(found.pickup_hotel)
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류')
      setRow(null)
    } finally {
      setLoading(false)
    }
  }, [importId])

  useEffect(() => {
    if (!importId) {
      setRow(null)
      setMatch(null)
      setError(null)
      setHotelId('')
      return
    }
    void load()
  }, [importId, load])

  const ext = row?.extracted_data
  const applied = ext?.pickup_change_applied === true
  const extractedPickup = (ext?.pickup_hotel || '').trim()
  const currentPickupLabel = useMemo(() => {
    if (!match?.pickup_hotel) return '미정'
    return getPickupHotelDisplay(match.pickup_hotel, hotels)
  }, [match?.pickup_hotel, hotels])

  const handleApply = async () => {
    if (!importId) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetchApiWithAuth(`/api/reservation-imports/${importId}/apply-pickup-change`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hotelId ? { hotel_id: hotelId } : {}),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error || '반영 실패')
      await load()
      onResolved?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : '반영 실패')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-change-import-title"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[min(92vh,800px)] flex flex-col border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-gray-100 shrink-0">
          <div className="min-w-0 flex items-start gap-2">
            <MapPin className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" aria-hidden />
            <div className="min-w-0">
              <h2 id="booking-change-import-title" className="text-base font-semibold text-gray-900">
                예약 변경 이메일
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                채널 RN으로 기존 예약을 찾습니다. 픽업은 반영할 수 있고, 날짜 변경 요청은 자동 반영하지 않습니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
          {loading && (
            <div className="flex justify-center py-10">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}
          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}
          {!loading && row && (
            <>
              <div className="text-sm space-y-1">
                <p className="font-medium text-gray-900 break-words">{row.subject ?? '(제목 없음)'}</p>
                {row.source_email && <p className="text-xs text-gray-500">발신: {row.source_email}</p>}
                {ext?.channel_rn ? (
                  <p className="text-xs font-mono text-sky-900 bg-sky-50 border border-sky-100 rounded px-2 py-1 mt-2">
                    조회 RN: <strong>{ext.channel_rn}</strong>
                  </p>
                ) : null}
              </div>

              <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-3 space-y-2 text-sm">
                {(ext?.requested_tour_date || ext?.original_tour_date || match?.tour_date) && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 space-y-1">
                    <p>
                      <span className="text-gray-500">현재 투어일</span>{' '}
                      <strong className="text-gray-900">
                        {match?.tour_date || ext?.original_tour_date || ext?.tour_date || '—'}
                      </strong>
                    </p>
                    {ext?.requested_tour_date ? (
                      <p>
                        <span className="text-gray-500">
                          {ext?.is_booking_change_request ? '요청 투어일' : '변경 투어일'}
                        </span>{' '}
                        <strong className="text-amber-900">{ext.requested_tour_date}</strong>
                      </p>
                    ) : null}
                    {ext?.requested_tour_date ? (
                      <p className="text-xs text-amber-900/90">
                        {ext?.is_booking_change_request
                          ? 'Viator 변경 요청입니다. 날짜는 자동으로 바꾸지 않습니다. 예약 상세에서 확인해 주세요.'
                          : '날짜는 자동으로 바꾸지 않습니다. 예약 상세에서 확인해 주세요.'}
                      </p>
                    ) : null}
                  </div>
                )}
                <p>
                  <span className="text-gray-500">메일 픽업</span>{' '}
                  <strong className="text-gray-900">{extractedPickup || '—'}</strong>
                </p>
                <p>
                  <span className="text-gray-500">현재 예약 픽업</span>{' '}
                  <strong className="text-gray-900">{match ? currentPickupLabel : '예약 미매칭'}</strong>
                </p>
                {applied && (
                  <p className="text-emerald-800 text-xs font-semibold">픽업 호텔이 예약에 반영되어 있습니다.</p>
                )}
                {match?.id && (
                  <a
                    href={`/${locale}/admin/reservations/${match.id}`}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    예약 상세 열기 <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">반영할 픽업 호텔</label>
                <select
                  value={hotelId}
                  onChange={(e) => setHotelId(e.target.value)}
                  className="w-full min-h-[44px] border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white"
                >
                  <option value="">카탈로그에서 선택…</option>
                  {hotels.map((h) => (
                    <option key={h.id} value={h.id}>
                      {(h.hotel || h.internal_name || h.id) +
                        (h.pick_up_location ? ` — ${h.pick_up_location}` : '')}
                    </option>
                  ))}
                </select>
              </div>

              <ImportedEmailBodyPanel
                text={row.raw_body_text}
                html={row.raw_body_html}
                heightClassName="h-56 max-h-[32vh]"
              />
            </>
          )}
        </div>

        <div className="shrink-0 border-t border-gray-100 px-4 py-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 text-sm text-gray-700 rounded-xl hover:bg-gray-100"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={() => void handleApply()}
            disabled={saving || loading || !row}
            className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 bg-sky-600 text-white text-sm rounded-xl hover:bg-sky-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
            픽업 호텔 반영
          </button>
        </div>
      </div>
    </div>
  )
}
