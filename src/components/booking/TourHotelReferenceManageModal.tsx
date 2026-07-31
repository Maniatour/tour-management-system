'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  mergeTourHotelManageRows,
  resolveCityFromHotelNamePrefix,
  type TourHotelManageRow,
  type TourHotelReference,
} from '@/lib/tourHotelReferences'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  locale: string
  onChanged?: () => void
  /** 부모 폼 드롭다운과 동일한 호텔명 (즉시 표시) */
  initialHotelNames?: string[]
  /** 부모 폼에 이미 로드된 참조 */
  initialReferences?: TourHotelReference[]
}

type Draft = {
  id?: string
  hotel_name: string
  city: string
  website: string
}

const emptyDraft = (): Draft => ({ hotel_name: '', city: '', website: '' })

export default function TourHotelReferenceManageModal({
  open,
  onOpenChange,
  locale,
  onChanged,
  initialHotelNames = [],
  initialReferences = [],
}: Props) {
  const isKo = locale === 'ko'
  const [rows, setRows] = useState<TourHotelManageRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [editingId, setEditingId] = useState<string | null>(null)

  const seedRows = useMemo(
    () =>
      mergeTourHotelManageRows(
        initialReferences,
        initialHotelNames.map((hotel) => ({ hotel }))
      ),
    [initialHotelNames, initialReferences]
  )

  const loadRows = useCallback(async () => {
    setLoading(true)
    try {
      let references: TourHotelReference[] = []
      try {
        const { data, error } = await supabase
          .from('tour_hotel_references' as never)
          .select('id, hotel_name, city, website')
          .order('hotel_name')
        if (error) throw error
        references = (data || []) as TourHotelReference[]
      } catch (error) {
        console.warn('호텔 참조 테이블 조회 실패 — 부킹 기록만 표시합니다.', error)
      }

      const { data: bookingData, error: bookingError } = await supabase
        .from('tour_hotel_bookings')
        .select('hotel, city, website, updated_at, created_at')
        .not('hotel', 'is', null)
        .order('updated_at', { ascending: false, nullsFirst: false })

      if (bookingError) throw bookingError

      const seenHotels = new Set<string>()
      const bookingRows: Array<{ hotel: string; city?: string | null; website?: string | null }> = []
      const sortedBookings = [...(bookingData || [])].sort((a, b) => {
        const aTs = Date.parse(String(a.updated_at || a.created_at || '')) || 0
        const bTs = Date.parse(String(b.updated_at || b.created_at || '')) || 0
        return bTs - aTs
      })
      for (const row of sortedBookings) {
        const hotel = String(row.hotel || '').trim()
        if (!hotel) continue
        const key = hotel.toLowerCase()
        if (seenHotels.has(key)) continue
        seenHotels.add(key)
        bookingRows.push({
          hotel,
          city: row.city,
          website: row.website,
        })
      }

      setRows(mergeTourHotelManageRows(references, bookingRows))
    } catch (error) {
      console.error('호텔 목록 조회 오류:', error)
      setRows(
        mergeTourHotelManageRows(
          initialReferences,
          initialHotelNames.map((hotel) => ({ hotel }))
        )
      )
      alert(isKo ? '호텔 목록을 불러오지 못했습니다.' : 'Failed to load hotel list.')
    } finally {
      setLoading(false)
    }
  }, [isKo, initialHotelNames, initialReferences])

  useEffect(() => {
    if (!open) return
    setRows(seedRows)
    void loadRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 모달 열릴 때만 새로고침
  }, [open])

  const resetDraft = () => {
    setDraft(emptyDraft())
    setEditingId(null)
  }

  const handleSave = async () => {
    const hotelName = draft.hotel_name.trim()
    const city = draft.city.trim()
    const website = draft.website.trim()
    if (!hotelName || !city) {
      alert(isKo ? '호텔명과 도시를 입력해 주세요.' : 'Hotel name and city are required.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        hotel_name: hotelName,
        city,
        website: website || null,
        updated_at: new Date().toISOString(),
      }
      if (editingId) {
        const { error } = await supabase
          .from('tour_hotel_references' as never)
          .update(payload as never)
          .eq('id', editingId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('tour_hotel_references' as never)
          .insert(payload as never)
        if (error) throw error
      }
      resetDraft()
      await loadRows()
      onChanged?.()
    } catch (error) {
      console.error('호텔 참조 저장 오류:', error)
      alert(isKo ? '저장에 실패했습니다.' : 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (row: TourHotelManageRow) => {
    if (row.source === 'reference' && row.id) {
      setEditingId(row.id)
      setDraft({
        id: row.id,
        hotel_name: row.hotel_name,
        city: row.city || resolveCityFromHotelNamePrefix(row.hotel_name) || '',
        website: row.website ?? '',
      })
      return
    }
    setEditingId(null)
    setDraft({
      hotel_name: row.hotel_name,
      city: row.city || resolveCityFromHotelNamePrefix(row.hotel_name) || '',
      website: row.website ?? '',
    })
  }

  const handleRegisterFromBooking = (row: TourHotelManageRow) => {
    setEditingId(null)
    setDraft({
      hotel_name: row.hotel_name,
      city: row.city || resolveCityFromHotelNamePrefix(row.hotel_name) || '',
      website: row.website ?? '',
    })
  }

  const handleDelete = async (id: string) => {
    if (!confirm(isKo ? '이 호텔을 삭제할까요?' : 'Delete this hotel?')) return
    try {
      const { error } = await supabase
        .from('tour_hotel_references' as never)
        .delete()
        .eq('id', id)
      if (error) throw error
      if (editingId === id) resetDraft()
      await loadRows()
      onChanged?.()
    } catch (error) {
      console.error('호텔 참조 삭제 오류:', error)
      alert(isKo ? '삭제에 실패했습니다.' : 'Failed to delete.')
    }
  }

  const registeredCount = rows.filter((r) => r.source === 'reference').length
  const bookingOnlyCount = rows.filter((r) => r.source === 'booking').length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" stackLevel="nested">
        <DialogHeader>
          <DialogTitle>{isKo ? '호텔명 관리' : 'Manage hotels'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {isKo
              ? '드롭다운에 보이는 호텔(부킹 기록)과 등록된 호텔을 함께 관리합니다. 부킹 기록만 있는 호텔은 도시·웹사이트를 입력해 등록할 수 있습니다.'
              : 'Manage hotels from booking history and registered references. Register booking-only hotels with city and website.'}
          </p>

          <div className="rounded-lg border border-border/60 p-4 space-y-3 bg-muted/30">
            <h3 className="text-sm font-medium">
              {editingId
                ? isKo
                  ? '호텔 수정'
                  : 'Edit hotel'
                : isKo
                  ? '새 호텔 추가'
                  : 'Add hotel'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {isKo ? '호텔명' : 'Hotel name'} *
                </label>
                <input
                  type="text"
                  value={draft.hotel_name}
                  onChange={(e) => setDraft((d) => ({ ...d, hotel_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="P Hampton Inn"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {isKo ? '도시' : 'City'} *
                </label>
                <input
                  type="text"
                  value={draft.city}
                  onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="Page"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {isKo ? '웹사이트' : 'Website'}
                </label>
                <input
                  type="text"
                  value={draft.website}
                  onChange={(e) => setDraft((d) => ({ ...d, website: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="booking.com / ..."
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {editingId ? (isKo ? '수정 저장' : 'Save changes') : isKo ? '추가' : 'Add'}
              </button>
              {editingId || draft.hotel_name ? (
                <button
                  type="button"
                  onClick={resetDraft}
                  className="px-3 py-2 rounded-md border text-sm hover:bg-gray-50"
                >
                  {isKo ? '취소' : 'Cancel'}
                </button>
              ) : null}
            </div>
          </div>

          {loading && rows.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              {isKo ? '불러오는 중…' : 'Loading…'}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {isKo ? '표시할 호텔이 없습니다.' : 'No hotels to show.'}
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {isKo
                  ? `총 ${rows.length}개 · 등록 ${registeredCount} · 부킹 기록만 ${bookingOnlyCount}`
                  : `${rows.length} total · ${registeredCount} registered · ${bookingOnlyCount} booking only`}
              </p>
              <div className="border border-border/60 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">{isKo ? '호텔명' : 'Hotel'}</th>
                      <th className="text-left px-3 py-2 font-medium">{isKo ? '도시' : 'City'}</th>
                      <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">
                        {isKo ? '웹사이트' : 'Website'}
                      </th>
                      <th className="text-left px-3 py-2 font-medium hidden md:table-cell">
                        {isKo ? '구분' : 'Source'}
                      </th>
                      <th className="w-24 px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.id ?? `booking-${row.hotel_name}`}
                        className="border-t border-border/40 hover:bg-muted/20"
                      >
                        <td className="px-3 py-2 font-medium">{row.hotel_name}</td>
                        <td className="px-3 py-2">{row.city || '—'}</td>
                        <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell truncate max-w-[12rem]">
                          {row.website || '—'}
                        </td>
                        <td className="px-3 py-2 hidden md:table-cell">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              row.source === 'reference'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {row.source === 'reference'
                              ? isKo
                                ? '등록됨'
                                : 'Registered'
                              : isKo
                                ? '부킹 기록'
                                : 'Booking only'}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-1">
                            {row.source === 'booking' ? (
                              <button
                                type="button"
                                onClick={() => handleRegisterFromBooking(row)}
                                className="px-2 py-1 rounded text-xs bg-primary/10 text-primary hover:bg-primary/20"
                              >
                                {isKo ? '등록' : 'Register'}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => handleEdit(row)}
                              className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
                              title={isKo ? '수정' : 'Edit'}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            {row.id ? (
                              <button
                                type="button"
                                onClick={() => void handleDelete(row.id!)}
                                className="p-1.5 rounded hover:bg-red-50 text-red-600"
                                title={isKo ? '삭제' : 'Delete'}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
