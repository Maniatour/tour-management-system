'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, ExternalLink, Loader2, Save, X } from 'lucide-react'
import LightRichEditor from '@/components/LightRichEditor'
import { useCustomerPageEditLabels } from '@/hooks/useCustomerPageEditLabels'
import { useModalEditorHeight } from '@/hooks/useModalEditorHeight'
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
import { fetchProductDetailsForAdminEdit } from '@/lib/fetchProductDetail'
import type { CustomerPageZone } from '@/lib/customerPageZones'
import {
  getZoneEditConfig,
  resolveCustomerPageZone,
  type BasicFieldKey,
  type DetailFieldKey,
  type ZoneEditConfig,
} from '@/lib/customerPageZoneEditMap'
import { confirmDiscardUnsavedChanges } from '@/lib/customerPageSoftReload'
import { emitCustomerPageBindingsUpdate } from '@/lib/customerPageBindingsSync'
import { persistCustomerPageZoneBindings } from '@/lib/customerPageBindingPersistence'
import {
  buildDetailSlotValuesFromRows,
  buildSlotValuesFromRow,
  loadZoneDetailFieldBindings,
  loadZoneFieldBindings,
  readDetailBoundValue,
  resolveEditSlotsForBasicFields,
  resolveEditSlotsForDetailFields,
  saveZoneDetailFieldBindings,
  saveZoneFieldBindings,
  serializeDetailSlotEditState,
  serializeSlotEditState,
  slotValuesToDbUpdate,
  detailSlotValuesToDbUpdates,
  type BasicSlotValues,
  type DetailBindingKey,
  type DetailSlotValues,
} from '@/lib/customerPageFieldBindings'
import CustomerPageBasicFieldSlotsForm from '@/components/product/CustomerPageBasicFieldSlotsForm'
import CustomerPageDetailFieldSlotsForm from '@/components/product/CustomerPageDetailFieldSlotsForm'
import CustomerPageHomeSettingsPanel from '@/components/product/CustomerPageHomeSettingsPanel'
import AdminCouponsEmbed from '@/components/admin/AdminCouponsEmbed'
import AdminEditLocaleToggle from '@/components/admin/AdminEditLocaleToggle'
import {
  normalizeAdminEditLocale,
  zoneEditSupportsLocaleSwitch,
  type AdminEditLocale,
} from '@/lib/adminEditLocales'
import type { SiteLocale } from '@/lib/siteLocales'

type CustomerPageZoneEditPanelProps = {
  zone: CustomerPageZone
  productId?: string | null
  locale: string
  /** 콘텐츠 언어 변경 시 상단 미리보기 locale과 동기화 */
  onContentLocaleChange?: (locale: SiteLocale) => void
  onSaved: () => void
  onNavigateToTab: (tabId: string) => void
  onClose: () => void
  onDirtyChange?: (dirty: boolean) => void
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
    internalNameKo: 'name',
    internalNameEn: 'name_en',
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
  if (
    config.editType === 'admin-tab' ||
    config.editType === 'info' ||
    config.editType === 'home-settings'
  ) {
    return false
  }
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
  if (config.editType === 'home-settings') return false
  if (config.editType === 'tags-bilingual') return true
  if (config.editType === 'basic-fields' || config.editType === 'detail-fields') return true
  if (config.editType === 'field-picker' && pickedField) return true
  return config.requiresProduct === true
}

function serializeEditSnapshot(input: {
  basicForm: BasicFormState
  detailValues: Partial<Record<DetailFieldKey, string>>
  visibility: Partial<Record<DetailFieldKey, boolean>>
  translationForm: TranslationFormState
  tagTranslations: TagTranslationState
  pickedField: DetailFieldKey | null
}): string {
  return JSON.stringify(input)
}

function supportsDirtyTracking(config: ZoneEditConfig | undefined, pickedField: DetailFieldKey | null): boolean {
  if (!config) return false
  if (
    config.editType === 'admin-tab' ||
    config.editType === 'info' ||
    config.editType === 'home-settings'
  ) {
    return false
  }
  if (config.editType === 'field-picker' && !pickedField) return false
  return true
}

