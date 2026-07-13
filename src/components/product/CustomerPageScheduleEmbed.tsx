'use client'

import { useCallback, useEffect, useState } from 'react'
import { Clock, ExternalLink, Loader2, MapPin, Save } from 'lucide-react'
import LightRichEditor, { markdownToHtml } from '@/components/LightRichEditor'
import AdminEditLocaleToggle from '@/components/admin/AdminEditLocaleToggle'
import { fetchProductDetailsRowForLocale } from '@/lib/fetchProductDetail'
import { DETAIL_FIELD_LABELS } from '@/lib/customerPageZoneEditMap'
import { normalizeAdminEditLocale, type AdminEditLocale } from '@/lib/adminEditLocales'
import { supabase } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'

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
  order_index: number | null
}

type ScheduleForm = {
  title_ko: string
  title_en: string
  description_ko: string
  description_en: string
  location_ko: string
  location_en: string
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

function scheduleToForm(item: ScheduleItem): ScheduleForm {
  return {
    title_ko: item.title_ko ?? '',
    title_en: item.title_en ?? '',
    description_ko: item.description_ko ?? '',
    description_en: item.description_en ?? '',
    location_ko: item.location_ko ?? '',
    location_en: item.location_en ?? '',
    start_time: item.start_time ?? '',
    end_time: item.end_time ?? '',
    duration_minutes: item.duration_minutes != null ? String(item.duration_minutes) : '',
    show_to_customers: item.show_to_customers !== false,
  }
}

function getScheduleLabel(item: ScheduleItem, locale: AdminEditLocale): string {
  const title =
    locale === 'en'
      ? item.title_en || item.title_ko
      : item.title_ko || item.title_en
  const time = item.start_time ? item.start_time.slice(0, 5) : ''
  return [time, title || `일정 #${item.order_index ?? ''}`].filter(Boolean).join(' · ')
}

export default function CustomerPageScheduleEmbed({
  productId,
  locale: localeProp,
  onSaved,
  onDirtyChange,
  onOpenFullAdmin,
}: CustomerPageScheduleEmbedProps) {
  const [editLocale, setEditLocale] = useState<AdminEditLocale>(() =>
    normalizeAdminEditLocale(localeProp ?? 'ko')
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [rowId, setRowId] = useState<string | null>(null)
  const [pickupDropInfo, setPickupDropInfo] = useState('')
  const [pickupVisible, setPickupVisible] = useState(true)
  const [schedules, setSchedules] = useState<ScheduleItem[]>([])
  const [activeScheduleId, setActiveScheduleId] = useState<string | null>(null)
  const [scheduleForm, setScheduleForm] = useState<ScheduleForm>(scheduleToForm({
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
    order_index: null,
  }))
  const [initialSnapshot, setInitialSnapshot] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const [row, scheduleResult] = await Promise.all([
        fetchProductDetailsRowForLocale(productId, editLocale),
        supabase
          .from('product_schedules')
          .select(
            'id, day_number, start_time, end_time, duration_minutes, show_to_customers, title_ko, title_en, description_ko, description_en, location_ko, location_en, order_index'
          )
          .eq('product_id', productId)
          .order('day_number', { ascending: true })
          .order('order_index', { ascending: true })
          .order('start_time', { ascending: true }),
      ])

      if (scheduleResult.error) throw scheduleResult.error

      const nextSchedules = (scheduleResult.data ?? []) as ScheduleItem[]
      const first = nextSchedules[0] ?? null
      const nextPickup = String(row?.pickup_drop_info ?? '')

      setRowId(row?.id ? String(row.id) : null)
      setPickupDropInfo(nextPickup)
      setPickupVisible(readPickupVisibility(row))
      setSchedules(nextSchedules)
      setActiveScheduleId(first?.id ?? null)
      if (first) {
        const nextForm = scheduleToForm(first)
        setScheduleForm(nextForm)
        setInitialSnapshot(
          JSON.stringify({
            pickup: nextPickup,
            pickupVisible: readPickupVisibility(row),
            scheduleId: first.id,
            schedule: nextForm,
            locale: editLocale,
          })
        )
      } else {
        setInitialSnapshot(
          JSON.stringify({
            pickup: nextPickup,
            pickupVisible: readPickupVisibility(row),
            scheduleId: null,
            schedule: {},
            locale: editLocale,
          })
        )
      }
    } catch (error) {
      console.error('여행 일정 로드 오류:', error)
      setMessage('여행 일정 데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [editLocale, productId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    const active = schedules.find((item) => item.id === activeScheduleId)
    if (!active) return
    const nextForm = scheduleToForm(active)
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
      const existingVisibility =
        rowId != null
          ? ((
              await fromUntypedTable(supabase, 'product_details_multilingual')
                .select('customer_page_visibility')
                .eq('id', rowId)
                .maybeSingle()
            ).data as { customer_page_visibility?: Record<string, unknown> } | null)
          : null

      const mergedVisibility = {
        ...(existingVisibility?.customer_page_visibility ?? {}),
        pickup_drop_info: pickupVisible,
      }

      const detailPayload = {
        pickup_drop_info: pickupDropInfo.trim() || null,
        customer_page_visibility: mergedVisibility,
        updated_at: new Date().toISOString(),
      }

      if (rowId) {
        const { error } = await fromUntypedTable(supabase, 'product_details_multilingual')
          .update(detailPayload)
          .eq('id', rowId)
        if (error) throw error
      } else {
        const { data, error } = await fromUntypedTable(supabase, 'product_details_multilingual')
          .insert([
            {
              product_id: productId,
              language_code: editLocale,
              channel_id: null,
              variant_key: 'default',
              ...detailPayload,
            },
          ])
          .select('id')
          .single()
        if (error) throw error
        setRowId(String((data as { id: string }).id))
      }

      if (activeScheduleId) {
        const { error: scheduleError } = await supabase
          .from('product_schedules')
          .update({
            title_ko: scheduleForm.title_ko.trim() || null,
            title_en: scheduleForm.title_en.trim() || null,
            description_ko: scheduleForm.description_ko.trim() || null,
            description_en: scheduleForm.description_en.trim() || null,
            location_ko: scheduleForm.location_ko.trim() || null,
            location_en: scheduleForm.location_en.trim() || null,
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

        setSchedules((prev) =>
          prev.map((item) =>
            item.id === activeScheduleId
              ? {
                  ...item,
                  title_ko: scheduleForm.title_ko.trim() || null,
                  title_en: scheduleForm.title_en.trim() || null,
                  description_ko: scheduleForm.description_ko.trim() || null,
                  description_en: scheduleForm.description_en.trim() || null,
                  location_ko: scheduleForm.location_ko.trim() || null,
                  location_en: scheduleForm.location_en.trim() || null,
                  start_time: scheduleForm.start_time.trim() || null,
                  end_time: scheduleForm.end_time.trim() || null,
                  duration_minutes: scheduleForm.duration_minutes
                    ? Number(scheduleForm.duration_minutes)
                    : null,
                  show_to_customers: scheduleForm.show_to_customers,
                }
              : item
          )
        )
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
      setMessage('저장되었습니다.')
      onSaved?.()
    } catch (error) {
      console.error('여행 일정 저장 오류:', error)
      setMessage('저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const titleField = editLocale === 'en' ? 'title_en' : 'title_ko'
  const descriptionField = editLocale === 'en' ? 'description_en' : 'description_ko'
  const locationField = editLocale === 'en' ? 'location_en' : 'location_ko'

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        여행 일정 불러오는 중…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          DB: <code className="rounded bg-muted px-1">product_schedules</code> ·{' '}
          <code className="rounded bg-muted px-1">pickup_drop_info</code>
        </p>
        <AdminEditLocaleToggle
          value={editLocale}
          onChange={setEditLocale}
          groupLabel="일정 편집 언어"
          koLabel="한국어"
          enLabel="English"
        />
      </div>

      <div className="space-y-3 rounded-xl border border-border/60 bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold text-foreground">
              {DETAIL_FIELD_LABELS.pickup_drop_info}
            </h4>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              여행 일정 상단에 표시되는 픽업·드롭 안내
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={pickupVisible}
              onChange={(e) => setPickupVisible(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-ring"
            />
            고객 페이지 표시
          </label>
        </div>
        <LightRichEditor
          value={pickupDropInfo}
          onChange={(value) => setPickupDropInfo(value ?? '')}
          height={140}
          placeholder="픽업·드롭 안내 내용"
          enableResize
        />
        {pickupDropInfo ? (
          <div
            className="prose prose-sm max-w-none rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-2 text-foreground"
            dangerouslySetInnerHTML={{ __html: markdownToHtml(pickupDropInfo) }}
          />
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          일정 항목 ({schedules.length}개)
        </p>
        {schedules.length === 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            등록된 일정이 없습니다. 전체 화면에서 일정을 추가하세요.
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
                        {getScheduleLabel(item, editLocale)}
                        {hidden ? (
                          <span className="ml-1.5 text-[10px] text-amber-700">(숨김)</span>
                        ) : null}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Day {item.day_number}
                        {item.duration_minutes ? ` · ${item.duration_minutes}분` : ''}
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
          <h4 className="text-sm font-semibold text-foreground">선택한 일정 편집</h4>
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
            고객에게 표시 (show_to_customers)
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium">시작 시간</span>
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
              <span className="text-xs font-medium">종료 시간</span>
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
              <span className="text-xs font-medium">소요(분)</span>
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
            <span className="text-xs font-medium">
              {editLocale === 'en' ? 'title_en' : 'title_ko'}
            </span>
            <input
              value={scheduleForm[titleField]}
              onChange={(e) =>
                setScheduleForm((prev) => ({ ...prev, [titleField]: e.target.value }))
              }
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium">
              {editLocale === 'en' ? 'location_en' : 'location_ko'}
            </span>
            <input
              value={scheduleForm[locationField]}
              onChange={(e) =>
                setScheduleForm((prev) => ({ ...prev, [locationField]: e.target.value }))
              }
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium">
              {editLocale === 'en' ? 'description_en' : 'description_ko'}
            </span>
            <LightRichEditor
              value={scheduleForm[descriptionField]}
              onChange={(value) =>
                setScheduleForm((prev) => ({ ...prev, [descriptionField]: value }))
              }
              height={160}
              placeholder="일정 설명"
              enableResize
            />
          </label>

          {scheduleForm[descriptionField] ? (
            <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-2">
              <p className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                <MapPin className="h-3 w-3" />
                미리보기
              </p>
              <div
                className="prose prose-sm max-w-none text-foreground"
                dangerouslySetInnerHTML={{
                  __html: markdownToHtml(scheduleForm[descriptionField]),
                }}
              />
            </div>
          ) : null}
        </div>
      ) : null}

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

      {onOpenFullAdmin ? (
        <button
          type="button"
          onClick={() => onOpenFullAdmin('schedule')}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
        >
          일정 추가·삭제·순서 관리 (전체 화면)
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  )
}
