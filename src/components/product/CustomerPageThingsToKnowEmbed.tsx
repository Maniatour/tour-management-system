'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import LightRichEditor from '@/components/LightRichEditor'
import ReusableDetailFieldPicker from '@/components/product/ReusableDetailFieldPicker'
import { fetchProductDetailsForAdminEdit } from '@/lib/fetchProductDetail'
import type { DetailFieldKey } from '@/lib/customerPageZoneEditMap'
import { useCustomerPageEditLabels } from '@/hooks/useCustomerPageEditLabels'
import { useModalEditorHeight } from '@/hooks/useModalEditorHeight'
import {
  getAdminEditLocaleLabel,
  normalizeAdminEditLocale,
  type AdminEditLocale,
} from '@/lib/adminEditLocales'
import {
  buildProductTranslationMap,
  fetchProductFieldTranslations,
  upsertProductFieldTranslations,
} from '@/lib/productFieldTranslations'
import {
  fetchDefaultProductDetailsCustomerPageVisibility,
  formatSupabaseError,
  upsertDefaultProductDetailsMultilingual,
} from '@/lib/productDetailsMultilingualAdmin'
import { isLegacyColumnLocale } from '@/lib/siteLocales'
import { supabase } from '@/lib/supabase'
import {
  detailContentLegacyColumns,
  fetchProductDetailContentLinks,
  isReusableDetailKind,
  linksToLibraryIdMap,
  mergeDetailContentI18n,
  upsertProductDetailContentLink,
  REUSABLE_DETAIL_KINDS,
  type ReusableDetailKind,
} from '@/lib/reusableContentLibrary'

type SectionId = 'basic' | 'included' | 'logistics' | 'policy'

const SECTION_IDS: SectionId[] = ['basic', 'included', 'logistics', 'policy']

const DETAIL_FIELDS_BY_SECTION: Record<Exclude<SectionId, 'basic'>, DetailFieldKey[]> = {
  included: ['included', 'not_included'],
  logistics: [
    'pickup_drop_info',
    'luggage_info',
    'tour_operation_info',
    'preparation_info',
    'small_group_info',
    'companion_recruitment_info',
    'notice_info',
  ],
  policy: [
    'important_notes',
    'private_tour_info',
    'cancellation_policy',
    'chat_announcement',
  ],
}

const GROUP_SIZE_OPTIONS = [
  { id: 'private', label: 'Private (단독)' },
  { id: 'small', label: 'Small Group (소규모)' },
  { id: 'big', label: 'Big Group (대규모)' },
] as const

type BasicForm = {
  sub_category: string
  max_participants: string
  group_size: string[]
  languages: string
  departure_city: string
  arrival_city: string
  departure_country: string
  arrival_country: string
  adult_age: string
  child_age_min: string
  child_age_max: string
  infant_age: string
  tags: string
}

type CustomerPageThingsToKnowEmbedProps = {
  productId: string
  locale?: string
  onSaved?: () => void
  onDirtyChange?: (dirty: boolean) => void
}

function readVisibility(
  row: Record<string, unknown> | null,
  key: DetailFieldKey
): boolean {
  const raw = row?.customer_page_visibility
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return true
  return (raw as Record<string, unknown>)[key] !== false
}

function emptyDetailForm(keys: DetailFieldKey[]): Partial<Record<DetailFieldKey, string>> {
  return Object.fromEntries(keys.map((key) => [key, ''])) as Partial<
    Record<DetailFieldKey, string>
  >
}

