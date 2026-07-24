'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Loader2, Save } from 'lucide-react'
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
import CustomerPageTranslationEditor from '@/components/product/CustomerPageTranslationEditor'
import {
  readTourHighlightSloganVisibility,
  TOUR_HIGHLIGHT_SLOGAN_KEYS,
  type TourHighlightSloganKey,
} from '@/lib/tourHighlightSlogans'
import {
  buildEmptyTranslationForm,
  invalidateTranslationCache,
  loadCustomerPageTranslations,
  saveCustomerPageTranslations,
  type TranslationFormState,
} from '@/lib/customerPageTranslations'

const GROUP_SIZE_OPTIONS = [
  { id: 'private', label: 'Private (단독)' },
  { id: 'small', label: 'Small Group (소규모)' },
  { id: 'big', label: 'Big Group (대규모)' },
] as const

const TRUST_BADGE_FIELDS = [
  { key: 'trustLicensedOperator', label: '공식 라이선스 (BadgeCheck)' },
  { key: 'trustSmallGroup', label: '소그룹 투어 (Bus)' },
  { key: 'trustFreeCancellation', label: '무료 취소 (Shield)' },
]

type CategoryOption = { value: string; label: string; id: string }
type SubCategoryOption = { value: string; label: string; categoryId: string }

type HighlightsForm = {
  durationHours: string
  groupSizes: string[]
  category: string
  subCategory: string
  departureCityKo: string
  departureCityEn: string
}

type CustomerPageDetailHighlightsEmbedProps = {
  productId: string
  locale?: string
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

export default function CustomerPageDetailHighlightsEmbed({
  productId,
  locale: localeProp,
  onSaved,
  onDirtyChange,
}: CustomerPageDetailHighlightsEmbedProps) {
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
  })
  const [initialForm, setInitialForm] = useState<HighlightsForm | null>(null)
  const [translationForm, setTranslationForm] = useState<TranslationFormState>(
    buildEmptyTranslationForm([...TRUST_BADGE_FIELDS])
  )
  const [initialTranslationForm, setInitialTranslationForm] =
    useState<TranslationFormState | null>(null)

  const filteredSubCategories = useMemo(() => {
    const selected = categories.find((c) => c.value === form.category)
    if (!selected) return subCategories
    return subCategories.filter((sub) => sub.categoryId === selected.id)
  }, [categories, form.category, subCategories])

  const loadData = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const [productRes, categoriesRes, subCategoriesRes, translations, details] =
        await Promise.all([
        supabase.from('products').select('*').eq('id', productId).single(),
        supabase.from('product_categories').select('id, name').eq('is_active', true).order('sort_order'),
        supabase
          .from('product_sub_categories')
          .select('id, name, category_id')
          .eq('is_active', true)
          .order('sort_order'),
        loadCustomerPageTranslations('productDetail', [...TRUST_BADGE_FIELDS]),
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
      }

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
      setTranslationForm(translations)
      setInitialTranslationForm(translations)

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
    if (!onDirtyChange || !initialForm || !initialTranslationForm || !initialHighlightSnapshot) return
    const formDirty = JSON.stringify(form) !== JSON.stringify(initialForm)
    const translationDirty =
      JSON.stringify(translationForm) !== JSON.stringify(initialTranslationForm)
    const highlightDirty =
      JSON.stringify({ highlightSlogans, highlightVisibility }) !== initialHighlightSnapshot
    onDirtyChange(formDirty || translationDirty || highlightDirty)
  }, [
    form,
    highlightSlogans,
    highlightVisibility,
    initialForm,
    initialHighlightSnapshot,
    initialTranslationForm,
    onDirtyChange,
    translationForm,
  ])

  const toggleGroupSize = (size: string, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      groupSizes: checked
        ? [...prev.groupSizes, size]
        : prev.groupSizes.filter((item) => item !== size),
    }))
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
      }
      if (form.category.trim()) {
        update.category = form.category.trim()
      }

      const { error } = await supabase.from('products').update(update as never).eq('id', productId)
      if (error) throw error

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

      await saveCustomerPageTranslations('productDetail', translationForm)
      await invalidateTranslationCache()

      setInitialForm(form)
      setInitialTranslationForm(translationForm)
      setInitialHighlightSnapshot(
        JSON.stringify({ highlightSlogans, highlightVisibility })
      )
      setMessage('저장되었습니다.')
      onSaved?.()
    } catch (error) {
      console.error('하이라이트 저장 오류:', error)
      setMessage(`저장 중 오류가 발생했습니다. ${formatSupabaseError(error)}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        하이라이트 정보 불러오는 중…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">
        고객 페이지 상단 아이콘 줄·하이라이트 체크리스트·신뢰 배지 문구를 편집합니다.
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

      <div className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
        <h4 className="text-sm font-semibold text-foreground">상품 정보 (DB)</h4>

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
          <p className="mt-1 text-[11px] text-muted-foreground">
            고객 화면: 18시간 / 18hrs · 48시간 이상 1박2일 / 1 night 2 days
          </p>
        </div>

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
          <p className="mt-1 text-[11px] text-muted-foreground">
            고객 화면: Small Group · Private Tour Available
          </p>
        </div>

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
        <p className="text-[11px] text-muted-foreground">
          고객 화면: Tour · Las Vegas (카테고리 · 출발 도시)
        </p>

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

      <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
        <h4 className="text-sm font-semibold text-foreground">신뢰 배지 문구</h4>
        <p className="text-[11px] text-muted-foreground">
          아이콘 옆 고정 문구입니다. 사이트 번역(productDetail)에 저장됩니다.
        </p>
        <CustomerPageTranslationEditor
          fields={TRUST_BADGE_FIELDS}
          values={translationForm}
          onChange={setTranslationForm}
        />
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
