'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Loader2, Save } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { fetchProductDetailsForAdminEdit } from '@/lib/fetchProductDetail'
import {
  fetchDefaultProductDetailsCustomerPageVisibility,
  formatSupabaseError,
  upsertDefaultProductDetailsMultilingual,
} from '@/lib/productDetailsMultilingualAdmin'
import {
  getAdminEditLocaleLabel,
  normalizeAdminEditLocale,
  type AdminEditLocale,
} from '@/lib/adminEditLocales'
import {
  readTourHighlightSloganVisibility,
  TOUR_HIGHLIGHT_SLOGAN_KEYS,
  type TourHighlightSloganKey,
} from '@/lib/tourHighlightSlogans'
import {
  buildTourHighlightItems,
  DEFAULT_TOUR_HIGHLIGHT_ICONS,
  parseTourHighlightIcons,
  parseTourHighlightLabels,
  resolveTourHighlightIconComponent,
  serializeTourHighlightIcons,
  serializeTourHighlightLabels,
  TOUR_HIGHLIGHT_ICON_OPTIONS,
  TOUR_HIGHLIGHT_ITEM_IDS,
  TOUR_HIGHLIGHT_ITEM_LABELS,
  type TourHighlightDisplayItem,
  type TourHighlightItemId,
  type TourHighlightLabelStore,
} from '@/lib/tourHighlightIcons'
import TourHighlightLanguagesEditor from '@/components/product/TourHighlightLanguagesEditor'
import TourHighlightItemLabel from '@/components/product/TourHighlightItemLabel'
import {
  formatProductDepartureArrivalHighlight,
  formatProductDuration,
  formatProductGroupSize,
  getProductCategoryLabel,
} from '@/lib/productDetailDisplay'
import { buildTourLanguageHighlightChips, mergeTourLanguageList } from '@/lib/tourHighlightLanguages'
import { resolveFileMessageLocale } from '@/lib/siteLocales'

const GROUP_SIZE_OPTIONS = [
  { id: 'private', label: 'Private (단독)' },
  { id: 'small', label: 'Small Group (소규모)' },
  { id: 'big', label: 'Big Group (대규모)' },
] as const

type CategoryOption = { value: string; label: string; id: string }
type SubCategoryOption = { value: string; label: string; categoryId: string }

type HighlightsForm = {
  durationHours: string
  groupSizes: string[]
  category: string
  subCategory: string
  departureCityKo: string
  departureCityEn: string
  arrivalCityKo: string
  arrivalCityEn: string
  languages: string[]
}

type CustomerPageDetailHighlightsEmbedProps = {
  productId: string
  locale?: string
  /** icon-grid: 상단 아이콘 줄 | checklist: slogan3~5 체크리스트 */
  mode?: 'icon-grid' | 'checklist'
  onSaved?: () => void
  onDirtyChange?: (dirty: boolean) => void
}

function stripHtmlToPlainText(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}

const HIGHLIGHT_SLOT_LABELS: Record<TourHighlightSloganKey, string> = {
  slogan3: '하이라이트 1',
  slogan4: '하이라이트 2',
  slogan5: '하이라이트 3',
}

type HighlightSloganForm = Record<TourHighlightSloganKey, string>
type HighlightSloganVisibility = Record<TourHighlightSloganKey, boolean>

function emptyHighlightSloganForm(): HighlightSloganForm {
  return { slogan3: '', slogan4: '', slogan5: '' }
}

function emptyHighlightSloganVisibility(): HighlightSloganVisibility {
  return { slogan3: true, slogan4: true, slogan5: true }
}

function parseDurationHours(raw: unknown): string {
  const text = String(raw ?? '')
  const match = text.match(/^(\d+)/)
  return match ? match[1] : text
}

function TourHighlightIconPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (next: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {TOUR_HIGHLIGHT_ICON_OPTIONS.map((option) => {
        const Icon = resolveTourHighlightIconComponent(option.key)
        const selected = value === option.key
        return (
          <button
            key={option.key}
            type="button"
            title={option.label}
            onClick={() => onChange(option.key)}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
              selected
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border/60 bg-background text-muted-foreground hover:border-primary/40 hover:bg-muted/40'
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden />
            <span className="sr-only">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function HighlightItemPreview({ items }: { items: TourHighlightDisplayItem[] }) {
  if (items.length === 0) return null
  return (
    <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        미리보기
      </p>
      <ul className="airbnb-detail-highlights mt-3">
        {items.map((item) => {
          const Icon = resolveTourHighlightIconComponent(item.iconKey)
          return (
            <li key={item.id} className="airbnb-detail-highlight-item">
              <Icon className="h-6 w-6 shrink-0 text-[#1a2b49]" strokeWidth={1.5} aria-hidden />
              <TourHighlightItemLabel item={item} />
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default function CustomerPageDetailHighlightsEmbed({
  productId,
  locale: localeProp,
  mode = 'icon-grid',
  onSaved,
  onDirtyChange,
}: CustomerPageDetailHighlightsEmbedProps) {
  const tProductDetail = useTranslations('productDetail')
  const [editLocale, setEditLocale] = useState<AdminEditLocale>(() =>
    normalizeAdminEditLocale(localeProp ?? 'ko')
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [detailRowId, setDetailRowId] = useState<string | null>(null)
  const [highlightSlogans, setHighlightSlogans] = useState<HighlightSloganForm>(emptyHighlightSloganForm)
  const [highlightVisibility, setHighlightVisibility] = useState<HighlightSloganVisibility>(
    emptyHighlightSloganVisibility
  )
  const [initialHighlightSnapshot, setInitialHighlightSnapshot] = useState<string | null>(null)
  const [highlightIcons, setHighlightIcons] = useState<Partial<Record<TourHighlightItemId, string>>>(
    {}
  )
  const [highlightLabels, setHighlightLabels] = useState<TourHighlightLabelStore>({})
  const [initialHighlightIconsSnapshot, setInitialHighlightIconsSnapshot] = useState<string | null>(
    null
  )
  const [initialHighlightLabelsSnapshot, setInitialHighlightLabelsSnapshot] = useState<string | null>(
    null
  )

  useEffect(() => {
    setEditLocale(normalizeAdminEditLocale(localeProp ?? 'ko'))
  }, [localeProp])

  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [subCategories, setSubCategories] = useState<SubCategoryOption[]>([])
  const [form, setForm] = useState<HighlightsForm>({
    durationHours: '',
    groupSizes: [],
    category: '',
    subCategory: '',
    departureCityKo: '',
    departureCityEn: '',
    arrivalCityKo: '',
    arrivalCityEn: '',
    languages: [],
  })
  const [initialForm, setInitialForm] = useState<HighlightsForm | null>(null)

  const isEnglish = resolveFileMessageLocale(editLocale) === 'en'

  const visibleHighlightItems = useMemo(() => {
    const durationLabel = form.durationHours.trim()
      ? formatProductDuration(
          form.durationHours.trim() ? `${form.durationHours.trim()}:00:00` : null,
          isEnglish
        )
      : null
    const groupSizeLabel = formatProductGroupSize(
      form.groupSizes.length > 0 ? form.groupSizes.join(',') : null,
      isEnglish
    )
    const categoryLabel = form.category.trim()
      ? getProductCategoryLabel(form.category.trim(), isEnglish)
      : null
    const locationLine =
      (isEnglish ? form.departureCityEn : form.departureCityKo).trim() ||
      form.departureCityKo.trim() ||
      form.departureCityEn.trim() ||
      'Las Vegas'

    const languageChips = buildTourLanguageHighlightChips(form.languages, editLocale)
    const departureArrivalLabel = formatProductDepartureArrivalHighlight(
      {
        departure_city_ko: form.departureCityKo,
        departure_city_en: form.departureCityEn,
        arrival_city_ko: form.arrivalCityKo,
        arrival_city_en: form.arrivalCityEn,
      },
      editLocale
    )

    return buildTourHighlightItems({
      durationLabel,
      groupSize: groupSizeLabel,
      categoryLabel,
      locationLine,
      languageChips,
      departureArrivalLabel,
      trustLicensedOperator:
        highlightLabels.trustLicensedOperator?.[editLocale]?.trim() ||
        tProductDetail('trustLicensedOperator'),
      trustSmallGroup:
        highlightLabels.trustSmallGroup?.[editLocale]?.trim() || tProductDetail('trustSmallGroup'),
      trustFreeCancellation:
        highlightLabels.trustFreeCancellation?.[editLocale]?.trim() ||
        tProductDetail('trustFreeCancellation'),
      icons: highlightIcons,
    })
  }, [form, highlightIcons, highlightLabels, isEnglish, editLocale, tProductDetail])

  const filteredSubCategories = useMemo(() => {
    const selected = categories.find((c) => c.value === form.category)
    if (!selected) return subCategories
    return subCategories.filter((sub) => sub.categoryId === selected.id)
  }, [categories, form.category, subCategories])

  const editorHighlightItems = useMemo(() => {
    if (mode !== 'icon-grid') return visibleHighlightItems

    const byId = new Map(visibleHighlightItems.map((item) => [item.id, item]))
    const ordered: TourHighlightDisplayItem[] = []

    for (const id of TOUR_HIGHLIGHT_ITEM_IDS) {
      if (id.startsWith('trust')) continue
      const existing = byId.get(id)
      if (existing) {
        ordered.push(existing)
        continue
      }
      if (id === 'languages' || id === 'departureArrival') {
        ordered.push({
          id,
          label:
            id === 'languages'
              ? '지원 언어를 선택하세요'
              : '출발·도착 도시를 입력하세요',
          iconKey: highlightIcons[id] ?? DEFAULT_TOUR_HIGHLIGHT_ICONS[id],
          ...(id === 'languages'
            ? { languageChips: buildTourLanguageHighlightChips(form.languages, editLocale) }
            : {}),
        })
      }
    }

    for (const id of TOUR_HIGHLIGHT_ITEM_IDS) {
      if (!id.startsWith('trust')) continue
      const existing = byId.get(id)
      if (existing) ordered.push(existing)
    }

    return ordered
  }, [form.languages, highlightIcons, mode, visibleHighlightItems])

  const loadData = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const [productRes, categoriesRes, subCategoriesRes, details] = await Promise.all([
          supabase.from('products').select('*').eq('id', productId).single(),
          supabase.from('product_categories').select('id, name').eq('is_active', true).order('sort_order'),
          supabase
            .from('product_sub_categories')
            .select('id, name, category_id')
            .eq('is_active', true)
            .order('sort_order'),
          fetchProductDetailsForAdminEdit(productId, editLocale),
        ])

      if (productRes.error) throw productRes.error
      if (categoriesRes.error) throw categoriesRes.error
      if (subCategoriesRes.error) throw subCategoriesRes.error

      const row = productRes.data as Record<string, unknown>
      const nextForm: HighlightsForm = {
        durationHours: parseDurationHours(row.duration),
        groupSizes: row.group_size
          ? String(row.group_size).split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        category: String(row.category ?? ''),
        subCategory: String(row.sub_category ?? ''),
        departureCityKo: String(row.departure_city_ko ?? row.departure_city ?? ''),
        departureCityEn: String(row.departure_city_en ?? ''),
        arrivalCityKo: String(row.arrival_city_ko ?? row.arrival_city ?? ''),
        arrivalCityEn: String(row.arrival_city_en ?? ''),
        languages: Array.isArray(row.languages)
          ? (row.languages as string[]).map((lang) => String(lang).trim()).filter(Boolean)
          : [],
      }
      const nextIcons = parseTourHighlightIcons(row.tour_highlight_icons)
      const nextLabels = parseTourHighlightLabels(row.tour_highlight_labels)

      setCategories(
        (categoriesRes.data ?? []).map((c: { id: string; name: string }) => ({
          id: c.id,
          value: c.name,
          label: c.name,
        }))
      )
      setSubCategories(
        (subCategoriesRes.data ?? []).map((s: { id: string; name: string; category_id: string }) => ({
          value: s.name,
          label: s.name,
          categoryId: s.category_id,
        }))
      )
      setForm(nextForm)
      setInitialForm(nextForm)
      setHighlightIcons(nextIcons)
      setInitialHighlightIconsSnapshot(JSON.stringify(nextIcons))
      setHighlightLabels(nextLabels)
      setInitialHighlightLabelsSnapshot(JSON.stringify(nextLabels))

      const nextHighlightSlogans = emptyHighlightSloganForm()
      const nextHighlightVisibility = emptyHighlightSloganVisibility()
      TOUR_HIGHLIGHT_SLOGAN_KEYS.forEach((key) => {
        nextHighlightSlogans[key] = stripHtmlToPlainText(String(details.values[key] ?? ''))
        nextHighlightVisibility[key] = readTourHighlightSloganVisibility(details.values, key)
      })
      setDetailRowId(details.row?.id ? String(details.row.id) : null)
      setHighlightSlogans(nextHighlightSlogans)
      setHighlightVisibility(nextHighlightVisibility)
      setInitialHighlightSnapshot(
        JSON.stringify({
          highlightSlogans: nextHighlightSlogans,
          highlightVisibility: nextHighlightVisibility,
        })
      )
    } catch (error) {
      console.error('하이라이트 로드 오류:', error)
      setMessage('데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [editLocale, productId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (!onDirtyChange || !initialForm) return
    const formDirty = JSON.stringify(form) !== JSON.stringify(initialForm)
    const highlightDirty =
      mode === 'checklist' &&
      initialHighlightSnapshot != null &&
      JSON.stringify({ highlightSlogans, highlightVisibility }) !== initialHighlightSnapshot
    const iconDirty =
      mode === 'icon-grid' &&
      initialHighlightIconsSnapshot != null &&
      JSON.stringify(highlightIcons) !== initialHighlightIconsSnapshot
    const labelDirty =
      mode === 'icon-grid' &&
      initialHighlightLabelsSnapshot != null &&
      JSON.stringify(highlightLabels) !== initialHighlightLabelsSnapshot
    onDirtyChange(formDirty || Boolean(highlightDirty) || Boolean(iconDirty) || Boolean(labelDirty))
  }, [
    form,
    highlightIcons,
    highlightLabels,
    highlightSlogans,
    highlightVisibility,
    initialForm,
    initialHighlightIconsSnapshot,
    initialHighlightLabelsSnapshot,
    initialHighlightSnapshot,
    mode,
    onDirtyChange,
  ])

  const toggleGroupSize = (size: string, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      groupSizes: checked
        ? [...prev.groupSizes, size]
        : prev.groupSizes.filter((item) => item !== size),
    }))
  }

  const setHighlightIcon = (itemId: TourHighlightItemId, iconKey: string) => {
    setHighlightIcons((prev) => ({ ...prev, [itemId]: iconKey }))
  }

  const setHighlightLabel = (itemId: TourHighlightItemId, value: string) => {
    setHighlightLabels((prev) => {
      const next = { ...prev }
      if (value.trim() === '') {
        if (!next[itemId]) return prev
        const locales = { ...(next[itemId] || {}) }
        delete locales[editLocale]
        if (Object.keys(locales).length === 0) {
          delete next[itemId]
        } else {
          next[itemId] = locales
        }
        return next
      }
      next[itemId] = {
        ...(next[itemId] || {}),
        [editLocale]: value,
      }
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const hours = form.durationHours.trim()
      const update: Record<string, unknown> = {
        duration: hours ? `${hours}:00:00` : null,
        group_size: form.groupSizes.length > 0 ? form.groupSizes.join(',') : null,
        sub_category: form.subCategory.trim() || null,
        departure_city_ko: form.departureCityKo.trim() || null,
        departure_city_en: form.departureCityEn.trim() || null,
        departure_city: form.departureCityKo.trim() || null,
        arrival_city_ko: form.arrivalCityKo.trim() || null,
        arrival_city_en: form.arrivalCityEn.trim() || null,
        arrival_city: form.arrivalCityKo.trim() || null,
        languages:
          form.languages.length > 0 ? mergeTourLanguageList([], form.languages) : null,
        tour_highlight_icons: serializeTourHighlightIcons(highlightIcons),
        tour_highlight_labels: serializeTourHighlightLabels(highlightLabels),
      }
      if (form.category.trim()) {
        update.category = form.category.trim()
      }

      const { error } = await supabase.from('products').update(update as never).eq('id', productId)
      if (error) throw error

      if (mode === 'checklist') {
        const existingVisibility = await fetchDefaultProductDetailsCustomerPageVisibility(
          supabase,
          productId,
          editLocale,
          detailRowId
        )
        const highlightPatch: Record<string, string | null> = {}
        const visibilityPatch: Record<string, boolean> = {}
        TOUR_HIGHLIGHT_SLOGAN_KEYS.forEach((key) => {
          highlightPatch[key] = highlightSlogans[key].trim() || null
          visibilityPatch[key] = highlightVisibility[key]
        })

        const { id: savedRowId } = await upsertDefaultProductDetailsMultilingual(supabase, {
          productId,
          languageCode: editLocale,
          existingRowId: detailRowId,
          patch: {
            ...highlightPatch,
            customer_page_visibility: {
              ...existingVisibility,
              ...visibilityPatch,
            },
          },
        })
        setDetailRowId(savedRowId)
        setInitialHighlightSnapshot(
          JSON.stringify({ highlightSlogans, highlightVisibility })
        )
      } else {
        setInitialHighlightIconsSnapshot(JSON.stringify(highlightIcons))
        setInitialHighlightLabelsSnapshot(JSON.stringify(highlightLabels))
      }

      setInitialForm(form)
      setMessage('저장되었습니다.')
      onSaved?.()
    } catch (error) {
      console.error('하이라이트 저장 오류:', error)
      setMessage(`저장 중 오류가 발생했습니다. ${formatSupabaseError(error)}`)
    } finally {
      setSaving(false)
    }
  }

  const renderItemEditor = (item: TourHighlightDisplayItem) => {
    const iconKey = highlightIcons[item.id] ?? DEFAULT_TOUR_HIGHLIGHT_ICONS[item.id]

    return (
      <div
        key={item.id}
        className="space-y-3 rounded-lg border border-border/60 bg-muted/10 p-3"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h5 className="text-sm font-medium text-foreground">
              {TOUR_HIGHLIGHT_ITEM_LABELS[item.id]}
            </h5>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {item.id === 'languages' ? (
                <TourHighlightItemLabel item={item} />
              ) : (
                item.label
              )}
            </p>
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">아이콘</p>
          <TourHighlightIconPicker
            value={iconKey}
            onChange={(next) => setHighlightIcon(item.id, next)}
          />
        </div>

        {item.id === 'duration' ? (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">소요 시간 (시간)</label>
            <input
              type="number"
              min={1}
              value={form.durationHours}
              onChange={(e) => setForm((prev) => ({ ...prev, durationHours: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="예: 18"
            />
          </div>
        ) : null}

        {item.id === 'groupSize' ? (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">그룹 규모</label>
            <div className="space-y-2 rounded-lg border border-border/60 bg-background p-3">
              {GROUP_SIZE_OPTIONS.map((option) => (
                <label key={option.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.groupSizes.includes(option.id)}
                    onChange={(e) => toggleGroupSize(option.id, e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-ring"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {item.id === 'category' ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">카테고리</label>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, category: e.target.value, subCategory: '' }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">선택</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">서브 카테고리</label>
                <select
                  value={form.subCategory}
                  onChange={(e) => setForm((prev) => ({ ...prev, subCategory: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  disabled={!form.category}
                >
                  <option value="">선택</option>
                  {filteredSubCategories.map((sub) => (
                    <option key={`${sub.categoryId}-${sub.value}`} value={sub.value}>
                      {sub.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">출발 도시 (한국어)</label>
                <input
                  type="text"
                  value={form.departureCityKo}
                  onChange={(e) => setForm((prev) => ({ ...prev, departureCityKo: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="예: 라스베이거스"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">출발 도시 (English)</label>
                <input
                  type="text"
                  value={form.departureCityEn}
                  onChange={(e) => setForm((prev) => ({ ...prev, departureCityEn: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="e.g. Las Vegas"
                />
              </div>
            </div>
          </div>
        ) : null}

        {item.id === 'languages' ? (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">지원 언어</label>
            <div className="rounded-lg border border-border/60 bg-background p-3">
              <TourHighlightLanguagesEditor
                value={form.languages}
                locale={editLocale}
                onChange={(languages) => setForm((prev) => ({ ...prev, languages }))}
              />
            </div>
          </div>
        ) : null}

        {item.id === 'departureArrival' ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">출발 도시 (한국어)</label>
                <input
                  type="text"
                  value={form.departureCityKo}
                  onChange={(e) => setForm((prev) => ({ ...prev, departureCityKo: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="예: 라스베이거스"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">출발 도시 (English)</label>
                <input
                  type="text"
                  value={form.departureCityEn}
                  onChange={(e) => setForm((prev) => ({ ...prev, departureCityEn: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="e.g. Las Vegas"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">도착 도시 (한국어)</label>
                <input
                  type="text"
                  value={form.arrivalCityKo}
                  onChange={(e) => setForm((prev) => ({ ...prev, arrivalCityKo: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="예: 그랜드캐니언"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">도착 도시 (English)</label>
                <input
                  type="text"
                  value={form.arrivalCityEn}
                  onChange={(e) => setForm((prev) => ({ ...prev, arrivalCityEn: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="e.g. Grand Canyon"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              고객 화면: 출발 도시 → 도착 도시 형식으로 표시됩니다.
            </p>
          </div>
        ) : null}

        {item.id.startsWith('trust') ? (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">표시 문구</label>
            <input
              type="text"
              value={highlightLabels[item.id]?.[editLocale] ?? ''}
              onChange={(e) => setHighlightLabel(item.id, e.target.value)}
              placeholder={tProductDetail(
                item.id as 'trustLicensedOperator' | 'trustSmallGroup' | 'trustFreeCancellation'
              )}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              비워두면 기본 문구({getAdminEditLocaleLabel(editLocale)})가 표시됩니다.
            </p>
          </div>
        ) : null}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        하이라이트 정보 불러오는 중…
      </div>
    )
  }

  if (mode === 'checklist') {
    return (
      <div className="space-y-6">
        <p className="text-xs text-muted-foreground">
          체크리스트에 표시되는 투어 하이라이트 문구(slogan3~5)를 편집합니다. 상단 아이콘 줄은 「투어
          하이라이트」 영역에서 편집하세요.
        </p>

        <div className="space-y-4 rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <div>
            <h4 className="text-sm font-semibold text-foreground">투어 하이라이트 문구</h4>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              slogan3~5 · 체크리스트에 최대 3개 표시 · {getAdminEditLocaleLabel(editLocale)}
            </p>
          </div>

          {TOUR_HIGHLIGHT_SLOGAN_KEYS.map((slotId) => (
            <div
              key={slotId}
              className="space-y-3 rounded-lg border border-border/60 bg-muted/10 p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h5 className="text-sm font-medium text-foreground">
                    {HIGHLIGHT_SLOT_LABELS[slotId]}
                  </h5>
                  <p className="text-[11px] text-muted-foreground">컬럼: {slotId}</p>
                </div>
                <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={highlightVisibility[slotId]}
                    onChange={(e) =>
                      setHighlightVisibility((prev) => ({ ...prev, [slotId]: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-ring"
                  />
                  고객 페이지 표시
                </label>
              </div>

              <textarea
                value={highlightSlogans[slotId]}
                onChange={(e) =>
                  setHighlightSlogans((prev) => ({ ...prev, [slotId]: e.target.value }))
                }
                rows={3}
                className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={`${HIGHLIGHT_SLOT_LABELS[slotId]} 문구를 입력하세요`}
              />
            </div>
          ))}

          {TOUR_HIGHLIGHT_SLOGAN_KEYS.some(
            (key) => highlightSlogans[key].trim() && highlightVisibility[key]
          ) ? (
            <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                미리보기
              </p>
              <ul className="airbnb-detail-highlight-list mt-2 space-y-2">
                {TOUR_HIGHLIGHT_SLOGAN_KEYS.map((key) => {
                  const text = highlightSlogans[key].trim()
                  if (!text || !highlightVisibility[key]) return null
                  return (
                    <li key={key} className="airbnb-detail-highlight-row flex items-start gap-2">
                      <span className="airbnb-detail-highlight-check" aria-hidden>
                        <Check className="h-4 w-4" strokeWidth={2.5} />
                      </span>
                      <span className="airbnb-detail-highlight-text text-sm">{text}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}
        </div>

        {message ? (
          <p className={`text-sm ${message.includes('오류') ? 'text-red-600' : 'text-green-600'}`}>
            {message}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          저장
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">
        고객 페이지 상단에 표시되는 아이콘 줄 항목만 편집합니다. 체크리스트 문구는 하단 「투어
        하이라이트」 체크리스트 영역에서 편집하세요.
      </p>

      {editorHighlightItems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
          현재 표시되는 하이라이트 항목이 없습니다. 소요 시간·그룹 규모·카테고리를 설정하면 여기에
          나타납니다.
        </div>
      ) : (
        <>
          <HighlightItemPreview items={visibleHighlightItems} />
          <div className="space-y-3">
            {editorHighlightItems.map((item) => renderItemEditor(item))}
          </div>
        </>
      )}

      {message ? (
        <p className={`text-sm ${message.includes('오류') ? 'text-red-600' : 'text-green-600'}`}>
          {message}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        저장
      </button>
    </div>
  )
}