export default function CustomerPageThingsToKnowEmbed({
  productId,
  locale: localeProp,
  onSaved,
  onDirtyChange,
}: CustomerPageThingsToKnowEmbedProps) {
  const {
    t,
    detailFieldLabel,
    showOnCustomerPage,
    columnLabel,
    contentPlaceholder,
    editorUiLocale,
  } = useCustomerPageEditLabels()
  const { height: editorHeight, measureRef: editorMeasureRef } = useModalEditorHeight(120)
  const sectionLabel = (id: SectionId) => {
    switch (id) {
      case 'basic':
        return t('thingsToKnow.sectionBasic')
      case 'included':
        return t('thingsToKnow.sectionIncluded')
      case 'logistics':
        return t('thingsToKnow.sectionLogistics')
      case 'policy':
        return t('thingsToKnow.sectionPolicy')
    }
  }
  const [editLocale, setEditLocale] = useState<AdminEditLocale>(() =>
    normalizeAdminEditLocale(localeProp ?? 'ko')
  )

  useEffect(() => {
    setEditLocale(normalizeAdminEditLocale(localeProp ?? 'ko'))
  }, [localeProp])
  const [activeSection, setActiveSection] = useState<SectionId>('basic')
  const [activeDetailField, setActiveDetailField] = useState<DetailFieldKey>('included')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [rowId, setRowId] = useState<string | null>(null)
  const [basicForm, setBasicForm] = useState<BasicForm>({
    sub_category: '',
    max_participants: '',
    group_size: [],
    languages: '',
    departure_city: '',
    arrival_city: '',
    departure_country: '',
    arrival_country: '',
    adult_age: '',
    child_age_min: '',
    child_age_max: '',
    infant_age: '',
    tags: '',
  })
  const [detailForm, setDetailForm] = useState<Partial<Record<DetailFieldKey, string>>>({})
  const [visibility, setVisibility] = useState<Partial<Record<DetailFieldKey, boolean>>>({})
  const [detailLibraryIds, setDetailLibraryIds] = useState<
    Partial<Record<ReusableDetailKind, string | null>>
  >({})
  const [initialSnapshot, setInitialSnapshot] = useState<string | null>(null)

  const sectionDetailFields = useMemo(() => {
    if (activeSection === 'basic') return []
    return DETAIL_FIELDS_BY_SECTION[activeSection]
  }, [activeSection])

  useEffect(() => {
    if (activeSection !== 'basic' && sectionDetailFields.length > 0) {
      setActiveDetailField(sectionDetailFields[0])
    }
  }, [activeSection, sectionDetailFields])

  const loadData = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const [details, productResult, translationRows, contentLinks] = await Promise.all([
        fetchProductDetailsForAdminEdit(productId, editLocale),
        supabase.from('products').select('*').eq('id', productId).maybeSingle(),
        fetchProductFieldTranslations(productId),
        fetchProductDetailContentLinks(supabase as never, productId).catch(() => []),
      ])

      if (productResult.error) throw productResult.error

      const { row, values } = details
      const libraryMap = linksToLibraryIdMap(contentLinks)
      setDetailLibraryIds(libraryMap)
      const productRow = (productResult.data ?? {}) as Record<string, unknown>
      const locationMap = buildProductTranslationMap(productRow, translationRows)
      const allDetailKeys = [
        ...DETAIL_FIELDS_BY_SECTION.included,
        ...DETAIL_FIELDS_BY_SECTION.logistics,
        ...DETAIL_FIELDS_BY_SECTION.policy,
      ]

      const nextDetailForm = emptyDetailForm(allDetailKeys)
      const nextVisibility: Partial<Record<DetailFieldKey, boolean>> = {}
      allDetailKeys.forEach((key) => {
        nextDetailForm[key] = String(values[key] ?? '')
        nextVisibility[key] = readVisibility(values, key)
      })

      const tags = Array.isArray(values.tags)
        ? (values.tags as string[]).join(', ')
        : Array.isArray(productRow.tags)
          ? (productRow.tags as string[]).join(', ')
          : ''

      const pickLocation = (field: keyof typeof locationMap) =>
        locationMap[field]?.[editLocale] ||
        locationMap[field]?.en ||
        locationMap[field]?.ko ||
        ''

      const nextBasic: BasicForm = {
        sub_category: String(productRow.sub_category ?? ''),
        max_participants: String(productRow.max_participants ?? ''),
        group_size: productRow.group_size
          ? String(productRow.group_size).split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        languages: Array.isArray(productRow.languages)
          ? (productRow.languages as string[]).join(', ')
          : '',
        departure_city: pickLocation('departure_city'),
        arrival_city: pickLocation('arrival_city'),
        departure_country: pickLocation('departure_country'),
        arrival_country: pickLocation('arrival_country'),
        adult_age: String(productRow.adult_age ?? ''),
        child_age_min: String(productRow.child_age_min ?? ''),
        child_age_max: String(productRow.child_age_max ?? ''),
        infant_age: String(productRow.infant_age ?? ''),
        tags,
      }

      setRowId(row?.id ? String(row.id) : null)
      setBasicForm(nextBasic)
      setDetailForm(nextDetailForm)
      setVisibility(nextVisibility)
      setInitialSnapshot(
        JSON.stringify({
          basic: nextBasic,
          detail: nextDetailForm,
          visibility: nextVisibility,
          library: libraryMap,
          locale: editLocale,
        })
      )
    } catch (error) {
      console.error('알아두실 사항 로드 오류:', error)
      setMessage(t('thingsToKnow.loadError'))
    } finally {
      setLoading(false)
    }
  }, [editLocale, productId, t])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (!onDirtyChange || !initialSnapshot) return
    const dirty =
      JSON.stringify({
        basic: basicForm,
        detail: detailForm,
        visibility,
        library: detailLibraryIds,
        locale: editLocale,
      }) !== initialSnapshot
    onDirtyChange(dirty)
  }, [basicForm, detailForm, detailLibraryIds, editLocale, initialSnapshot, onDirtyChange, visibility])

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const existingVisibility = await fetchDefaultProductDetailsCustomerPageVisibility(
        supabase,
        productId,
        editLocale,
        rowId
      )

      const mergedVisibility = {
        ...existingVisibility,
        ...visibility,
      }

      const allDetailKeys = [
        ...DETAIL_FIELDS_BY_SECTION.included,
        ...DETAIL_FIELDS_BY_SECTION.logistics,
        ...DETAIL_FIELDS_BY_SECTION.policy,
      ]

      const detailPayload: Record<string, unknown> = {
        customer_page_visibility: mergedVisibility,
      }
      allDetailKeys.forEach((key) => {
        detailPayload[key] = detailForm[key]?.trim() || null
      })

      const tagList = basicForm.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
      detailPayload.tags = tagList

      const { id: savedRowId } = await upsertDefaultProductDetailsMultilingual(supabase, {
        productId,
        languageCode: editLocale,
        existingRowId: rowId,
        patch: detailPayload,
      })
      setRowId(savedRowId)

      // Persist reusable detail library links (+ update linked snippet body for this locale)
      for (const kind of REUSABLE_DETAIL_KINDS) {
        const libraryId = detailLibraryIds[kind] ?? null
        await upsertProductDetailContentLink(supabase as never, productId, kind, libraryId)
        if (libraryId) {
          const body = (detailForm[kind] ?? '').trim()
          const { data: existing } = await supabase
            .from('detail_content_library')
            .select('body, body_en, content_i18n')
            .eq('id', libraryId)
            .maybeSingle()
          const existingRow = (existing || {}) as {
            body?: string | null
            body_en?: string | null
            content_i18n?: { body?: Partial<Record<string, string>> } | null
          }
          const content_i18n = mergeDetailContentI18n(
            existingRow.content_i18n as never,
            editLocale,
            body
          )
          const legacy = detailContentLegacyColumns(editLocale, body, existingRow)
          await supabase
            .from('detail_content_library')
            .update({
              ...legacy,
              content_i18n,
              updated_at: new Date().toISOString(),
            } as never)
            .eq('id', libraryId)
        }
      }

      const locationLegacyPatch = await upsertProductFieldTranslations({
        productId,
        locale: editLocale,
        values: {
          departure_city: basicForm.departure_city,
          arrival_city: basicForm.arrival_city,
          departure_country: basicForm.departure_country,
          arrival_country: basicForm.arrival_country,
        },
      })

      const productUpdate: Record<string, unknown> = {
        sub_category: basicForm.sub_category.trim() || null,
        max_participants: basicForm.max_participants
          ? Number(basicForm.max_participants)
          : null,
        group_size:
          basicForm.group_size.length > 0 ? basicForm.group_size.join(',') : null,
        languages: basicForm.languages
          .split(',')
          .map((lang) => lang.trim())
          .filter(Boolean),
        ...locationLegacyPatch,
        adult_age: basicForm.adult_age ? Number(basicForm.adult_age) : null,
        child_age_min: basicForm.child_age_min ? Number(basicForm.child_age_min) : null,
        child_age_max: basicForm.child_age_max ? Number(basicForm.child_age_max) : null,
        infant_age: basicForm.infant_age ? Number(basicForm.infant_age) : null,
        tags: tagList,
      }
      if (isLegacyColumnLocale(editLocale)) {
        if (editLocale === 'ko') {
          productUpdate.departure_city_ko = basicForm.departure_city.trim() || null
          productUpdate.arrival_city_ko = basicForm.arrival_city.trim() || null
          productUpdate.departure_country_ko = basicForm.departure_country.trim() || null
          productUpdate.arrival_country_ko = basicForm.arrival_country.trim() || null
        } else {
          productUpdate.departure_city_en = basicForm.departure_city.trim() || null
          productUpdate.arrival_city_en = basicForm.arrival_city.trim() || null
          productUpdate.departure_country_en = basicForm.departure_country.trim() || null
          productUpdate.arrival_country_en = basicForm.arrival_country.trim() || null
        }
      }

      const { error: productError } = await supabase
        .from('products')
        .update(productUpdate as never)
        .eq('id', productId)
      if (productError) throw productError

      setInitialSnapshot(
        JSON.stringify({
          basic: basicForm,
          detail: detailForm,
          visibility,
          locale: editLocale,
        })
      )
      setMessage(t('thingsToKnow.saved'))
      onSaved?.()
    } catch (error) {
      console.error('알아두실 사항 저장 오류:', error)
      setMessage(`${t('thingsToKnow.saveError')} ${formatSupabaseError(error)}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('thingsToKnow.loading')}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        DB: <code className="rounded bg-muted px-1">product_details_multilingual</code> ·{' '}
        <code className="rounded bg-muted px-1">products</code>
      </p>

      <div className="flex flex-wrap gap-1.5 rounded-lg border border-border/60 bg-muted/30 p-1">
        {SECTION_IDS.map((sectionId) => (
          <button
            key={sectionId}
            type="button"
            onClick={() => setActiveSection(sectionId)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeSection === sectionId
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-white hover:text-foreground'
            }`}
          >
            {sectionLabel(sectionId)}
          </button>
        ))}
      </div>

      {activeSection === 'basic' ? (
        <div className="space-y-3 rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <h4 className="text-sm font-semibold text-foreground">기본 정보 (products)</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 sm:col-span-2">
              <span className="text-xs font-medium">서브 카테고리 (sub_category)</span>
              <input
                value={basicForm.sub_category}
                onChange={(e) =>
                  setBasicForm((prev) => ({ ...prev, sub_category: e.target.value }))
                }
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium">최대 인원 (max_participants)</span>
              <input
                type="number"
                value={basicForm.max_participants}
                onChange={(e) =>
                  setBasicForm((prev) => ({ ...prev, max_participants: e.target.value }))
                }
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1 sm:col-span-2">
              <span className="text-xs font-medium">그룹 규모 (group_size)</span>
              <div className="flex flex-wrap gap-2">
                {GROUP_SIZE_OPTIONS.map((option) => (
                  <label
                    key={option.id}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={basicForm.group_size.includes(option.id)}
                      onChange={(e) => {
                        setBasicForm((prev) => ({
                          ...prev,
                          group_size: e.target.checked
                            ? [...prev.group_size, option.id]
                            : prev.group_size.filter((id) => id !== option.id),
                        }))
                      }}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </label>
            <label className="block space-y-1 sm:col-span-2">
              <span className="text-xs font-medium">지원 언어 (languages, 쉼표 구분)</span>
              <input
                value={basicForm.languages}
                onChange={(e) =>
                  setBasicForm((prev) => ({ ...prev, languages: e.target.value }))
                }
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                placeholder="ko, en, ja"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium">
                출발 도시 ({getAdminEditLocaleLabel(editLocale)})
              </span>
              <input
                value={basicForm.departure_city}
                onChange={(e) =>
                  setBasicForm((prev) => ({ ...prev, departure_city: e.target.value }))
                }
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium">
                도착 도시 ({getAdminEditLocaleLabel(editLocale)})
              </span>
              <input
                value={basicForm.arrival_city}
                onChange={(e) =>
                  setBasicForm((prev) => ({ ...prev, arrival_city: e.target.value }))
                }
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium">
                출발 국가 ({getAdminEditLocaleLabel(editLocale)})
              </span>
              <input
                value={basicForm.departure_country}
                onChange={(e) =>
                  setBasicForm((prev) => ({ ...prev, departure_country: e.target.value }))
                }
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium">
                도착 국가 ({getAdminEditLocaleLabel(editLocale)})
              </span>
              <input
                value={basicForm.arrival_country}
                onChange={(e) =>
                  setBasicForm((prev) => ({ ...prev, arrival_country: e.target.value }))
                }
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium">성인 연령 (adult_age)</span>
              <input
                type="number"
                value={basicForm.adult_age}
                onChange={(e) =>
                  setBasicForm((prev) => ({ ...prev, adult_age: e.target.value }))
                }
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium">아동 연령 최소</span>
              <input
                type="number"
                value={basicForm.child_age_min}
                onChange={(e) =>
                  setBasicForm((prev) => ({ ...prev, child_age_min: e.target.value }))
                }
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium">아동 연령 최대</span>
              <input
                type="number"
                value={basicForm.child_age_max}
                onChange={(e) =>
                  setBasicForm((prev) => ({ ...prev, child_age_max: e.target.value }))
                }
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium">유아 연령 (infant_age)</span>
              <input
                type="number"
                value={basicForm.infant_age}
                onChange={(e) =>
                  setBasicForm((prev) => ({ ...prev, infant_age: e.target.value }))
                }
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1 sm:col-span-2">
              <span className="text-xs font-medium">태그 (쉼표 구분)</span>
              <input
                value={basicForm.tags}
                onChange={(e) => setBasicForm((prev) => ({ ...prev, tags: e.target.value }))}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {t('thingsToKnow.highlightsHint')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {sectionDetailFields.map((field) => (
              <button
                key={field}
                type="button"
                onClick={() => setActiveDetailField(field)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  activeDetailField === field
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {detailFieldLabel(field)}
              </button>
            ))}
          </div>

          <div className="space-y-3 rounded-xl border border-border/60 bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-foreground">
                  {detailFieldLabel(activeDetailField)}
                </h4>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {columnLabel(activeDetailField)}
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={visibility[activeDetailField] !== false}
                  onChange={(e) =>
                    setVisibility((prev) => ({
                      ...prev,
                      [activeDetailField]: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-ring"
                />
                {showOnCustomerPage}
              </label>
            </div>

            <div ref={editorMeasureRef}>
              {isReusableDetailKind(activeDetailField) ? (
                <ReusableDetailFieldPicker
                  productId={productId}
                  kind={activeDetailField}
                  locale={editLocale}
                  value={detailForm[activeDetailField] ?? ''}
                  onChange={(value) =>
                    setDetailForm((prev) => ({ ...prev, [activeDetailField]: value }))
                  }
                  libraryId={detailLibraryIds[activeDetailField] ?? null}
                  onLibraryIdChange={(id) =>
                    setDetailLibraryIds((prev) => ({
                      ...prev,
                      [activeDetailField as ReusableDetailKind]: id,
                    }))
                  }
                  editorHeight={editorHeight}
                  placeholder={contentPlaceholder(detailFieldLabel(activeDetailField))}
                  uiLocale={editorUiLocale}
                />
              ) : (
                <LightRichEditor
                  value={detailForm[activeDetailField] ?? ''}
                  onChange={(value) =>
                    setDetailForm((prev) => ({ ...prev, [activeDetailField]: value }))
                  }
                  height={editorHeight}
                  placeholder={contentPlaceholder(detailFieldLabel(activeDetailField))}
                  enableResize
                  uiLocale={editorUiLocale}
                  maxHeight={1200}
                />
              )}
            </div>
          </div>
        </div>
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
        {t('thingsToKnow.save')}
      </button>
    </div>
  )
}
