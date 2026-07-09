'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Save, X } from 'lucide-react'
import {
  getCatalogItem,
  HOME_SECTION_CARD_FIELD_SLOTS,
  HOME_SECTION_PRODUCT_QUERY_OPTIONS,
  normalizeHomeSectionConfig,
  type HomePageSectionEntry,
  type HomeSectionKind,
} from '@/lib/customerPageHomeSectionCatalog'
import {
  applyHomeSectionPreset,
  getHomeSectionPresetsByKind,
  getHomeSectionPresetById,
  HOME_SECTION_KIND_FILTER_OPTIONS,
  HOME_SECTION_PRESETS,
  type HomeSectionPreset,
} from '@/lib/customerPageHomeSectionPresets'
import HomeSectionPresetCard from '@/components/product/HomeSectionPresetCard'
import { ZONE_UI_PRESETS } from '@/lib/customerPageZoneUiStyle'
import { BASIC_FIELD_LABELS, type BasicFieldKey } from '@/lib/customerPageZoneEditMap'

type CustomerPageHomeSectionEditDialogProps = {
  mode: 'add' | 'edit'
  initialKind?: HomeSectionKind
  initialSection?: HomePageSectionEntry
  onClose: () => void
  onSave: (result: {
    kind: HomeSectionKind
    section?: HomePageSectionEntry | undefined
    config: HomePageSectionEntry['config']
  }) => void
}

function applyPresetToForm(preset: HomeSectionPreset) {
  const { kind, config } = applyHomeSectionPreset(preset)
  return {
    kind,
    structureVariant: config.structureVariant ?? '',
    uiPresetId: config.uiPresetId ?? 'default',
    cardCount: config.cardCount ?? 3,
    itemCount: config.itemCount ?? 3,
    productQuery: config.productQuery ?? 'favorites',
    tagFilter: config.tagFilter ?? '',
    categoryFilter: config.categoryFilter ?? '',
    title: config.title ?? '',
    cardBindings: config.cardFieldBindings ?? {},
  }
}

