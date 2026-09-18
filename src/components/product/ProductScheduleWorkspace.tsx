'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, Loader2, Plus, Save } from 'lucide-react'
import LightRichEditor from '@/components/LightRichEditor'
import ScheduleItemEditModal, {
  type ProductScheduleAdminRow,
  type ScheduleItemSavePayload,
} from '@/components/product/ScheduleItemEditModal'
import TourScheduleCustomerItineraryView, {
  type CustomerScheduleItem,
} from '@/components/product/TourScheduleCustomerItineraryView'
import { Button } from '@/components/ui/button'
import { useCustomerPageEditLabels } from '@/hooks/useCustomerPageEditLabels'
import { fetchProductDetailsForAdminEdit } from '@/lib/fetchProductDetail'
import {
  normalizeAdminEditLocale,
  type AdminEditLocale,
} from '@/lib/adminEditLocales'
import {
  fetchDefaultProductDetailsCustomerPageVisibility,
  formatSupabaseError,
  upsertDefaultProductDetailsMultilingual,
} from '@/lib/productDetailsMultilingualAdmin'
import { supabase } from '@/lib/supabase'

type ProductScheduleWorkspaceProps = {
  productId: string
  isNewProduct?: boolean
  locale?: string
  compact?: boolean
  showPickup?: boolean
  onSaved?: () => void
  onDirtyChange?: (dirty: boolean) => void
}

function readPickupVisibility(row: Record<string, unknown> | null): boolean {
  const raw = row?.customer_page_visibility
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return true
  return (raw as Record<string, unknown>).pickup_drop_info !== false
}

function timeToMinutes(time: string | null): number | null {
  if (!time) return null
  const [hours, minutes] = time.split(':').map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null
  return hours * 60 + minutes
}

