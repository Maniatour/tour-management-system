'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Clock, ExternalLink, Loader2, Save } from 'lucide-react'
import LightRichEditor from '@/components/LightRichEditor'
import { fetchProductDetailsForAdminEdit } from '@/lib/fetchProductDetail'
import {
  getAdminEditLocaleLabel,
  normalizeAdminEditLocale,
  type AdminEditLocale,
} from '@/lib/adminEditLocales'
import {
  getScheduleExactText,
  mergeScheduleI18n,
  type ScheduleContentI18n,
} from '@/lib/productScheduleLocales'
import {
  fetchDefaultProductDetailsCustomerPageVisibility,
  formatSupabaseError,
  upsertDefaultProductDetailsMultilingual,
} from '@/lib/productDetailsMultilingualAdmin'
import { supabase } from '@/lib/supabase'
import { useCustomerPageEditLabels } from '@/hooks/useCustomerPageEditLabels'
import { useModalEditorHeight } from '@/hooks/useModalEditorHeight'

type ScheduleItem = {
  id: string
  day_number: number
  start_time: string | null
  end_time: string | null
  duration_minutes: number | null
  show_to_customers: boolean | null
  title_ko: string | null
  title_en: string | null
  description_ko: string | null
  description_en: string | null
  location_ko: string | null
  location_en: string | null
  content_i18n?: ScheduleContentI18n | null
  order_index: number | null
}

type ScheduleForm = {
  titleDraft: string
  descriptionDraft: string
  locationDraft: string
  title_ko: string
  title_en: string
  description_ko: string
  description_en: string
  location_ko: string
  location_en: string
  content_i18n: ScheduleContentI18n
  start_time: string
  end_time: string
  duration_minutes: string
  show_to_customers: boolean
}

type CustomerPageScheduleEmbedProps = {
  productId: string
  locale?: string
  onSaved?: () => void
  onDirtyChange?: (dirty: boolean) => void
  onOpenFullAdmin?: (tabId: string) => void
}

function readPickupVisibility(row: Record<string, unknown> | null): boolean {
  const raw = row?.customer_page_visibility
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return true
  return (raw as Record<string, unknown>).pickup_drop_info !== false
}

function scheduleToForm(item: ScheduleItem, locale: AdminEditLocale): ScheduleForm {
  return {
    titleDraft: getScheduleExactText(item, 'title', locale),
    descriptionDraft: getScheduleExactText(item, 'description', locale),
    locationDraft: getScheduleExactText(item, 'location', locale),
    title_ko: item.title_ko ?? '',
    title_en: item.title_en ?? '',
    description_ko: item.description_ko ?? '',
    description_en: item.description_en ?? '',
    location_ko: item.location_ko ?? '',
    location_en: item.location_en ?? '',
    content_i18n: item.content_i18n || {},
    start_time: item.start_time ?? '',
    end_time: item.end_time ?? '',
    duration_minutes: item.duration_minutes != null ? String(item.duration_minutes) : '',
    show_to_customers: item.show_to_customers !== false,
  }
}

function getScheduleLabel(
  item: ScheduleItem,
  locale: AdminEditLocale,
  untitled: string
): string {
  const title = getScheduleExactText(item, 'title', locale)
  const time = item.start_time ? item.start_time.slice(0, 5) : ''
  return [time, title || untitled].filter(Boolean).join(' · ')
}