export default function CustomerPageHomeSectionEditDialog({
  mode,
  initialKind = 'card-list',
  initialSection,
  onClose,
  onSave,
}: CustomerPageHomeSectionEditDialogProps) {
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(
    mode === 'add' ? 'cards-popular-3' : null
  )
  const [kindFilter, setKindFilter] = useState<'all' | HomeSectionKind>('all')
  const [showAdvanced, setShowAdvanced] = useState(mode === 'edit')

  const initialForm = useMemo(() => {
    if (initialSection) {
      const c = initialSection.config
      return {
        kind: initialSection.kind,
        structureVariant: c.structureVariant ?? getCatalogItem(initialSection.kind).defaultConfig.structureVariant ?? '',
        uiPresetId: c.uiPresetId ?? 'default',
        cardCount: c.cardCount ?? 3,
        itemCount: c.itemCount ?? 3,
        productQuery: c.productQuery ?? 'favorites',
        tagFilter: c.tagFilter ?? '',
        categoryFilter: c.categoryFilter ?? '',
        title: c.title ?? '',
        cardBindings: c.cardFieldBindings ?? {},
      }
    }
    const preset =
      getHomeSectionPresetById('cards-popular-3') ??
      getHomeSectionPresetsByKind(initialKind)[0] ??
      HOME_SECTION_PRESETS[0]
    return applyPresetToForm(preset)
  }, [initialSection, initialKind])

  const [kind, setKind] = useState<HomeSectionKind>(initialForm.kind)
  const catalog = getCatalogItem(kind)

  const [structureVariant, setStructureVariant] = useState(initialForm.structureVariant)
  const [uiPresetId, setUiPresetId] = useState(initialForm.uiPresetId)
  const [cardCount, setCardCount] = useState(initialForm.cardCount)
  const [itemCount, setItemCount] = useState(initialForm.itemCount)
  const [productQuery, setProductQuery] = useState(initialForm.productQuery)
  const [tagFilter, setTagFilter] = useState(initialForm.tagFilter)
  const [categoryFilter, setCategoryFilter] = useState(initialForm.categoryFilter)
  const [title, setTitle] = useState(initialForm.title)
  const [cardBindings, setCardBindings] = useState<Partial<Record<string, BasicFieldKey>>>(initialForm.cardBindings)

  const filteredPresets = useMemo(
    () => getHomeSectionPresetsByKind(kindFilter),
    [kindFilter]
  )

  const applyPreset = (preset: HomeSectionPreset) => {
    setSelectedPresetId(preset.id)
    const form = applyPresetToForm(preset)
    setKind(form.kind)
    setStructureVariant(form.structureVariant)
    setUiPresetId(form.uiPresetId)
    setCardCount(form.cardCount)
    setItemCount(form.itemCount)
    setProductQuery(form.productQuery)
    setTagFilter(form.tagFilter)
    setCategoryFilter(form.categoryFilter)
    setTitle(form.title)
    setCardBindings(form.cardBindings)
  }

  const draftConfig = useMemo(
    () =>
      normalizeHomeSectionConfig(
        {
          structureVariant,
          uiPresetId,
          cardCount,
          itemCount,
          productQuery,
          tagFilter,
          categoryFilter,
          title,
          cardFieldBindings: cardBindings,
        },
        kind
      ),
    [
      structureVariant,
      uiPresetId,
      cardCount,
      itemCount,
      productQuery,
      tagFilter,
      categoryFilter,
      title,
      cardBindings,
      kind,
    ]
  )

  const handleSubmit = () => {
    onSave({
      kind,
      section: initialSection,
      config: draftConfig,
    })
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-violet-50 to-indigo-50 shrink-0">
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              {mode === 'add' ? '섹션 템플릿 선택' : '섹션 설정'}
            </h3>
            {mode === 'add' && (
              <p className="text-[11px] text-gray-500 mt-0.5">
                {HOME_SECTION_PRESETS.length}종 프리셋 · 레이아웃·테마·데이터가 한 번에 적용됩니다
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-white/80 text-gray-400">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {mode === 'add' && (
            <div className="p-4 border-b border-slate-100 space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {HOME_SECTION_KIND_FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setKindFilter(opt.id)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors ${
                      kindFilter === opt.id
                        ? 'bg-violet-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {opt.label}
                    {opt.id !== 'all' && (
                      <span className="ml-1 opacity-70">
                        ({getHomeSectionPresetsByKind(opt.id).length})
                      </span>
                    )}
                    {opt.id === 'all' && (
                      <span className="ml-1 opacity-70">({HOME_SECTION_PRESETS.length})</span>
                    )}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[280px] overflow-y-auto pr-1">
                {filteredPresets.map((preset) => (
                  <HomeSectionPresetCard
                    key={preset.id}
                    preset={preset}
                    selected={selectedPresetId === preset.id}
                    onSelect={() => applyPreset(preset)}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="p-4 space-y-4">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex w-full items-center justify-between text-xs font-semibold text-gray-700 py-2 px-3 rounded-lg bg-slate-50 hover:bg-slate-100"
            >
              <span>고급 설정 (레이아웃 · 테마 · 데이터)</span>
              {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showAdvanced && (
              <div className="space-y-4 pl-1">
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">레이아웃 구조</label>
                  <select
                    value={structureVariant}
                    onChange={(e) => {
                      setStructureVariant(e.target.value)
                      setSelectedPresetId(null)
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    {catalog.structureVariants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">섹션 테마</label>
                  <select
                    value={uiPresetId}
                    onChange={(e) => {
                      setUiPresetId(e.target.value)
                      setSelectedPresetId(null)
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    {ZONE_UI_PRESETS.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </div>

                {kind === 'card-list' && (
                  <>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 mb-1 block">섹션 제목 (선택)</label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => {
                          setTitle(e.target.value)
                          setSelectedPresetId(null)
                        }}
                        placeholder="비워두면 기본 번역 사용"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-700 mb-1 block">
                        표시할 카드 수 ({cardCount}개)
                      </label>
                      <input
                        type="range"
                        min={1}
                        max={12}
                        value={cardCount}
                        onChange={(e) => {
                          setCardCount(Number(e.target.value))
                          setSelectedPresetId(null)
                        }}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-700 mb-1 block">데이터 소스</label>
                      <select
                        value={productQuery}
                        onChange={(e) => {
                          setProductQuery(e.target.value as typeof productQuery)
                          setSelectedPresetId(null)
                        }}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      >
                        {HOME_SECTION_PRODUCT_QUERY_OPTIONS.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label} — {opt.description}
                          </option>
                        ))}
                      </select>
                    </div>

                    {productQuery === 'tag' && (
                      <div>
                        <label className="text-xs font-semibold text-gray-700 mb-1 block">태그 필터</label>
                        <input
                          type="text"
                          value={tagFilter}
                          onChange={(e) => setTagFilter(e.target.value)}
                          placeholder="예: 그랜드캐년"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                    )}

                    {productQuery === 'category' && (
                      <div>
                        <label className="text-xs font-semibold text-gray-700 mb-1 block">카테고리 필터</label>
                        <input
                          type="text"
                          value={categoryFilter}
                          onChange={(e) => setCategoryFilter(e.target.value)}
                          placeholder="products.category 값"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                    )}

                    <div>
                      <label className="text-xs font-semibold text-gray-700 mb-2 block">카드 필드 → DB 연결</label>
                      <div className="space-y-2">
                        {HOME_SECTION_CARD_FIELD_SLOTS.map(({ slot, label, options }) => (
                          <div key={slot} className="flex items-center gap-2">
                            <span className="text-xs text-gray-600 w-20 shrink-0">{label}</span>
                            <select
                              value={cardBindings[slot] ?? options[0]}
                              onChange={(e) => {
                                setCardBindings((prev) => ({
                                  ...prev,
                                  [slot]: e.target.value as BasicFieldKey,
                                }))
                                setSelectedPresetId(null)
                              }}
                              className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                            >
                              {options.map((field) => (
                                <option key={field} value={field}>
                                  products.{field} ({BASIC_FIELD_LABELS[field]})
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {['reviews', 'faq', 'gallery', 'logos'].includes(kind) && (
                  <>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 mb-1 block">섹션 제목 (선택)</label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => {
                          setTitle(e.target.value)
                          setSelectedPresetId(null)
                        }}
                        placeholder="비워두면 기본 번역 사용"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 mb-1 block">
                        표시 항목 수 ({itemCount}개)
                      </label>
                      <input
                        type="range"
                        min={1}
                        max={12}
                        value={itemCount}
                        onChange={(e) => {
                          setItemCount(Number(e.target.value))
                          setSelectedPresetId(null)
                        }}
                        className="w-full"
                      />
                    </div>
                  </>
                )}

                {['video', 'newsletter', 'promo', 'rich-text'].includes(kind) && (
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">섹션 제목 (선택)</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value)
                        setSelectedPresetId(null)
                      }}
                      placeholder="비워두면 기본 번역 사용"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-slate-200 bg-slate-50 shrink-0">
          {mode === 'add' && selectedPresetId && (
            <p className="text-[10px] text-violet-700 truncate max-w-[50%]">
              선택: {HOME_SECTION_PRESETS.find((p) => p.id === selectedPresetId)?.label}
            </p>
          )}
          <div className="flex justify-end gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-xs font-medium rounded-lg text-gray-600 hover:bg-gray-100"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-violet-600 text-white hover:bg-violet-700"
            >
              <Save className="h-3.5 w-3.5" />
              {mode === 'add' ? '섹션 추가' : '적용'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
