'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Loader2, Save, X } from 'lucide-react'
import LightRichEditor from '@/components/LightRichEditor'
import CustomerPageZoneAdminEmbed from '@/components/product/CustomerPageZoneAdminEmbed'
import ProductTagsBilingualEditor, {
  saveProductTagsWithTranslations,
  type TagTranslationState,
} from '@/components/product/ProductTagsBilingualEditor'
import CustomerPageTranslationEditor from '@/components/product/CustomerPageTranslationEditor'
import {
  buildEmptyTranslationForm,
  invalidateTranslationCache,
  loadCustomerPageTranslations,
  saveCustomerPageTranslations,
  type TranslationFormState,
} from '@/lib/customerPageTranslations'
import { supabase } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import type { CustomerPageZone } from '@/lib/customerPageZones'
import {
  getZoneEditConfig,
  BASIC_FIELD_LABELS,
  DETAIL_FIELD_LABELS,
  type BasicFieldKey,
  type DetailFieldKey,
  type ZoneEditConfig,
} from '@/lib/customerPageZoneEditMap'

type CustomerPageZoneEditPanelProps = {
  zone: CustomerPageZone
  productId?: string | null
  locale: string
  onSaved: () => void
  onNavigateToTab: (tabId: string) => void
  onClose: () => void
  variant?: 'sidebar' | 'modal'
}

type BasicFormState = Partial<Record<BasicFieldKey, string | string[]>>

function toNullIfEmpty(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') return null
  const textContent = value.replace(/<[^>]*>/g, '').trim()
  if (textContent === '') return null
  return value
}

function dbColumnForBasicField(field: BasicFieldKey): string {
  const map: Record<BasicFieldKey, string> = {
    customerNameKo: 'customer_name_ko',
    customerNameEn: 'customer_name_en',
    summaryKo: 'summary_ko',
    summaryEn: 'summary_en',
    description: 'description',
    tags: 'tags',
    departureCity: 'departure_city',
    arrivalCity: 'arrival_city',
    departureCountry: 'departure_country',
    arrivalCountry: 'arrival_country',
    departureCityKo: 'departure_city_ko',
    departureCityEn: 'departure_city_en',
    arrivalCityKo: 'arrival_city_ko',
    arrivalCityEn: 'arrival_city_en',
    departureCountryKo: 'departure_country_ko',
    departureCountryEn: 'departure_country_en',
    arrivalCountryKo: 'arrival_country_ko',
    arrivalCountryEn: 'arrival_country_en',
    duration: 'duration',
    maxParticipants: 'max_participants',
    groupSize: 'group_size',
    languages: 'languages',
    transportationMethods: 'transportation_methods',
    adultBasePrice: 'adult_base_price',
    childBasePrice: 'child_base_price',
    infantBasePrice: 'infant_base_price',
    adultAge: 'adult_age',
    childAgeMin: 'child_age_min',
    childAgeMax: 'child_age_max',
    infantAge: 'infant_age',
  }
  return map[field]
}

function productRowToBasicForm(row: Record<string, unknown>, fields: BasicFieldKey[]): BasicFormState {
  const out: BasicFormState = {}
  for (const field of fields) {
    const col = dbColumnForBasicField(field)
    const raw = row[col]
    if (field === 'tags' || field === 'languages' || field === 'transportationMethods') {
      out[field] = Array.isArray(raw) ? (raw as string[]) : []
    } else if (field === 'duration') {
      const dur = String(raw ?? '')
      const match = dur.match(/^(\d+)/)
      out[field] = match ? match[1] : dur
    } else if (field === 'groupSize') {
      out[field] = raw != null ? String(raw) : ''
    } else {
      out[field] = raw != null ? String(raw) : ''
    }
  }
  return out
}