export default function CustomerPageScheduleEmbed({
  productId,
  locale: localeProp,
  onSaved,
  onDirtyChange,
  onOpenFullAdmin,
}: CustomerPageScheduleEmbedProps) {
  const { t, editorUiLocale, detailFieldLabel, showOnCustomerPage } =
    useCustomerPageEditLabels()
  const tf = (key: string, values?: Record<string, string | number>) =>
    values ? t(`scheduleEmbed.${key}`, values) : t(`scheduleEmbed.${key}`)
  const { height: descriptionEditorHeight, measureRef: descriptionMeasureRef } =
    useModalEditorHeight(120)
  const [editLocale, setEditLocale] = useState<AdminEditLocale>(() =>
    normalizeAdminEditLocale(localeProp ?? 'ko')
  )
  const editLocaleRef = useRef(editLocale)
  editLocaleRef.current = editLocale
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(
    null
  )
  const [rowId, setRowId] = useState<string | null>(null)
  const [pickupDropInfo, setPickupDropInfo] = useState('')
  const [pickupVisible, setPickupVisible] = useState(true)
  const [schedules, setSchedules] = useState<ScheduleItem[]>([])
  const [activeScheduleId, setActiveScheduleId] = useState<string | null>(null)
  const [scheduleForm, setScheduleForm] = useState<ScheduleForm>(() =>
    scheduleToForm(
      {
        id: '',
        day_number: 1,
        start_time: null,
        end_time: null,
        duration_minutes: null,
        show_to_customers: true,
        title_ko: null,
        title_en: null,
        description_ko: null,
        description_en: null,
        location_ko: null,
        location_en: null,
        content_i18n: {},
        order_index: null,
      },
      'ko'
    )
  )
  const [initialSnapshot, setInitialSnapshot] = useState<string | null>(null)

  const localeLabel = getAdminEditLocaleLabel(editLocale)

  const loadData = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const [details, scheduleResult] = await Promise.all([
        fetchProductDetailsForAdminEdit(productId, editLocale),
        supabase
          .from('product_schedules')
          .select(
            'id, day_number, start_time, end_time, duration_minutes, show_to_customers, title_ko, title_en, description_ko, description_en, location_ko, location_en, content_i18n, order_index'
          )
          .eq('product_id', productId)
          .order('day_number', { ascending: true })
          .order('order_index', { ascending: true })
          .order('start_time', { ascending: true }),
      ])

      if (scheduleResult.error) throw scheduleResult.error

      const { row, values } = details
      const nextSchedules = (scheduleResult.data ?? []) as unknown as ScheduleItem[]
      const first = nextSchedules[0] ?? null
      const nextPickup = String(values.pickup_drop_info ?? '')

      setRowId(row?.id ? String(row.id) : null)
      setPickupDropInfo(nextPickup)
      setPickupVisible(readPickupVisibility(values))
      setSchedules(nextSchedules)
      setActiveScheduleId(first?.id ?? null)
      const nextPickupVisible = readPickupVisibility(values)
      if (first) {
        const nextForm = scheduleToForm(first, editLocale)
        setScheduleForm(nextForm)
        setInitialSnapshot(
          JSON.stringify({
            pickup: nextPickup,
            pickupVisible: nextPickupVisible,
            scheduleId: first.id,
            schedule: nextForm,
            locale: editLocale,
          })
        )
      } else {
        setInitialSnapshot(
          JSON.stringify({
            pickup: nextPickup,
            pickupVisible: nextPickupVisible,
            scheduleId: null,
            schedule: {},
            locale: editLocale,
          })
        )
      }
    } catch (error) {
      console.error('여행 일정 로드 오류:', error)
      setMessage({ text: tf('loadError'), type: 'error' })
    } finally {
      setLoading(false)
    }
    // tf is stable enough via t; omit to avoid reload loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editLocale, productId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    const active = schedules.find((item) => item.id === activeScheduleId)
    if (!active) return
    const nextForm = scheduleToForm(active, editLocale)
    setScheduleForm(nextForm)
    setInitialSnapshot(
      JSON.stringify({
        pickup: pickupDropInfo,
        pickupVisible,
        scheduleId: active.id,
        schedule: nextForm,
        locale: editLocale,
      })
    )
  }, [activeScheduleId])

  const switchLocale = (next: AdminEditLocale) => {
    if (next === editLocaleRef.current) return
    const merged = mergeScheduleI18n(
      scheduleForm,
      editLocale,
      scheduleForm.titleDraft,
      scheduleForm.descriptionDraft,
      scheduleForm.locationDraft
    )
    const source = { ...scheduleForm, ...merged }
    setScheduleForm({
      ...scheduleForm,
      content_i18n: merged.content_i18n,
      title_ko: merged.title_ko ?? '',
      title_en: merged.title_en ?? '',
      description_ko: merged.description_ko ?? '',
      description_en: merged.description_en ?? '',
      location_ko: merged.location_ko ?? '',
      location_en: merged.location_en ?? '',
      titleDraft: getScheduleExactText(source, 'title', next),
      descriptionDraft: getScheduleExactText(source, 'description', next),
      locationDraft: getScheduleExactText(source, 'location', next),
    })
    setEditLocale(next)
  }

  useEffect(() => {
    switchLocale(normalizeAdminEditLocale(localeProp ?? 'ko'))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only localeProp
  }, [localeProp])

  useEffect(() => {
    if (!onDirtyChange || !initialSnapshot) return
    const dirty =
      JSON.stringify({
        pickup: pickupDropInfo,
        pickupVisible,
        scheduleId: activeScheduleId,
        schedule: scheduleForm,
        locale: editLocale,
      }) !== initialSnapshot
    onDirtyChange(dirty)
  }, [
    activeScheduleId,
    editLocale,
    initialSnapshot,
    onDirtyChange,
    pickupDropInfo,
    pickupVisible,
    scheduleForm,
  ])

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
        pickup_drop_info: pickupVisible,
      }

      const detailPayload = {
        pickup_drop_info: pickupDropInfo.trim() || null,
        customer_page_visibility: mergedVisibility,
      }

      const { id: savedRowId } = await upsertDefaultProductDetailsMultilingual(supabase, {
        productId,
        languageCode: editLocale,
        existingRowId: rowId,
        patch: detailPayload,
      })
      setRowId(savedRowId)

      if (activeScheduleId) {
        const merged = mergeScheduleI18n(
          scheduleForm,
          editLocale,
          scheduleForm.titleDraft,
          scheduleForm.descriptionDraft,
          scheduleForm.locationDraft
        )
        const { error: scheduleError } = await supabase
          .from('product_schedules')
          .update({
            content_i18n: merged.content_i18n,
            title_ko: merged.title_ko,
            title_en: merged.title_en,
            description_ko: merged.description_ko,
            description_en: merged.description_en,
            location_ko: merged.location_ko,
            location_en: merged.location_en,
            start_time: scheduleForm.start_time.trim() || null,
            end_time: scheduleForm.end_time.trim() || null,
            duration_minutes: scheduleForm.duration_minutes
              ? Number(scheduleForm.duration_minutes)
              : null,
            show_to_customers: scheduleForm.show_to_customers,
            updated_at: new Date().toISOString(),
          } as never)
          .eq('id', activeScheduleId)
        if (scheduleError) throw scheduleError

        const nextItem: ScheduleItem = {
          ...(schedules.find((s) => s.id === activeScheduleId) as ScheduleItem),
          content_i18n: merged.content_i18n,
          title_ko: merged.title_ko,
          title_en: merged.title_en,
          description_ko: merged.description_ko,
          description_en: merged.description_en,
          location_ko: merged.location_ko,
          location_en: merged.location_en,
          start_time: scheduleForm.start_time.trim() || null,
          end_time: scheduleForm.end_time.trim() || null,
          duration_minutes: scheduleForm.duration_minutes
            ? Number(scheduleForm.duration_minutes)
            : null,
          show_to_customers: scheduleForm.show_to_customers,
        }
        setSchedules((prev) =>
          prev.map((item) => (item.id === activeScheduleId ? nextItem : item))
        )
        setScheduleForm(scheduleToForm(nextItem, editLocale))
      }

      setInitialSnapshot(
        JSON.stringify({
          pickup: pickupDropInfo,
          pickupVisible,
          scheduleId: activeScheduleId,
          schedule: scheduleForm,
          locale: editLocale,
        })
      )
      setMessage({ text: tf('saved'), type: 'success' })
      onSaved?.()
    } catch (error) {
      console.error('여행 일정 저장 오류:', error)
      setMessage({ text: `${tf('saveError')} ${formatSupabaseError(error)}`, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {tf('loading')}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        DB: <code className="rounded bg-muted px-1">product_schedules</code> ·{' '}
        <code className="rounded bg-muted px-1">pickup_drop_info</code>
      </p>

      <div className="space-y-3 rounded-xl border border-border/60 bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold text-foreground">
              {detailFieldLabel('pickup_drop_info')}
            </h4>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{tf('pickupHint')}</p>
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={pickupVisible}
              onChange={(e) => setPickupVisible(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-ring"
            />
            {showOnCustomerPage}
          </label>
        </div>
        <LightRichEditor
          value={pickupDropInfo}
          onChange={(value) => setPickupDropInfo(value ?? '')}
          height={120}
          placeholder={tf('pickupPlaceholder')}
          enableResize
          uiLocale={editorUiLocale}
        />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          {tf('itemsCount', { count: schedules.length })}
        </p>
        {schedules.length === 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {tf('empty')}
          </div>
        ) : (
          <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-border/60 bg-muted/20 p-2">
            {schedules.map((item) => {
              const isActive = item.id === activeScheduleId
              const hidden = item.show_to_customers === false
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveScheduleId(item.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                    isActive
                      ? 'border-primary bg-primary/5'
                      : 'border-transparent bg-white hover:border-border'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-booking" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {getScheduleLabel(
                          item,
                          editLocale,
                          tf('untitled', { index: String(item.order_index ?? '') })
                        )}
                        {hidden ? (
                          <span className="ml-1.5 text-[10px] text-amber-700">
                            {tf('hidden')}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Day {item.day_number}
                        {item.duration_minutes
                          ? ` · ${tf('durationMinutes', { minutes: item.duration_minutes })}`
                          : ''}
                      </p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {activeScheduleId ? (
        <div className="space-y-3 rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <h4 className="text-sm font-semibold text-foreground">{tf('editSelected')}</h4>
          <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={scheduleForm.show_to_customers}
              onChange={(e) =>
                setScheduleForm((prev) => ({
                  ...prev,
                  show_to_customers: e.target.checked,
                }))
              }
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-ring"
            />
            {tf('showToCustomers')}
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium">{tf('startTime')}</span>
              <input
                type="time"
                value={scheduleForm.start_time?.slice(0, 5) ?? ''}
                onChange={(e) =>
                  setScheduleForm((prev) => ({ ...prev, start_time: e.target.value }))
                }
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium">{tf('endTime')}</span>
              <input
                type="time"
                value={scheduleForm.end_time?.slice(0, 5) ?? ''}
                onChange={(e) =>
                  setScheduleForm((prev) => ({ ...prev, end_time: e.target.value }))
                }
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium">{tf('duration')}</span>
              <input
                type="number"
                value={scheduleForm.duration_minutes}
                onChange={(e) =>
                  setScheduleForm((prev) => ({ ...prev, duration_minutes: e.target.value }))
                }
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-medium">{tf('title', { locale: localeLabel })}</span>
            <input
              value={scheduleForm.titleDraft}
              onChange={(e) =>
                setScheduleForm((prev) => ({ ...prev, titleDraft: e.target.value }))
              }
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium">
              {tf('location', { locale: localeLabel })}
            </span>
            <input
              value={scheduleForm.locationDraft}
              onChange={(e) =>
                setScheduleForm((prev) => ({ ...prev, locationDraft: e.target.value }))
              }
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium">
              {tf('description', { locale: localeLabel })}
            </span>
            <div ref={descriptionMeasureRef}>
              <LightRichEditor
                value={scheduleForm.descriptionDraft}
                onChange={(value) =>
                  setScheduleForm((prev) => ({
                    ...prev,
                    descriptionDraft: value ?? '',
                  }))
                }
                height={descriptionEditorHeight}
                placeholder={tf('descriptionPlaceholder')}
                enableResize
                uiLocale={editorUiLocale}
                maxHeight={1200}
              />
            </div>
          </label>
        </div>
      ) : null}

      {message ? (
        <p
          className={`text-sm ${
            message.type === 'error' ? 'text-red-600' : 'text-green-600'
          }`}
        >
          {message.text}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {tf('save')}
      </button>

      {onOpenFullAdmin ? (
        <button
          type="button"
          onClick={() => onOpenFullAdmin('schedule')}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
        >
          {tf('openFullAdmin')}
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  )
}