function minutesToTime(total: number): string {
  const normalized = ((Math.round(total) % 1440) + 1440) % 1440
  const hours = Math.floor(normalized / 60)
  const minutes = normalized % 60
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

function buildNewItem(productId: string, rows: ProductScheduleAdminRow[]): ProductScheduleAdminRow {
  const last = rows[rows.length - 1] ?? null
  const dayNumber = last?.day_number ?? 1
  const lastEnd = last?.end_time ?? null
  const sameDay = rows.filter((row) => row.day_number === dayNumber)
  const maxOrder = sameDay.length > 0 ? Math.max(...sameDay.map((row) => row.order_index || 0)) : 0
  const start = lastEnd
  const end = start ? minutesToTime((timeToMinutes(start) ?? 0) + 60) : null

  return {
    id: '',
    product_id: productId,
    day_number: dayNumber,
    start_time: start,
    end_time: end,
    duration_minutes: start ? 60 : null,
    is_break: false,
    is_meal: false,
    is_transport: false,
    is_tour: false,
    show_to_customers: true,
    title_ko: null,
    title_en: null,
    description_ko: null,
    description_en: null,
    location_ko: null,
    location_en: null,
    content_i18n: {},
    guide_notes_ko: null,
    guide_notes_en: null,
    thumbnail_url: null,
    order_index: maxOrder + 1,
    two_guide_schedule: null,
    guide_driver_schedule: null,
    google_maps_link: null,
    no_time: false,
    latitude: null,
    longitude: null,
  }
}

function toCustomerItem(row: ProductScheduleAdminRow): CustomerScheduleItem {
  return {
    id: row.id,
    day_number: row.day_number,
    start_time: row.start_time,
    end_time: row.end_time,
    duration_minutes: row.duration_minutes,
    is_break: row.is_break,
    is_meal: row.is_meal,
    is_transport: row.is_transport,
    is_tour: row.is_tour,
    title_ko: row.title_ko,
    title_en: row.title_en,
    description_ko: row.description_ko,
    description_en: row.description_en,
    location_ko: row.location_ko,
    location_en: row.location_en,
    ...(row.content_i18n ? { content_i18n: row.content_i18n } : {}),
    thumbnail_url: row.thumbnail_url,
    google_maps_link: row.google_maps_link,
    show_to_customers: row.show_to_customers,
  }
}

export default function ProductScheduleWorkspace({
  productId,
  isNewProduct = false,
  locale: localeProp,
  compact = false,
  showPickup = true,
  onSaved,
  onDirtyChange,
}: ProductScheduleWorkspaceProps) {
  const { t, editorUiLocale, detailFieldLabel, showOnCustomerPage } =
    useCustomerPageEditLabels()
  const tf = (key: string, values?: Record<string, string | number>) =>
    values ? t(`scheduleEmbed.${key}`, values) : t(`scheduleEmbed.${key}`)
  const locale = normalizeAdminEditLocale(localeProp ?? 'ko')
  const [loading, setLoading] = useState(true)
  const [savingItem, setSavingItem] = useState(false)
  const [savingPickup, setSavingPickup] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [schedules, setSchedules] = useState<ProductScheduleAdminRow[]>([])
  const [rowId, setRowId] = useState<string | null>(null)
  const [pickupDropInfo, setPickupDropInfo] = useState('')
  const [pickupVisible, setPickupVisible] = useState(true)
  const [pickupSnapshot, setPickupSnapshot] = useState('')
  const [allExpanded, setAllExpanded] = useState(true)
  const [expandedSchedules, setExpandedSchedules] = useState<Set<string>>(new Set())
  const [showHidden, setShowHidden] = useState(false)
  const [modalItem, setModalItem] = useState<ProductScheduleAdminRow | null>(null)
  const [modalIsNew, setModalIsNew] = useState(false)

  const visibleSchedules = useMemo(
    () => schedules.filter((item) => item.show_to_customers !== false),
    [schedules]
  )
  const hiddenSchedules = useMemo(
    () => schedules.filter((item) => item.show_to_customers === false),
    [schedules]
  )
  const hiddenIds = useMemo(
    () => new Set(hiddenSchedules.map((item) => item.id)),
    [hiddenSchedules]
  )

  const loadData = useCallback(async () => {
    if (isNewProduct) {
      setLoading(false)
      return
    }
    setLoading(true)
    setMessage(null)
    try {
      const [details, scheduleResult] = await Promise.all([
        showPickup
          ? fetchProductDetailsForAdminEdit(productId, locale)
          : Promise.resolve(null),
        supabase
          .from('product_schedules')
          .select('*')
          .eq('product_id', productId)
          .order('day_number', { ascending: true })
          .order('order_index', { ascending: true })
          .order('start_time', { ascending: true }),
      ])

      if (scheduleResult.error) throw scheduleResult.error
      setSchedules((scheduleResult.data ?? []) as unknown as ProductScheduleAdminRow[])

      if (details) {
        const { row, values } = details
        const nextPickup = String(values.pickup_drop_info ?? '')
        const nextVisible = readPickupVisibility(values)
        setRowId(row?.id ? String(row.id) : null)
        setPickupDropInfo(nextPickup)
        setPickupVisible(nextVisible)
        setPickupSnapshot(JSON.stringify({ pickup: nextPickup, pickupVisible: nextVisible }))
      }
    } catch (error) {
      console.error('여행 일정 로드 오류:', error)
      setMessage({ text: tf('loadError'), type: 'error' })
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNewProduct, locale, productId, showPickup])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (!onDirtyChange) return
    if (!showPickup) {
      onDirtyChange(false)
      return
    }
    onDirtyChange(
      JSON.stringify({ pickup: pickupDropInfo, pickupVisible }) !== pickupSnapshot
    )
  }, [onDirtyChange, pickupDropInfo, pickupSnapshot, pickupVisible, showPickup])

  const getText = (koText: string, enText?: string) =>
    locale === 'ko' ? koText : enText || koText

  const getLocalizedText = (
    ko: string | null,
    en: string | null,
    fallback: string | null
  ) => {
    if (locale === 'ko') return ko || fallback || en || ''
    return en || fallback || ko || ''
  }

  const openNew = () => {
    if (isNewProduct) return
    setModalIsNew(true)
    setModalItem(buildNewItem(productId, schedules))
  }

  const persistItem = async (payload: ScheduleItemSavePayload) => {
    if (isNewProduct || !modalItem) return
    setSavingItem(true)
    setMessage(null)
    try {
      const body = {
        ...payload,
        product_id: productId,
        order_index: modalItem.order_index ?? schedules.length + 1,
        updated_at: new Date().toISOString(),
      }
      if (modalIsNew || !modalItem.id) {
        const { error } = await supabase.from('product_schedules').insert(body as never)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('product_schedules')
          .update(body as never)
          .eq('id', modalItem.id)
        if (error) throw error
      }
      setModalItem(null)
      setModalIsNew(false)
      await loadData()
      setMessage({ text: tf('saved'), type: 'success' })
      onSaved?.()
    } catch (error) {
      console.error('여행 일정 저장 오류:', error)
      setMessage({ text: `${tf('saveError')} ${formatSupabaseError(error)}`, type: 'error' })
    } finally {
      setSavingItem(false)
    }
  }

  const deleteItem = async (id: string) => {
    const target = schedules.find((item) => item.id === id)
    const label =
      getLocalizedText(target?.title_ko ?? null, target?.title_en ?? null, '') || tf('untitled', { index: '' })
    if (!window.confirm(tf('deleteConfirm', { name: label }))) return
    setMessage(null)
    try {
      const { error } = await supabase.from('product_schedules').delete().eq('id', id)
      if (error) throw error
      await loadData()
      setMessage({ text: tf('deleted'), type: 'success' })
      onSaved?.()
    } catch (error) {
      console.error('여행 일정 삭제 오류:', error)
      setMessage({ text: `${tf('deleteError')} ${formatSupabaseError(error)}`, type: 'error' })
    }
  }

  const savePickup = async () => {
    setSavingPickup(true)
    setMessage(null)
    try {
      const existingVisibility = await fetchDefaultProductDetailsCustomerPageVisibility(
        supabase,
        productId,
        locale as AdminEditLocale,
        rowId
      )
      const { id: savedRowId } = await upsertDefaultProductDetailsMultilingual(supabase, {
        productId,
        languageCode: locale as AdminEditLocale,
        existingRowId: rowId,
        patch: {
          pickup_drop_info: pickupDropInfo.trim() || null,
          customer_page_visibility: {
            ...existingVisibility,
            pickup_drop_info: pickupVisible,
          },
        },
      })
      setRowId(savedRowId)
      setPickupSnapshot(JSON.stringify({ pickup: pickupDropInfo, pickupVisible }))
      setMessage({ text: tf('saved'), type: 'success' })
      onDirtyChange?.(false)
      onSaved?.()
    } catch (error) {
      console.error('픽업 안내 저장 오류:', error)
      setMessage({ text: `${tf('saveError')} ${formatSupabaseError(error)}`, type: 'error' })
    } finally {
      setSavingPickup(false)
    }
  }

  const renderItinerary = (items: ProductScheduleAdminRow[], hideChrome = false) => (
    <TourScheduleCustomerItineraryView
      schedules={items.map(toCustomerItem)}
      locale={locale}
      allSchedulesExpanded={allExpanded}
      expandedSchedules={expandedSchedules}
      onToggleAll={() => setAllExpanded((current) => !current)}
      onToggleSchedule={(scheduleId) => {
        setExpandedSchedules((prev) => {
          const next = new Set(prev)
          if (next.has(scheduleId)) next.delete(scheduleId)
          else next.add(scheduleId)
          return next
        })
      }}
      getText={getText}
      getLocalizedText={getLocalizedText}
      interactive
      hiddenFromCustomerIds={hiddenIds}
      hiddenLabel={tf('hidden')}
      clickToEditLabel={tf('clickToEdit')}
      deleteLabel={tf('deleteItem')}
      onEditItem={(id) => {
        const target = schedules.find((item) => item.id === id)
        if (!target) return
        setModalIsNew(false)
        setModalItem(target)
      }}
      onDeleteItem={deleteItem}
      {...(hideChrome ? { hideChrome: true } : {})}
    />
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {tf('loading')}
      </div>
    )
  }

  return (
    <div className={compact ? 'space-y-4' : 'space-y-6'}>
      {compact ? null : (
        <div>
          <h3 className="text-lg font-semibold text-foreground">{tf('previewTitle')}</h3>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{tf('workspaceHint')}</p>
        </div>
      )}

      {isNewProduct ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {tf('saveAfterProduct')}
        </p>
      ) : null}

      {showPickup ? (
        <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
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
          <Button type="button" onClick={() => void savePickup()} disabled={savingPickup || isNewProduct}>
            {savingPickup ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {tf('savePickup')}
          </Button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-white shadow-sm">
        {visibleSchedules.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-medium text-foreground">{tf('empty')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{tf('emptyHint')}</p>
            <Button className="mt-4" type="button" onClick={openNew} disabled={isNewProduct}>
              <Plus className="mr-1.5 h-4 w-4" />
              {tf('addItem')}
            </Button>
          </div>
        ) : (
          <div className="px-4 py-5 sm:px-6">{renderItinerary(visibleSchedules)}</div>
        )}

        <div className="border-t border-dashed border-border/80 p-3">
          <button
            type="button"
            onClick={openNew}
            disabled={isNewProduct}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm font-medium text-muted-foreground transition hover:border-primary hover:bg-primary/5 hover:text-primary disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {tf('addItem')}
          </button>
        </div>
      </div>

      {hiddenSchedules.length > 0 ? (
        <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/50">
          <button
            type="button"
            onClick={() => setShowHidden((current) => !current)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <span className="text-sm font-medium text-amber-900">
              {tf('hiddenSection', { count: hiddenSchedules.length })}
            </span>
            <ChevronDown className={`h-4 w-4 text-amber-800 transition ${showHidden ? 'rotate-180' : ''}`} />
          </button>
          {showHidden ? (
            <div className="border-t border-amber-200/70 bg-white px-4 py-5 sm:px-6">
              <p className="mb-4 text-xs text-muted-foreground">{tf('hiddenSectionHint')}</p>
              {renderItinerary(hiddenSchedules, true)}
            </div>
          ) : null}
        </div>
      ) : null}

      {message ? (
        <p className={`text-sm ${message.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
          {message.text}
        </p>
      ) : null}

      <ScheduleItemEditModal
        open={Boolean(modalItem)}
        item={modalItem}
        isNew={modalIsNew}
        locale={locale}
        saving={savingItem}
        onClose={() => {
          setModalItem(null)
          setModalIsNew(false)
        }}
        onSave={(payload) => void persistItem(payload)}
      />
    </div>
  )
}