function basicFormToDbUpdate(form: BasicFormState, fields: BasicFieldKey[]): Record<string, unknown> {
  const update: Record<string, unknown> = {}
  for (const field of fields) {
    const col = dbColumnForBasicField(field)
    const val = form[field]
    if (field === 'tags' || field === 'languages' || field === 'transportationMethods') {
      update[col] = Array.isArray(val) ? val : []
    } else if (field === 'duration') {
      update[col] = val != null && val !== '' ? `${val}:00:00` : null
    } else if (field === 'maxParticipants' || field === 'adultAge' || field === 'childAgeMin' || field === 'childAgeMax' || field === 'infantAge') {
      update[col] = val != null && val !== '' ? Number(val) : null
    } else if (field === 'adultBasePrice' || field === 'childBasePrice' || field === 'infantBasePrice') {
      update[col] = val != null && val !== '' ? Number(val) : 0
      if (field === 'adultBasePrice') {
        update.base_price = val != null && val !== '' ? Number(val) : 0
      }
    } else if (field === 'groupSize') {
      update[col] = val != null && val !== '' ? String(val) : null
    } else {
      update[col] = typeof val === 'string' && val.trim() !== '' ? val.trim() : null
    }
  }
  return update
}

const EMPTY_DETAIL_FIELDS: DetailFieldKey[] = []

function resolveDetailFieldsToLoad(
  config: ZoneEditConfig | undefined,
  pickedField: DetailFieldKey | null
): DetailFieldKey[] {
  if (!config) return EMPTY_DETAIL_FIELDS
  if (config.editType === 'field-picker') {
    return pickedField ? [pickedField] : EMPTY_DETAIL_FIELDS
  }
  if (config.editType === 'detail-fields') {
    return config.detailFields ?? EMPTY_DETAIL_FIELDS
  }
  return EMPTY_DETAIL_FIELDS
}

function needsAsyncLoad(
  config: ZoneEditConfig | undefined,
  pickedField: DetailFieldKey | null,
  productId: string | null | undefined
): boolean {
  if (!config) return false
  if (config.editType === 'admin-tab' || config.editType === 'info') return false
  if (config.editType === 'translation-fields') {
    return (config.translationFields?.length ?? 0) > 0 && !!config.translationNamespace
  }
  if (config.editType === 'tags-bilingual') return !!productId
  if (config.editType === 'field-picker' && !pickedField) return false
  if (!productId) return false
  if (config.editType === 'basic-fields') return (config.basicFields?.length ?? 0) > 0
  if (config.editType === 'detail-fields') return (config.detailFields?.length ?? 0) > 0
  if (config.editType === 'field-picker' && pickedField) return true
  return false
}

function needsProductForEditing(config: ZoneEditConfig, pickedField: DetailFieldKey | null): boolean {
  if (config.editType === 'tags-bilingual') return true
  if (config.editType === 'basic-fields' || config.editType === 'detail-fields') return true
  if (config.editType === 'field-picker' && pickedField) return true
  return config.requiresProduct === true
}

