'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Save, Search, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import AdminEditLocaleToggle from '@/components/admin/AdminEditLocaleToggle'
import ContentLibraryLocaleBadges from '@/components/admin/ContentLibraryLocaleBadges'
import { getAdminEditLocaleLabel, normalizeAdminEditLocale, type AdminEditLocale } from '@/lib/adminEditLocales'
import { supabase } from '@/lib/supabase'
import type { SiteLocale } from '@/lib/siteLocales'
import {
  TOUR_AUDIENCE_KIND_LABELS,
  buildTourAudienceLibraryPayload,
  fetchTourAudienceLibrary,
  getTourAudienceFilledLocales,
  getTourAudienceLocalizedText,
  tourAudienceDraftFromLibraryItem,
  type TourAudienceKind,
  type TourAudienceLibraryItem,
} from '@/lib/tourAudienceLibrary'

type TourAudienceDraft = {
  name: string
  titleByLocale: Partial<Record<SiteLocale, string>>
  audienceKind: TourAudienceKind
}

const INPUT_CLASS = 'w-full rounded-lg border border-border px-3 py-2 text-sm'

function emptyTourAudienceDraft(): TourAudienceDraft {
  return { name: '', titleByLocale: {}, audienceKind: 'recommended' }
}

type TourAudienceLibraryManagerPanelProps = {
  onMutated?: () => void
  listMaxHeight?: string
}

export default function TourAudienceLibraryManagerPanel({
  onMutated,
  listMaxHeight = 'max-h-[60vh]',
}: TourAudienceLibraryManagerPanelProps) {
  const t = useTranslations('products.customerPageEdit.tourAudienceLibraryManager')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [items, setItems] = useState<TourAudienceLibraryItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<TourAudienceDraft>(emptyTourAudienceDraft)
  const [editLocale, setEditLocale] = useState<AdminEditLocale>('ko')

  const loadItems = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      setItems(await fetchTourAudienceLibrary(supabase as never, { activeOnly: false }))
    } catch (error) {
      console.error(error)
      setMessage(t('loadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((item) => {
      if (item.is_active === false) return false
      if (!q) return true
      const hay = `${item.name} ${getTourAudienceLocalizedText(item, 'ko')} ${getTourAudienceLocalizedText(item, 'en')}`.toLowerCase()
      return hay.includes(q)
    })
  }, [items, search])

  const startNew = () => {
    setSelectedId(null)
    setDraft(emptyTourAudienceDraft())
  }

  const localeLabel = getAdminEditLocaleLabel(editLocale)
  const draftLocales = getTourAudienceFilledLocales({
    content_i18n: { title: draft.titleByLocale },
  })

  const saveItem = async () => {
    if (!Object.values(draft.titleByLocale).some((v) => v?.trim())) {
      setMessage(t('validationError'))
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      const payload = {
        ...buildTourAudienceLibraryPayload({
          name: draft.name,
          titleByLocale: draft.titleByLocale,
          audienceKind: draft.audienceKind,
        }),
        updated_at: new Date().toISOString(),
      }
      if (selectedId) {
        const { error } = await supabase
          .from('tour_audience_library')
          .update(payload as never)
          .eq('id', selectedId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('tour_audience_library')
          .insert([payload] as never)
          .select('*')
          .single()
        if (error) throw error
        setSelectedId(String((data as { id: string }).id))
      }
      setMessage(t('saveSuccess'))
      await loadItems()
      onMutated?.()
    } catch (error) {
      console.error(error)
      setMessage(t('saveError'))
    } finally {
      setSaving(false)
    }
  }

  const deactivateItem = async (id: string) => {
    if (!confirm(t('deactivateConfirm'))) return
    await supabase.from('tour_audience_library').update({ is_active: false } as never).eq('id', id)
    if (selectedId === id) startNew()
    await loadItems()
    onMutated?.()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{t('hint')}</p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm"
        />
      </div>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-2 rounded-xl border border-border/60 bg-card p-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">{t('listTitle')}</h2>
            <button
              type="button"
              onClick={startNew}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('newButton')}
            </button>
          </div>
          <div className={`${listMaxHeight} space-y-1.5 overflow-y-auto`}>
            {filteredItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSelectedId(item.id)
                  setDraft(tourAudienceDraftFromLibraryItem(item))
                }}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                  selectedId === item.id ? 'border-primary/40 bg-primary/5' : 'border-border hover:bg-muted/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 font-medium">
                    {item.name ||
                      getTourAudienceLocalizedText(item, 'ko').slice(0, 60) ||
                      t('unnamed')}
                  </div>
                  <ContentLibraryLocaleBadges locales={getTourAudienceFilledLocales(item)} />
                </div>
                <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {TOUR_AUDIENCE_KIND_LABELS[item.audience_kind].ko}
                </div>
                <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                  {getTourAudienceLocalizedText(item, 'ko') || getTourAudienceLocalizedText(item, 'en')}
                </div>
              </button>
            ))}
            {filteredItems.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">{t('emptyList')}</p>
            ) : null}
          </div>
        </div>
        <div className="space-y-3 rounded-xl border border-border/60 bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">{selectedId ? t('editTitle') : t('newTitle')}</h2>
            <AdminEditLocaleToggle
              value={editLocale}
              onChange={(next) => setEditLocale(normalizeAdminEditLocale(next))}
              groupLabel={t('editLocaleGroup')}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">{t('localeHint')}</p>
          <label className="block space-y-1">
            <span className="text-xs font-medium">{t('adminName')}</span>
            <input
              value={draft.name}
              onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
              className={INPUT_CLASS}
              placeholder={t('adminNamePlaceholder')}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium">{t('audienceKind')}</span>
            <select
              value={draft.audienceKind}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  audienceKind: e.target.value as TourAudienceKind,
                }))
              }
              className={`${INPUT_CLASS} bg-background`}
            >
              <option value="recommended">{TOUR_AUDIENCE_KIND_LABELS.recommended.ko}</option>
              <option value="not_recommended">{TOUR_AUDIENCE_KIND_LABELS.not_recommended.ko}</option>
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium">{t('title', { locale: localeLabel })}</span>
            <input
              value={draft.titleByLocale[editLocale] ?? ''}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  titleByLocale: { ...prev.titleByLocale, [editLocale]: e.target.value },
                }))
              }
              className={INPUT_CLASS}
            />
          </label>
          <ContentLibraryLocaleBadges locales={draftLocales} />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void saveItem()}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t('save')}
            </button>
            {selectedId ? (
              <button
                type="button"
                onClick={() => void deactivateItem(selectedId)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                <Trash2 className="h-4 w-4" />
                {t('deactivate')}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
