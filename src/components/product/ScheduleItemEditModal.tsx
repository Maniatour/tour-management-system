'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import LightRichEditor from '@/components/LightRichEditor'
import LocaleDropdown from '@/components/LocaleDropdown'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useCustomerPageEditLabels } from '@/hooks/useCustomerPageEditLabels'
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

export type ProductScheduleAdminRow = {
  id: string
  product_id: string
  day_number: number
  start_time: string | null
  end_time: string | null
  duration_minutes: number | null
  is_break: boolean | null
  is_meal: boolean | null
  is_transport: boolean | null
  is_tour: boolean | null
  show_to_customers: boolean | null
  title_ko: string | null
  title_en: string | null
  description_ko: string | null
  description_en: string | null
  location_ko: string | null
  location_en: string | null
  content_i18n?: ScheduleContentI18n | null
  guide_notes_ko: string | null
  guide_notes_en: string | null
  thumbnail_url: string | null
  order_index: number | null
  two_guide_schedule: string | null
  guide_driver_schedule: string | null
  google_maps_link: string | null
  no_time: boolean | null
  latitude: number | null
  longitude: number | null
}

export type ScheduleItemSavePayload = {
  day_number: number
  start_time: string | null
  end_time: string | null
  duration_minutes: number | null
  no_time: boolean
  is_break: boolean
  is_meal: boolean
  is_transport: boolean
  is_tour: boolean
  show_to_customers: boolean
  thumbnail_url: string | null
  google_maps_link: string | null
  two_guide_schedule: string | null
  guide_driver_schedule: string | null
  guide_notes_ko: string | null
  guide_notes_en: string | null
  content_i18n: ScheduleContentI18n
  title_ko: string | null
  title_en: string | null
  description_ko: string | null
  description_en: string | null
  location_ko: string | null
  location_en: string | null
}

type FormState = {
  titleDraft: string
  descriptionDraft: string
  locationDraft: string
  guideNotesKo: string
  guideNotesEn: string
  title_ko: string
  title_en: string
  description_ko: string
  description_en: string
  location_ko: string
  location_en: string
  content_i18n: ScheduleContentI18n
  day_number: string
  start_time: string
  end_time: string
  duration_minutes: string
  no_time: boolean
  show_to_customers: boolean
  is_break: boolean
  is_meal: boolean
  is_transport: boolean
  is_tour: boolean
  thumbnail_url: string
  google_maps_link: string
  two_guide_schedule: string
  guide_driver_schedule: string
}

type ScheduleItemEditModalProps = {
  open: boolean
  item: ProductScheduleAdminRow | null
  isNew?: boolean
  locale: string
  saving?: boolean
  onClose: () => void
  onSave: (payload: ScheduleItemSavePayload) => void
}

function sliceTime(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : ''
}