export default function CustomerPageZoneEditPanel({
  zone,
  productId,
  locale,
  onContentLocaleChange,
  onSaved,
  onNavigateToTab,
  onClose,
  onDirtyChange,
  variant = 'sidebar',
}: CustomerPageZoneEditPanelProps) {
  const {
    t: tEdit,
    zoneLabel: resolveZoneLabel,
    zoneNote: resolveZoneNote,
  } = useCustomerPageEditLabels()
  const resolvedZone = useMemo(() => resolveCustomerPageZone(zone), [zone])
  const config = useMemo(() => getZoneEditConfig(resolvedZone), [resolvedZone])
  const zoneLabel = resolveZoneLabel(resolvedZone, config?.label ?? resolvedZone)
  const zoneNote = resolveZoneNote(resolvedZone, config?.note)
  const basicFieldSlots = useMemo(
    () => (config?.basicFields ? resolveEditSlotsForBasicFields(config.basicFields) : []),
    [config]
  )
  const useBasicFieldSlots = config?.editType === 'basic-fields' && basicFieldSlots.length > 0
  const initialSnapshotRef = useRef<string | null>(null)
  const productRowRef = useRef<Record<string, unknown> | null>(null)
  const detailsRowRef = useRef<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(() =>
    needsAsyncLoad(getZoneEditConfig(resolveCustomerPageZone(zone)), null, productId)
  )
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
  const [slotBindings, setSlotBindings] = useState<Record<string, BasicFieldKey>>({})
  const [slotValues, setSlotValues] = useState<BasicSlotValues>({})
  const [detailSlotBindings, setDetailSlotBindings] = useState<Record<string, DetailBindingKey>>({})
  const [detailSlotValues, setDetailSlotValues] = useState<DetailSlotValues>({})
  const [editLocale, setEditLocale] = useState<AdminEditLocale>(() => normalizeAdminEditLocale(locale))

  useEffect(() => {
    setEditLocale(normalizeAdminEditLocale(locale))
  }, [locale])

  const showLocaleToggle = zoneEditSupportsLocaleSwitch(config)
  const showFaqFullAdmin =
    !!onNavigateToTab &&
    (config?.adminTab === 'detail-faq' || config?.adminTab === 'faq')

  const fieldsToLoad = useMemo(
    () => resolveDetailFieldsToLoad(config, pickedField),
    [config, pickedField]
  )
  const detailFieldSlots = useMemo(
    () => resolveEditSlotsForDetailFields(fieldsToLoad),
    [fieldsToLoad]
  )
  const useDetailFieldSlots =
    (config?.editType === 'detail-fields' ||
      (config?.editType === 'field-picker' && !!pickedField)) &&
    detailFieldSlots.length > 0

  useEffect(() => {
    setPickedField(null)
    setMessage(null)
    setEditLocale(normalizeAdminEditLocale(locale))
    initialSnapshotRef.current = null
    productRowRef.current = null
    detailsRowRef.current = null
    if (useBasicFieldSlots) {
      const bindings = loadZoneFieldBindings(zone, basicFieldSlots)
      setSlotBindings(bindings)
      setSlotValues({})
    }
    // Reset detail slots on zone change only — not when useDetailFieldSlots flips
    // after picking a field (that would clear pickedField and bounce back to the list).
    if (config?.editType === 'detail-fields' || config?.editType === 'field-picker') {
      setDetailSlotBindings({})
      setDetailSlotValues({})
    }
    onDirtyChange?.(false)
  }, [resolvedZone, zone, onDirtyChange, useBasicFieldSlots, basicFieldSlots, config?.editType])

  const captureSnapshot = () => {
    if (useBasicFieldSlots) {
      return serializeSlotEditState(slotBindings, slotValues)
    }
    if (useDetailFieldSlots) {
      return serializeDetailSlotEditState(detailSlotBindings, detailSlotValues, visibility)
    }
    if (config?.editType === 'admin-tab') {
      return JSON.stringify({})
    }
    return serializeEditSnapshot({
      basicForm,
      detailValues,
      visibility,
      translationForm,
      tagTranslations,
      pickedField,
    })
  }

  const markSnapshotSaved = () => {
    initialSnapshotRef.current = captureSnapshot()
    onDirtyChange?.(false)
  }

  useEffect(() => {
    if (loading || !supportsDirtyTracking(config, pickedField)) {
      onDirtyChange?.(false)
      return
    }
    if (initialSnapshotRef.current === null) {
      initialSnapshotRef.current = captureSnapshot()
      onDirtyChange?.(false)
      return
    }
    const dirty = captureSnapshot() !== initialSnapshotRef.current
    onDirtyChange?.(dirty)
  }, [
    basicForm,
    detailValues,
    visibility,
    translationForm,
    tagTranslations,
    pickedField,
    slotBindings,
    slotValues,
    detailSlotBindings,
    detailSlotValues,
    useBasicFieldSlots,
    useDetailFieldSlots,
    loading,
    config,
    onDirtyChange,
  ])

  const handleRequestClose = () => {
    const dirty =
      supportsDirtyTracking(config, pickedField) &&
      initialSnapshotRef.current !== null &&
      captureSnapshot() !== initialSnapshotRef.current
    if (dirty && !confirmDiscardUnsavedChanges()) return
    onClose()
  }

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
            const row = data as Record<string, unknown>
            productRowRef.current = row
            if (useBasicFieldSlots) {
              const bindings = loadZoneFieldBindings(zone, basicFieldSlots)
              setSlotBindings(bindings)
              setSlotValues(buildSlotValuesFromRow(basicFieldSlots, bindings, row))
            } else {
              setBasicForm(productRowToBasicForm(row, config.basicFields))
            }
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
          const [{ data: productData, error: productError }, details] = await Promise.all([
            supabase.from('products').select('*').eq('id', productId).maybeSingle(),
            fetchProductDetailsForAdminEdit(productId, editLocale),
          ])

          if (productError) throw productError
          if (cancelled) return

          const productRow = (productData ?? {}) as Record<string, unknown>
          productRowRef.current = productRow

          const { row, values } = details
          const vals: Partial<Record<DetailFieldKey, string>> = {}
          for (const f of detailFieldsToLoad) {
            vals[f] = values[f] != null ? String(values[f]) : ''
          }
          setDetailValues(vals)

          const visRaw = values.customer_page_visibility
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

          const slots = resolveEditSlotsForDetailFields(detailFieldsToLoad)
          const bindings = loadZoneDetailFieldBindings(zone, slots)
          setDetailSlotBindings(bindings)

          if (row) {
            detailsRowRef.current = row
            setDetailsRowId(String(row.id ?? ''))
            setDetailSlotValues(
              buildDetailSlotValuesFromRows(slots, bindings, values, productRow)
            )
          } else {
            detailsRowRef.current = {}
            setDetailsRowId(null)
            setDetailSlotValues(
              buildDetailSlotValuesFromRows(slots, bindings, values, productRow)
            )
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
  }, [config, productId, editLocale, pickedField, zone, useBasicFieldSlots, basicFieldSlots, locale])

  const handleDetailSlotBindingChange = (slotId: DetailFieldKey, binding: DetailBindingKey) => {
    const nextBindings = { ...detailSlotBindings, [slotId]: binding }
    setDetailSlotBindings(nextBindings)
    saveZoneDetailFieldBindings(zone, nextBindings)
    emitCustomerPageBindingsUpdate(zone)
    void persistCustomerPageZoneBindings(zone, { detail: nextBindings }).catch((err) => {
      console.error('Failed to persist detail field bindings:', err)
    })
    if (detailsRowRef.current && productRowRef.current) {
      setDetailSlotValues((prev) => ({
        ...prev,
        [slotId]: readDetailBoundValue(
          binding,
          detailsRowRef.current!,
          productRowRef.current!
        ),
      }))
    }
  }

  const handleDetailSlotValueChange = (slotId: DetailFieldKey, value: string) => {
    setDetailSlotValues((prev) => ({ ...prev, [slotId]: value }))
  }

  const handleSlotBindingChange = (slotId: string, field: BasicFieldKey) => {
    const nextBindings = { ...slotBindings, [slotId]: field }
    setSlotBindings(nextBindings)
    saveZoneFieldBindings(zone, nextBindings)
    emitCustomerPageBindingsUpdate(zone)
    void persistCustomerPageZoneBindings(zone, { basic: nextBindings }).catch((err) => {
      console.error('Failed to persist basic field bindings:', err)
    })
    if (productRowRef.current) {
      setSlotValues((prev) => ({
        ...prev,
        ...buildSlotValuesFromRow(basicFieldSlots, nextBindings, productRowRef.current!),
      }))
    }
  }

  const handleSlotValueChange = (slotId: string, value: string | string[]) => {
    setSlotValues((prev) => ({ ...prev, [slotId]: value }))
  }

  const missingProduct = config ? needsProductForEditing(config, pickedField) && !productId : false

  const activeDetailFields = fieldsToLoad

  const handleSaveTranslations = async () => {
    if (!config?.translationNamespace || !config.translationFields?.length) {
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      await saveCustomerPageTranslations(config.translationNamespace, translationForm)
      await invalidateTranslationCache()
      setMessage({ text: '저장되었습니다.', type: 'success' })
      markSnapshotSaved()
      onSaved()
    } catch (err) {
      setMessage({ text: `저장 실패: ${String(err)}`, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveBasic = async () => {
    if (!productId) return
    if (useBasicFieldSlots) {
      if (!basicFieldSlots.length) return
    } else if (!config?.basicFields?.length) {
      return
    }

    setSaving(true)
    setMessage(null)
    try {
      const update = useBasicFieldSlots
        ? slotValuesToDbUpdate(basicFieldSlots, slotBindings, slotValues)
        : basicFormToDbUpdate(basicForm, config!.basicFields!)
      if (!useBasicFieldSlots) {
        if (update.departure_city_ko != null) update.departure_city = update.departure_city_ko
        if (update.arrival_city_ko != null) update.arrival_city = update.arrival_city_ko
        if (update.departure_country_ko != null) update.departure_country = update.departure_country_ko
        if (update.arrival_country_ko != null) update.arrival_country = update.arrival_country_ko
      }
      const { error } = await supabase.from('products').update(update as never).eq('id', productId)
      if (error) throw error
      if (productRowRef.current) {
        productRowRef.current = { ...productRowRef.current, ...update }
      }
      setMessage({ text: '저장되었습니다.', type: 'success' })
      markSnapshotSaved()
      emitCustomerPageBindingsUpdate(zone)
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
      markSnapshotSaved()
      emitCustomerPageBindingsUpdate(zone)
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
      if (useDetailFieldSlots) {
        const { productUpdate, detailFieldUpdates } = detailSlotValuesToDbUpdates(
          detailFieldSlots,
          detailSlotBindings,
          detailSlotValues
        )

        if (Object.keys(productUpdate).length > 0) {
          const { error: productError } = await supabase
            .from('products')
            .update(productUpdate as never)
            .eq('id', productId)
          if (productError) throw productError
          if (productRowRef.current) {
            productRowRef.current = { ...productRowRef.current, ...productUpdate }
          }
        }

        const patch: Record<string, unknown> = {
          product_id: productId,
          language_code: editLocale,
          channel_id: null,
          variant_key: 'default',
        }

        for (const [field, val] of Object.entries(detailFieldUpdates) as [
          DetailFieldKey,
          string,
        ][]) {
          patch[field] = toNullIfEmpty(val)
        }

        const visPatch: Record<string, boolean> = { ...fullVisibility }
        for (const slot of detailFieldSlots) {
          const bound = detailSlotBindings[slot.slotId] ?? slot.defaultOption
          if (!bound.startsWith('product:')) {
            if (visibility[slot.slotId] === false) visPatch[slot.slotId] = false
            else delete visPatch[slot.slotId]
          }
        }
        patch.customer_page_visibility = visPatch

        if (Object.keys(detailFieldUpdates).length > 0 || Object.keys(visPatch).length > 0) {
          if (detailsRowId) {
            const { error } = await fromUntypedTable(supabase, 'product_details_multilingual')
              .update({ ...patch, updated_at: new Date().toISOString() })
              .eq('id', detailsRowId)
            if (error) throw error
          } else if (Object.keys(detailFieldUpdates).length > 0) {
            const { data, error } = await fromUntypedTable(supabase, 'product_details_multilingual')
              .insert(patch)
              .select('id')
              .single()
            if (error) throw error
            setDetailsRowId(String((data as { id: string }).id))
          }
          if (detailsRowRef.current) {
            detailsRowRef.current = { ...detailsRowRef.current, ...patch }
          }
        }

        setMessage({ text: '저장되었습니다.', type: 'success' })
        markSnapshotSaved()
        onSaved()
        return
      }

      const patch: Record<string, unknown> = {
        product_id: productId,
        language_code: editLocale,
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
      markSnapshotSaved()
      emitCustomerPageBindingsUpdate(zone)
      onSaved()
    } catch (err) {
      setMessage({ text: `저장 실패: ${String(err)}`, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const showContentSaveFooter =
    !missingProduct &&
    (config?.editType === 'basic-fields' ||
      config?.editType === 'tags-bilingual' ||
      config?.editType === 'translation-fields' ||
      config?.editType === 'detail-fields' ||
      (config?.editType === 'field-picker' && pickedField))

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
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900">{zoneLabel}</h3>
            <p className="mt-0.5 text-xs text-gray-500">{tEdit('zonePanelSubtitle')}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {showLocaleToggle ? (
              <AdminEditLocaleToggle
                value={editLocale}
                onChange={(next) => {
                  setEditLocale(next)
                  onContentLocaleChange?.(next)
                }}
                groupLabel={tEdit('editLocaleGroup')}
                koLabel={tEdit('editLocaleKo')}
                enLabel={tEdit('editLocaleEn')}
              />
            ) : null}
            {showFaqFullAdmin ? (
              <button
                type="button"
                onClick={() => onNavigateToTab('faq')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-white px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm hover:bg-muted"
                title={tEdit('faqEmbed.openFullAdmin')}
              >
                {tEdit('faqEmbed.openFullAdminShort')}
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleRequestClose}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-white/80 hover:text-gray-600"
              aria-label={tEdit('close')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        {zoneNote ? (
          <p className="text-xs text-gray-600 mt-2">{zoneNote}</p>
        ) : null}
      </div>

      <div
        data-customer-zone-edit-scroll
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4"
      >
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-500">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            {tEdit('loading')}
          </div>
        ) : (
          <>
            {missingProduct && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {tEdit.rich('needProduct', {
                  strong: (chunks) => <strong>{chunks}</strong>,
                })}
              </div>
            )}

            {config.editType === 'home-settings' && config.homeSettingsKind ? (
              <CustomerPageHomeSettingsPanel
                kind={config.homeSettingsKind}
                locale={editLocale}
                {...(config.translationNamespace ? { translationNamespace: config.translationNamespace } : {})}
                {...(config.translationFields ? { translationFields: config.translationFields } : {})}
                onSaved={onSaved}
                {...(onDirtyChange ? { onDirtyChange } : {})}
              />
            ) : null}

            {config.editType === 'translation-fields' &&
              config.translationFields && (
              <CustomerPageTranslationEditor
                fields={config.translationFields}
                values={translationForm}
                onChange={setTranslationForm}
              />
            )}

            {resolvedZone === 'detail-promo-codes' && (
              <div className="mt-6 space-y-3 border-t border-border pt-6">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">쿠폰 관리</h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    고객이 입력하는 실제 쿠폰 코드입니다. 편집·추가 시 쿠폰 모달이 열립니다.
                  </p>
                </div>
                <AdminCouponsEmbed
                  productId={productId ?? null}
                  onMutated={onSaved}
                  {...(onNavigateToTab
                    ? { onOpenFullAdmin: () => onNavigateToTab('coupons') }
                    : {})}
                />
              </div>
            )}

            {config.editType === 'info' && (
              <InfoPanel config={config} />
            )}

            {config.editType === 'admin-tab' && config.adminTab && (
              <CustomerPageZoneAdminEmbed
                config={config}
                zone={resolvedZone}
                adminTab={config.adminTab}
                productId={productId ?? null}
                locale={editLocale}
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
                className="mb-3 text-xs text-primary hover:text-primary/80"
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

            {!missingProduct && config.editType === 'basic-fields' && useBasicFieldSlots && (
              <CustomerPageBasicFieldSlotsForm
                slots={basicFieldSlots}
                bindings={slotBindings}
                values={slotValues}
                onBindingChange={handleSlotBindingChange}
                onValueChange={handleSlotValueChange}
              />
            )}

            {
              !missingProduct &&
              config.editType === 'basic-fields' &&
              !useBasicFieldSlots &&
              config.basicFields && (
              <BasicFieldsForm
                fields={config.basicFields}
                form={basicForm}
                onChange={setBasicForm}
              />
            )}

            {
              !missingProduct &&
              (config.editType === 'detail-fields' ||
                (config.editType === 'field-picker' && pickedField)) &&
              activeDetailFields.length > 0 &&
              useDetailFieldSlots && (
                <CustomerPageDetailFieldSlotsForm
                  slots={detailFieldSlots}
                  bindings={detailSlotBindings}
                  values={detailSlotValues}
                  visibility={visibility}
                  onBindingChange={handleDetailSlotBindingChange}
                  onValueChange={handleDetailSlotValueChange}
                  onVisibilityChange={setVisibility}
                />
              )}

            {
              !missingProduct &&
              (config.editType === 'detail-fields' ||
                (config.editType === 'field-picker' && pickedField)) &&
              activeDetailFields.length > 0 &&
              !useDetailFieldSlots && (
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

        {!missingProduct && showContentSaveFooter && (
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
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {tEdit('save')}
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
  const { t, detailFieldLabel } = useCustomerPageEditLabels()
  const fields = config.detailFields ?? []

  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-600 mb-3">{t('pickFieldHint')}</p>
      {fields.map((field) => (
        <button
          key={field}
          type="button"
          onClick={() => onPick(field)}
          className="w-full text-left px-3 py-2.5 rounded-lg border border-gray-200 hover:border-border hover:bg-muted/50 text-sm text-gray-800 transition-colors"
        >
          {detailFieldLabel(field)}
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
  const { basicFieldLabel, t } = useCustomerPageEditLabels()
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
                  {basicFieldLabel(field)}
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
                  {basicFieldLabel(enField)}
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
                {basicFieldLabel(field)}
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
              <p className="text-[11px] text-gray-500 mt-1">{t('commaSeparated')}</p>
            </div>
          )
        }

        if (field === 'transportationMethods') {
          return (
            <div key={field}>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {basicFieldLabel(field)}
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
              <p className="text-[11px] text-gray-500 mt-1">{t('commaSeparated')}</p>
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
              {basicFieldLabel(field)}
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
  const {
    detailFieldLabel,
    showOnCustomerPage,
    contentPlaceholder,
    editorUiLocale,
  } = useCustomerPageEditLabels()
  const singleEditor = fields.filter((f) => !f.startsWith('slogan')).length <= 1
  const { height: editorHeight, measureRef: editorMeasureRef } = useModalEditorHeight(
    singleEditor ? 120 : 360
  )

  return (
    <div className="space-y-6">
      {fields.map((field, index) => {
        const label = detailFieldLabel(field)
        const isPrimaryEditor = singleEditor && !field.startsWith('slogan')
        const isFirstEditor =
          !field.startsWith('slogan') &&
          fields.findIndex((f) => !f.startsWith('slogan')) === index
        return (
          <div key={field}>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-700">{label}</label>
              <label className="flex items-center gap-1.5 text-[11px] text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={visibility[field] !== false}
                  onChange={(e) =>
                    onVisibilityChange({ ...visibility, [field]: e.target.checked })
                  }
                  className="h-3.5 w-3.5 rounded border-gray-300 text-primary"
                />
                {showOnCustomerPage}
              </label>
            </div>
            <div ref={isPrimaryEditor || isFirstEditor ? editorMeasureRef : undefined}>
              <LightRichEditor
                value={values[field] ?? ''}
                onChange={(v) => onChange({ ...values, [field]: v })}
                height={
                  field.startsWith('slogan')
                    ? 80
                    : singleEditor
                      ? editorHeight
                      : Math.min(editorHeight, 240)
                }
                placeholder={contentPlaceholder(label)}
                enableResize
                uiLocale={editorUiLocale}
                maxHeight={1200}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