export default function CustomerPageZoneEditPanel({
  zone,
  productId,
  locale,
  onSaved,
  onNavigateToTab,
  onClose,
  variant = 'sidebar',
}: CustomerPageZoneEditPanelProps) {
  const config = useMemo(() => getZoneEditConfig(zone), [zone])
  const [loading, setLoading] = useState(() => needsAsyncLoad(getZoneEditConfig(zone), null, productId))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [basicForm, setBasicForm] = useState<BasicFormState>({})
  const [detailValues, setDetailValues] = useState<Partial<Record<DetailFieldKey, string>>>({})
  const [visibility, setVisibility] = useState<Partial<Record<DetailFieldKey, boolean>>>({})
  const [fullVisibility, setFullVisibility] = useState<Record<string, boolean>>({})
  const [pickedField, setPickedField] = useState<DetailFieldKey | null>(null)
  const [detailsRowId, setDetailsRowId] = useState<string | null>(null)
  const [tagTranslations, setTagTranslations] = useState<TagTranslationState>({})
  const [translationForm, setTranslationForm] = useState<TranslationFormState>({})

  const fieldsToLoad = useMemo(
    () => resolveDetailFieldsToLoad(config, pickedField),
    [config, pickedField]
  )

  useEffect(() => {
    setPickedField(null)
    setMessage(null)
  }, [zone])

  useEffect(() => {
    if (!config) {
      setLoading(false)
      return
    }

    if (!needsAsyncLoad(config, pickedField, productId)) {
      setLoading(false)
      return
    }

    if (config.editType === 'translation-fields' && config.translationNamespace && config.translationFields) {
      let cancelled = false
      const loadTranslations = async () => {
        setLoading(true)
        setMessage(null)
        try {
          const form = await loadCustomerPageTranslations(
            config.translationNamespace!,
            config.translationFields!
          )
          if (!cancelled) setTranslationForm(form)
        } catch (err) {
          if (!cancelled) {
            setMessage({ text: `불러오기 실패: ${String(err)}`, type: 'error' })
            setTranslationForm(buildEmptyTranslationForm(config.translationFields!))
          }
        } finally {
          if (!cancelled) setLoading(false)
        }
      }
      void loadTranslations()
      return () => {
        cancelled = true
      }
    }

    if (!productId) {
      setLoading(false)
      return
    }

    const detailFieldsToLoad = resolveDetailFieldsToLoad(config, pickedField)
    let cancelled = false

    const loadData = async () => {
      setLoading(true)
      setMessage(null)

      try {
        if (config.editType === 'basic-fields' && config.basicFields?.length) {
          const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', productId)
            .maybeSingle()
          if (error) throw error
          if (!cancelled && data) {
            setBasicForm(productRowToBasicForm(data as Record<string, unknown>, config.basicFields))
          }
        }

        if (config.editType === 'tags-bilingual') {
          const { data, error } = await supabase
            .from('products')
            .select('tags')
            .eq('id', productId)
            .maybeSingle()
          if (error) throw error
          if (!cancelled && data) {
            const tags = Array.isArray((data as { tags?: string[] }).tags)
              ? ((data as { tags: string[] }).tags ?? [])
              : []
            setBasicForm({ tags })
          }
        }

        if (
          (config.editType === 'detail-fields' || config.editType === 'field-picker') &&
          detailFieldsToLoad.length > 0
        ) {
          const { data, error } = await fromUntypedTable(supabase, 'product_details_multilingual')
            .select('*')
            .eq('product_id', productId)
            .eq('language_code', locale)
            .is('channel_id', null)
            .eq('variant_key', 'default')
            .maybeSingle()

          if (error) throw error
          if (cancelled) return

          if (data) {
            const row = data as Record<string, unknown>
            setDetailsRowId(String(row.id ?? ''))
            const vals: Partial<Record<DetailFieldKey, string>> = {}
            for (const f of detailFieldsToLoad) {
              vals[f] = row[f] != null ? String(row[f]) : ''
            }
            setDetailValues(vals)

            const visRaw = row.customer_page_visibility
            if (visRaw && typeof visRaw === 'object' && !Array.isArray(visRaw)) {
              const rawVis = visRaw as Record<string, unknown>
              const mergedVis: Record<string, boolean> = {}
              for (const [k, v] of Object.entries(rawVis)) {
                if (v === false) mergedVis[k] = false
              }
              setFullVisibility(mergedVis)
              const vis: Partial<Record<DetailFieldKey, boolean>> = {}
              for (const f of detailFieldsToLoad) {
                vis[f] = rawVis[f] !== false
              }
              setVisibility(vis)
            } else {
              setFullVisibility({})
            }
          } else {
            setDetailsRowId(null)
            const vals: Partial<Record<DetailFieldKey, string>> = {}
            for (const f of detailFieldsToLoad) vals[f] = ''
            setDetailValues(vals)
          }
        }
      } catch (err) {
        if (!cancelled) {
          setMessage({ text: `불러오기 실패: ${String(err)}`, type: 'error' })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadData()

    return () => {
      cancelled = true
    }
  }, [config, productId, locale, pickedField, zone])

  const missingProduct = config ? needsProductForEditing(config, pickedField) && !productId : false

  const activeDetailFields = fieldsToLoad

  const handleSaveTranslations = async () => {
    if (!config?.translationNamespace || !config.translationFields?.length) return
    setSaving(true)
    setMessage(null)
    try {
      await saveCustomerPageTranslations(config.translationNamespace, translationForm)
      await invalidateTranslationCache()
      setMessage({ text: '저장되었습니다.', type: 'success' })
      onSaved()
    } catch (err) {
      setMessage({ text: `저장 실패: ${String(err)}`, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveBasic = async () => {
    if (!config?.basicFields?.length || !productId) return
    setSaving(true)
    setMessage(null)
    try {
      const update = basicFormToDbUpdate(basicForm, config.basicFields)
      // 레거시 컬럼 동기화 (한국어 우선)
      if (update.departure_city_ko != null) update.departure_city = update.departure_city_ko
      if (update.arrival_city_ko != null) update.arrival_city = update.arrival_city_ko
      if (update.departure_country_ko != null) update.departure_country = update.departure_country_ko
      if (update.arrival_country_ko != null) update.arrival_country = update.arrival_country_ko
      const { error } = await supabase.from('products').update(update as never).eq('id', productId)
      if (error) throw error
      setMessage({ text: '저장되었습니다.', type: 'success' })
      onSaved()
    } catch (err) {
      setMessage({ text: `저장 실패: ${String(err)}`, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveTags = async () => {
    if (!productId) return
    const tags = (basicForm.tags as string[]) ?? []
    setSaving(true)
    setMessage(null)
    try {
      await saveProductTagsWithTranslations(productId, tags, tagTranslations)
      setMessage({ text: '저장되었습니다.', type: 'success' })
      onSaved()
    } catch (err) {
      setMessage({ text: `저장 실패: ${String(err)}`, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveDetails = async () => {
    if (activeDetailFields.length === 0 || !productId) return
    setSaving(true)
    setMessage(null)

    try {
      const patch: Record<string, unknown> = {
        product_id: productId,
        language_code: locale,
        channel_id: null,
        variant_key: 'default',
      }

      for (const f of activeDetailFields) {
        patch[f] = toNullIfEmpty(detailValues[f] ?? '')
      }

      const visPatch: Record<string, boolean> = { ...fullVisibility }
      for (const f of activeDetailFields) {
        if (visibility[f] === false) visPatch[f] = false
        else delete visPatch[f]
      }
      patch.customer_page_visibility = visPatch

      if (detailsRowId) {
        const { error } = await fromUntypedTable(supabase, 'product_details_multilingual')
          .update({ ...patch, updated_at: new Date().toISOString() })
          .eq('id', detailsRowId)
        if (error) throw error
      } else {
        const { data, error } = await fromUntypedTable(supabase, 'product_details_multilingual')
          .insert(patch)
          .select('id')
          .single()
        if (error) throw error
        setDetailsRowId(String((data as { id: string }).id))
      }

      setMessage({ text: '저장되었습니다.', type: 'success' })
      onSaved()
    } catch (err) {
      setMessage({ text: `저장 실패: ${String(err)}`, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (!config) {
    return (
      <div className="p-4 text-sm text-gray-600">
        이 영역의 편집 설정을 찾을 수 없습니다.
      </div>
    )
  }

  return (
    <div
      className={`flex flex-col min-h-0 bg-white ${
        variant === 'sidebar' ? 'h-full border-l border-gray-200' : 'h-full'
      }`}
    >
      <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-blue-50 shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{config.label}</h3>
            <p className="text-xs text-gray-500 mt-0.5">고객 페이지 영역 편집</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-white/80 hover:text-gray-600"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {config.note && <p className="text-xs text-gray-600 mt-2">{config.note}</p>}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-500">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            불러오는 중…
          </div>
        ) : (
          <>
            {missingProduct && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                이 영역을 편집하려면 상단에서 <strong>상품을 선택</strong>하세요.
              </div>
            )}

            {config.editType === 'translation-fields' && config.translationFields && (
              <CustomerPageTranslationEditor
                fields={config.translationFields}
                values={translationForm}
                onChange={setTranslationForm}
              />
            )}

            {config.editType === 'info' && (
              <InfoPanel config={config} />
            )}

            {config.editType === 'admin-tab' && config.adminTab && (
              <CustomerPageZoneAdminEmbed
                config={config}
                zone={zone}
                adminTab={config.adminTab}
                productId={productId ?? null}
                locale={locale}
                onSaved={onSaved}
                {...(onNavigateToTab ? { onOpenFullAdmin: onNavigateToTab } : {})}
              />
            )}

            {!missingProduct && config.editType === 'field-picker' && !pickedField && (
              <FieldPickerPanel
                config={config}
                onPick={(field) => {
                  setPickedField(field)
                }}
              />
            )}

            {!missingProduct && config.editType === 'field-picker' && pickedField && (
              <button
                type="button"
                onClick={() => setPickedField(null)}
                className="mb-3 text-xs text-blue-600 hover:text-blue-800"
              >
                ← 필드 목록으로
              </button>
            )}

            {config.editType === 'tags-bilingual' && !missingProduct && (
              <ProductTagsBilingualEditor
                selectedTags={(basicForm.tags as string[]) ?? []}
                onTagsChange={(tags) => setBasicForm((prev) => ({ ...prev, tags }))}
                onTranslationsChange={setTagTranslations}
              />
            )}

            {!missingProduct && config.editType === 'basic-fields' && config.basicFields && (
              <BasicFieldsForm
                fields={config.basicFields}
                form={basicForm}
                onChange={setBasicForm}
              />
            )}

            {!missingProduct &&
              (config.editType === 'detail-fields' ||
                (config.editType === 'field-picker' && pickedField)) &&
              activeDetailFields.length > 0 && (
                <DetailFieldsForm
                  fields={activeDetailFields}
                  values={detailValues}
                  visibility={visibility}
                  onChange={setDetailValues}
                  onVisibilityChange={setVisibility}
                />
              )}
          </>
        )}

        {message && (
          <div
            className={`mt-4 flex items-center gap-1.5 text-sm ${
              message.type === 'success' ? 'text-green-600' : 'text-red-600'
            }`}
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            {message.text}
          </div>
        )}
      </div>

        {!missingProduct &&
          (config.editType === 'basic-fields' ||
            config.editType === 'tags-bilingual' ||
            config.editType === 'translation-fields' ||
        config.editType === 'detail-fields' ||
        (config.editType === 'field-picker' && pickedField)) && (
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 shrink-0">
          <button
            type="button"
            disabled={saving || loading}
            onClick={() => {
              if (config.editType === 'tags-bilingual') void handleSaveTags()
              else if (config.editType === 'basic-fields') void handleSaveBasic()
              else if (config.editType === 'translation-fields') void handleSaveTranslations()
              else void handleSaveDetails()
            }}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            저장
          </button>
        </div>
      )}
    </div>
  )
}

function InfoPanel({ config }: { config: ZoneEditConfig }) {
  return (
    <div className="space-y-3">
      {config.infoLines?.map((line) => (
        <p key={line} className="text-sm text-gray-700 leading-relaxed">
          {line}
        </p>
      ))}
      {!config.infoLines?.length && (
        <p className="text-sm text-gray-600">이 영역은 코드·번역 파일에서 관리됩니다.</p>
      )}
    </div>
  )
}

function FieldPickerPanel({
  config,
  onPick,
}: {
  config: ZoneEditConfig
  onPick: (field: DetailFieldKey) => void
}) {
  const fields = config.detailFields ?? []

  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-600 mb-3">수정할 항목을 선택하세요.</p>
      {fields.map((field) => (
        <button
          key={field}
          type="button"
          onClick={() => onPick(field)}
          className="w-full text-left px-3 py-2.5 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-sm text-gray-800 transition-colors"
        >
          {DETAIL_FIELD_LABELS[field]}
        </button>
      ))}
    </div>
  )
}

function BasicFieldsForm({
  fields,
  form,
  onChange,
}: {
  fields: BasicFieldKey[]
  form: BasicFormState
  onChange: (next: BasicFormState) => void
}) {
  const setField = (key: BasicFieldKey, value: string | string[]) => {
    onChange({ ...form, [key]: value })
  }

  return (
    <div className="space-y-4">
      {fields.map((field) => {
        if (field === 'tags') return null

        const isBilingualDeparture =
          field.endsWith('Ko') ||
          field.endsWith('En') ||
          ['departureCity', 'arrivalCity', 'departureCountry', 'arrivalCountry'].includes(field)

        if (isBilingualDeparture && field.endsWith('Ko')) {
          const base = field.replace(/Ko$/, '')
          const enField = `${base}En` as BasicFieldKey
          if (!fields.includes(enField)) return null
          return (
            <div key={field} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {BASIC_FIELD_LABELS[field]}
                </label>
                <input
                  type="text"
                  value={String(form[field] ?? '')}
                  onChange={(e) => setField(field, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {BASIC_FIELD_LABELS[enField]}
                </label>
                <input
                  type="text"
                  value={String(form[enField] ?? '')}
                  onChange={(e) => setField(enField, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
          )
        }

        if (isBilingualDeparture && field.endsWith('En')) {
          return null
        }

        if (field === 'languages') {
          return (
            <div key={field}>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {BASIC_FIELD_LABELS[field]}
              </label>
              <input
                type="text"
                value={Array.isArray(form.languages) ? form.languages.join(', ') : ''}
                onChange={(e) =>
                  setField(
                    'languages',
                    e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                  )
                }
                placeholder="한국어, English"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <p className="text-[11px] text-gray-500 mt-1">쉼표로 구분</p>
            </div>
          )
        }

        if (field === 'transportationMethods') {
          return (
            <div key={field}>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {BASIC_FIELD_LABELS[field]}
              </label>
              <input
                type="text"
                value={
                  Array.isArray(form.transportationMethods)
                    ? form.transportationMethods.join(', ')
                    : ''
                }
                onChange={(e) =>
                  setField(
                    'transportationMethods',
                    e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                  )
                }
                placeholder="van, bus"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <p className="text-[11px] text-gray-500 mt-1">쉼표로 구분</p>
            </div>
          )
        }

        const inputType =
          field.includes('Price') || field.includes('Age') || field === 'maxParticipants' || field === 'duration'
            ? 'number'
            : 'text'

        return (
          <div key={field}>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              {BASIC_FIELD_LABELS[field]}
            </label>
            <input
              type={inputType}
              value={String(form[field] ?? '')}
              onChange={(e) => setField(field, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        )
      })}
    </div>
  )
}

function DetailFieldsForm({
  fields,
  values,
  visibility,
  onChange,
  onVisibilityChange,
}: {
  fields: DetailFieldKey[]
  values: Partial<Record<DetailFieldKey, string>>
  visibility: Partial<Record<DetailFieldKey, boolean>>
  onChange: (next: Partial<Record<DetailFieldKey, string>>) => void
  onVisibilityChange: (next: Partial<Record<DetailFieldKey, boolean>>) => void
}) {
  return (
    <div className="space-y-6">
      {fields.map((field) => (
        <div key={field}>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-gray-700">
              {DETAIL_FIELD_LABELS[field]}
            </label>
            <label className="flex items-center gap-1.5 text-[11px] text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={visibility[field] !== false}
                onChange={(e) =>
                  onVisibilityChange({ ...visibility, [field]: e.target.checked })
                }
                className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600"
              />
              고객 페이지 표시
            </label>
          </div>
          <LightRichEditor
            value={values[field] ?? ''}
            onChange={(v) => onChange({ ...values, [field]: v })}
            height={field.startsWith('slogan') ? 80 : 220}
            placeholder={`${DETAIL_FIELD_LABELS[field]} 내용`}
            enableResize
          />
        </div>
      ))}
    </div>
  )
}