function toForm(item: ProductScheduleAdminRow | null, locale: AdminEditLocale): FormState {
  const source = item ?? {
    title_ko: null,
    title_en: null,
    description_ko: null,
    description_en: null,
    location_ko: null,
    location_en: null,
    content_i18n: {},
  }
  return {
    titleDraft: getScheduleExactText(source, 'title', locale),
    descriptionDraft: getScheduleExactText(source, 'description', locale),
    locationDraft: getScheduleExactText(source, 'location', locale),
    guideNotesKo: item?.guide_notes_ko ?? '',
    guideNotesEn: item?.guide_notes_en ?? '',
    title_ko: item?.title_ko ?? '',
    title_en: item?.title_en ?? '',
    description_ko: item?.description_ko ?? '',
    description_en: item?.description_en ?? '',
    location_ko: item?.location_ko ?? '',
    location_en: item?.location_en ?? '',
    content_i18n: item?.content_i18n || {},
    day_number: String(item?.day_number ?? 1),
    start_time: sliceTime(item?.start_time),
    end_time: sliceTime(item?.end_time),
    duration_minutes: item?.duration_minutes != null ? String(item.duration_minutes) : '',
    no_time: Boolean(item?.no_time),
    show_to_customers: item?.show_to_customers !== false,
    is_break: Boolean(item?.is_break),
    is_meal: Boolean(item?.is_meal),
    is_transport: Boolean(item?.is_transport),
    is_tour: Boolean(item?.is_tour),
    thumbnail_url: item?.thumbnail_url ?? '',
    google_maps_link: item?.google_maps_link ?? '',
    two_guide_schedule: item?.two_guide_schedule ?? '',
    guide_driver_schedule: item?.guide_driver_schedule ?? '',
  }
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export default function ScheduleItemEditModal({
  open,
  item,
  isNew = false,
  locale,
  saving = false,
  onClose,
  onSave,
}: ScheduleItemEditModalProps) {
  const { t, editorUiLocale } = useCustomerPageEditLabels()
  const tf = (key: string, values?: Record<string, string | number>) =>
    values ? t(`scheduleEmbed.${key}`, values) : t(`scheduleEmbed.${key}`)
  const [editLocale, setEditLocale] = useState<AdminEditLocale>(() =>
    normalizeAdminEditLocale(locale)
  )
  const [form, setForm] = useState<FormState>(() => toForm(item, normalizeAdminEditLocale(locale)))

  useEffect(() => {
    if (!open) return
    const nextLocale = normalizeAdminEditLocale(locale)
    setEditLocale(nextLocale)
    setForm(toForm(item, nextLocale))
  }, [item, locale, open])

  const localeLabel = getAdminEditLocaleLabel(editLocale)
  const flagFields = useMemo(
    () =>
      [
        { key: 'show_to_customers', label: tf('showToCustomers') },
        { key: 'is_tour', label: tf('flagTour') },
        { key: 'is_transport', label: tf('flagTransport') },
        { key: 'is_meal', label: tf('flagMeal') },
        { key: 'is_break', label: tf('flagBreak') },
        { key: 'no_time', label: tf('flagNoTime') },
      ] as const,
    [t]
  )

  const switchLocale = (next: AdminEditLocale) => {
    if (next === editLocale) return
    const merged = mergeScheduleI18n(
      form,
      editLocale,
      form.titleDraft,
      form.descriptionDraft,
      form.locationDraft
    )
    const source = { ...form, ...merged }
    setForm({
      ...form,
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

  const handleSave = () => {
    const merged = mergeScheduleI18n(
      form,
      editLocale,
      form.titleDraft,
      form.descriptionDraft,
      form.locationDraft
    )
    const title = getScheduleExactText(
      { ...form, ...merged },
      'title',
      editLocale
    )
    if (!title) {
      alert(tf('titleRequired'))
      return
    }
    onSave({
      day_number: Math.max(1, Number(form.day_number) || 1),
      start_time: form.no_time ? null : emptyToNull(form.start_time),
      end_time: form.no_time ? null : emptyToNull(form.end_time),
      duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
      no_time: form.no_time,
      is_break: form.is_break,
      is_meal: form.is_meal,
      is_transport: form.is_transport,
      is_tour: form.is_tour,
      show_to_customers: form.show_to_customers,
      thumbnail_url: emptyToNull(form.thumbnail_url),
      google_maps_link: emptyToNull(form.google_maps_link),
      two_guide_schedule: emptyToNull(form.two_guide_schedule),
      guide_driver_schedule: emptyToNull(form.guide_driver_schedule),
      guide_notes_ko: emptyToNull(form.guideNotesKo),
      guide_notes_en: emptyToNull(form.guideNotesEn),
      content_i18n: merged.content_i18n,
      title_ko: merged.title_ko,
      title_en: merged.title_en,
      description_ko: merged.description_ko,
      description_en: merged.description_en,
      location_ko: merged.location_ko,
      location_en: merged.location_en,
    })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        forceZIndex={10100}
        className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>{isNew ? tf('addItem') : tf('editItem')}</DialogTitle>
          <DialogDescription>{tf('modalHint')}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-end">
          <LocaleDropdown value={editLocale} onChange={switchLocale} showLabel />
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <label className="block space-y-1">
            <span className="text-xs font-medium">{tf('dayNumber')}</span>
            <input
              type="number"
              min={1}
              value={form.day_number}
              onChange={(e) => setForm((prev) => ({ ...prev, day_number: e.target.value }))}
              className="h-10 w-full rounded-lg border border-border px-3 text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium">{tf('startTime')}</span>
            <input
              type="time"
              value={form.start_time}
              disabled={form.no_time}
              onChange={(e) => setForm((prev) => ({ ...prev, start_time: e.target.value }))}
              className="h-10 w-full rounded-lg border border-border px-3 text-sm disabled:opacity-50"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium">{tf('endTime')}</span>
            <input
              type="time"
              value={form.end_time}
              disabled={form.no_time}
              onChange={(e) => setForm((prev) => ({ ...prev, end_time: e.target.value }))}
              className="h-10 w-full rounded-lg border border-border px-3 text-sm disabled:opacity-50"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium">{tf('duration')}</span>
            <input
              type="number"
              min={0}
              value={form.duration_minutes}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, duration_minutes: e.target.value }))
              }
              className="h-10 w-full rounded-lg border border-border px-3 text-sm"
            />
          </label>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {flagFields.map((field) => (
            <label key={field.key} className="inline-flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form[field.key]}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, [field.key]: e.target.checked }))
                }
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-ring"
              />
              {field.label}
            </label>
          ))}
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-medium">{tf('title', { locale: localeLabel })}</span>
          <input
            value={form.titleDraft}
            onChange={(e) => setForm((prev) => ({ ...prev, titleDraft: e.target.value }))}
            className="h-11 w-full rounded-lg border border-border px-3 text-sm"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium">{tf('location', { locale: localeLabel })}</span>
          <input
            value={form.locationDraft}
            onChange={(e) => setForm((prev) => ({ ...prev, locationDraft: e.target.value }))}
            className="h-11 w-full rounded-lg border border-border px-3 text-sm"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium">
            {tf('description', { locale: localeLabel })}
          </span>
          <LightRichEditor
            value={form.descriptionDraft}
            onChange={(value) =>
              setForm((prev) => ({ ...prev, descriptionDraft: value ?? '' }))
            }
            height={160}
            placeholder={tf('descriptionPlaceholder')}
            enableResize
            uiLocale={editorUiLocale}
            maxHeight={800}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium">{tf('thumbnailUrl')}</span>
          <input
            value={form.thumbnail_url}
            onChange={(e) => setForm((prev) => ({ ...prev, thumbnail_url: e.target.value }))}
            className="h-10 w-full rounded-lg border border-border px-3 text-sm"
          />
        </label>

        <details className="rounded-xl border border-border/70 bg-muted/20 p-3">
          <summary className="cursor-pointer text-sm font-medium text-foreground">
            {tf('advancedFields')}
          </summary>
          <div className="mt-3 space-y-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium">{tf('googleMaps')}</span>
              <input
                value={form.google_maps_link}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, google_maps_link: e.target.value }))
                }
                className="h-10 w-full rounded-lg border border-border px-3 text-sm"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-xs font-medium">{tf('twoGuide')}</span>
                <select
                  value={form.two_guide_schedule}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, two_guide_schedule: e.target.value }))
                  }
                  className="h-10 w-full rounded-lg border border-border px-3 text-sm"
                >
                  <option value="">{tf('unassigned')}</option>
                  <option value="guide">{tf('roleGuide')}</option>
                  <option value="assistant">{tf('roleAssistant')}</option>
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium">{tf('guideDriver')}</span>
                <select
                  value={form.guide_driver_schedule}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, guide_driver_schedule: e.target.value }))
                  }
                  className="h-10 w-full rounded-lg border border-border px-3 text-sm"
                >
                  <option value="">{tf('unassigned')}</option>
                  <option value="guide">{tf('roleGuide')}</option>
                  <option value="driver">{tf('roleDriver')}</option>
                  <option value="assistant">{tf('roleAssistant')}</option>
                </select>
              </label>
            </div>
            <label className="block space-y-1">
              <span className="text-xs font-medium">{tf('guideNotesKo')}</span>
              <textarea
                value={form.guideNotesKo}
                onChange={(e) => setForm((prev) => ({ ...prev, guideNotesKo: e.target.value }))}
                rows={2}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium">{tf('guideNotesEn')}</span>
              <textarea
                value={form.guideNotesEn}
                onChange={(e) => setForm((prev) => ({ ...prev, guideNotesEn: e.target.value }))}
                rows={2}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
          </div>
        </details>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            {tf('cancel')}
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {tf('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
