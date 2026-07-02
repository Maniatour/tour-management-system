'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, ChevronLeft, ChevronRight, MapPin, AlertTriangle, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  computeAutoGroupPreview,
  flattenAutoGroupAssignments,
  hotelHasLocation,
  type AutoGroupPreview,
} from '@/lib/pickupHotelAutoGroup'
import type { PickupHotel } from '@/utils/pickupHotelUtils'

type Step = 'count' | 'representatives' | 'preview'

interface PickupHotelAutoGroupModalProps {
  isOpen: boolean
  onClose: () => void
  hotels: PickupHotel[]
  locale: string
  onApplied: () => void
}

function formatDistance(meters: number | null, locale: string): string {
  if (meters === null || meters === 0) return ''
  if (meters < 1000) {
    return locale === 'en' ? `${meters} m` : `${meters}m`
  }
  const km = (meters / 1000).toFixed(1)
  return locale === 'en' ? `${km} km` : `${km}km`
}

export default function PickupHotelAutoGroupModal({
  isOpen,
  onClose,
  hotels,
  locale,
  onApplied,
}: PickupHotelAutoGroupModalProps) {
  const isEn = locale === 'en'
  const [step, setStep] = useState<Step>('count')
  const [spotCount, setSpotCount] = useState(7)
  const [selectedRepIds, setSelectedRepIds] = useState<string[]>([])
  const [repSearch, setRepSearch] = useState('')
  const [preview, setPreview] = useState<AutoGroupPreview | null>(null)
  const [applying, setApplying] = useState(false)
  const [onlyWithLocation, setOnlyWithLocation] = useState(true)

  const reset = () => {
    setStep('count')
    setSpotCount(7)
    setSelectedRepIds([])
    setRepSearch('')
    setPreview(null)
    setApplying(false)
    setOnlyWithLocation(true)
  }

  useEffect(() => {
    if (!isOpen) reset()
  }, [isOpen])

  const hotelsForSelection = useMemo(() => {
    let list = [...hotels]
    if (onlyWithLocation) {
      list = list.filter(hotelHasLocation)
    }
    const q = repSearch.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (h) =>
          h.hotel.toLowerCase().includes(q) ||
          (h.pick_up_location || '').toLowerCase().includes(q) ||
          (h.address || '').toLowerCase().includes(q)
      )
    }
    return list.sort((a, b) => a.hotel.localeCompare(b.hotel))
  }, [hotels, onlyWithLocation, repSearch])

  const toggleRep = (id: string) => {
    setSelectedRepIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= spotCount) return prev
      return [...prev, id]
    })
  }

  const goToPreview = () => {
    const result = computeAutoGroupPreview(hotels, selectedRepIds)
    setPreview(result)
    setStep('preview')
  }

  const handleApply = async () => {
    if (!preview) return
    const assignments = flattenAutoGroupAssignments(preview)
    if (assignments.length === 0) return

    const confirmed = window.confirm(
      isEn
        ? `Apply group numbers to ${assignments.length} hotel(s)?`
        : `${assignments.length}개 호텔의 그룹 번호를 적용하시겠습니까?`
    )
    if (!confirmed) return

    setApplying(true)
    try {
      const results = await Promise.all(
        assignments.map(({ hotelId, groupNumber }) =>
          supabase.from('pickup_hotels').update({ group_number: groupNumber } as never).eq('id', hotelId)
        )
      )
      const failed = results.find((r) => r.error)
      if (failed?.error) {
        throw failed.error
      }
      onApplied()
      onClose()
    } catch (err) {
      console.error('Auto group apply failed:', err)
      alert(
        isEn
          ? 'Failed to apply group numbers.'
          : '그룹 번호 적용에 실패했습니다.'
      )
    } finally {
      setApplying(false)
    }
  }

  if (!isOpen) return null

  const canProceedFromCount = spotCount >= 1 && spotCount <= 99
  const canProceedFromReps =
    selectedRepIds.length === spotCount &&
    selectedRepIds.every((id) => {
      const h = hotels.find((item) => item.id === id)
      return h != null && hotelHasLocation(h)
    })

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={() => !applying && onClose()}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {isEn ? 'Auto-assign Group Numbers' : '그룹 번호 자동 정렬'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {step === 'count' &&
                (isEn ? 'Step 1: Number of pickup spots' : '1단계: 픽업 장소(그룹) 개수')}
              {step === 'representatives' &&
                (isEn ? 'Step 2: Select representative hotels' : '2단계: 대표 호텔 선택')}
              {step === 'preview' &&
                (isEn ? 'Step 3: Review and apply' : '3단계: 미리보기 및 적용')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={applying}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X size={22} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {step === 'count' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                {isEn
                  ? 'How many pickup locations (groups) do you want? Each group needs one representative hotel with map coordinates.'
                  : '픽업 장소(그룹)를 몇 곳으로 나눌까요? 각 그룹마다 좌표가 있는 대표 호텔 1곳을 지정합니다.'}
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {isEn ? 'Number of groups' : '그룹(픽업 장소) 수'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={spotCount}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10)
                    if (!Number.isNaN(n)) setSpotCount(Math.min(99, Math.max(1, n)))
                  }}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {[3, 5, 7, 10, 12].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSpotCount(n)}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                      spotCount === n
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'representatives' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-gray-600">
                  {isEn
                    ? `Select ${spotCount} representative hotel(s) (${selectedRepIds.length}/${spotCount})`
                    : `대표 호텔 ${spotCount}곳을 선택하세요 (${selectedRepIds.length}/${spotCount})`}
                </p>
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={onlyWithLocation}
                    onChange={(e) => setOnlyWithLocation(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  {isEn ? 'Only with coordinates' : '좌표 있는 호텔만'}
                </label>
              </div>
              <input
                type="text"
                value={repSearch}
                onChange={(e) => setRepSearch(e.target.value)}
                placeholder={isEn ? 'Search hotels...' : '호텔 검색...'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <div className="border rounded-lg divide-y max-h-[min(50vh,420px)] overflow-y-auto">
                {hotelsForSelection.length === 0 ? (
                  <p className="p-4 text-sm text-gray-500 text-center">
                    {isEn ? 'No matching hotels.' : '일치하는 호텔이 없습니다.'}
                  </p>
                ) : (
                  hotelsForSelection.map((hotel) => {
                    const selected = selectedRepIds.includes(hotel.id)
                    const order = selected ? selectedRepIds.indexOf(hotel.id) + 1 : null
                    const hasLoc = hotelHasLocation(hotel)
                    const disabled = !selected && selectedRepIds.length >= spotCount
                    return (
                      <button
                        key={hotel.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleRep(hotel.id)}
                        className={`w-full text-left px-3 py-2.5 flex items-start gap-3 transition-colors ${
                          selected
                            ? 'bg-amber-50 hover:bg-amber-100'
                            : disabled
                              ? 'bg-gray-50 opacity-50 cursor-not-allowed'
                              : 'hover:bg-gray-50'
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs font-bold ${
                            selected
                              ? 'bg-amber-500 border-amber-500 text-white'
                              : 'border-gray-300 text-transparent'
                          }`}
                        >
                          {order ?? '·'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-gray-900 text-sm">{hotel.hotel}</span>
                            {order !== null && (
                              <span className="text-xs px-1.5 py-0.5 bg-amber-200 text-amber-900 rounded">
                                {isEn ? `Group ${order}` : `그룹 ${order}`}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate">{hotel.pick_up_location}</p>
                          {!hasLoc && (
                            <p className="text-xs text-orange-600 flex items-center gap-1 mt-0.5">
                              <AlertTriangle size={12} />
                              {isEn ? 'No coordinates' : '좌표 없음'}
                            </p>
                          )}
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
              {selectedRepIds.length === spotCount && !canProceedFromReps && (
                <p className="text-sm text-orange-600 flex items-center gap-1">
                  <AlertTriangle size={16} />
                  {isEn
                    ? 'All representatives need pin or Google Maps coordinates.'
                    : '대표 호텔은 모두 pin 좌표 또는 구글맵 링크가 필요합니다.'}
                </p>
              )}
            </div>
          )}

          {step === 'preview' && preview && (
            <div className="space-y-4">
              {preview.repsWithoutLocation.length > 0 && (
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800">
                  {isEn ? 'Representatives without location (skipped): ' : '좌표 없는 대표 (제외): '}
                  {preview.repsWithoutLocation.map((h) => h.hotel).join(', ')}
                </div>
              )}
              {preview.skippedNoLocation.length > 0 && (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
                  <p className="font-medium mb-1">
                    {isEn
                      ? `${preview.skippedNoLocation.length} hotel(s) without location (not assigned)`
                      : `좌표 없음 ${preview.skippedNoLocation.length}곳 (배정 제외)`}
                  </p>
                  <p className="text-xs text-gray-500 line-clamp-2">
                    {preview.skippedNoLocation.map((h) => h.hotel).join(', ')}
                  </p>
                </div>
              )}
              {preview.groups.map((group) => (
                <div key={group.groupIndex} className="border rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-amber-50 border-b flex items-center gap-2">
                    <MapPin size={16} className="text-amber-700 shrink-0" />
                    <span className="font-semibold text-sm text-amber-900">
                      {isEn ? `Group ${group.groupIndex}` : `그룹 ${group.groupIndex}`}
                    </span>
                    <span className="text-sm text-amber-800 truncate">
                      · {group.representative.hotel}
                    </span>
                    <span className="text-xs text-amber-700 ml-auto shrink-0">
                      {group.members.length - 1}{isEn ? ' nearby' : '곳 주변'}
                    </span>
                  </div>
                  <ul className="divide-y max-h-48 overflow-y-auto">
                    {group.members.map((m) => (
                      <li
                        key={m.hotelId}
                        className={`px-3 py-1.5 text-sm flex items-center justify-between gap-2 ${
                          m.isRepresentative ? 'bg-white font-medium' : 'bg-gray-50/50'
                        }`}
                      >
                        <span className="truncate">
                          {m.isRepresentative && (
                            <span className="text-xs text-amber-700 mr-1.5">
                              [{isEn ? 'Rep' : '대표'}]
                            </span>
                          )}
                          {m.hotelName}
                        </span>
                        <span className="text-xs text-gray-500 shrink-0 tabular-nums">
                          {m.groupNumber}
                          {m.distanceMeters != null && m.distanceMeters > 0 && (
                            <span className="text-gray-400 ml-1">
                              ({formatDistance(m.distanceMeters, locale)})
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 p-4 border-t shrink-0">
          <div>
            {step !== 'count' && (
              <button
                type="button"
                disabled={applying}
                onClick={() => {
                  if (step === 'preview') setStep('representatives')
                  else if (step === 'representatives') setStep('count')
                }}
                className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg flex items-center gap-1 disabled:opacity-50"
              >
                <ChevronLeft size={16} />
                {isEn ? 'Back' : '이전'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={applying}
              className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50"
            >
              {isEn ? 'Cancel' : '취소'}
            </button>
            {step === 'count' && (
              <button
                type="button"
                disabled={!canProceedFromCount}
                onClick={() => {
                  setSelectedRepIds([])
                  setStep('representatives')
                }}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
              >
                {isEn ? 'Next' : '다음'}
                <ChevronRight size={16} />
              </button>
            )}
            {step === 'representatives' && (
              <button
                type="button"
                disabled={!canProceedFromReps}
                onClick={goToPreview}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
              >
                {isEn ? 'Preview grouping' : '그룹화 미리보기'}
                <ChevronRight size={16} />
              </button>
            )}
            {step === 'preview' && (
              <button
                type="button"
                disabled={applying || !preview || preview.groups.length === 0}
                onClick={() => void handleApply()}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                {applying && <Loader2 size={16} className="animate-spin" />}
                {applying
                  ? isEn
                    ? 'Applying...'
                    : '적용 중...'
                  : isEn
                    ? 'Apply'
                    : '적용'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
