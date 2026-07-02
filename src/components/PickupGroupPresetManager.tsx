'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X, Plus, Save, Trash2, RefreshCw, Loader2, Search, ChevronUp, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  fetchPickupGroupPresetWithReps,
  inferRepresentativesFromHotels,
  presetDisplayName,
  type PickupGroupPresetRow,
} from '@/lib/pickupGroupPreset'
import type { PickupHotel } from '@/utils/pickupHotelUtils'

interface PickupGroupPresetManagerProps {
  isOpen: boolean
  onClose: () => void
  hotels: PickupHotel[]
  locale: string
  onChanged: () => void
}

type DraftPreset = {
  id?: string
  name_ko: string
  name_en: string
  group_count: number
  sort_order: number
  representatives: Record<number, string | null>
}

function SearchableHotelSelect({
  hotels,
  value,
  onChange,
  placeholder,
  noResultsLabel,
  clearTitle,
}: {
  hotels: PickupHotel[]
  value: string | null
  onChange: (id: string | null) => void
  placeholder: string
  noResultsLabel: string
  clearTitle: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  const selectedHotel = useMemo(
    () => hotels.find((h) => h.id === value) ?? null,
    [hotels, value]
  )

  const filteredHotels = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return hotels
    return hotels.filter(
      (h) =>
        h.hotel.toLowerCase().includes(q) ||
        (h.pick_up_location || '').toLowerCase().includes(q) ||
        (h.address || '').toLowerCase().includes(q)
    )
  }, [hotels, search])

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0">
      <div className="relative">
        <Search
          size={14}
          className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        />
        <input
          type="text"
          value={open ? search : selectedHotel?.hotel ?? ''}
          onChange={(e) => {
            setSearch(e.target.value)
            setOpen(true)
          }}
          onFocus={() => {
            setSearch(selectedHotel?.hotel ?? '')
            setOpen(true)
          }}
          placeholder={placeholder}
          className="w-full pl-7 pr-8 py-1.5 border rounded-md text-sm"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange(null)
              setSearch('')
              setOpen(false)
            }}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 rounded"
            title={clearTitle}
          >
            <X size={14} />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-52 overflow-y-auto">
          {filteredHotels.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-500 text-center">{noResultsLabel}</p>
          ) : (
            filteredHotels.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => {
                  onChange(h.id)
                  setSearch('')
                  setOpen(false)
                }}
                className={`w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 ${
                  value === h.id ? 'bg-blue-50/80' : ''
                }`}
              >
                <div className="text-sm font-medium text-gray-900 truncate">{h.hotel}</div>
                {(h.pick_up_location || h.address) && (
                  <div className="text-xs text-gray-500 truncate">
                    {[h.pick_up_location, h.address].filter(Boolean).join(' · ')}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default function PickupGroupPresetManager({
  isOpen,
  onClose,
  hotels,
  locale,
  onChanged,
}: PickupGroupPresetManagerProps) {
  const isEn = locale === 'en'
  const [presets, setPresets] = useState<PickupGroupPresetRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<DraftPreset | null>(null)

  const loadPresets = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('pickup_group_presets')
        .select('id, name_ko, name_en, group_count, sort_order, is_active')
        .order('sort_order', { ascending: true })
        .order('name_ko', { ascending: true })
      if (error) throw error
      setPresets((data ?? []) as PickupGroupPresetRow[])
    } catch (e) {
      console.error(e)
      alert(isEn ? 'Failed to load presets.' : '프리셋 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [isEn])

  useEffect(() => {
    if (isOpen) void loadPresets()
  }, [isOpen, loadPresets])

  const openEdit = async (preset: PickupGroupPresetRow) => {
    const full = await fetchPickupGroupPresetWithReps(supabase, preset.id)
    const representatives: Record<number, string | null> = {}
    for (let i = 1; i <= preset.group_count; i++) {
      representatives[i] =
        full?.representatives.find((r) => r.group_index === i)?.representative_hotel_id ?? null
    }
    setEditing({
      id: preset.id,
      name_ko: preset.name_ko,
      name_en: preset.name_en ?? '',
      group_count: preset.group_count,
      sort_order: preset.sort_order,
      representatives,
    })
  }

  const openNew = () => {
    const inferred = inferRepresentativesFromHotels(8, hotels)
    setEditing({
      name_ko: '',
      name_en: '',
      group_count: 8,
      sort_order: (presets[presets.length - 1]?.sort_order ?? 0) + 10,
      representatives: inferred,
    })
  }

  const resizeRepresentatives = (count: number) => {
    if (!editing) return
    const next: Record<number, string | null> = {}
    for (let i = 1; i <= count; i++) {
      next[i] = editing.representatives[i] ?? null
    }
    setEditing({ ...editing, group_count: count, representatives: next })
  }

  const fillFromCurrentHotels = () => {
    if (!editing) return
    const inferred = inferRepresentativesFromHotels(editing.group_count, hotels)
    setEditing({ ...editing, representatives: inferred })
  }

  const swapGroupRepresentatives = (a: number, b: number) => {
    if (!editing || a < 1 || b < 1 || a > editing.group_count || b > editing.group_count) return
    const representatives = { ...editing.representatives }
    const temp = representatives[a] ?? null
    representatives[a] = representatives[b] ?? null
    representatives[b] = temp
    setEditing({ ...editing, representatives })
  }

  const saveEditing = async () => {
    if (!editing || !editing.name_ko.trim()) {
      alert(isEn ? 'Korean name is required.' : '한국어 이름을 입력해 주세요.')
      return
    }
    setSaving(true)
    try {
      let presetId = editing.id
      if (presetId) {
        const { error } = await supabase
          .from('pickup_group_presets')
          .update({
            name_ko: editing.name_ko.trim(),
            name_en: editing.name_en.trim() || null,
            group_count: editing.group_count,
            sort_order: editing.sort_order,
          } as never)
          .eq('id', presetId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('pickup_group_presets')
          .insert({
            name_ko: editing.name_ko.trim(),
            name_en: editing.name_en.trim() || null,
            group_count: editing.group_count,
            sort_order: editing.sort_order,
            is_active: true,
          } as never)
          .select('id')
          .single()
        if (error) throw error
        presetId = (data as { id: string }).id
      }

      await supabase
        .from('pickup_group_preset_representatives')
        .delete()
        .eq('preset_id', presetId!)

      const rows = Object.entries(editing.representatives)
        .filter(([, hotelId]) => hotelId)
        .map(([groupIndex, hotelId]) => ({
          preset_id: presetId!,
          group_index: Number(groupIndex),
          representative_hotel_id: hotelId,
        }))

      if (rows.length > 0) {
        const { error: repError } = await supabase
          .from('pickup_group_preset_representatives')
          .insert(rows as never)
        if (repError) throw repError
      }

      setEditing(null)
      await loadPresets()
      onChanged()
    } catch (e) {
      console.error(e)
      alert(isEn ? 'Failed to save preset.' : '프리셋 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const deletePreset = async (id: string) => {
    if (!window.confirm(isEn ? 'Delete this preset?' : '이 프리셋을 삭제할까요?')) return
    try {
      const { error } = await supabase.from('pickup_group_presets').delete().eq('id', id)
      if (error) throw error
      await loadPresets()
      onChanged()
    } catch (e) {
      console.error(e)
      alert(isEn ? 'Failed to delete.' : '삭제에 실패했습니다.')
    }
  }

  if (!isOpen) return null

  const selectableHotels = hotels
    .filter((h) => h.is_active !== false)
    .sort((a, b) => a.hotel.localeCompare(b.hotel))

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={() => !saving && onClose()}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <h2 className="text-lg font-semibold">
            {isEn ? 'Pickup Group Presets' : '픽업 그룹 프리셋'}
          </h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={22} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {editing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    {isEn ? 'Name (KO)' : '이름 (한국어)'}
                  </label>
                  <input
                    value={editing.name_ko}
                    onChange={(e) => setEditing({ ...editing, name_ko: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    {isEn ? 'Name (EN)' : '이름 (영어)'}
                  </label>
                  <input
                    value={editing.name_en}
                    onChange={(e) => setEditing({ ...editing, name_en: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    {isEn ? 'Group count' : '그룹(픽업 장소) 수'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={editing.group_count}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10)
                      if (!Number.isNaN(n)) resizeRepresentatives(Math.min(99, Math.max(1, n)))
                    }}
                    className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    {isEn ? 'Sort order' : '정렬 순서'}
                  </label>
                  <input
                    type="number"
                    value={editing.sort_order}
                    onChange={(e) =>
                      setEditing({ ...editing, sort_order: parseInt(e.target.value, 10) || 0 })
                    }
                    className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-gray-800">
                  {isEn ? 'Representative hotels per group' : '그룹별 대표 호텔'}
                </p>
                <button
                  type="button"
                  onClick={fillFromCurrentHotels}
                  className="text-xs px-2 py-1 border rounded-md hover:bg-gray-50 flex items-center gap-1"
                >
                  <RefreshCw size={14} />
                  {isEn ? 'Fill from current groups' : '현재 그룹에서 채우기'}
                </button>
              </div>

              <div className="border rounded-lg divide-y max-h-[min(45vh,360px)] overflow-y-auto">
                {Array.from({ length: editing.group_count }, (_, i) => i + 1).map((groupIndex) => (
                  <div
                    key={groupIndex}
                    className="px-3 py-2 flex items-center gap-2 sm:gap-3"
                  >
                    <div className="flex flex-col shrink-0">
                      <button
                        type="button"
                        disabled={groupIndex === 1}
                        onClick={() => swapGroupRepresentatives(groupIndex, groupIndex - 1)}
                        className="p-0.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded disabled:opacity-30 disabled:pointer-events-none"
                        title={isEn ? 'Move up' : '위로'}
                      >
                        <ChevronUp size={16} />
                      </button>
                      <button
                        type="button"
                        disabled={groupIndex === editing.group_count}
                        onClick={() => swapGroupRepresentatives(groupIndex, groupIndex + 1)}
                        className="p-0.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded disabled:opacity-30 disabled:pointer-events-none"
                        title={isEn ? 'Move down' : '아래로'}
                      >
                        <ChevronDown size={16} />
                      </button>
                    </div>
                    <span className="text-sm font-semibold text-gray-700 w-14 shrink-0">
                      {isEn ? `Group ${groupIndex}` : `그룹 ${groupIndex}`}
                    </span>
                    <SearchableHotelSelect
                      hotels={selectableHotels}
                      value={editing.representatives[groupIndex] ?? null}
                      onChange={(hotelId) =>
                        setEditing({
                          ...editing,
                          representatives: {
                            ...editing.representatives,
                            [groupIndex]: hotelId,
                          },
                        })
                      }
                      placeholder={isEn ? 'Search hotel...' : '호텔 검색...'}
                      noResultsLabel={isEn ? 'No hotels found' : '검색 결과 없음'}
                      clearTitle={isEn ? 'Clear selection' : '선택 해제'}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : loading ? (
            <div className="py-12 text-center text-gray-500">
              <Loader2 className="animate-spin mx-auto mb-2" />
              Loading...
            </div>
          ) : (
            <div className="space-y-2">
              {presets.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 p-3 border rounded-lg hover:bg-gray-50"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">{presetDisplayName(p, locale)}</p>
                    <p className="text-xs text-gray-500">
                      {p.group_count} {isEn ? 'groups' : '개 그룹'} · sort {p.sort_order}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => void openEdit(p)}
                      className="px-2 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
                    >
                      {isEn ? 'Edit' : '수정'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void deletePreset(p.id)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                      title={isEn ? 'Delete' : '삭제'}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {presets.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-8">
                  {isEn ? 'No presets yet.' : '등록된 프리셋이 없습니다.'}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between gap-2 p-4 border-t shrink-0">
          <div>
            {!editing && (
              <button
                type="button"
                onClick={openNew}
                className="px-3 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-1"
              >
                <Plus size={16} />
                {isEn ? 'New preset' : '프리셋 추가'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {editing ? (
              <>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-gray-200 rounded-lg"
                >
                  {isEn ? 'Back' : '목록'}
                </button>
                <button
                  type="button"
                  onClick={() => void saveEditing()}
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg flex items-center gap-1 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {isEn ? 'Save' : '저장'}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm bg-gray-200 rounded-lg"
              >
                {isEn ? 'Close' : '닫기'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
